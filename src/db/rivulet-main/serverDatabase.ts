import { create } from 'domain';
import DatabaseClient from '../../client/DatabaseClient';
import { createLogger, Verbosity } from '../../config/debug';

const logger = createLogger("serverDatabase", "database");

export async function createChannelSequenceDB(serverId: number) {
    const query = 'INSERT INTO channel_sequences (server_id, max_id) VALUES ($1, 0) RETURNING *';
    const values = [serverId];
    const result = await DatabaseClient.query(query, values);
    logger.log(`Channel sequence created for server ID: ${serverId}`, Verbosity.MEDIUM);
    return result.rows[0];
}

export async function createServerDB(serverName: string, ownerId: number) {
    // Insert into servers with ownerId
    const serversQuery = 'INSERT INTO servers (server_name, owner_id) VALUES ($1, $2) RETURNING *';
    const values = [serverName, ownerId];
    const serversResult = await DatabaseClient.query(serversQuery, values);

    // Add owner as a member
    const serverId = serversResult.rows[0].server_id;
    const membersQuery = 'INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)';
    const memberValues = [ownerId, serverId];
    await DatabaseClient.query(membersQuery, memberValues);

    logger.log(`Server created with name: ${serverName} and ownerId: ${ownerId}`, Verbosity.MEDIUM);

    createChannelSequenceDB(serverId); // Initialize channel sequence for the new server

    return serversResult.rows[0];
}

export async function getServersByUserIdDB(user_id: number) {
    const query = `
        SELECT s.server_id, s.server_name
        FROM servers s
        JOIN server_members sm ON s.server_id = sm.server_id
        WHERE sm.user_id = $1
    `;
    const values = [user_id];
    const result = await DatabaseClient.query(query, values);

    logger.log(`Retrieved servers for user ID: ${user_id}`, Verbosity.MEDIUM);

    return result.rows;
}

export async function getInviteCodeByServerIdDB(serverId: number) {
    const query = 'SELECT invite_code FROM server_invites WHERE server_id = $1';
    const values = [serverId];
    const result = await DatabaseClient.query(query, values);

    logger.log(`Retrieved invite code for server ID: ${serverId}`, Verbosity.MEDIUM);

    if(!result.rows[0]) return null; // No invite code exists for this server
    return result.rows[0]?.invite_code;
}

export async function createInviteCodeDB(serverId: number, inviteCode: string) {
    const query = 'INSERT INTO server_invites (server_id, invite_code) VALUES ($1, $2) RETURNING *';
    const values = [serverId, inviteCode];
    const result = await DatabaseClient.query(query, values);

    logger.log(`Created invite code for server ID: ${serverId}`, Verbosity.MEDIUM);

    return result.rows[0];
}

export async function joinServerByInviteCodeDB(inviteCode: string, userId: number) {
    const query = `
        WITH server_info AS (
            SELECT server_id
            FROM server_invites
            WHERE invite_code = $1
        )
        INSERT INTO server_members (user_id, server_id)
        SELECT $2, server_id FROM server_info
        RETURNING server_id
    `;
    const values = [inviteCode, userId];
    const result = await DatabaseClient.query(query, values);

    logger.log(`User ID: ${userId} joined server with invite code: ${inviteCode}`, Verbosity.MEDIUM);

    return result.rows[0];
}