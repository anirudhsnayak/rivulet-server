# Rivulet Server

Express 5 / PostgreSQL API for the Rivulet frontend. Supports accounts and cookie sessions, servers and invites, channels and messages, server roles, member moderation, ownership transfer, and SSE presence and messages.

## Database setup or upgrade

Stop the API before migrating. From this repository in PowerShell, using the existing Docker container:

Start Docker Desktop, then run `npm run db:start` first. This command starts
`rivulet-postgres` if it exists, or creates it using `.env` credentials, the
`POSTGRES_PORT` setting (default 5432), and the persistent `rivulet-data` volume.
New containers bind to localhost. Existing containers keep their original
configuration and data. The command waits for PostgreSQL to become ready and
can be rerun. It does not apply migrations. From the frontend directory, the
same command is available as `npm run dev:db`.

Stop the API, then apply the migration using the same `.env` database settings as the server:

```powershell
npm run db:migrate
```

Restart the API afterward. This adds missing membership roles and widens legacy
`char(16)` invite codes to `varchar(256)`, preserving existing invites and accounts.
From the frontend directory, use `npm run dev:db:migrate`.

Alternatively, with Docker:

```powershell
Get-Content -Raw ./db/migrations/001_feature_parity.sql | docker exec -i rivulet-postgres psql -v ON_ERROR_STOP=1 -U postgres -d rivulet-db
```

Replace the user/database names if your PostgreSQL configuration differs. For a local psql installation:

```powershell
psql -v ON_ERROR_STOP=1 -U postgres -d rivulet-db -f ./db/migrations/001_feature_parity.sql
```

Or, inside a local psql session launched from this repository:

```psql
\set ON_ERROR_STOP on
\i db/migrations/001_feature_parity.sql
```

The same migration initializes an empty database or upgrades the original schema. It preserves existing data, fills missing counters, and can be rerun. Existing owner IDs are retained. Servers without an owner use their earliest valid member (joined_at, then user_id). If a server has neither an owner nor valid members, the migration rolls back and asks you to assign an existing user to servers.owner_id. Invalid existing references or duplicate invite codes also fail instead of deleting data.

The creator role is derived from servers.owner_id. Stored membership roles are member/admin. A deferred composite foreign key requires every server owner to remain a member; server creation and ownership changes use transactions on dedicated pool connections. All server operations lock the server before checking membership. Deleting a channel cascades to messages and message counters.

`db/schema.sql` is a psql entry point that includes the migration relative to itself. When piping SQL into Docker, use the migration directly as above.

## Run

Install dependencies with `npm install`, then create `.env`:

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_DB=rivulet-db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
PORT=3000
SESSION_SECRET=your-random-session-secret
```

Start the API with `npm run dev`. In the frontend repository, add `VITE_API_MODE=psql` to `.env.local` and restart Vite. Without that setting the frontend retains its local development adapter. The API allows credentialed browser requests from `http://localhost:5173`.

## API

All routes except signup/login/logout require a session cookie. Send `credentials: 'include'` in browser requests. All IDs are positive integers. Errors use a non-success HTTP status with JSON `{ message }`.

| Method | Path | Input / behavior |
| --- | --- | --- |
| POST | /api/account/signup | `{ username, hash }`; SHA-256 hex hash, creates session |
| POST | /api/account/login | `{ username, hash }`; regenerates session |
| POST | /api/account/logout | Destroys session and disconnects its streams |
| GET | /api/account/session | Returns `{ user_id, username }` |
| POST | /api/user | Returns `{ servers }` with the current user's role |
| POST | /api/server | `{ serverName }`; creator membership, general channel, invite, counters in one transaction |
| POST | /api/server/join | `{ invite_code }`; repeat joins preserve existing roles |
| POST | /api/server/invite | `{ serverId }`; any current member |
| POST | /api/server/ownership | `{ serverId, successorUserId }`; creator only, successor must be another member; former creator becomes admin |
| POST | /api/server/leave | `{ serverId, successorUserId? }`; creator must supply a current member as successor |
| GET | /api/member | `?serverId=...`; members include role |
| POST | /api/member/kick | `{ serverId, userId }`; admin/creator; cannot kick self or creator |
| PATCH | /api/member/role | `{ serverId, userId, role }`; creator only, role member/admin, cannot target creator |
| GET | /api/channel | `?serverId=...`; membership required |
| POST | /api/channel | `{ serverId, channelName }`; admin/creator |
| DELETE | /api/channel | `{ serverId, channelId }`; admin/creator; cascades messages |
| GET | /api/message | `?serverId=...&channelId=...`; membership and channel checked |
| POST | /api/message | `{ serverId, channelId, messageText }`; author from session |
| GET | /api/presence | `?serverIds=1,2`; authorize every requested server |
| GET | /api/sse/events | `?serverId=...&channelId=...`; authenticated channel stream |

Presence emits named `presence:snapshot` events with `{ servers: [{ serverId, onlineUserIds }] }` immediately, on changes, and every 15 seconds. Counts presence connections per user across tabs. Online users are filtered by server membership. Message streams emit `ready` on subscription and `message:created` with the same message shape as the HTTP API (`guild_id`, `channel_id`, `message_id`, `user_id`, `message_text`, `author_name`). The frontend reloads history on readiness/events/reconnects. Heartbeats run every 15 seconds. Kicks, departures, and logout revoke existing streams; periodic checks cover session expiry or external membership changes.

The active protected API is in `src/routes/apiRoutes.ts`; `src/services/permissions.ts` provides shared authorization and `src/sse/streams.ts` manages streams. Earlier resource routers/controllers remain unmounted. `DatabaseClient` uses a pool and dedicated transaction clients.

Sessions and presence are process-local: run one API instance. Restarting clears sessions/presence, while PostgreSQL data persists. Multiple instances require shared sessions and presence/pubsub. Password handling retains the frontend's existing SHA-256 protocol.

## Verification

`npm run typecheck` checks TypeScript. `npm test` runs integration tests when `RIVULET_TEST_DATABASE_URL` points to an **empty disposable database whose name ends in _test**; otherwise it skips the database suite. Tests create their own tables and do not use `.env` application credentials.

```powershell
$env:RIVULET_TEST_DATABASE_URL='postgresql://postgres:test-password@localhost:55439/rivulet_parity_test'
npm test
```

Tests cover legacy migration and repeat application, permissions, creator protection, concurrent messages, cascade deletion, presence across tabs, live messages, kicks/rejoin roles, ownership transfer/leave, and logout.
