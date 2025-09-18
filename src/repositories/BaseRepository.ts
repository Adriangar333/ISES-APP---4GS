import { executeQuery, executeQuerySingle, executeTransaction } from '../services/database';

export abstract class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(where?: string, params?: any[]): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    if (where) {
      query += ` WHERE ${where}`;
    }
    query += ' ORDER BY created_at DESC';
    
    return executeQuery<T>(query, params);
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    return executeQuerySingle<T>(query, [id]);
  }

  /**
   * Find a single record with custom where clause
   */
  async findOne(where: string, params: any[]): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${where}`;
    return executeQuerySingle<T>(query, params);
  }

  /**
   * Count records with optional filtering
   */
  async count(where?: string, params?: any[]): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    const result = await executeQuerySingle<{ count: string }>(query, params);
    return parseInt(result?.count || '0');
  }

  /**
   * Delete a record by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await executeQuery(query, [id]);
    return result.length > 0;
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const result = await executeQuerySingle(query, [id]);
    return result !== null;
  }

  /**
   * Execute a custom query
   */
  protected async executeCustomQuery<R = any>(query: string, params?: any[]): Promise<R[]> {
    return executeQuery<R>(query, params);
  }

  /**
   * Execute a custom query returning single result
   */
  protected async executeCustomQuerySingle<R = any>(query: string, params?: any[]): Promise<R | null> {
    return executeQuerySingle<R>(query, params);
  }

  /**
   * Execute multiple queries in a transaction
   */
  protected async executeInTransaction(queries: Array<{ query: string; params?: any[] }>): Promise<any[]> {
    return executeTransaction(queries);
  }
}