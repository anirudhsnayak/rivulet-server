
import DatabaseClient from '../../client/DatabaseClient';

//TODO: have channel-specific member lists for specific channels
export async function getMembersInServerDB(serverId: number) {
    const query = `
        SELECT sm.user_id, sm.server_id, u.username
        FROM server_members sm
        JOIN users u ON sm.user_id = u.user_id
        WHERE sm.server_id = $1
    `;
    const values = [serverId];
    const result = await DatabaseClient.query(query, values);
    return result.rows;
}       