import DatabaseClient from '../client/DatabaseClient';
import { createLogger, Verbosity } from '../config/debug';

const logger = createLogger("accountDatabase", "database");

export async function loginAccount(username: string, hash: string) {
  const query = 'SELECT * FROM users WHERE username = $1 AND password_hash = $2';
  const values = [username, hash];  
  const result = await DatabaseClient.query(query, values);
  logger.log(`User login attempt for ${username} returned ${result.rows.length > 0}`, Verbosity.MEDIUM);
  return result.rows.length > 0;
}

export async function createAccount(username: string, hash: string) { 
    //check if username already exists
    const checkQuery = 'SELECT * FROM users WHERE username = $1';
    const checkValues = [username];
    const checkResult = await DatabaseClient.query(checkQuery, checkValues);
    if (checkResult.rows.length > 0) { // Username already exists
        logger.log(`Error: attempted to create account with existing username: ${username}`, Verbosity.LOW);
        return false;
    }
    const query = 'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *';
    const values = [username, hash];
    const result = await DatabaseClient.query(query, values);
    logger.log(`Account created for username: ${username}`, Verbosity.MEDIUM);
    return result.rows.length > 0;
}

export async function getUserId(username: string) {
  const query = 'SELECT user_id FROM users WHERE username = $1';
  const values = [username];
  const result = await DatabaseClient.query(query, values);
  return result.rows[0]?.user_id;
}
