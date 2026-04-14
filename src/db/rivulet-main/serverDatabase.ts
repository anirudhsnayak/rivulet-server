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

export async function getServersByUserId(user_id: number) {
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