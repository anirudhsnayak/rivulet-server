import DatabaseClient from './DatabaseClient';

export async function loginAccount(username: string, hash: string) {
  const query = 'SELECT * FROM users WHERE username = $1 AND password_hash = $2';
  const values = [username, hash];  
  const result = await DatabaseClient.query(query, values);
  return result.rows.length > 0;
}

export async function createAccount(username: string, hash: string) {
  const query = 'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *';
  // console.log(`Executing query: ${query} with values: ${username}, ${hash}`);
  const values = [username, hash];
  const result = await DatabaseClient.query(query, values);
  return result.rows.length > 0;
}

export async function getUserId(username: string) {
  const query = 'SELECT user_id FROM users WHERE username = $1';
  const values = [username];
  const result = await DatabaseClient.query(query, values);
  return result.rows[0]?.user_id;
}
