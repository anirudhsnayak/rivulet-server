import pg from 'pg';

export default class DatabaseClient {
  static client: pg.Client;
  static init() {
    DatabaseClient.client = new pg.Client({
      user: process.env.POSTGRES_USER,
      host: 'localhost',
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    });
    this.client.connect();
  }
  static query(text: string, params?: any[]) {
    return this.client.query(text, params);
  }
}