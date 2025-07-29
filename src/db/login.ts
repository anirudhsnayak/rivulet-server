//write code which queries validity of username and hash from postgres container
import pg from 'pg';

export function checkLoginValidity( username: string, hash: string) {
  // This function should query the PostgreSQL database to check if the username and hash match
 
  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    host: 'localhost',
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  });

  client.connect();
  const query = 'SELECT * FROM users WHERE username = $1 AND hash = $2';
  const values = [username, hash];  
  return client.query(query, values)
    .then(res => {
      client.end();
      return res.rows.length > 0; // Returns true if a matching user is found
    })
    .catch(err => {
      client.end();
      console.error('Database query error:', err);
      throw err; // Propagate the error
    });

}
