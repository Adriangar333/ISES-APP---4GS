import { Pool, PoolConfig } from 'pg';
import { config } from './index';

export class DatabaseConnection {
  private static instance: Pool;

  private constructor() {}

  public static getInstance(): Pool {
    if (!DatabaseConnection.instance) {
      const poolConfig: PoolConfig = {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      };

      DatabaseConnection.instance = new Pool(poolConfig);

      // Handle pool errors
      DatabaseConnection.instance.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
      });

      // Handle pool connection
      DatabaseConnection.instance.on('connect', (client) => {
        console.log('New client connected to database');
      });

      // Handle pool disconnection
      DatabaseConnection.instance.on('remove', (client) => {
        console.log('Client removed from pool');
      });
    }

    return DatabaseConnection.instance;
  }

  public static async closeConnection(): Promise<void> {
    if (DatabaseConnection.instance) {
      await DatabaseConnection.instance.end();
      console.log('Database connection pool closed');
    }
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const pool = DatabaseConnection.getInstance();
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connection test successful');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}