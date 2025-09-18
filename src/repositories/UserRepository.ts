import { Pool } from 'pg';
import { User, UserRole } from '../types';
import { DatabaseConnection } from '../config/database';

export class UserRepository {
  private db: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Create a new user
   */
  async create(userData: {
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const { email, passwordHash, role } = userData;

    const query = `
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, $3)
      RETURNING id, email, role, is_active, last_login, created_at, updated_at
    `;

    const result = await this.db.query(query, [email, passwordHash, role]);
    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, role, is_active, last_login, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, role, is_active, last_login, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await this.db.query(query, [email]);
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(token: string): Promise<User | null> {
    const query = `
      SELECT id, email, role, is_active, last_login, created_at, updated_at
      FROM users
      WHERE password_reset_token = $1 
        AND password_reset_expires > NOW()
    `;

    const result = await this.db.query(query, [token]);
    return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
  }

  /**
   * Get all users with pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    role?: UserRole,
    isActive?: boolean
  ): Promise<{ users: User[]; total: number }> {
    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereConditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get users
    const query = `
      SELECT id, email, role, is_active, last_login, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(limit, offset);
    const result = await this.db.query(query, params);
    const users = result.rows.map(row => this.mapRowToUser(row));

    return { users, total };
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<User>): Promise<User> {
    const allowedFields = ['email', 'role', 'is_active'];
    const setClause = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        const dbField = key === 'isActive' ? 'is_active' : key;
        setClause.push(`${dbField} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);
    const query = `
      UPDATE users
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, email, role, is_active, last_login, created_at, updated_at
    `;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapRowToUser(result.rows[0]);
  }

  /**
   * Delete user (soft delete by setting is_active to false)
   */
  async delete(id: string): Promise<void> {
    const query = `
      UPDATE users
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
  }

  /**
   * Get password hash for user
   */
  async getPasswordHash(id: string): Promise<string> {
    const query = `SELECT password_hash FROM users WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0].password_hash;
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await this.db.query(query, [passwordHash, id]);
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.db.query(query, [id]);
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(id: string, token: string, expires: Date): Promise<void> {
    const query = `
      UPDATE users
      SET password_reset_token = $1, password_reset_expires = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;

    await this.db.query(query, [token, expires, id]);
  }

  /**
   * Clear password reset token
   */
  async clearPasswordResetToken(id: string): Promise<void> {
    const query = `
      UPDATE users
      SET password_reset_token = NULL, password_reset_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.db.query(query, [id]);
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = `SELECT 1 FROM users WHERE email = $1`;
    const params = [email];

    if (excludeId) {
      query += ` AND id != $2`;
      params.push(excludeId);
    }

    const result = await this.db.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: any): User {
    const user: User = {
      id: row.id,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
    
    if (row.last_login) {
      user.lastLogin = new Date(row.last_login);
    }
    
    return user;
  }
}