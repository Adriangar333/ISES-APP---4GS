import { Pool } from 'pg';
import { 
  Notification, 
  NotificationTemplate, 
  NotificationPreference, 
  NotificationHistory,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
  NotificationStats
} from '../types';

export class NotificationRepository {
  constructor(private db: Pool) {}

  // Notification CRUD operations
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
    const query = `
      INSERT INTO notifications (
        type, priority, title, message, data, recipient_id, recipient_type,
        channels, status, scheduled_for, expires_at, max_retries, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      notification.type,
      notification.priority,
      notification.title,
      notification.message,
      JSON.stringify(notification.data || {}),
      notification.recipientId,
      notification.recipientType,
      notification.channels,
      notification.status,
      notification.scheduledFor,
      notification.expiresAt,
      notification.maxRetries,
      notification.createdBy
    ];

    const result = await this.db.query(query, values);
    return this.mapNotificationRow(result.rows[0]);
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapNotificationRow(result.rows[0]);
  }

  async getNotificationsByRecipient(
    recipientId: string, 
    recipientType: string,
    limit: number = 50,
    offset: number = 0,
    status?: NotificationStatus
  ): Promise<Notification[]> {
    let query = `
      SELECT * FROM notifications 
      WHERE recipient_id = $1 AND recipient_type = $2
    `;
    const values: any[] = [recipientId, recipientType];
    
    if (status) {
      query += ' AND status = $3';
      values.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapNotificationRow(row));
  }

  async getPendingNotifications(limit: number = 100): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications 
      WHERE status = 'pending' 
        AND (scheduled_for IS NULL OR scheduled_for <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY priority DESC, created_at ASC
      LIMIT $1
    `;
    
    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => this.mapNotificationRow(row));
  }

  async updateNotificationStatus(
    id: string, 
    status: NotificationStatus,
    additionalFields?: {
      sentAt?: Date;
      deliveredAt?: Date;
      readAt?: Date;
      retryCount?: number;
    }
  ): Promise<void> {
    let query = 'UPDATE notifications SET status = $1, updated_at = NOW()';
    const values: any[] = [status];
    let paramIndex = 2;

    if (additionalFields?.sentAt) {
      query += `, sent_at = $${paramIndex}`;
      values.push(additionalFields.sentAt);
      paramIndex++;
    }

    if (additionalFields?.deliveredAt) {
      query += `, delivered_at = $${paramIndex}`;
      values.push(additionalFields.deliveredAt);
      paramIndex++;
    }

    if (additionalFields?.readAt) {
      query += `, read_at = $${paramIndex}`;
      values.push(additionalFields.readAt);
      paramIndex++;
    }

    if (additionalFields?.retryCount !== undefined) {
      query += `, retry_count = $${paramIndex}`;
      values.push(additionalFields.retryCount);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex}`;
    values.push(id);

    await this.db.query(query, values);
  }

  async markAsRead(notificationId: string): Promise<void> {
    const query = `
      UPDATE notifications 
      SET status = 'read', read_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status != 'read'
    `;
    await this.db.query(query, [notificationId]);
  }

  async markMultipleAsRead(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;
    
    const query = `
      UPDATE notifications 
      SET status = 'read', read_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1) AND status != 'read'
    `;
    await this.db.query(query, [notificationIds]);
  }

  // Template operations
  async getNotificationTemplate(type: NotificationType): Promise<NotificationTemplate | null> {
    const query = 'SELECT * FROM notification_templates WHERE type = $1 AND is_active = true';
    const result = await this.db.query(query, [type]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapTemplateRow(result.rows[0]);
  }

  async getAllNotificationTemplates(): Promise<NotificationTemplate[]> {
    const query = 'SELECT * FROM notification_templates ORDER BY type, name';
    const result = await this.db.query(query);
    return result.rows.map(row => this.mapTemplateRow(row));
  }

  async updateNotificationTemplate(
    id: string, 
    updates: Partial<NotificationTemplate>
  ): Promise<void> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.title) {
      fields.push(`title = $${paramIndex}`);
      values.push(updates.title);
      paramIndex++;
    }

    if (updates.messageTemplate) {
      fields.push(`message_template = $${paramIndex}`);
      values.push(updates.messageTemplate);
      paramIndex++;
    }

    if (updates.emailTemplate) {
      fields.push(`email_template = $${paramIndex}`);
      values.push(updates.emailTemplate);
      paramIndex++;
    }

    if (updates.defaultChannels) {
      fields.push(`default_channels = $${paramIndex}`);
      values.push(updates.defaultChannels);
      paramIndex++;
    }

    if (updates.defaultPriority) {
      fields.push(`default_priority = $${paramIndex}`);
      values.push(updates.defaultPriority);
      paramIndex++;
    }

    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex}`);
      values.push(updates.isActive);
      paramIndex++;
    }

    if (fields.length === 0) return;

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE notification_templates SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
    await this.db.query(query, values);
  }

  // Preference operations
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
    const query = 'SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY notification_type';
    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapPreferenceRow(row));
  }

  async updateNotificationPreference(
    userId: string,
    notificationType: NotificationType,
    updates: Partial<NotificationPreference>
  ): Promise<void> {
    const fields = [];
    const values: any[] = [userId, notificationType];
    let paramIndex = 3;

    if (updates.channels) {
      fields.push(`channels = $${paramIndex}`);
      values.push(updates.channels);
      paramIndex++;
    }

    if (updates.isEnabled !== undefined) {
      fields.push(`is_enabled = $${paramIndex}`);
      values.push(updates.isEnabled);
      paramIndex++;
    }

    if (updates.quietHoursStart) {
      fields.push(`quiet_hours_start = $${paramIndex}`);
      values.push(updates.quietHoursStart);
      paramIndex++;
    }

    if (updates.quietHoursEnd) {
      fields.push(`quiet_hours_end = $${paramIndex}`);
      values.push(updates.quietHoursEnd);
      paramIndex++;
    }

    if (fields.length === 0) return;

    fields.push('updated_at = NOW()');

    const query = `
      UPDATE notification_preferences 
      SET ${fields.join(', ')} 
      WHERE user_id = $1 AND notification_type = $2
    `;
    await this.db.query(query, values);
  }

  // History operations
  async addNotificationHistory(history: Omit<NotificationHistory, 'id'>): Promise<void> {
    const query = `
      INSERT INTO notification_history (
        notification_id, channel, status, attempted_at, delivered_at, error_message, response_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    const values = [
      history.notificationId,
      history.channel,
      history.status,
      history.attemptedAt,
      history.deliveredAt,
      history.errorMessage,
      JSON.stringify(history.responseData || {})
    ];

    await this.db.query(query, values);
  }

  async getNotificationHistory(notificationId: string): Promise<NotificationHistory[]> {
    const query = `
      SELECT * FROM notification_history 
      WHERE notification_id = $1 
      ORDER BY attempted_at DESC
    `;
    const result = await this.db.query(query, [notificationId]);
    return result.rows.map(row => this.mapHistoryRow(row));
  }

  // Statistics
  async getNotificationStats(
    startDate?: Date,
    endDate?: Date,
    recipientId?: string
  ): Promise<NotificationStats> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      values.push(endDate);
      paramIndex++;
    }

    if (recipientId) {
      whereClause += ` AND recipient_id = $${paramIndex}`;
      values.push(recipientId);
      paramIndex++;
    }

    // Get overall stats
    const overallQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')) as total_sent,
        COUNT(*) FILTER (WHERE status IN ('delivered', 'read')) as total_delivered,
        COUNT(*) FILTER (WHERE status = 'read') as total_read,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed
      FROM notifications ${whereClause}
    `;

    const overallResult = await this.db.query(overallQuery, values);
    const overall = overallResult.rows[0];

    // Get stats by type and priority (simplified for now)
    return {
      totalSent: parseInt(overall.total_sent) || 0,
      totalDelivered: parseInt(overall.total_delivered) || 0,
      totalRead: parseInt(overall.total_read) || 0,
      totalFailed: parseInt(overall.total_failed) || 0,
      byChannel: {} as any, // Would need more complex query
      byType: {} as any, // Would need more complex query
      byPriority: {} as any // Would need more complex query
    };
  }

  // Cleanup expired notifications
  async cleanupExpiredNotifications(): Promise<number> {
    const query = `
      DELETE FROM notifications 
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING id
    `;
    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  // Helper methods to map database rows to objects
  private mapNotificationRow(row: any): Notification {
    return {
      id: row.id,
      type: row.type,
      priority: row.priority,
      title: row.title,
      message: row.message,
      data: row.data || {},
      recipientId: row.recipient_id,
      recipientType: row.recipient_type,
      channels: row.channels || [],
      status: row.status,
      scheduledFor: row.scheduled_for,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      expiresAt: row.expires_at,
      retryCount: row.retry_count || 0,
      maxRetries: row.max_retries || 3,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapTemplateRow(row: any): NotificationTemplate {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      title: row.title,
      messageTemplate: row.message_template,
      emailTemplate: row.email_template,
      pushTemplate: row.push_template,
      defaultChannels: row.default_channels || [],
      defaultPriority: row.default_priority,
      isActive: row.is_active,
      variables: row.variables || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapPreferenceRow(row: any): NotificationPreference {
    return {
      id: row.id,
      userId: row.user_id,
      notificationType: row.notification_type,
      channels: row.channels || [],
      isEnabled: row.is_enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapHistoryRow(row: any): NotificationHistory {
    return {
      id: row.id,
      notificationId: row.notification_id,
      channel: row.channel,
      status: row.status,
      attemptedAt: row.attempted_at,
      deliveredAt: row.delivered_at,
      errorMessage: row.error_message,
      responseData: row.response_data || {}
    };
  }
}