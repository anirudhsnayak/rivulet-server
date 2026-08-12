import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import DB from '../client/DatabaseClient';
import { requireAuth } from '../middlewares/authMiddleware';
import { id, text, fail, membership, channel, canManage } from '../services/permissions';
import { streams } from '../sse/streams';

const router = Router();
router.use(requireAuth);
const servers = async (userId: number) => (await DB.query(`
  SELECT s.server_id, s.server_name,
    CASE WHEN s.owner_id=sm.user_id THEN 'creator' ELSE sm.role END AS role
  FROM servers s JOIN server_members sm USING (server_id)
  WHERE sm.user_id=$1 ORDER BY s.server_id`, [userId])).rows;

router.post('/user', async (req, res) => {
  res.json({ servers: await servers(req.session.userId!) });
});
router.post('/server', async (req, res) => {
  const name = text(req.body?.serverName, 50), userId = req.session.userId!;
  const serverId = await DB.transaction(async c => {
    const sid = (await c.query('INSERT INTO servers(server_name,owner_id) VALUES($1,$2) RETURNING server_id', [name, userId])).rows[0].server_id;
    await c.query('INSERT INTO server_members(user_id,server_id) VALUES($1,$2)', [userId, sid]);
    await c.query('INSERT INTO channel_sequences(server_id,max_id) VALUES($1,1)', [sid]);
    await c.query("INSERT INTO channels(server_id,channel_id,name) VALUES($1,1,'general')", [sid]);
    await c.query('INSERT INTO message_sequences(server_id,channel_id,max_id) VALUES($1,1,0)', [sid]);
    await c.query('INSERT INTO server_invites(server_id,invite_code) VALUES($1,$2)', [sid, randomBytes(16).toString('hex')]);
    return sid;
  });
  res.json({ servers: await servers(userId), created_server_id: serverId });
});
router.post('/server/join', async (req, res) => {
  const code = text(req.body?.invite_code, 256), userId = req.session.userId!;
  await DB.transaction(async c => {
    const server = (await c.query('SELECT s.server_id FROM servers s JOIN server_invites i USING(server_id) WHERE invite_code=$1 FOR UPDATE OF s', [code])).rows[0];
    if (!server) fail(404, 'Invalid invite code');
    await c.query('INSERT INTO server_members(user_id,server_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, server.server_id]);
  });
  await streams.refresh();
  res.json({ servers: await servers(userId) });
});
router.post('/server/invite', async (req, res) => {
  const sid = id(req.body?.serverId);
  const code = await DB.transaction(async c => {
    await membership(c, sid, req.session.userId!);
    return (await c.query(`INSERT INTO server_invites(server_id,invite_code) VALUES($1,$2)
      ON CONFLICT(server_id) DO UPDATE SET invite_code=server_invites.invite_code RETURNING invite_code`,
    [sid, randomBytes(16).toString('hex')])).rows[0].invite_code;
  });
  res.json({ invite_code: code });
});
for (const leaving of [false, true]) {
  router.post(leaving ? '/server/leave' : '/server/ownership', async (req, res) => {
    const sid = id(req.body?.serverId), userId = req.session.userId!;
    await DB.transaction(async c => {
      const role = await membership(c, sid, userId);
      if (!leaving && role !== 'creator') fail(403, 'Only the creator can transfer ownership');
      if (role === 'creator') {
        const successor = id(req.body?.successorUserId);
        if (successor === userId) fail(400, 'Choose a different current member');
        if (!(await c.query('SELECT 1 FROM server_members WHERE server_id=$1 AND user_id=$2', [sid, successor])).rowCount) fail(400, 'Successor must be a current member');
        await c.query('UPDATE servers SET owner_id=$2 WHERE server_id=$1', [sid, successor]);
        await c.query("UPDATE server_members SET role=CASE WHEN user_id=$2 THEN 'member' ELSE 'admin' END WHERE server_id=$1 AND user_id IN ($2,$3)", [sid, successor, userId]);
      }
      if (leaving) await c.query('DELETE FROM server_members WHERE server_id=$1 AND user_id=$2', [sid, userId]);
    });
    await streams.refresh();
    res.json({ message: leaving ? 'Left server successfully' : 'Ownership transferred' });
  });
}
router.get('/member', async (req, res) => {
  const sid = id(req.query.serverId);
  const members = await DB.transaction(async c => {
    await membership(c, sid, req.session.userId!);
    return (await c.query(`SELECT sm.user_id,sm.server_id,u.username,
      CASE WHEN s.owner_id=sm.user_id THEN 'creator' ELSE sm.role END AS role
      FROM server_members sm JOIN users u USING(user_id) JOIN servers s USING(server_id)
      WHERE sm.server_id=$1 ORDER BY sm.joined_at,sm.user_id`, [sid])).rows;
  });
  res.json({ members });
});
for (const kicking of [true, false]) {
  const handler: import('express').RequestHandler = async (req, res) => {
    const sid = id(req.body?.serverId), target = id(req.body?.userId), actor = req.session.userId!;
    await DB.transaction(async c => {
      const role = await membership(c, sid, actor);
      if (kicking) canManage(role);
      else if (role !== 'creator') fail(403, 'Only the creator can change roles');
      const targetRole = await membership(c, sid, target);
      if (target === actor || targetRole === 'creator') fail(403, 'Cannot target yourself or the creator');
      if (kicking) await c.query('DELETE FROM server_members WHERE server_id=$1 AND user_id=$2', [sid, target]);
      else {
        if (!['member', 'admin'].includes(req.body?.role)) fail(400, 'Role must be member or admin');
        await c.query('UPDATE server_members SET role=$3 WHERE server_id=$1 AND user_id=$2', [sid, target, req.body.role]);
      }
    });
    await streams.refresh();
    res.json({ message: kicking ? 'Member removed' : 'Role updated' });
  };
  if (kicking) router.post('/member/kick', handler);
  else router.patch('/member/role', handler);
}
router.get('/channel', async (req, res) => {
  const sid = id(req.query.serverId);
  const channels = await DB.transaction(async c => {
    await membership(c, sid, req.session.userId!);
    return (await c.query('SELECT * FROM channels WHERE server_id=$1 ORDER BY channel_id', [sid])).rows;
  });
  res.json({ channels });
});
router.post('/channel', async (req, res) => {
  const sid = id(req.body?.serverId), name = text(req.body?.channelName, 100);
  const created = await DB.transaction(async c => {
    canManage(await membership(c, sid, req.session.userId!));
    const seq = (await c.query('UPDATE channel_sequences SET max_id=max_id+1 WHERE server_id=$1 RETURNING max_id', [sid])).rows[0];
    const row = (await c.query('INSERT INTO channels(server_id,channel_id,name) VALUES($1,$2,$3) RETURNING *', [sid, seq.max_id, name])).rows[0];
    await c.query('INSERT INTO message_sequences(server_id,channel_id,max_id) VALUES($1,$2,0)', [sid, seq.max_id]);
    return row;
  });
  res.json(created);
});
router.delete('/channel', async (req, res) => {
  const sid = id(req.body?.serverId), cid = id(req.body?.channelId);
  const deleted = await DB.transaction(async c => {
    canManage(await membership(c, sid, req.session.userId!));
    await channel(c, sid, cid);
    return (await c.query('DELETE FROM channels WHERE server_id=$1 AND channel_id=$2 RETURNING *', [sid, cid])).rows[0];
  });
  await streams.refresh();
  res.json({ channel: deleted });
});
router.get('/message', async (req, res) => {
  const sid = id(req.query.serverId), cid = id(req.query.channelId);
  const messages = await DB.transaction(async c => {
    await membership(c, sid, req.session.userId!);
    await channel(c, sid, cid);
    return (await c.query(`SELECT m.server_id AS guild_id,m.channel_id,m.message_id,m.user_id,m.message_text,
      COALESCE(u.username,'user-' || m.user_id) AS author_name FROM messages m LEFT JOIN users u USING(user_id)
      WHERE m.server_id=$1 AND m.channel_id=$2 ORDER BY m.message_id`, [sid, cid])).rows;
  });
  res.json({ messages });
});
router.post('/message', async (req, res) => {
  const sid = id(req.body?.serverId), cid = id(req.body?.channelId), content = text(req.body?.messageText, 1024);
  const message = await DB.transaction(async c => {
    await membership(c, sid, req.session.userId!);
    await channel(c, sid, cid);
    return (await c.query(`WITH next AS (
      UPDATE message_sequences SET max_id=max_id+1 WHERE server_id=$1 AND channel_id=$2 RETURNING max_id
    ) INSERT INTO messages(server_id,channel_id,message_id,user_id,message_text)
      SELECT $1,$2,max_id,$3,$4 FROM next
      RETURNING server_id AS guild_id,channel_id,message_id,user_id,message_text,
      (SELECT username FROM users WHERE user_id=$3) AS author_name`, [sid, cid, req.session.userId!, content])).rows[0];
  });
  await streams.message(message);
  res.json(message);
});
router.get('/presence', (req, res, next) => { streams.open(req, res, 'presence').catch(next); });
router.get('/sse/events', (req, res, next) => { streams.open(req, res, 'messages').catch(next); });
export default router;
