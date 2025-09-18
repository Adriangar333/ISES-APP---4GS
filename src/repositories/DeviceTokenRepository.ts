import { Pool } from 'pg';
import { DeviceToken, DevicePlatform } from '../types';

export class DeviceTokenRepository {
  constructor(private db: Pool) {}

  async createDeviceToken(deviceToken: Omit<DeviceToken, 'id' | 'createdAt'>): Promise<DeviceToken> {
    const query = `
      INSERT INTO device_tokens (user_id, token, platform, is_active, last_used_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, token) 
      DO UPDATE SET 
        is_active = EXCLUDED.is_active,
        last_used_at = EXCLUDED.last_used_at,
        platform = EXCLUDED.platform
      RETURNING *
    `;

    const values = [
      deviceToken.userId,
      deviceToken.token,
      deviceToken.platform,
      deviceToken.isActive,
      deviceToken.lastUsedAt
    ];

    const result = await this.db.query(query, values);
    return this.mapDeviceTokenRow(result.rows[0]);
  }

  async getDeviceTokenById(id: string): Promise<DeviceToken | null> {
    const query = 'SELECT * FROM device_tokens WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDeviceTokenRow(result.rows[0]);
  }

  async getDeviceTokensByUser(
    userId: string, 
    platform?: DevicePlatform,
    activeOnly: boolean = true
  ): Promise<DeviceToken[]> {
    let query = 'SELECT * FROM device_tokens WHERE user_id = $1';
    const values: any[] = [userId];
    let paramIndex = 2;

    if (activeOnly) {
      query += ` AND is_active = true`;
    }

    if (platform) {
      query += ` AND platform = $${paramIndex}`;
      values.push(platform);
      paramIndex++;
    }

    query += ' ORDER BY last_used_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapDeviceTokenRow(row));
  }

  async getDeviceTokenByUserAndToken(userId: string, token: string): Promise<DeviceToken | null> {
    const query = 'SELECT * FROM device_tokens WHERE user_id = $1 AND token = $2';
    const result = await this.db.query(query, [userId, token]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDeviceTokenRow(result.rows[0]);
  }

  async updateDeviceToken(
    id: string, 
    updates: Partial<Pick<DeviceToken, 'isActive' | 'lastUsedAt' | 'platform'>>
  ): Promise<void> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex}`);
      values.push(updates.isActive);
      paramIndex++;
    }

    if (updates.lastUsedAt) {
      fields.push(`last_used_at = $${paramIndex}`);
      values.push(updates.lastUsedAt);
      paramIndex++;
    }

    if (updates.platform) {
      fields.push(`platform = $${paramIndex}`);
      values.push(updates.platform);
      paramIndex++;
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE device_tokens SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
    
    await this.db.query(query, values);
  }

  async deactivateDeviceToken(userId: string, token: string): Promise<void> {
    const query = `
      UPDATE device_tokens 
      SET is_active = false 
      WHERE user_id = $1 AND token = $2
    `;
    await this.db.query(query, [userId, token]);
  }

  async deactivateDeviceTokensByTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    const query = `
      UPDATE device_tokens 
      SET is_active = false 
      WHERE token = ANY($1)
    `;
    await this.db.query(query, [tokens]);
  }

  async deleteDeviceToken(id: string): Promise<void> {
    const query = 'DELETE FROM device_tokens WHERE id = $1';
    await this.db.query(query, [id]);
  }

  async deleteDeviceTokensByUser(userId: string): Promise<void> {
    const query = 'DELETE FROM device_tokens WHERE user_id = $1';
    await this.db.query(query, [userId]);
  }

  async getActiveTokensByPlatform(platform: DevicePlatform, limit?: number): Promise<DeviceToken[]> {
    let query = `
      SELECT * FROM device_tokens 
      WHERE platform = $1 AND is_active = true 
      ORDER BY last_used_at DESC
    `;
    const values: any[] = [platform];

    if (limit) {
      query += ` LIMIT $2`;
      values.push(limit);
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapDeviceTokenRow(row));
  }

  async getAllActiveTokens(limit?: number): Promise<DeviceToken[]> {
    let query = `
      SELECT * FROM device_tokens 
      WHERE is_active = true 
      ORDER BY last_used_at DESC
    `;
    const values: any[] = [];

    if (limit) {
      query += ` LIMIT $1`;
      values.push(limit);
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapDeviceTokenRow(row));
  }

  async getTokenStatistics(): Promise<{
    totalTokens: number;
    activeTokens: number;
    tokensByPlatform: Record<DevicePlatform, number>;
    recentlyUsedTokens: number; // Used in last 7 days
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
        COUNT(*) FILTER (WHERE platform = 'ios' AND is_active = true) as ios_tokens,
        COUNT(*) FILTER (WHERE platform = 'android' AND is_active = true) as android_tokens,
        COUNT(*) FILTER (WHERE platform = 'web' AND is_active = true) as web_tokens,
        COUNT(*) FILTER (WHERE is_active = true AND last_used_at > NOW() - INTERVAL '7 days') as recently_used_tokens
      FROM device_tokens
    `;
    
    const result = await this.db.query(query);
    const row = result.rows[0];
    
    return {
      totalTokens: parseInt(row.total_tokens) || 0,
      activeTokens: parseInt(row.active_tokens) || 0,
      tokensByPlatform: {
        ios: parseInt(row.ios_tokens) || 0,
        android: parseInt(row.android_tokens) || 0,
        web: parseInt(row.web_tokens) || 0
      },
      recentlyUsedTokens: parseInt(row.recently_used_tokens) || 0
    };
  }

  async cleanupInactiveTokens(daysInactive: number = 30): Promise<number> {
    const query = `
      UPDATE device_tokens 
      SET is_active = false 
      WHERE is_active = true 
        AND last_used_at < NOW() - INTERVAL '${daysInactive} days'
      RETURNING id
    `;
    
    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  async deleteOldInactiveTokens(daysOld: number = 90): Promise<number> {
    const query = `
      DELETE FROM device_tokens 
      WHERE is_active = false 
        AND last_used_at < NOW() - INTERVAL '${daysOld} days'
      RETURNING id
    `;
    
    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  async getUsersWithActiveTokens(platform?: DevicePlatform): Promise<string[]> {
    let query = `
      SELECT DISTINCT user_id 
      FROM device_tokens 
      WHERE is_active = true
    `;
    const values: any[] = [];

    if (platform) {
      query += ' AND platform = $1';
      values.push(platform);
    }

    const result = await this.db.query(query, values);
    return result.rows.map(row => row.user_id);
  }

  async updateLastUsedAt(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    const query = `
      UPDATE device_tokens 
      SET last_used_at = NOW() 
      WHERE token = ANY($1) AND is_active = true
    `;
    
    await this.db.query(query, [tokens]);
  }

  async getTokensForUsers(userIds: string[], platform?: DevicePlatform): Promise<DeviceToken[]> {
    if (userIds.length === 0) return [];

    let query = `
      SELECT * FROM device_tokens 
      WHERE user_id = ANY($1) AND is_active = true
    `;
    const values: any[] = [userIds];

    if (platform) {
      query += ' AND platform = $2';
      values.push(platform);
    }

    query += ' ORDER BY last_used_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapDeviceTokenRow(row));
  }

  private mapDeviceTokenRow(row: any): DeviceToken {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      platform: row.platform,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    };
  }
}