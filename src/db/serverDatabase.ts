import DatabaseClient from './DatabaseClient';

export async function createServer(user_id: number, serverName: string) {
    const serversQuery = 'INSERT INTO servers (name) VALUES ($1) RETURNING *';
    const values = [serverName];
    const serversResult = await DatabaseClient.query(serversQuery, values);

    const membersQuery = 'INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)';
    const serverId = serversResult.rows[0].server_id; 
    const memberValues = [user_id, serverId as string];
    const membersResult = await DatabaseClient.query(membersQuery, memberValues);

    return {
        server: serversResult.rows[0],
        member: membersResult.rows.length > 0
    };
}

export async function getServersByUserId(user_id: number) {
    const query = `
        SELECT s.server_id, s.name
        FROM servers s
        JOIN server_members sm ON s.server_id = sm.server_id
        WHERE sm.user_id = $1
    `;
    const values = [user_id];
    const result = await DatabaseClient.query(query, values);
    return result.rows;
}