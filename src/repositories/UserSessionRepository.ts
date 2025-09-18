import { Pool } from 'pg';
import { UserSession } from '../types';
import { DatabaseConnection } from '../config/database';

export class UserSessionRepository {
  private db: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Create a new user session
   */
  async create(sessionData: {
    userId: string;
    sessionToken: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    expiresAt: Date;
  }): Promise<UserSession> {
    const { userId, sessionToken, ipAddress, userAgent, expiresAt } = sessionData;

    const query = `
      INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, session_token, ip_address, user_agent, expires_at, is_active, created_at
    `;

    const result = await this.db.query(query, [
      userId,
      sessionToken,
      ipAddress || null,
      userAgent || null,
      expiresAt,
    ]);

    return this.mapRowToSession(result.rows[0]);
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<UserSession | null> {
    const query = `
      SELECT id, user_id, session_token, ip_address, user_agent, expires_at, is_active, created_at
      FROM user_sessions
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapRowToSession(result.rows[0]) : null;
  }

  /**
   * Find session by session token
   */
  async findByToken(sessionToken: string): Promise<UserSession | null> {
    const query = `
      SELECT id, user_id, session_token, ip_address, user_agent, expires_at, is_active, created_at
      FROM user_sessions
      WHERE session_token = $1 AND is_active = true
    `;

    const result = await this.db.query(query, [sessionToken]);
    return result.rows[0] ? this.mapRowToSession(result.rows[0]) : null;
  }

  /**
   * Find all active sessions for a user
   */
  async findByUserId(userId: string): Promise<UserSession[]> {
    const query = `
      SELECT id, user_id, session_token, ip_address, user_agent, expires_at, is_active, created_at
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToSession(row));
  }

  /**
   * Update session activity
   */
  async updateActivity(id: string): Promise<void> {
    const query = `
      UPDATE user_sessions
      SET expires_at = NOW() + INTERVAL '24 hours'
      WHERE id = $1 AND is_active = true
    `;

    await this.db.query(query, [id]);
  }

  /**
   * Deactivate a session
   */
  async deactivate(id: string): Promise<void> {
    const query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rowCount === 0) {
      throw new Error('Session not found');
    }
  }

  /**
   * Deactivate all sessions for a user
   */
  async deactivateAllForUser(userId: string): Promise<void> {
    const query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1 AND is_active = true
    `;

    await this.db.query(query, [userId]);
  }

  /**
   * Deactivate all sessions except current one
   */
  async deactivateAllExcept(userId: string, currentSessionId: string): Promise<void> {
    const query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1 AND id != $2 AND is_active = true
    `;

    await this.db.query(query, [userId, currentSessionId]);
  }

  /**
   * Delete expired sessions
   */
  async deleteExpired(): Promise<number> {
    const query = `
      DELETE FROM user_sessions
      WHERE expires_at < NOW() OR is_active = false
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStats(userId: string): Promise<{
    total: number;
    active: number;
    expired: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true AND expires_at > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN expires_at <= NOW() OR is_active = false THEN 1 END) as expired
      FROM user_sessions
      WHERE user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      expired: parseInt(row.expired),
    };
  }

  /**
   * Get recent sessions for a user
   */
  async getRecentSessions(userId: string, limit: number = 10): Promise<UserSession[]> {
    const query = `
      SELECT id, user_id, session_token, ip_address, user_agent, expires_at, is_active, created_at
      FROM user_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [userId, limit]);
    return result.rows.map(row => this.mapRowToSession(row));
  }

  /**
   * Clean up old sessions (older than 30 days)
   */
  async cleanup(): Promise<number> {
    const query = `
      DELETE FROM user_sessions
      WHERE created_at < NOW() - INTERVAL '30 days'
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  /**
   * Extend session expiration
   */
  async extendSession(id: string, additionalHours: number = 24): Promise<void> {
    const query = `
      UPDATE user_sessions
      SET expires_at = expires_at + INTERVAL '${additionalHours} hours'
      WHERE id = $1 AND is_active = true
    `;

    const result = await this.db.query(query, [id]);
    if (result.rowCount === 0) {
      throw new Error('Session not found or inactive');
    }
  }

  /**
   * Map database row to UserSession object
   */
  private mapRowToSession(row: any): UserSession {
    const session: UserSession = {
      id: row.id,
      userId: row.user_id,
      sessionToken: row.session_token,
      expiresAt: new Date(row.expires_at),
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    };
    
    if (row.ip_address) session.ipAddress = row.ip_address;
    if (row.user_agent) session.userAgent = row.user_agent;
    
    return session;
  }
}