import DatabaseClient from '../../client/DatabaseClient';
import { createLogger, Verbosity } from '../../config/debug';

const logger = createLogger("channelDatabase", "database");

async function createMessageSequenceDB(serverId: number, channelId: number) {
    logger.log(`Creating message sequence for server ID: ${serverId}, channel ID: ${channelId}`, Verbosity.MEDIUM);
    const query = 'INSERT INTO message_sequences (server_id, channel_id, max_id) VALUES ($1, $2, 0) RETURNING *';
    const values = [serverId, channelId];
    const result = await DatabaseClient.query(query, values);
    return result.rows[0];
}

export async function createChannelDB(channelName: string, serverId: number) {
    logger.log(`Creating channel with name: ${channelName} in server ID: ${serverId}`, Verbosity.MEDIUM);
    const query = `
        WITH next AS (
            UPDATE channel_sequences
            SET max_id = max_id + 1
            WHERE server_id = $2
            RETURNING max_id AS channel_id
        )
        INSERT INTO channels (name, server_id, channel_id)
        SELECT $1, $2, channel_id
        FROM next
        RETURNING *;
    `;
    const values = [channelName, serverId];
    const result = await DatabaseClient.query(query, values);
    await createMessageSequenceDB(serverId, result.rows[0].channel_id); // Initialize message sequence for the new channel
    return result.rows[0];
}

//TODO: rename this to deleteChannelDB
export async function removeChannelDB(channelId: number, serverId: string) {
    logger.log(`Removing channel ID: ${channelId} from server ID: ${serverId}`, Verbosity.MEDIUM);
    const query = 'DELETE FROM channels WHERE server_id = $1 AND channel_id = $2 RETURNING *';
    const values = [serverId, channelId];
    const result = await DatabaseClient.query(query, values);
    return result.rows[0];
}

export async function getChannelsByServerIdDB(serverId: number) {
    logger.log(`Retrieving channels for server ID: ${serverId}`, Verbosity.MEDIUM);
    const query = 'SELECT * FROM channels WHERE server_id = $1';
    const values = [serverId];
    const result = await DatabaseClient.query(query, values);
    return result.rows;
}