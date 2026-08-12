import pg from 'pg';

export default class DatabaseClient {
  static client: pg.Pool;
  static init() {
    DatabaseClient.client ??= new pg.Pool({
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    });
  }
  static query(text: string, params?: any[]) {
    return this.client.query(text, params);
  }
  static async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.client.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
