import DatabaseClient from '../../client/DatabaseClient';

export async function createChannelDB(channelName: string, serverId: string) {
    const query = `
        WITH next AS (
            UPDATE channel_sequences
            SET max_id = max_id + 1
            WHERE server_id = $1
            RETURNING max_id AS channel_id
        )
        INSERT INTO channels (name, server_id, channel_id)
        SELECT $1, $2, channel_id
        FROM next
        RETURNING *;
    `;
    const values = [channelName, serverId];
    const result = await DatabaseClient.query(query, values);
    return result.rows[0];
}

export async function removeChannelDB(channelId: number, serverId: string) {
    const query = 'DELETE FROM channels WHERE server_id = $1 AND channel_id = $2 RETURNING *';
    const values = [serverId, channelId];
    const result = await DatabaseClient.query(query, values);
    return result.rows[0];
}