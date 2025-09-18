import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createPushNotificationRoutes } from '../../routes/push-notifications';
import { PushNotificationService } from '../../services/PushNotificationService';
import { authenticate } from '../../middleware/auth';
import { DevicePlatform } from '../../types';

// Mock dependencies
jest.mock('../../services/PushNotificationService');
jest.mock('../../middleware/auth');

describe('Push Notification Routes', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<Pool>;
  let mockPushService: jest.Mocked<PushNotificationService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    mockPushService = {
      registerDeviceToken: jest.fn(),
      unregisterDeviceToken: jest.fn(),
      getUserDeviceTokens: jest.fn(),
      sendPushNotification: jest.fn(),
      sendBulkPushNotifications: jest.fn(),
      getUserNotificationPreferences: jest.fn(),
      getTokenStatistics: jest.fn(),
      cleanupInactiveTokens: jest.fn(),
    } as any;

    // Mock authentication middleware
    (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin'
      };
      next();
    });

    const router = createPushNotificationRoutes(mockDb, mockPushService);
    app.use('/api/push', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/push/tokens', () => {
    it('should register a device token successfully', async () => {
      mockPushService.registerDeviceToken.mockResolvedValue();

      const response = await request(app)
        .post('/api/push/tokens')
        .send({
          token: 'device-token-123',
          platform: 'android'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Device token registered successfully');
      expect(mockPushService.registerDeviceToken).toHaveBeenCalledWith(
        'user-123',
        'device-token-123',
        'android'
      );
    });

    it('should validate token registration request', async () => {
      const response = await request(app)
        .post('/api/push/tokens')
        .send({
          token: '', // Invalid empty token
          platform: 'invalid-platform'
        });

      expect(response.status).toBe(400);
      expect(mockPushService.registerDeviceToken).not.toHaveBeenCalled();
    });

    it('should handle registration errors', async () => {
      mockPushService.registerDeviceToken.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/push/tokens')
        .send({
          token: 'device-token-123',
          platform: 'android'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to register device token');
    });
  });

  describe('DELETE /api/push/tokens/:token', () => {
    it('should unregister a device token successfully', async () => {
      mockPushService.unregisterDeviceToken.mockResolvedValue();

      const response = await request(app)
        .delete('/api/push/tokens/device-token-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Device token unregistered successfully');
      expect(mockPushService.unregisterDeviceToken).toHaveBeenCalledWith(
        'user-123',
        'device-token-123'
      );
    });

    it('should handle unregistration errors', async () => {
      mockPushService.unregisterDeviceToken.mockRejectedValue(new Error('Token not found'));

      const response = await request(app)
        .delete('/api/push/tokens/device-token-123');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/push/tokens', () => {
    it('should get user device tokens', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'user-123',
          token: 'device-token-123',
          platform: 'android' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        }
      ];

      mockPushService.getUserDeviceTokens.mockResolvedValue(mockTokens);

      const response = await request(app)
        .get('/api/push/tokens');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTokens);
      expect(mockPushService.getUserDeviceTokens).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should filter tokens by platform', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'user-123',
          token: 'ios-token-123',
          platform: 'ios' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        }
      ];

      mockPushService.getUserDeviceTokens.mockResolvedValue(mockTokens);

      const response = await request(app)
        .get('/api/push/tokens?platform=ios');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockTokens);
      expect(mockPushService.getUserDeviceTokens).toHaveBeenCalledWith('user-123', 'ios');
    });
  });

  describe('POST /api/push/send', () => {
    beforeEach(() => {
      // Mock admin user for send permissions
      (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          userId: 'admin-123',
          email: 'admin@example.com',
          role: 'admin'
        };
        next();
      });
    });

    it('should send bulk push notifications successfully', async () => {
      const mockReports = [
        {
          notificationId: '',
          totalRecipients: 2,
          successfulDeliveries: 2,
          failedDeliveries: 0,
          results: [],
          deliveredAt: new Date()
        }
      ];

      mockPushService.sendBulkPushNotifications.mockResolvedValue(mockReports);

      const response = await request(app)
        .post('/api/push/send')
        .send({
          userIds: ['user-1', 'user-2'],
          title: 'Test Notification',
          body: 'Test message',
          priority: 'high',
          platforms: ['android', 'ios']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRecipients).toBe(2);
      expect(response.body.data.successfulDeliveries).toBe(2);
      expect(mockPushService.sendBulkPushNotifications).toHaveBeenCalledWith(
        ['user-1', 'user-2'],
        expect.objectContaining({
          title: 'Test Notification',
          body: 'Test message',
          priority: 'high'
        }),
        ['android', 'ios']
      );
    });

    it('should reject non-admin users', async () => {
      (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          userId: 'user-123',
          email: 'user@example.com',
          role: 'inspector'
        };
        next();
      });

      const response = await request(app)
        .post('/api/push/send')
        .send({
          userIds: ['user-1'],
          title: 'Test Notification',
          body: 'Test message'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions to send push notifications');
    });

    it('should validate send notification request', async () => {
      const response = await request(app)
        .post('/api/push/send')
        .send({
          userIds: [], // Empty array should fail validation
          title: 'Test Notification',
          body: 'Test message'
        });

      expect(response.status).toBe(400);
      expect(mockPushService.sendBulkPushNotifications).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/push/preferences', () => {
    it('should get user notification preferences', async () => {
      const mockPreferences = {
        pushEnabled: true,
        platforms: ['android', 'ios'] as DevicePlatform[],
        quietHours: {
          start: '22:00',
          end: '08:00'
        }
      };

      mockPushService.getUserNotificationPreferences.mockResolvedValue(mockPreferences);

      const response = await request(app)
        .get('/api/push/preferences');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPreferences);
    });
  });

  describe('PUT /api/push/preferences', () => {
    it('should update notification preferences', async () => {
      const response = await request(app)
        .put('/api/push/preferences')
        .send({
          pushEnabled: true,
          platforms: ['android'],
          quietHours: {
            start: '23:00',
            end: '07:00'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification preferences updated successfully');
    });

    it('should validate preferences update request', async () => {
      const response = await request(app)
        .put('/api/push/preferences')
        .send({
          pushEnabled: 'invalid', // Should be boolean
          platforms: ['invalid-platform']
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/push/statistics', () => {
    beforeEach(() => {
      (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          userId: 'admin-123',
          email: 'admin@example.com',
          role: 'admin'
        };
        next();
      });
    });

    it('should get push notification statistics for admin', async () => {
      const mockStats = {
        totalTokens: 100,
        activeTokens: 80,
        tokensByPlatform: {
          ios: 30,
          android: 40,
          web: 10
        }
      };

      mockPushService.getTokenStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/push/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });

    it('should reject non-admin users', async () => {
      (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          userId: 'user-123',
          email: 'user@example.com',
          role: 'supervisor'
        };
        next();
      });

      const response = await request(app)
        .get('/api/push/statistics');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Admin access required');
    });
  });

  describe('POST /api/push/test', () => {
    beforeEach(() => {
      (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          userId: 'admin-123',
          email: 'admin@example.com',
          role: 'admin'
        };
        next();
      });
    });

    it('should send test notification for admin', async () => {
      const mockReport = {
        notificationId: '',
        totalRecipients: 1,
        successfulDeliveries: 1,
        failedDeliveries: 0,
        results: [{
          platform: 'android' as DevicePlatform,
          token: 'test-token',
          success: true,
          messageId: 'msg-123'
        }],
        deliveredAt: new Date()
      };

      mockPushService.sendPushNotification.mockResolvedValue(mockReport);

      const response = await request(app)
        .post('/api/push/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRecipients).toBe(1);
      expect(response.body.data.successfulDeliveries).toBe(1);
      expect(mockPushService.sendPushNotification).toHaveBeenCalledWith(
        'admin-123',
        expect.objectContaining({
          title: 'Test Notification',
          body: 'This is a test push notification from the Route Assignment System'
        })
      );
    });
  });

  describe('POST /api/push/cleanup', () => {
    beforeEach(() => {
      (authenticate as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          userId: 'admin-123',
          email: 'admin@example.com',
          role: 'admin'
        };
        next();
      });
    });

    it('should cleanup inactive tokens for admin', async () => {
      mockPushService.cleanupInactiveTokens.mockResolvedValue(15);

      const response = await request(app)
        .post('/api/push/cleanup')
        .send({ daysInactive: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cleanedTokens).toBe(15);
      expect(response.body.data.daysInactive).toBe(30);
      expect(mockPushService.cleanupInactiveTokens).toHaveBeenCalledWith(30);
    });

    it('should use default days inactive if not provided', async () => {
      mockPushService.cleanupInactiveTokens.mockResolvedValue(10);

      const response = await request(app)
        .post('/api/push/cleanup')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.daysInactive).toBe(30);
      expect(mockPushService.cleanupInactiveTokens).toHaveBeenCalledWith(30);
    });
  });
});