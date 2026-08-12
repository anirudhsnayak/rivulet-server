const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });

async function main() {
  const client = new Client({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: Number(process.env.POSTGRES_PORT || 5432),
  });
  try {
    await client.connect();
    await client.query(readFileSync(resolve(__dirname, '../db/migrations/001_feature_parity.sql'), 'utf8'));
    console.log('Database migration complete. Existing data retained.');
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
