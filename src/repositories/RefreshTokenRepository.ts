import { Pool } from 'pg';
import { RefreshToken } from '../types';
import { DatabaseConnection } from '../config/database';

export class RefreshTokenRepository {
  private db: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Create a new refresh token
   */
  async create(tokenData: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    const { userId, tokenHash, expiresAt } = tokenData;

    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token_hash, expires_at, is_revoked, created_at
    `;

    const result = await this.db.query(query, [userId, tokenHash, expiresAt]);
    return this.mapRowToToken(result.rows[0]);
  }

  /**
   * Find refresh token by token hash
   */
  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const query = `
      SELECT id, user_id, token_hash, expires_at, is_revoked, created_at
      FROM refresh_tokens
      WHERE token_hash = $1 AND is_revoked = false
    `;

    const result = await this.db.query(query, [tokenHash]);
    return result.rows[0] ? this.mapRowToToken(result.rows[0]) : null;
  }

  /**
   * Find refresh token by ID
   */
  async findById(id: string): Promise<RefreshToken | null> {
    const query = `
      SELECT id, user_id, token_hash, expires_at, is_revoked, created_at
      FROM refresh_tokens
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapRowToToken(result.rows[0]) : null;
  }

  /**
   * Find all active refresh tokens for a user
   */
  async findByUserId(userId: string): Promise<RefreshToken[]> {
    const query = `
      SELECT id, user_id, token_hash, expires_at, is_revoked, created_at
      FROM refresh_tokens
      WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToToken(row));
  }

  /**
   * Revoke a refresh token
   */
  async revoke(id: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET is_revoked = true
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rowCount === 0) {
      throw new Error('Refresh token not found');
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllForUser(userId: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET is_revoked = true
      WHERE user_id = $1 AND is_revoked = false
    `;

    await this.db.query(query, [userId]);
  }

  /**
   * Delete expired refresh tokens
   */
  async deleteExpired(): Promise<number> {
    const query = `
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW() OR is_revoked = true
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  /**
   * Get refresh token statistics for a user
   */
  async getTokenStats(userId: string): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_revoked = false AND expires_at > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired,
        COUNT(CASE WHEN is_revoked = true THEN 1 END) as revoked
      FROM refresh_tokens
      WHERE user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      expired: parseInt(row.expired),
      revoked: parseInt(row.revoked),
    };
  }

  /**
   * Clean up old tokens (older than 30 days)
   */
  async cleanup(): Promise<number> {
    const query = `
      DELETE FROM refresh_tokens
      WHERE created_at < NOW() - INTERVAL '30 days'
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  /**
   * Map database row to RefreshToken object
   */
  private mapRowToToken(row: any): RefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      isRevoked: row.is_revoked,
      createdAt: new Date(row.created_at),
    };
  }
}