import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import app from '../src/app';
import DB from '../src/client/DatabaseClient';

const connectionString = process.env.RIVULET_TEST_DATABASE_URL;
test('PostgreSQL migration and HTTP feature parity', { skip: !connectionString }, async t => {
  // This suite owns a disposable database; refuse an application database URL.
  assert.match(new URL(connectionString!).pathname, /_test$/);
  DB.client = new pg.Pool({ connectionString });
  t.after(() => DB.client.end());
  assert.equal((await DB.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count, 0, 'Test database must be empty');
  const migration = await readFile('db/migrations/001_feature_parity.sql', 'utf8');
  await t.test('upgrades legacy data, backfills owner and counters, and is repeatable', async () => {
    await DB.query(`CREATE SEQUENCE user_id_seq; CREATE SEQUENCE server_id_seq;
      CREATE TABLE users(user_id integer PRIMARY KEY DEFAULT nextval('user_id_seq'),username varchar(50) UNIQUE NOT NULL,password_hash char(64) NOT NULL);
      CREATE TABLE servers(server_id integer PRIMARY KEY DEFAULT nextval('server_id_seq'),server_name varchar(50) NOT NULL);
      CREATE TABLE server_members(user_id integer,server_id integer REFERENCES servers ON DELETE CASCADE,joined_at timestamp DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,server_id));
      CREATE TABLE channels(server_id integer REFERENCES servers ON DELETE CASCADE,channel_id integer,name varchar(100),PRIMARY KEY(server_id,channel_id));
      CREATE TABLE server_invites(server_id integer PRIMARY KEY REFERENCES servers ON DELETE CASCADE,invite_code char(16) NOT NULL UNIQUE);
      INSERT INTO users VALUES(10,'legacy',repeat('a',64));
      INSERT INTO servers VALUES(10,'legacy'); INSERT INTO server_invites VALUES(10,'legacy-invite'); INSERT INTO server_members(user_id,server_id) VALUES(10,10);
      INSERT INTO channels VALUES(10,7,'legacy');`);
    await DB.query(migration);
    await DB.query(migration);
    assert.equal((await DB.query('SELECT invite_code FROM server_invites WHERE server_id=10')).rows[0].invite_code, 'legacy-invite');
    assert.equal((await DB.query('SELECT role FROM server_members WHERE server_id=10 AND user_id=10')).rows[0].role, 'member');
    await DB.query('UPDATE server_invites SET invite_code=$1 WHERE server_id=10', ['a'.repeat(32)]);
    assert.equal((await DB.query('SELECT owner_id FROM servers WHERE server_id=10')).rows[0].owner_id, 10);
    assert.equal((await DB.query('SELECT max_id FROM channel_sequences WHERE server_id=10')).rows[0].max_id, 7);
    assert.equal((await DB.query('SELECT max_id FROM message_sequences WHERE server_id=10 AND channel_id=7')).rows[0].max_id, 0);
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api`;
  const aborters: AbortController[] = [];
  t.after(() => aborters.forEach(a => a.abort()));
  async function request(cookie: string, path: string, method = 'GET', body?: object, status = 200) {
    const response = await fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
  }
  const signup = async (username: string) => {
    const result = await request('', '/account/signup', 'POST', { username, hash: 'a'.repeat(64) });
    return { cookie: result.cookie, id: (await request(result.cookie, '/account/session')).data.user_id };
  };
  const owner = await signup('owner'), member = await signup('member'), outsider = await signup('outsider');
  const sid = (await request(owner.cookie, '/server', 'POST', { serverName: 'test' })).data.created_server_id;
  const invite = (await request(owner.cookie, '/server/invite', 'POST', { serverId: sid })).data.invite_code;
  await request(member.cookie, '/server/join', 'POST', { invite_code: invite });
  await request(member.cookie, '/server/join', 'POST', { invite_code: invite });

  await t.test('authenticates and enforces membership on all reads and writes', async () => {
    await request('', '/user', 'POST', undefined, 401);
    for (const path of [`/member?serverId=${sid}`, `/channel?serverId=${sid}`, `/message?serverId=${sid}&channelId=1`, `/presence?serverIds=${sid}`, `/sse/events?serverId=${sid}&channelId=1`]) {
      await request(outsider.cookie, path, 'GET', undefined, 403);
    }
    await request(member.cookie, '/channel', 'POST', { serverId: sid, channelName: 'denied' }, 403);
    await request(outsider.cookie, '/message', 'POST', { serverId: sid, channelId: 1, messageText: 'denied' }, 403);
    await request(owner.cookie, `/channel?serverId=${sid}junk`, 'GET', undefined, 400);
    await request(owner.cookie, '/message', 'POST', { serverId: sid, channelId: 999, messageText: 'no channel' }, 404);
    await request(owner.cookie, '/server/join', 'POST', { invite_code: 'invalid' }, 404);
  });
  await t.test('roles and ownership are returned and creator protections hold', async () => {
    const model = (await request(owner.cookie, '/user', 'POST')).data;
    assert.equal(model.servers[0].role, 'creator');
    await request(member.cookie, '/member/role', 'PATCH', { serverId: sid, userId: owner.id, role: 'member' }, 403);
    await request(owner.cookie, '/member/role', 'PATCH', { serverId: sid, userId: member.id, role: 'creator' }, 400);
    await request(owner.cookie, '/member/role', 'PATCH', { serverId: sid, userId: member.id, role: 'admin' });
    await request(member.cookie, '/member/kick', 'POST', { serverId: sid, userId: owner.id }, 403);
    await request(member.cookie, '/member/kick', 'POST', { serverId: sid, userId: member.id }, 403);
  });
  await t.test('message counters serialize concurrent writes and channel deletion cascades', async () => {
    const cid = (await request(member.cookie, '/channel', 'POST', { serverId: sid, channelName: 'chat' })).data.channel_id;
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => request(member.cookie, '/message', 'POST', { serverId: sid, channelId: cid, messageText: `message ${i}` })));
    assert.equal(new Set(results.map(r => r.data.message_id)).size, 8);
    assert.equal(results[0].data.author_name, 'member');
    await request(member.cookie, '/channel', 'DELETE', { serverId: sid, channelId: cid });
    assert.equal((await DB.query('SELECT * FROM messages WHERE server_id=$1 AND channel_id=$2', [sid, cid])).rowCount, 0);
    assert.equal((await DB.query('SELECT * FROM message_sequences WHERE server_id=$1 AND channel_id=$2', [sid, cid])).rowCount, 0);
  });

  async function stream(cookie: string, path: string) {
    const controller = new AbortController(); aborters.push(controller);
    const response = await fetch(base + path, { headers: { Cookie: cookie }, signal: controller.signal });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    const reader = response.body!.getReader(); let buffer = '';
    return { close: () => controller.abort(), ended: async () => {
      const deadline = setTimeout(() => controller.abort(), 5000);
      try { while (!(await reader.read()).done) { /* drain buffered events */ } }
      finally { clearTimeout(deadline); }
    }, next: async (event: string, predicate: (data: any) => boolean = () => true) => {
      const deadline = setTimeout(() => controller.abort(), 5000);
      try {
        while (true) {
          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            if (block.startsWith(`event: ${event}\n`)) {
              const data = JSON.parse(block.split('\ndata: ')[1]);
              if (predicate(data)) return data;
            }
          }
          const chunk = await reader.read();
          if (chunk.done) throw new Error('Stream ended before expected event');
          buffer += new TextDecoder().decode(chunk.value);
        }
      } finally { clearTimeout(deadline); }
    } };
  }
  await t.test('presence tracks duplicate tabs, isolates servers, and reconnects with a snapshot', async () => {
    const separateId = (await request(outsider.cookie, '/server', 'POST', { serverName: 'separate' })).data.created_server_id;
    const separate = await stream(outsider.cookie, `/presence?serverIds=${separateId}`);
    assert.deepEqual((await separate.next('presence:snapshot')).servers, [{ serverId: separateId, onlineUserIds: [outsider.id] }]);
    const presence = await stream(owner.cookie, `/presence?serverIds=${sid}`);
    assert.deepEqual((await presence.next('presence:snapshot')).servers[0].onlineUserIds, [owner.id]);
    const tab1 = await stream(member.cookie, `/presence?serverIds=${sid}`);
    await tab1.next('presence:snapshot');
    await presence.next('presence:snapshot', d => d.servers[0].onlineUserIds.length === 2);
    assert.deepEqual((await separate.next('presence:snapshot')).servers[0].onlineUserIds, [outsider.id]);
    const tab2 = await stream(member.cookie, `/presence?serverIds=${sid}`);
    await tab2.next('presence:snapshot'); tab1.close();
    await presence.next('presence:snapshot', d => d.servers[0].onlineUserIds.includes(member.id));
    tab2.close();
    await presence.next('presence:snapshot', d => d.servers[0].onlineUserIds.length === 1);
    presence.close();
    const reconnect = await stream(owner.cookie, `/presence?serverIds=${sid}`);
    assert.deepEqual((await reconnect.next('presence:snapshot')).servers.map((s: any) => s.serverId), [sid]);
    reconnect.close();
    separate.close();
  });
  await t.test('streams live messages and rejects access after a kick', async () => {
    const messages = await stream(member.cookie, `/sse/events?serverId=${sid}&channelId=1`);
    await messages.next('ready');
    await request(owner.cookie, '/message', 'POST', { serverId: sid, channelId: 1, messageText: 'live' });
    assert.equal((await messages.next('message:created')).message_text, 'live');
    await request(owner.cookie, '/member/kick', 'POST', { serverId: sid, userId: member.id });
    await messages.ended();
    await request(member.cookie, `/message?serverId=${sid}&channelId=1`, 'GET', undefined, 403);
    await request(member.cookie, '/server/join', 'POST', { invite_code: invite });
    assert.equal((await request(member.cookie, '/user', 'POST')).data.servers[0].role, 'member');
    messages.close();
  });
  await t.test('ownership transfers and creator departures are atomic', async () => {
    await request(owner.cookie, '/server/ownership', 'POST', { serverId: sid, successorUserId: outsider.id }, 400);
    await request(owner.cookie, '/server/leave', 'POST', { serverId: sid }, 400);
    await request(owner.cookie, '/server/ownership', 'POST', { serverId: sid, successorUserId: member.id });
    assert.equal((await request(owner.cookie, '/user', 'POST')).data.servers[0].role, 'admin');
    assert.equal((await request(member.cookie, '/user', 'POST')).data.servers[0].role, 'creator');
    await request(member.cookie, '/server/leave', 'POST', { serverId: sid, successorUserId: owner.id });
    assert.equal((await request(member.cookie, '/user', 'POST')).data.servers.length, 0);
    assert.equal((await request(owner.cookie, '/user', 'POST')).data.servers[0].role, 'creator');
    // The schema itself prevents leaving a server without a creator membership.
    await assert.rejects(DB.query('DELETE FROM server_members WHERE server_id=$1 AND user_id=$2', [sid, owner.id]));
  });
  await t.test('logout destroys the session', async () => {
    const presence = await stream(owner.cookie, `/presence?serverIds=${sid}`);
    await presence.next('presence:snapshot');
    const messages = await stream(owner.cookie, `/sse/events?serverId=${sid}&channelId=1`);
    await messages.next('ready');
    await request(owner.cookie, '/account/logout', 'POST');
    await Promise.all([presence.ended(), messages.ended()]);
    await request(owner.cookie, '/account/session', 'GET', undefined, 401);
  });
});
