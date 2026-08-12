import type { Request, Response } from 'express';
import DB from '../client/DatabaseClient';
import { id, fail } from '../services/permissions';

interface Connection {
  req: Request; res: Response; userId: number; serverIds: number[];
  kind: 'presence' | 'messages'; channelId?: number;
}

// Process-local presence: deploy one API instance, or replace this with shared
// presence/pubsub before running multiple instances.
class Streams {
  private connections = new Set<Connection>();
  private pending = Promise.resolve();
  private timer?: ReturnType<typeof setInterval>;

  private enqueue(work: () => Promise<void>) {
    const next = this.pending.then(work);
    this.pending = next.catch(error => {
      console.error('Stream refresh failed', error);
      for (const connection of this.connections) connection.res.end();
    });
    return this.pending;
  }
  private send(c: Connection, event: string, data: unknown) {
    if (c.res.writableLength > 1024 * 1024) { c.res.end(); return; }
    c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  private async authorized(c: Connection) {
    const session = await new Promise<import('express-session').SessionData | null>((resolve, reject) => {
      c.req.sessionStore.get(c.req.sessionID, (err, value) => err ? reject(err) : resolve(value ?? null));
    });
    if (session?.userId !== c.userId) return false;
    const memberships = (await DB.query('SELECT server_id FROM server_members WHERE user_id=$1 AND server_id=ANY($2::int[])', [c.userId, c.serverIds])).rows;
    if (memberships.length !== c.serverIds.length) return false;
    if (c.channelId !== undefined) {
      return !!(await DB.query('SELECT 1 FROM channels WHERE server_id=$1 AND channel_id=$2', [c.serverIds[0], c.channelId])).rowCount;
    }
    return true;
  }
  private async snapshots() {
    for (const c of this.connections) {
      if (!await this.authorized(c)) { this.connections.delete(c); c.res.end(); }
    }
    const online = [...new Set([...this.connections].filter(c => c.kind === 'presence').map(c => c.userId))];
    const members = online.length ? (await DB.query('SELECT server_id,user_id FROM server_members WHERE user_id=ANY($1::int[])', [online])).rows : [];
    for (const c of this.connections) {
      if (c.kind === 'presence') this.send(c, 'presence:snapshot', {
        servers: c.serverIds.map(serverId => ({ serverId, onlineUserIds: members.filter(m => m.server_id === serverId).map(m => m.user_id).sort((a, b) => a - b) })),
      });
    }
  }
  refresh() { return this.enqueue(() => this.snapshots()); }
  async open(req: Request, res: Response, kind: Connection['kind']) {
    const serverIds = kind === 'presence'
      ? (typeof req.query.serverIds === 'string' ? req.query.serverIds.split(',').map(id) : fail(400, 'serverIds required'))
      : [id(req.query.serverId)];
    if (!serverIds.length || serverIds.length > 500 || new Set(serverIds).size !== serverIds.length) fail(400, 'Invalid serverIds');
    const c: Connection = { req, res, userId: req.session.userId!, serverIds, kind,
      channelId: kind === 'messages' ? id(req.query.channelId) : undefined };
    if (!await this.authorized(c)) fail(403, 'Unauthorized stream subscription');
    if (res.destroyed) return;
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    this.connections.add(c);
    res.on('close', () => {
      this.connections.delete(c);
      if (!this.connections.size && this.timer) { clearInterval(this.timer); this.timer = undefined; }
      void this.refresh();
    });
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.refresh().then(() => { for (const client of this.connections) client.res.write(': keep-alive\n\n'); });
      }, 15000);
      this.timer.unref();
    }
    await this.refresh();
    if (kind === 'messages' && this.connections.has(c)) this.send(c, 'ready', {});
  }
  message(message: { guild_id: number; channel_id: number }) {
    return this.enqueue(async () => {
      for (const c of this.connections) {
        if (c.kind === 'messages' && c.serverIds[0] === message.guild_id && c.channelId === message.channel_id) {
          if (await this.authorized(c)) this.send(c, 'message:created', message);
          else { this.connections.delete(c); c.res.end(); }
        }
      }
    });
  }
  disconnectSession(sessionId: string) {
    for (const c of this.connections) if (c.req.sessionID === sessionId) { this.connections.delete(c); c.res.end(); }
    return this.refresh();
  }
}
export const streams = new Streams();
