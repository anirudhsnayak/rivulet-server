-- Works on an empty database and upgrades the original Rivulet schema.
-- Stop the API before applying. The whole migration rolls back on failure.
BEGIN;
CREATE SEQUENCE IF NOT EXISTS public.user_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.server_id_seq;
CREATE TABLE IF NOT EXISTS public.users (
  user_id integer PRIMARY KEY DEFAULT nextval('public.user_id_seq'),
  username varchar(50) NOT NULL UNIQUE,
  password_hash char(64) NOT NULL,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.servers (
  server_id integer PRIMARY KEY DEFAULT nextval('public.server_id_seq'),
  server_name varchar(50) NOT NULL,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  owner_id integer
);
CREATE TABLE IF NOT EXISTS public.server_members (
  user_id integer NOT NULL,
  server_id integer NOT NULL REFERENCES public.servers ON DELETE CASCADE,
  joined_at timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,server_id)
);
CREATE TABLE IF NOT EXISTS public.channels (
  server_id integer NOT NULL REFERENCES public.servers ON DELETE CASCADE,
  channel_id integer NOT NULL,
  name varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(server_id,channel_id)
);
CREATE TABLE IF NOT EXISTS public.messages (
  server_id integer NOT NULL,
  channel_id integer NOT NULL,
  message_id integer NOT NULL,
  user_id integer NOT NULL,
  message_text varchar(1024) NOT NULL,
  PRIMARY KEY(server_id,channel_id,message_id)
);
CREATE TABLE IF NOT EXISTS public.channel_sequences (
  server_id integer PRIMARY KEY REFERENCES public.servers ON DELETE CASCADE,
  max_id integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.message_sequences (
  server_id integer NOT NULL,
  channel_id integer NOT NULL,
  max_id integer NOT NULL DEFAULT 0,
  PRIMARY KEY(server_id,channel_id)
);
CREATE TABLE IF NOT EXISTS public.server_invites (
  server_id integer PRIMARY KEY REFERENCES public.servers ON DELETE CASCADE,
  invite_code varchar(256) NOT NULL UNIQUE
);

ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS owner_id integer;
ALTER TABLE public.server_members ADD COLUMN IF NOT EXISTS role varchar(10) NOT NULL DEFAULT 'member';
-- The API derives 'creator' from servers.owner_id; there is one source of truth.
UPDATE public.servers s SET owner_id=(
  SELECT sm.user_id FROM public.server_members sm JOIN public.users u USING(user_id)
  WHERE sm.server_id=s.server_id ORDER BY sm.joined_at NULLS LAST,sm.user_id LIMIT 1
) WHERE owner_id IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.servers WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'A server has no owner and no valid members. Assign servers.owner_id to an existing user, then rerun this migration.';
  END IF;
END $$;
INSERT INTO public.server_members(user_id,server_id)
SELECT owner_id,server_id FROM public.servers ON CONFLICT DO NOTHING;
UPDATE public.server_members SET role='member' WHERE role='creator';
ALTER TABLE public.server_members ALTER COLUMN role SET DEFAULT 'member';
ALTER TABLE public.server_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.server_members DROP CONSTRAINT IF EXISTS rivulet_member_role;
ALTER TABLE public.server_members ADD CONSTRAINT rivulet_member_role CHECK(role IN ('member','admin'));
ALTER TABLE public.servers ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.server_members DROP CONSTRAINT IF EXISTS rivulet_member_user;
ALTER TABLE public.server_members ADD CONSTRAINT rivulet_member_user FOREIGN KEY(user_id) REFERENCES public.users(user_id);
-- Deferrable so server creation and ownership transfer can be committed atomically.
ALTER TABLE public.servers DROP CONSTRAINT IF EXISTS rivulet_owner_member;
ALTER TABLE public.servers ADD CONSTRAINT rivulet_owner_member
  FOREIGN KEY(owner_id,server_id) REFERENCES public.server_members(user_id,server_id)
  DEFERRABLE INITIALLY DEFERRED;

-- Replace any old channel FKs so channel deletion removes messages/counters.
DO $$ DECLARE constraint_row record; BEGIN
  FOR constraint_row IN
    SELECT conrelid::regclass AS tab,conname FROM pg_constraint
    WHERE contype='f' AND confrelid='public.channels'::regclass
      AND conrelid IN ('public.messages'::regclass,'public.message_sequences'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',constraint_row.tab,constraint_row.conname);
  END LOOP;
END $$;
ALTER TABLE public.messages ADD CONSTRAINT rivulet_message_channel
  FOREIGN KEY(server_id,channel_id) REFERENCES public.channels(server_id,channel_id) ON DELETE CASCADE;
ALTER TABLE public.message_sequences ADD CONSTRAINT rivulet_counter_channel
  FOREIGN KEY(server_id,channel_id) REFERENCES public.channels(server_id,channel_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS rivulet_invite_server ON public.server_invites(server_id);
CREATE UNIQUE INDEX IF NOT EXISTS rivulet_invite_code ON public.server_invites(invite_code);
CREATE INDEX IF NOT EXISTS rivulet_members_server ON public.server_members(server_id,user_id);
INSERT INTO public.channel_sequences(server_id,max_id)
SELECT s.server_id,COALESCE(MAX(c.channel_id),0) FROM public.servers s
LEFT JOIN public.channels c USING(server_id) GROUP BY s.server_id
ON CONFLICT(server_id) DO UPDATE SET max_id=GREATEST(channel_sequences.max_id,EXCLUDED.max_id);
INSERT INTO public.message_sequences(server_id,channel_id,max_id)
SELECT c.server_id,c.channel_id,COALESCE(MAX(m.message_id),0) FROM public.channels c
LEFT JOIN public.messages m USING(server_id,channel_id) GROUP BY c.server_id,c.channel_id
ON CONFLICT(server_id,channel_id) DO UPDATE SET max_id=GREATEST(message_sequences.max_id,EXCLUDED.max_id);
-- Preserve counters that are already ahead of the stored data.
SELECT setval('public.user_id_seq',GREATEST((SELECT last_value FROM public.user_id_seq),COALESCE((SELECT MAX(user_id) FROM public.users),1)),true);
SELECT setval('public.server_id_seq',GREATEST((SELECT last_value FROM public.server_id_seq),COALESCE((SELECT MAX(server_id) FROM public.servers),1)),true);
COMMIT;
