// Database service utilities
import { PoolClient } from 'pg';
import { DatabaseConnection } from '../config/database';

/**
 * Execute a database query with automatic connection management
 */
export const executeQuery = async <T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> => {
  const pool = DatabaseConnection.getInstance();
  const client: PoolClient = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
};

/**
 * Execute a database query and return a single row
 */
export const executeQuerySingle = async <T = any>(
  query: string,
  params: any[] = []
): Promise<T | null> => {
  const rows = await executeQuery<T>(query, params);
  return rows[0] || null;
};

/**
 * Execute multiple queries in a transaction
 */
export const executeTransaction = async (
  queries: Array<{ query: string; params?: any[] }>
): Promise<any[]> => {
  const pool = DatabaseConnection.getInstance();
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const { query, params = [] } of queries) {
      const result = await client.query(query, params);
      results.push(result.rows);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Check if database connection is healthy
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await executeQuery('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

/**
 * Get database statistics
 */
export const getDatabaseStats = async () => {
  try {
    const stats = await executeQuerySingle(`
      SELECT 
        (SELECT count(*) FROM zones) as total_zones,
        (SELECT count(*) FROM inspectors WHERE is_active = true) as active_inspectors,
        (SELECT count(*) FROM coordinates) as total_coordinates,
        (SELECT count(*) FROM routes) as total_routes,
        (SELECT count(*) FROM routes WHERE status = 'pending') as pending_routes
    `);
    return stats;
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return null;
  }
};