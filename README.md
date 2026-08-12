# Rivulet Server

The backend for [Rivulet](https://github.com/anirudhsnayak/rivulet), a Discord-like chat application with servers, channels, and real-time messaging.

This is an Express 5 HTTP API backed by PostgreSQL, written in TypeScript and run directly on Node via `tsx`. It handles account creation and session-based login, servers and invites, channels, messages, member lists, and a Server-Sent Events endpoint. It is a companion to the React frontend, which talks to it at `http://localhost:3000/api/*` when its `API_MODE` is set to `'psql'`.

## Features

- **Account creation, login, and logout** 
- **Servers** 
- **Invites** 
- **Channels** 
- **Messages** 
- **Member lists** 
- **Server-Sent Events** 
- **Verbosity-gated logging**

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Language | TypeScript 5.9 (`strict`) |
| Database | PostgreSQL via `pg` (single shared client) |
| Sessions | `express-session` (in-memory store, `connect.sid` cookie) |
| Real-time | Server-Sent Events |
| Dev runner | `tsx --env-file` |
| Config | `dotenv` |

## Getting started

**Prerequisites:** Node.js `>=20.6` (for the native `--env-file` flag) and Docker, or a local PostgreSQL instance.

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL — runs a postgres:latest container named `rivulet-postgres`
./docker.sh

# 3. Create the schema
docker exec -i rivulet-postgres psql -U postgres -d rivulet-db < db/schema.sql

# 4. Create a .env file (see the table below)

# 5. Start the API
npm run dev
```

You should see `Server running on port 3000`.

**Start PostgreSQL before the API.** The database connection is opened when the app module loads, and a failed connection is an unhandled rejection that kills the process rather than a recoverable error.

`./rivulet-psql.sh` opens a `psql` shell inside the running container.

### Environment variables

`.env` is gitignored. It is read twice — once by `tsx --env-file` and again by `dotenv` in [config.ts](src/config/config.ts) — and also sourced by `docker.sh`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the API listens on |
| `NODE_ENV` | `development` | Environment name, exposed on `config.nodeEnv` |
| `POSTGRES_USER` | — | Database user (`DatabaseClient` and `docker.sh`) |
| `POSTGRES_PASSWORD` | — | Database password |
| `POSTGRES_DB` | — | Database name |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_VOLUME` | `./rivulet-data` | Declared in `.env` but unused — `docker.sh` mounts the named volume `rivulet-data` instead |

The host is hardcoded to `localhost` in [DatabaseClient.ts](src/client/DatabaseClient.ts).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the API with `tsx`, loading `.env` and resolving `src/server.js` to [src/server.ts](src/server.ts) |
| `npm test` | Not implemented — exits with an error |

There is no build, lint, or start script yet, even though `eslint`, `prettier`, and `typescript` are installed as dev dependencies.

## Project structure

```
src/
├── server.ts        Entry point — listens on config.port, closes the DB on SIGINT
├── app.ts           Wiring: JSON body parsing, CORS, sessions, route mounting, error handler
├── routes/          One Express router per resource, mounted under /api/*
├── controllers/     Request handlers — read the request, call the DB layer, shape JSON
│   ├── accountController.ts     login / signup / logout
│   ├── userController.ts        the whole user model (servers) for the client
│   └── rivulet-main/            server, channel, message, member controllers
├── db/              Data access — one exported function per parameterized query
│   ├── accountDatabase.ts
│   └── rivulet-main/            server, channel, message, member queries
├── middlewares/     requireAuth (session guard), errorHandler (terminal handler)
├── sse/             Server-Sent Events handler
├── client/          DatabaseClient — the shared pg.Client wrapper
├── config/          config.ts (env), debug.ts (verbosity logger)
└── types.d.ts       Augments express-session with `userId`
db/schema.sql        PostgreSQL dump — partial, see Notes
docker.sh            Starts the PostgreSQL container
rivulet-psql.sh      Opens psql inside the container
```

## Architecture

Requests flow in one direction, with errors funnelled to a single handler:

```
HTTP → Route → (requireAuth) → Controller → DB module → DatabaseClient → PostgreSQL
                                    ↓ next(error)
                              errorHandler
```

- **Routes** map a verb and path to a controller. All routers are mounted in [app.ts](src/app.ts) under `/api/server`, `/api/channel`, `/api/account`, `/api/message`, `/api/user`, `/api/member`, and `/api/sse`.
- **Controllers** read `req.body`, `req.query`, and `req.session.userId`, call DB functions, and respond with JSON. Failures are passed to `next()` and answered by `errorHandler` as `{ message }` with `err.status` or `500`.
- **DB modules** export one async function per query. Every query is parameterized (`$1`, `$2`, …) — no string interpolation.
- **DatabaseClient** holds a single `pg.Client`, connected in [app.ts](src/app.ts) at import time and ended on `SIGINT` in [server.ts](src/server.ts).

### Authentication and sessions

Sessions are stored in memory (`express-session`) and identified by the `connect.sid` cookie: `httpOnly`, `sameSite: 'lax'`, `secure: false`. Login and signup set `req.session.userId`; logout destroys the session and clears the cookie.

Guarding is split between two styles:

- [requireAuth](src/middlewares/authMiddleware.ts) middleware returns `401 { message: 'Unauthorized' }` — used by the channel, message, and member routes.
- The server routes and `/api/user` check `req.session.userId` inside the controller instead.

**Password handling:** the client sends `hash`, the SHA-256 hex digest of `username + password`, and the server stores and compares that value directly in `users.password_hash` (a `char(64)` column). The plaintext password never reaches the API, but there is no bcrypt, no per-user salt, and no server-side rehash — treat this as a dev-grade scheme to replace before deploying.

CORS allows exactly one origin, `http://localhost:5173`, with `credentials: true`. Change the Vite dev port and you must change [app.ts](src/app.ts) too. The session secret is likewise hardcoded there.

### Data model

| Table | Key columns | Notes |
|---|---|---|
| `users` | `user_id`, `username` (unique), `password_hash`, `created_at` | `user_id` from `user_id_seq` |
| `servers` | `server_id`, `server_name`, `owner_id`, `created_at` | `owner_id` is recorded, but nothing enforces it yet |
| `server_members` | `(user_id, server_id)`, `joined_at` | Membership is the join table; leaving deletes the row |
| `server_invites` | `server_id`, `invite_code` | One invite code per server, created on demand |
| `channels` | `(server_id, channel_id)`, `name`, `created_at` | `channel_id` is scoped to its server |
| `channel_sequences` | `server_id`, `max_id` | Per-server counter for the next `channel_id` |
| `messages` | `(server_id, channel_id, message_id)`, `user_id`, `message_text` | `message_text` is `varchar(1024)` |
| `message_sequences` | `(server_id, channel_id)`, `max_id` | Per-channel counter for the next `message_id` |

Two things are worth knowing about this shape:

- **IDs are sequential per scope, not global.** Channels number from `channel_sequences` per server; messages number from `message_sequences` per channel, so `#general` in two different servers can each have a `message_id` of 1. Both IDs are allocated in the same statement that inserts the row, via an `UPDATE … RETURNING` CTE — atomic, with no read-then-write race on the counter.
- **Deletes cascade.** In the dump, `channels`, `channel_sequences`, and `server_members` carry an `ON DELETE CASCADE` foreign key to `servers`, so removing a server takes its channels and memberships with it. No route deletes a server yet.

Message queries alias `server_id` as `guild_id` in their results, because the frontend calls the concept a *guild*. See the frontend's "Guild vs. Server" note — prefer "Server" in new code here.

## API reference

All requests and responses are JSON. Browser clients must send `credentials: 'include'`, since auth is cookie-based.

| Method | Endpoint | Auth | Input | Success response |
|---|---|---|---|---|
| POST | `/api/account/signup` | — | `{ username, hash }` | `{ message }` |
| POST | `/api/account/login` | — | `{ username, hash }` | `{ message }` |
| POST | `/api/account/logout` | Session | — | `{ message }` |
| POST | `/api/user` | Session | — | `{ servers }` |
| POST | `/api/server/` | Session | `{ serverName }` | `{ servers, created_server_id }` |
| POST | `/api/server/invite` | Session | `{ serverId }` | `{ invite_code }` |
| POST | `/api/server/join` | Session | `{ invite_code }` | `{ servers }` |
| POST | `/api/server/leave` | Session | `{ serverId }` | `{ message }` |
| GET | `/api/channel?serverId=` | `requireAuth` | — | `{ channels }` |
| POST | `/api/channel/` | `requireAuth` | `{ channelName, serverId }` | Channel row |
| DELETE | `/api/channel/` | `requireAuth` | `{ serverId, channelId }` | `{ channel }` |
| GET | `/api/message?serverId=&channelId=` | `requireAuth` | — | `{ messages }` |
| POST | `/api/message/` | `requireAuth` | `{ serverId, channelId, messageText }` | Message row |
| GET | `/api/member?serverId=` | `requireAuth` | — | `{ members }` |
| GET | `/api/sse/events` | — | — | `text/event-stream` |

Behaviour worth noting:

- **Creating a server** does three things: inserts the server, adds the creator as a member, then creates a default `general` channel and a 16-character invite code. It returns the caller's refreshed server list plus `created_server_id`.
- **`POST /api/server/invite`** returns the existing code for a server, generating and storing one if none exists yet.
- **Message rows** come back as `{ guild_id, channel_id, message_id, user_id, message_text, author_name }`, with `author_name` joined from `users` and falling back to `user-<id>`.
- **`DELETE /api/channel/`** takes its identifiers in the request **body**, not the path or query string.
- **Validation errors** return `400 { message }` — a missing `serverId` for channels or members, or non-numeric `serverId`/`channelId` for messages.
- **Membership is not checked.** Any authenticated user can create or delete a channel in any server and post to any channel; `owner_id` is stored but never consulted. There are TODOs in [messageDatabase.ts](src/db/rivulet-main/messageDatabase.ts) to add those checks.

## Real-time events (SSE)

`GET /api/sse/events` opens an event stream in [sseHandler.ts](src/sse/sseHandler.ts). It currently:

- sends `{ message: 'Connected to SSE' }` on connect,
- writes a `: keep-alive` comment every 15 seconds,
- emits a `{ timestamp }` event every 10 seconds.

This is a scaffold, not a live feed — nothing publishes message events to it yet. On the client side, `useMessageStream` still subscribes to the in-memory `EventBus`, and is written to be swapped for an `EventSource` when this endpoint is wired up. The `ws` dependency and the commented-out `import "./websocket"` in [app.ts](src/app.ts) are leftovers from an earlier WebSocket approach.

## Logging

[debug.ts](src/config/debug.ts) exposes `createLogger(module, logType)`. Each call takes a message and a `Verbosity` (`NONE`, `LOW`, `MEDIUM`, `HIGH`), and logs only if the level meets the threshold configured for its category:

```ts
export const verbosityConfig: Record<string, Verbosity> = {
    controller: Verbosity.HIGH,
    database: Verbosity.HIGH,
    routes: Verbosity.MEDIUM,
    sse: Verbosity.MEDIUM,
    default: Verbosity.MEDIUM,
}
```

Set `disableLogs = true` to silence regular logging; `criticalError` always writes to `console.error`.

## Connecting from the client

In the [Rivulet frontend](https://github.com/anirudhsnayak/rivulet), flip the mode in `src/api/ApiConfig.ts`:

```ts
export const API_MODE: ApiMode = 'psql';  // was 'in-memory'
```

Every API module then targets `http://localhost:3000/api/*` with `credentials: 'include'`. Run this server first, or the client silently falls back to reporting failed logins and empty lists.

## Notes

- **`db/schema.sql` is incomplete.** It contains `users`, `servers`, `server_members`, `channels`, and `channel_sequences`, but not `messages`, `message_sequences`, `server_invites`, or the `servers.owner_id` column — all of which the code queries. Running the dump alone gives a database that only partly works. Regenerate it from a live database with `pg_dump` once the missing tables exist.
- **No tests.** `npm test` is a stub and there is no framework configured.
- **Hardcoded secrets and origins.** The session secret and the single CORS origin live in [app.ts](src/app.ts) — the code already notes the secret should move to an env var.
- **Invite codes use `Math.random`**, and are 16 alphanumeric characters, with no uniqueness constraint retry and no expiry.
- **`npm run dev` names `src/server.js`**, which does not exist — `tsx` resolves it to `src/server.ts`. Expect a moment of confusion when grepping for the entry point.

## Related

- [Rivulet frontend](https://github.com/anirudhsnayak/rivulet) — the React 19 SPA that consumes this API
