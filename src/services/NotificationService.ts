import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { getWebSocketService } from './WebSocketService';
import {
  Notification,
  NotificationTemplate,
  NotificationPreference,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
  EmailNotificationData,
  PushNotificationData,
  WebSocketNotificationData,
  NotificationStats
} from '../types';

export interface NotificationServiceConfig {
  email?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
  };
  push?: {
    fcmServerKey?: string;
    apnsKeyId?: string;
    apnsTeamId?: string;
    apnsKeyPath?: string;
  };
  websocket?: {
    enabled: boolean;
  };
}

export class NotificationService {
  private repository: NotificationRepository;
  private emailTransporter?: nodemailer.Transporter;
  private pushNotificationService?: any; // Will be dynamically imported
  private config: NotificationServiceConfig;
  private processingQueue: Set<string> = new Set();

  constructor(db: Pool, config: NotificationServiceConfig = {}) {
    this.repository = new NotificationRepository(db);
    this.config = config;
    this.initializeEmailTransporter();
    this.initializePushNotificationService(db);
    this.startNotificationProcessor();
  }

  private initializeEmailTransporter(): void {
    if (this.config.email) {
      this.emailTransporter = nodemailer.createTransport({
        host: this.config.email.host,
        port: this.config.email.port,
        secure: this.config.email.secure,
        auth: this.config.email.auth
      });
    }
  }

  private async initializePushNotificationService(db: Pool): Promise<void> {
    if (this.config.push) {
      try {
        const { PushNotificationService } = await import('./PushNotificationService');
        this.pushNotificationService = new PushNotificationService(db, this.config.push);
        console.log('Push notification service initialized');
      } catch (error) {
        console.error('Failed to initialize push notification service:', error);
      }
    }
  }

  // Main method to create and send notifications
  async createNotification(params: {
    type: NotificationType;
    recipientId: string;
    recipientType: 'user' | 'inspector' | 'zone' | 'all';
    data?: Record<string, any>;
    priority?: NotificationPriority;
    channels?: NotificationChannel[];
    scheduledFor?: Date;
    expiresAt?: Date;
    createdBy?: string;
  }): Promise<string> {
    // Get notification template
    const template = await this.repository.getNotificationTemplate(params.type);
    if (!template) {
      throw new Error(`No template found for notification type: ${params.type}`);
    }

    // Process template with data
    const processedContent = this.processTemplate(template, params.data || {});

    // Determine channels based on user preferences or defaults
    const channels = params.channels || template.defaultChannels;
    const priority = params.priority || template.defaultPriority;

    // Create notification record
    const notification = await this.repository.createNotification({
      type: params.type,
      priority,
      title: processedContent.title,
      message: processedContent.message,
      data: params.data || {},
      recipientId: params.recipientId,
      recipientType: params.recipientType,
      channels,
      status: 'pending',
      scheduledFor: params.scheduledFor || null,
      expiresAt: params.expiresAt || null,
      retryCount: 0,
      maxRetries: 3,
      createdBy: params.createdBy || null
    });

    // If not scheduled, process immediately
    if (!params.scheduledFor || params.scheduledFor <= new Date()) {
      this.processNotification(notification.id);
    }

    return notification.id;
  }

  // Process template with dynamic data
  private processTemplate(template: NotificationTemplate, data: Record<string, any>): {
    title: string;
    message: string;
    emailContent?: string;
    pushContent?: string;
  } {
    const processString = (str: string): string => {
      return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key]?.toString() || match;
      });
    };

    const result: {
      title: string;
      message: string;
      emailContent?: string;
      pushContent?: string;
    } = {
      title: processString(template.title),
      message: processString(template.messageTemplate)
    };

    if (template.emailTemplate) {
      result.emailContent = processString(template.emailTemplate);
    }

    if (template.pushTemplate) {
      result.pushContent = processString(template.pushTemplate);
    }

    return result;
  }

  // Process individual notification
  private async processNotification(notificationId: string): Promise<void> {
    if (this.processingQueue.has(notificationId)) {
      return; // Already being processed
    }

    this.processingQueue.add(notificationId);

    try {
      const notification = await this.repository.getNotificationById(notificationId);
      if (!notification || notification.status !== 'pending') {
        return;
      }

      // Check if notification has expired
      if (notification.expiresAt && notification.expiresAt < new Date()) {
        await this.repository.updateNotificationStatus(notificationId, 'failed');
        return;
      }

      // Get user preferences if recipient is a user
      let userPreferences: NotificationPreference[] = [];
      if (notification.recipientType === 'user') {
        userPreferences = await this.repository.getUserNotificationPreferences(notification.recipientId);
      }

      // Filter channels based on user preferences
      const enabledChannels = this.getEnabledChannels(notification, userPreferences);

      if (enabledChannels.length === 0) {
        await this.repository.updateNotificationStatus(notificationId, 'failed');
        await this.repository.addNotificationHistory({
          notificationId,
          channel: 'websocket', // Default channel for logging
          status: 'failed',
          attemptedAt: new Date(),
          errorMessage: 'No enabled channels for recipient'
        });
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(userPreferences, notification.type)) {
        // Reschedule for later
        const nextSchedule = this.calculateNextScheduleTime(userPreferences);
        // For now, we'll just delay by 1 hour - in production, you'd want more sophisticated scheduling
        return;
      }

      // Send through each enabled channel
      let successCount = 0;
      const errors: string[] = [];

      for (const channel of enabledChannels) {
        try {
          await this.sendThroughChannel(notification, channel);
          successCount++;
          
          await this.repository.addNotificationHistory({
            notificationId,
            channel,
            status: 'delivered',
            attemptedAt: new Date(),
            deliveredAt: new Date()
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${channel}: ${errorMessage}`);
          
          await this.repository.addNotificationHistory({
            notificationId,
            channel,
            status: 'failed',
            attemptedAt: new Date(),
            errorMessage
          });
        }
      }

      // Update notification status
      if (successCount > 0) {
        await this.repository.updateNotificationStatus(notificationId, 'sent', {
          sentAt: new Date()
        });
      } else {
        // All channels failed, increment retry count
        const newRetryCount = notification.retryCount + 1;
        if (newRetryCount >= notification.maxRetries) {
          await this.repository.updateNotificationStatus(notificationId, 'failed', {
            retryCount: newRetryCount
          });
        } else {
          await this.repository.updateNotificationStatus(notificationId, 'pending', {
            retryCount: newRetryCount
          });
          // Schedule retry (exponential backoff)
          setTimeout(() => {
            this.processNotification(notificationId);
          }, Math.pow(2, newRetryCount) * 1000 * 60); // 2^n minutes
        }
      }

    } catch (error) {
      console.error(`Error processing notification ${notificationId}:`, error);
    } finally {
      this.processingQueue.delete(notificationId);
    }
  }

  // Send notification through specific channel
  private async sendThroughChannel(notification: Notification, channel: NotificationChannel): Promise<void> {
    switch (channel) {
      case 'websocket':
        await this.sendWebSocketNotification(notification);
        break;
      case 'email':
        await this.sendEmailNotification(notification);
        break;
      case 'push':
        await this.sendPushNotification(notification);
        break;
      case 'sms':
        await this.sendSMSNotification(notification);
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  // WebSocket notification
  private async sendWebSocketNotification(notification: Notification): Promise<void> {
    try {
      const wsService = getWebSocketService();
      
      const wsData: WebSocketNotificationData = {
        event: 'notification',
        data: {
          id: notification.id,
          type: notification.type,
          priority: notification.priority,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          timestamp: new Date()
        }
      };

      if (notification.recipientType === 'user' || notification.recipientType === 'inspector') {
        wsData.targetUserId = notification.recipientId;
        wsService.notifyInspector(notification.recipientId, {
          type: 'alert',
          title: notification.title,
          message: notification.message,
          data: notification.data
        });
      } else if (notification.recipientType === 'all') {
        wsService.broadcastAnnouncement({
          title: notification.title,
          message: notification.message,
          type: this.mapPriorityToAnnouncementType(notification.priority),
          targetAudience: 'all'
        });
      }
    } catch (error) {
      throw new Error(`WebSocket delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Email notification
  private async sendEmailNotification(notification: Notification): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    // Get recipient email - this would need to be implemented based on your user system
    const recipientEmail = await this.getRecipientEmail(notification.recipientId, notification.recipientType);
    if (!recipientEmail) {
      throw new Error('Recipient email not found');
    }

    const template = await this.repository.getNotificationTemplate(notification.type);
    const emailContent = template?.emailTemplate 
      ? this.processTemplate(template, notification.data || {}).emailContent
      : notification.message;

    const mailOptions = {
      from: this.config.email?.from || 'noreply@routeassignment.com',
      to: recipientEmail,
      subject: notification.title,
      text: notification.message,
      html: emailContent || `<p>${notification.message}</p>`
    };

    try {
      await this.emailTransporter.sendMail(mailOptions);
    } catch (error) {
      throw new Error(`Email delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Push notification implementation
  private async sendPushNotification(notification: Notification): Promise<void> {
    const { PushNotificationService } = await import('./PushNotificationService');
    
    if (!this.pushNotificationService) {
      throw new Error('Push notification service not initialized');
    }

    const template = await this.repository.getNotificationTemplate(notification.type);
    const pushContent = template?.pushTemplate 
      ? this.processTemplate(template, notification.data || {}).pushContent
      : notification.message;

    const payload = {
      title: notification.title,
      body: pushContent || notification.message,
      data: notification.data || {},
      priority: notification.priority === 'critical' || notification.priority === 'high' ? 'high' as const : 'normal' as const,
      sound: 'default',
      badge: 1
    };

    try {
      const report = await this.pushNotificationService.sendPushNotification(
        notification.recipientId,
        payload
      );

      if (report.successfulDeliveries === 0 && report.totalRecipients > 0) {
        throw new Error(`Push notification failed for all ${report.totalRecipients} devices`);
      }

      // Log delivery statistics
      console.log(`Push notification delivered to ${report.successfulDeliveries}/${report.totalRecipients} devices`);
    } catch (error) {
      throw new Error(`Push notification delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // SMS notification (placeholder)
  private async sendSMSNotification(notification: Notification): Promise<void> {
    // This is a placeholder implementation
    // In a real implementation, you would integrate with Twilio, AWS SNS, or similar service
    
    console.log('SMS notification would be sent:', {
      recipientId: notification.recipientId,
      message: notification.message
    });

    // For now, just simulate success
    // throw new Error('SMS notifications not implemented yet');
  }

  // Helper methods
  private getEnabledChannels(notification: Notification, preferences: NotificationPreference[]): NotificationChannel[] {
    if (notification.recipientType !== 'user' || preferences.length === 0) {
      return notification.channels;
    }

    const preference = preferences.find(p => p.notificationType === notification.type);
    if (!preference || !preference.isEnabled) {
      return [];
    }

    return notification.channels.filter(channel => preference.channels.includes(channel));
  }

  private isInQuietHours(preferences: NotificationPreference[], notificationType: NotificationType): boolean {
    const preference = preferences.find(p => p.notificationType === notificationType);
    if (!preference || !preference.quietHoursStart || !preference.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = preference.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preference.quietHoursEnd.split(':').map(Number);
    
    if (startHour === undefined || startMin === undefined || endHour === undefined || endMin === undefined) {
      return false;
    }
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private calculateNextScheduleTime(preferences: NotificationPreference[]): Date {
    // Simple implementation - schedule for 1 hour later
    // In production, you'd want to calculate based on quiet hours end time
    const nextTime = new Date();
    nextTime.setHours(nextTime.getHours() + 1);
    return nextTime;
  }

  private mapPriorityToAnnouncementType(priority: NotificationPriority): 'info' | 'warning' | 'success' | 'error' {
    switch (priority) {
      case 'low': return 'info';
      case 'medium': return 'info';
      case 'high': return 'warning';
      case 'critical': return 'error';
      default: return 'info';
    }
  }

  private async getRecipientEmail(recipientId: string, recipientType: string): Promise<string | null> {
    // This would need to be implemented based on your user/inspector tables
    // For now, return a placeholder
    return `${recipientId}@example.com`;
  }

  // Public API methods
  async getNotificationsByRecipient(
    recipientId: string,
    recipientType: string,
    limit?: number,
    offset?: number,
    status?: NotificationStatus
  ): Promise<Notification[]> {
    return this.repository.getNotificationsByRecipient(recipientId, recipientType, limit, offset, status);
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.repository.markAsRead(notificationId);
  }

  async markMultipleAsRead(notificationIds: string[]): Promise<void> {
    await this.repository.markMultipleAsRead(notificationIds);
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.repository.getUserNotificationPreferences(userId);
  }

  async updateUserPreference(
    userId: string,
    notificationType: NotificationType,
    updates: Partial<NotificationPreference>
  ): Promise<void> {
    await this.repository.updateNotificationPreference(userId, notificationType, updates);
  }

  async getNotificationStats(startDate?: Date, endDate?: Date, recipientId?: string): Promise<NotificationStats> {
    return this.repository.getNotificationStats(startDate, endDate, recipientId);
  }

  // Background processor
  private startNotificationProcessor(): void {
    // Process pending notifications every 30 seconds
    setInterval(async () => {
      try {
        const pendingNotifications = await this.repository.getPendingNotifications(50);
        
        for (const notification of pendingNotifications) {
          this.processNotification(notification.id);
        }
      } catch (error) {
        console.error('Error in notification processor:', error);
      }
    }, 30000);

    // Cleanup expired notifications every hour
    setInterval(async () => {
      try {
        const cleanedCount = await this.repository.cleanupExpiredNotifications();
        if (cleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} expired notifications`);
        }
      } catch (error) {
        console.error('Error cleaning up expired notifications:', error);
      }
    }, 3600000);
  }

  // Convenience methods for common notification types
  async notifyRouteAssigned(routeId: string, inspectorId: string, routeName: string, zoneName: string, estimatedDuration: number): Promise<string> {
    return this.createNotification({
      type: 'route_assigned',
      recipientId: inspectorId,
      recipientType: 'inspector',
      data: {
        routeId,
        routeName,
        zoneName,
        estimatedDuration
      },
      priority: 'medium'
    });
  }

  async notifyRouteCompleted(routeId: string, routeName: string, inspectorName: string, supervisorIds: string[]): Promise<string[]> {
    const notificationIds: string[] = [];
    
    for (const supervisorId of supervisorIds) {
      const id = await this.createNotification({
        type: 'route_completed',
        recipientId: supervisorId,
        recipientType: 'user',
        data: {
          routeId,
          routeName,
          inspectorName
        },
        priority: 'low'
      });
      notificationIds.push(id);
    }
    
    return notificationIds;
  }

  async notifyRouteDelayed(routeId: string, routeName: string, delayMinutes: number, inspectorName: string, supervisorIds: string[]): Promise<string[]> {
    const notificationIds: string[] = [];
    
    for (const supervisorId of supervisorIds) {
      const id = await this.createNotification({
        type: 'route_delayed',
        recipientId: supervisorId,
        recipientType: 'user',
        data: {
          routeId,
          routeName,
          delayMinutes,
          inspectorName
        },
        priority: 'high'
      });
      notificationIds.push(id);
    }
    
    return notificationIds;
  }

  async notifySystemAlert(message: string, alertType: string, targetAudience: 'all' | 'supervisors' | 'inspectors' = 'all'): Promise<string> {
    return this.createNotification({
      type: 'system_alert',
      recipientId: targetAudience,
      recipientType: 'all',
      data: {
        alertMessage: message,
        alertType
      },
      priority: 'high'
    });
  }
}