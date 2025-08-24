import DatabaseClient from '../client/DatabaseClient';

export async function createChannel(channelName: string, serverId: string) {
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