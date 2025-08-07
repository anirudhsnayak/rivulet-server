//write code which queries validity of username and hash from postgres container
import pg from 'pg';

export async function loginAccount( username: string, hash: string) {
  // This function should query the PostgreSQL database to check if the username and hash match
 
  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  });

  client.connect();
  const query = 'SELECT * FROM users WHERE username = $1 AND password_hash = $2';
  const values = [username, hash];  
  const result = await client.query(query, values);
  client.end();
  if (result.rows.length > 0) {
    return true; // User exists and credentials are valid
  } else {
    return false; // Invalid credentials
  }
}

export async function createAccount(username: string, hash: string) {
  // This function should insert a new user into the PostgreSQL database
  const client = new pg.Client
({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  });
  // sanitize inputs and handle errors properly
  client.connect();
  const query = 'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *';
  // console.log(`Executing query: ${query} with values: ${username}, ${hash}`);
  const values = [username, hash];
  const result = await client.query(query, values);
  client.end();
  if (result.rows.length > 0) {
    return true; // User created successfully
  } else {
    return false; // User creation failed
  }
}
