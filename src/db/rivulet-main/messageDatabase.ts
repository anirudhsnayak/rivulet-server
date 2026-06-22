import DatabaseClient from '../../client/DatabaseClient';
import { createLogger, Verbosity } from '../../config/debug';

//  Table "public.messages"
//     Column    |            Type             | Collation | Nullable |      Default
// --------------+-----------------------------+-----------+----------+-------------------      
//  server_id    | integer                     |           | not null |
//  channel_id   | integer                     |           | not null |
//  message_id   | integer                     |           | not null |
//  user_id      | integer                     |           | not null |
//  message_text | character varying(1024)     |           | not null |

const logger = createLogger("messageDatabase", "database");

//TODO: change the db to store user_id as author_id instead
export async function createMessageDB(serverId: number, channelId: number, userId: number, content: string) {
    logger.log(`Creating message: ${content}, in server ID: ${serverId}, channel ID: ${channelId} by user ID: ${userId}`, Verbosity.MEDIUM);
    //TODO: check that everything is valid (server/channel exists, user is a member of the server, etc.) before creating the message
    const query = `
        WITH next AS (
            UPDATE message_sequences
            SET max_id = max_id + 1
            WHERE server_id = $1 AND channel_id = $2
            RETURNING max_id AS message_id
        )
        INSERT INTO messages (server_id, channel_id, message_id, user_id, message_text)
        SELECT $1, $2, message_id, $3, $4
        FROM next
        RETURNING server_id AS guild_id, channel_id, message_id, user_id, message_text,
                  (SELECT username FROM users WHERE user_id = $3) AS author_name;
    `;
    const values = [serverId, channelId, userId, content];
    const result = await DatabaseClient.query(query, values);
    return result.rows[0];
}

export async function getMessagesByChannelIdDB(serverId: number, channelId: number) {
    logger.log(`Retrieving messages for server ID: ${serverId}, channel ID: ${channelId}`, Verbosity.MEDIUM);
    const query = `
        SELECT m.server_id AS guild_id, m.channel_id, m.message_id, m.user_id, m.message_text,
               COALESCE(u.username, 'user-' || m.user_id) AS author_name
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.user_id
        WHERE m.server_id = $1 AND m.channel_id = $2
        ORDER BY m.message_id ASC
    `;
    const values = [serverId, channelId];
    const result = await DatabaseClient.query(query, values);
    return result.rows;
}

export async function deleteMessageDB(serverId: number, channelId: number, messageId: number) {
    logger.log(`Deleting message ID: ${messageId} in server ID: ${serverId}, channel ID: ${channelId}`, Verbosity.MEDIUM);
    const query = 'DELETE FROM messages WHERE server_id = $1 AND channel_id = $2 AND message_id = $3 RETURNING *';
    const values = [serverId, channelId, messageId];
    const result = await DatabaseClient.query(query, values);
    return result.rows[0];
}