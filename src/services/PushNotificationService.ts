import * as admin from 'firebase-admin';
import * as apn from 'node-apn';
import { Pool } from 'pg';
import { DeviceTokenRepository } from '../repositories/DeviceTokenRepository';
import {
  DeviceToken,
  DevicePlatform,
  PushNotificationPayload,
  PushNotificationResult,
  FCMNotificationResult,
  APNSNotificationResult,
  NotificationDeliveryReport,
  NotificationAnalytics
} from '../types';

export interface PushNotificationConfig {
  fcm?: {
    serviceAccountPath?: string;
    serviceAccount?: admin.ServiceAccount;
    projectId?: string;
  };
  apns?: {
    keyId: string;
    teamId: string;
    keyPath: string;
    bundleId: string;
    production?: boolean;
  };
}

export class PushNotificationService {
  private fcmApp?: admin.app.App;
  private apnsProvider?: apn.Provider;
  private db: Pool;
  private deviceTokenRepository: DeviceTokenRepository;
  private config: PushNotificationConfig;

  constructor(db: Pool, config: PushNotificationConfig) {
    this.db = db;
    this.deviceTokenRepository = new DeviceTokenRepository(db);
    this.config = config;
    this.initializeFCM();
    this.initializeAPNS();
  }

  private initializeFCM(): void {
    if (!this.config.fcm) {
      console.warn('FCM configuration not provided. Android push notifications will not be available.');
      return;
    }

    try {
      let serviceAccount: admin.ServiceAccount;

      if (this.config.fcm.serviceAccount) {
        serviceAccount = this.config.fcm.serviceAccount;
      } else if (this.config.fcm.serviceAccountPath) {
        serviceAccount = require(this.config.fcm.serviceAccountPath);
      } else {
        throw new Error('FCM service account not provided');
      }

      this.fcmApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: this.config.fcm.projectId || serviceAccount.project_id
      }, 'push-notifications');

      console.log('FCM initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FCM:', error);
    }
  }

  private initializeAPNS(): void {
    if (!this.config.apns) {
      console.warn('APNS configuration not provided. iOS push notifications will not be available.');
      return;
    }

    try {
      const options: apn.ProviderOptions = {
        token: {
          key: this.config.apns.keyPath,
          keyId: this.config.apns.keyId,
          teamId: this.config.apns.teamId
        },
        production: this.config.apns.production || false
      };

      this.apnsProvider = new apn.Provider(options);
      console.log('APNS initialized successfully');
    } catch (error) {
      console.error('Failed to initialize APNS:', error);
    }
  }

  // Device token management
  async registerDeviceToken(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    await this.deviceTokenRepository.createDeviceToken({
      userId,
      token,
      platform,
      isActive: true,
      lastUsedAt: new Date()
    });
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepository.deactivateDeviceToken(userId, token);
  }

  async getUserDeviceTokens(userId: string, platform?: DevicePlatform): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.getDeviceTokensByUser(userId, platform, true);
  }

  async removeInvalidTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.deviceTokenRepository.deactivateDeviceTokensByTokens(tokens);
  }

  // Push notification sending
  async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload,
    platforms?: DevicePlatform[]
  ): Promise<NotificationDeliveryReport> {
    const deviceTokens = await this.deviceTokenRepository.getDeviceTokensByUser(userId);
    
    let filteredTokens = deviceTokens;
    if (platforms && platforms.length > 0) {
      filteredTokens = deviceTokens.filter(token => platforms.includes(token.platform));
    }

    if (filteredTokens.length === 0) {
      return {
        notificationId: '', // Will be set by caller
        totalRecipients: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        results: [],
        deliveredAt: new Date()
      };
    }

    const results: PushNotificationResult[] = [];
    const invalidTokens: string[] = [];

    // Group tokens by platform for efficient sending
    const tokensByPlatform = this.groupTokensByPlatform(filteredTokens);

    // Send to Android devices via FCM
    if (tokensByPlatform.android.length > 0) {
      const fcmResults = await this.sendFCMNotifications(tokensByPlatform.android, payload);
      results.push(...fcmResults);
      
      // Collect invalid tokens
      fcmResults.forEach(result => {
        if (result.shouldRemoveToken) {
          invalidTokens.push(result.token);
        }
      });
    }

    // Send to iOS devices via APNS
    if (tokensByPlatform.ios.length > 0) {
      const apnsResults = await this.sendAPNSNotifications(tokensByPlatform.ios, payload);
      results.push(...apnsResults);
      
      // Collect invalid tokens
      apnsResults.forEach(result => {
        if (result.shouldRemoveToken) {
          invalidTokens.push(result.token);
        }
      });
    }

    // Send to web devices via FCM (Web Push)
    if (tokensByPlatform.web.length > 0) {
      const webResults = await this.sendWebPushNotifications(tokensByPlatform.web, payload);
      results.push(...webResults);
      
      // Collect invalid tokens
      webResults.forEach(result => {
        if (result.shouldRemoveToken) {
          invalidTokens.push(result.token);
        }
      });
    }

    // Remove invalid tokens
    if (invalidTokens.length > 0) {
      await this.removeInvalidTokens(invalidTokens);
    }

    const successfulDeliveries = results.filter(r => r.success).length;
    const failedDeliveries = results.filter(r => !r.success).length;

    return {
      notificationId: '', // Will be set by caller
      totalRecipients: filteredTokens.length,
      successfulDeliveries,
      failedDeliveries,
      results,
      deliveredAt: new Date()
    };
  }

  async sendBulkPushNotifications(
    userIds: string[],
    payload: PushNotificationPayload,
    platforms?: DevicePlatform[]
  ): Promise<NotificationDeliveryReport[]> {
    const reports: NotificationDeliveryReport[] = [];

    // Process in batches to avoid overwhelming the services
    const batchSize = 100;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchPromises = batch.map(userId => 
        this.sendPushNotification(userId, payload, platforms)
      );
      
      const batchResults = await Promise.all(batchPromises);
      reports.push(...batchResults);
    }

    return reports;
  }

  // FCM implementation
  private async sendFCMNotifications(
    tokens: string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult[]> {
    if (!this.fcmApp) {
      return tokens.map(token => ({
        platform: 'android' as DevicePlatform,
        token,
        success: false,
        error: 'FCM not initialized'
      }));
    }

    const messaging = admin.messaging(this.fcmApp);
    const results: PushNotificationResult[] = [];

    // FCM supports batch sending up to 500 tokens
    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      const message: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl
        },
        data: payload.data ? this.stringifyData(payload.data) : undefined,
        android: {
          priority: payload.priority === 'high' ? 'high' : 'normal',
          notification: {
            icon: payload.icon,
            sound: payload.sound || 'default',
            clickAction: payload.clickAction,
            badge: payload.badge?.toString()
          },
          ttl: payload.ttl ? payload.ttl * 1000 : undefined // Convert to milliseconds
        },
        webpush: payload.clickAction ? {
          fcmOptions: {
            link: payload.clickAction
          }
        } : undefined
      };

      try {
        const response = await messaging.sendMulticast(message);
        
        // Process individual results
        response.responses.forEach((result, index) => {
          const token = batch[index];
          if (result.success) {
            results.push({
              platform: 'android',
              token,
              success: true,
              messageId: result.messageId
            });
          } else {
            const shouldRemoveToken = this.shouldRemoveFCMToken(result.error);
            results.push({
              platform: 'android',
              token,
              success: false,
              error: result.error?.message || 'Unknown FCM error',
              shouldRemoveToken
            });
          }
        });
      } catch (error) {
        // If the entire batch fails, mark all tokens as failed
        batch.forEach(token => {
          results.push({
            platform: 'android',
            token,
            success: false,
            error: error instanceof Error ? error.message : 'FCM batch send failed'
          });
        });
      }
    }

    return results;
  }

  // APNS implementation
  private async sendAPNSNotifications(
    tokens: string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult[]> {
    if (!this.apnsProvider || !this.config.apns) {
      return tokens.map(token => ({
        platform: 'ios' as DevicePlatform,
        token,
        success: false,
        error: 'APNS not initialized'
      }));
    }

    const results: PushNotificationResult[] = [];

    const notification = new apn.Notification({
      alert: {
        title: payload.title,
        body: payload.body
      },
      badge: payload.badge,
      sound: payload.sound || 'default',
      topic: this.config.apns.bundleId,
      payload: payload.data || {},
      priority: payload.priority === 'high' ? 10 : 5,
      expiry: payload.ttl ? Math.floor(Date.now() / 1000) + payload.ttl : undefined
    });

    try {
      const response = await this.apnsProvider.send(notification, tokens);
      
      // Process successful sends
      response.sent.forEach(result => {
        results.push({
          platform: 'ios',
          token: result.device,
          success: true,
          messageId: result.response?.headers?.['apns-id'] as string
        });
      });

      // Process failed sends
      response.failed.forEach(result => {
        const shouldRemoveToken = this.shouldRemoveAPNSToken(result.error);
        results.push({
          platform: 'ios',
          token: result.device,
          success: false,
          error: result.error?.message || 'Unknown APNS error',
          shouldRemoveToken
        });
      });
    } catch (error) {
      // If the entire send fails, mark all tokens as failed
      tokens.forEach(token => {
        results.push({
          platform: 'ios',
          token,
          success: false,
          error: error instanceof Error ? error.message : 'APNS send failed'
        });
      });
    }

    return results;
  }

  // Web Push implementation (via FCM)
  private async sendWebPushNotifications(
    tokens: string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult[]> {
    if (!this.fcmApp) {
      return tokens.map(token => ({
        platform: 'web' as DevicePlatform,
        token,
        success: false,
        error: 'FCM not initialized for web push'
      }));
    }

    const messaging = admin.messaging(this.fcmApp);
    const results: PushNotificationResult[] = [];

    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      const message: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl
        },
        data: payload.data ? this.stringifyData(payload.data) : undefined,
        webpush: {
          notification: {
            icon: payload.icon,
            badge: payload.icon,
            requireInteraction: payload.priority === 'high',
            actions: payload.clickAction ? [{
              action: 'open',
              title: 'Open'
            }] : undefined
          },
          fcmOptions: payload.clickAction ? {
            link: payload.clickAction
          } : undefined
        }
      };

      try {
        const response = await messaging.sendMulticast(message);
        
        response.responses.forEach((result, index) => {
          const token = batch[index];
          if (result.success) {
            results.push({
              platform: 'web',
              token,
              success: true,
              messageId: result.messageId
            });
          } else {
            const shouldRemoveToken = this.shouldRemoveFCMToken(result.error);
            results.push({
              platform: 'web',
              token,
              success: false,
              error: result.error?.message || 'Unknown web push error',
              shouldRemoveToken
            });
          }
        });
      } catch (error) {
        batch.forEach(token => {
          results.push({
            platform: 'web',
            token,
            success: false,
            error: error instanceof Error ? error.message : 'Web push batch send failed'
          });
        });
      }
    }

    return results;
  }

  // Helper methods
  private groupTokensByPlatform(tokens: DeviceToken[]): Record<DevicePlatform, string[]> {
    const grouped: Record<DevicePlatform, string[]> = {
      ios: [],
      android: [],
      web: []
    };

    tokens.forEach(deviceToken => {
      grouped[deviceToken.platform].push(deviceToken.token);
    });

    return grouped;
  }

  private stringifyData(data: Record<string, any>): Record<string, string> {
    const stringified: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      stringified[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return stringified;
  }

  private shouldRemoveFCMToken(error?: admin.messaging.MessagingError): boolean {
    if (!error) return false;
    
    const invalidTokenErrors = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument'
    ];
    
    return invalidTokenErrors.includes(error.code);
  }

  private shouldRemoveAPNSToken(error?: any): boolean {
    if (!error) return false;
    
    // APNS error codes that indicate invalid tokens
    const invalidTokenStatuses = [400, 410]; // Bad request, Gone
    return invalidTokenStatuses.includes(error.status);
  }



  // Analytics and reporting
  async getNotificationAnalytics(
    notificationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationAnalytics | null> {
    // This would require additional tracking tables for opens/clicks
    // For now, return a basic structure
    return {
      notificationId,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      platformBreakdown: {
        ios: { sent: 0, delivered: 0, opened: 0, clicked: 0 },
        android: { sent: 0, delivered: 0, opened: 0, clicked: 0 },
        web: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
      }
    };
  }

  async getUserNotificationPreferences(userId: string): Promise<{
    pushEnabled: boolean;
    platforms: DevicePlatform[];
    quietHours?: { start: string; end: string };
  }> {
    // This would integrate with the notification preferences system
    // For now, return default preferences
    const tokens = await this.getUserDeviceTokens(userId);
    return {
      pushEnabled: tokens.length > 0,
      platforms: [...new Set(tokens.map(t => t.platform))],
      quietHours: undefined
    };
  }

  // Cleanup and maintenance
  async cleanupInactiveTokens(daysInactive: number = 30): Promise<number> {
    return this.deviceTokenRepository.cleanupInactiveTokens(daysInactive);
  }

  async getTokenStatistics(): Promise<{
    totalTokens: number;
    activeTokens: number;
    tokensByPlatform: Record<DevicePlatform, number>;
  }> {
    const stats = await this.deviceTokenRepository.getTokenStatistics();
    return {
      totalTokens: stats.totalTokens,
      activeTokens: stats.activeTokens,
      tokensByPlatform: stats.tokensByPlatform
    };
  }
}