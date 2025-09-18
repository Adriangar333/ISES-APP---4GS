import { Pool } from 'pg';
import { UserProfile } from '../types';
import { DatabaseConnection } from '../config/database';

export class UserProfileRepository {
  private db: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Create a new user profile
   */
  async create(profileData: {
    userId: string;
    inspectorId?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
    preferences?: Record<string, any>;
  }): Promise<UserProfile> {
    const { userId, inspectorId, firstName, lastName, phone, preferences = {} } = profileData;

    const query = `
      INSERT INTO user_profiles (user_id, inspector_id, first_name, last_name, phone, preferences)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, inspector_id, first_name, last_name, phone, avatar_url, preferences, created_at, updated_at
    `;

    const result = await this.db.query(query, [
      userId,
      inspectorId || null,
      firstName || null,
      lastName || null,
      phone || null,
      JSON.stringify(preferences),
    ]);

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Find profile by user ID
   */
  async findByUserId(userId: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, user_id, inspector_id, first_name, last_name, phone, avatar_url, preferences, created_at, updated_at
      FROM user_profiles
      WHERE user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0] ? this.mapRowToProfile(result.rows[0]) : null;
  }

  /**
   * Find profile by ID
   */
  async findById(id: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, user_id, inspector_id, first_name, last_name, phone, avatar_url, preferences, created_at, updated_at
      FROM user_profiles
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapRowToProfile(result.rows[0]) : null;
  }

  /**
   * Find profile by inspector ID
   */
  async findByInspectorId(inspectorId: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, user_id, inspector_id, first_name, last_name, phone, avatar_url, preferences, created_at, updated_at
      FROM user_profiles
      WHERE inspector_id = $1
    `;

    const result = await this.db.query(query, [inspectorId]);
    return result.rows[0] ? this.mapRowToProfile(result.rows[0]) : null;
  }

  /**
   * Update user profile
   */
  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const allowedFields = ['inspector_id', 'first_name', 'last_name', 'phone', 'avatar_url', 'preferences'];
    const setClause = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        let dbField = key;
        let dbValue = value;

        // Handle camelCase to snake_case conversion
        if (key === 'inspectorId') dbField = 'inspector_id';
        else if (key === 'firstName') dbField = 'first_name';
        else if (key === 'lastName') dbField = 'last_name';
        else if (key === 'avatarUrl') dbField = 'avatar_url';

        // Handle JSON fields
        if (key === 'preferences') {
          dbValue = JSON.stringify(value);
        }

        setClause.push(`${dbField} = $${paramIndex++}`);
        params.push(dbValue);
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);
    const query = `
      UPDATE user_profiles
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, user_id, inspector_id, first_name, last_name, phone, avatar_url, preferences, created_at, updated_at
    `;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Delete user profile
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM user_profiles WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error('Profile not found');
    }
  }

  /**
   * Delete profile by user ID
   */
  async deleteByUserId(userId: string): Promise<void> {
    const query = `DELETE FROM user_profiles WHERE user_id = $1`;
    await this.db.query(query, [userId]);
  }

  /**
   * Get all profiles with user information
   */
  async findAllWithUsers(
    page: number = 1,
    limit: number = 10
  ): Promise<{ profiles: (UserProfile & { userEmail: string; userRole: string })[]; total: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
    `;
    const countResult = await this.db.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    // Get profiles with user info
    const query = `
      SELECT 
        up.id, up.user_id, up.inspector_id, up.first_name, up.last_name, 
        up.phone, up.avatar_url, up.preferences, up.created_at, up.updated_at,
        u.email as user_email, u.role as user_role
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      ORDER BY up.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.db.query(query, [limit, offset]);
    const profiles = result.rows.map(row => ({
      ...this.mapRowToProfile(row),
      userEmail: row.user_email,
      userRole: row.user_role,
    }));

    return { profiles, total };
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Record<string, any>): Promise<UserProfile> {
    const query = `
      UPDATE user_profiles
      SET preferences = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING id, user_id, inspector_id, first_name, last_name, phone, avatar_url, preferences, created_at, updated_at
    `;

    const result = await this.db.query(query, [JSON.stringify(preferences), userId]);
    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Link profile to inspector
   */
  async linkToInspector(userId: string, inspectorId: string): Promise<UserProfile> {
    const query = `
      UPDATE user_profiles
      SET inspector_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING id, user_id, inspector_id, first_name, last_name, phone, avatar_url, preferences, created_at, updated_at
    `;

    const result = await this.db.query(query, [inspectorId, userId]);
    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    return this.mapRowToProfile(result.rows[0]);
  }

  /**
   * Map database row to UserProfile object
   */
  private mapRowToProfile(row: any): UserProfile {
    const profile: UserProfile = {
      id: row.id,
      userId: row.user_id,
      preferences: row.preferences ? JSON.parse(row.preferences) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
    
    if (row.inspector_id) profile.inspectorId = row.inspector_id;
    if (row.first_name) profile.firstName = row.first_name;
    if (row.last_name) profile.lastName = row.last_name;
    if (row.phone) profile.phone = row.phone;
    if (row.avatar_url) profile.avatarUrl = row.avatar_url;
    
    return profile;
  }
}