import type { PoolClient } from 'pg';

export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
export function id(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))) return fail(400, 'Expected a positive integer ID');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0 || result > 2147483647) fail(400, 'Invalid ID');
  return result;
}
export function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max) fail(400, `Text must contain 1-${max} characters`);
  return value;
}
// Serialize operations on a server before checking membership, so moderation
// and ownership transfers cannot race with message/channel writes.
export async function membership(client: PoolClient, serverId: number, userId: number) {
  const server = (await client.query('SELECT owner_id FROM servers WHERE server_id=$1 FOR UPDATE', [serverId])).rows[0];
  if (!server) fail(404, 'Server not found');
  const member = (await client.query('SELECT role FROM server_members WHERE server_id=$1 AND user_id=$2', [serverId, userId])).rows[0];
  if (!member) fail(403, 'Server membership required');
  return server.owner_id === userId ? 'creator' : member.role as 'member' | 'admin';
}
export function canManage(role: string) {
  if (role !== 'creator' && role !== 'admin') fail(403, 'Admin or creator role required');
}
export async function channel(client: PoolClient, serverId: number, channelId: number) {
  if (!(await client.query('SELECT 1 FROM channels WHERE server_id=$1 AND channel_id=$2', [serverId, channelId])).rowCount) fail(404, 'Channel not found in this server');
}
