
import DatabaseClient from '../../client/DatabaseClient';

//TODO: have channel-specific member lists for specific channels
export async function getMembersInServerDB(serverId: number) {
    const query = 'SELECT * FROM server_members WHERE server_id = $1';
    const values = [serverId];
    const result = await DatabaseClient.query(query, values);
    return result.rows;
}       