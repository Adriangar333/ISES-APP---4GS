import { Pool } from 'pg';
import { PushNotificationService, PushNotificationConfig } from '../../services/PushNotificationService';
import { DeviceTokenRepository } from '../../repositories/DeviceTokenRepository';
import { DevicePlatform, PushNotificationPayload } from '../../types';

// Mock the dependencies
jest.mock('firebase-admin');
jest.mock('node-apn');
jest.mock('../../repositories/DeviceTokenRepository');

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let mockDb: jest.Mocked<Pool>;
  let mockDeviceTokenRepository: jest.Mocked<DeviceTokenRepository>;
  let config: PushNotificationConfig;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    mockDeviceTokenRepository = {
      createDeviceToken: jest.fn(),
      getDeviceTokensByUser: jest.fn(),
      deactivateDeviceToken: jest.fn(),
      deactivateDeviceTokensByTokens: jest.fn(),
      getTokenStatistics: jest.fn(),
      cleanupInactiveTokens: jest.fn(),
    } as any;

    (DeviceTokenRepository as jest.Mock).mockImplementation(() => mockDeviceTokenRepository);

    config = {
      fcm: {
        serviceAccount: {
          projectId: 'test-project',
          privateKey: 'test-private-key',
          clientEmail: 'test@test-project.iam.gserviceaccount.com'
        }
      },
      apns: {
        keyId: 'test-key-id',
        teamId: 'test-team-id',
        keyPath: '/path/to/key.p8',
        bundleId: 'com.test.app'
      }
    };

    service = new PushNotificationService(mockDb, config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Device Token Management', () => {
    it('should register a device token', async () => {
      const userId = 'user-123';
      const token = 'device-token-123';
      const platform: DevicePlatform = 'android';

      mockDeviceTokenRepository.createDeviceToken.mockResolvedValue({
        id: 'token-id-123',
        userId,
        token,
        platform,
        isActive: true,
        lastUsedAt: new Date(),
        createdAt: new Date()
      });

      await service.registerDeviceToken(userId, token, platform);

      expect(mockDeviceTokenRepository.createDeviceToken).toHaveBeenCalledWith({
        userId,
        token,
        platform,
        isActive: true,
        lastUsedAt: expect.any(Date)
      });
    });

    it('should unregister a device token', async () => {
      const userId = 'user-123';
      const token = 'device-token-123';

      mockDeviceTokenRepository.deactivateDeviceToken.mockResolvedValue();

      await service.unregisterDeviceToken(userId, token);

      expect(mockDeviceTokenRepository.deactivateDeviceToken).toHaveBeenCalledWith(userId, token);
    });

    it('should get user device tokens', async () => {
      const userId = 'user-123';
      const platform: DevicePlatform = 'ios';
      const mockTokens = [
        {
          id: 'token-1',
          userId,
          token: 'token-123',
          platform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        }
      ];

      mockDeviceTokenRepository.getDeviceTokensByUser.mockResolvedValue(mockTokens);

      const result = await service.getUserDeviceTokens(userId, platform);

      expect(result).toEqual(mockTokens);
      expect(mockDeviceTokenRepository.getDeviceTokensByUser).toHaveBeenCalledWith(userId, platform, true);
    });

    it('should remove invalid tokens', async () => {
      const invalidTokens = ['token-1', 'token-2'];

      mockDeviceTokenRepository.deactivateDeviceTokensByTokens.mockResolvedValue();

      await service.removeInvalidTokens(invalidTokens);

      expect(mockDeviceTokenRepository.deactivateDeviceTokensByTokens).toHaveBeenCalledWith(invalidTokens);
    });
  });

  describe('Push Notification Sending', () => {
    it('should handle empty device tokens gracefully', async () => {
      const userId = 'user-123';
      const payload: PushNotificationPayload = {
        title: 'Test Notification',
        body: 'Test message',
        priority: 'normal'
      };

      mockDeviceTokenRepository.getDeviceTokensByUser.mockResolvedValue([]);

      const result = await service.sendPushNotification(userId, payload);

      expect(result).toEqual({
        notificationId: '',
        totalRecipients: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        results: [],
        deliveredAt: expect.any(Date)
      });
    });

    it('should filter tokens by platform when specified', async () => {
      const userId = 'user-123';
      const payload: PushNotificationPayload = {
        title: 'Test Notification',
        body: 'Test message',
        priority: 'normal'
      };
      const platforms: DevicePlatform[] = ['android'];

      const mockTokens = [
        {
          id: 'token-1',
          userId,
          token: 'android-token',
          platform: 'android' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        },
        {
          id: 'token-2',
          userId,
          token: 'ios-token',
          platform: 'ios' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        }
      ];

      mockDeviceTokenRepository.getDeviceTokensByUser.mockResolvedValue(mockTokens);

      // Mock FCM to avoid actual sending
      const mockFCMSend = jest.fn().mockResolvedValue([{
        platform: 'android',
        token: 'android-token',
        success: true,
        messageId: 'msg-123'
      }]);

      // Replace the private method for testing
      (service as any).sendFCMNotifications = mockFCMSend;
      (service as any).sendAPNSNotifications = jest.fn().mockResolvedValue([]);
      (service as any).sendWebPushNotifications = jest.fn().mockResolvedValue([]);

      const result = await service.sendPushNotification(userId, payload, platforms);

      expect(result.totalRecipients).toBe(1); // Only Android token should be used
      expect(mockFCMSend).toHaveBeenCalledWith(['android-token'], payload);
    });
  });

  describe('Bulk Notifications', () => {
    it('should send bulk notifications in batches', async () => {
      const userIds = Array.from({ length: 150 }, (_, i) => `user-${i}`);
      const payload: PushNotificationPayload = {
        title: 'Bulk Notification',
        body: 'Bulk message',
        priority: 'normal'
      };

      // Mock individual send method
      const mockSendPushNotification = jest.spyOn(service, 'sendPushNotification')
        .mockResolvedValue({
          notificationId: '',
          totalRecipients: 1,
          successfulDeliveries: 1,
          failedDeliveries: 0,
          results: [],
          deliveredAt: new Date()
        });

      const results = await service.sendBulkPushNotifications(userIds, payload);

      expect(results).toHaveLength(150);
      expect(mockSendPushNotification).toHaveBeenCalledTimes(150);
    });
  });

  describe('Statistics and Analytics', () => {
    it('should get token statistics', async () => {
      const mockStats = {
        totalTokens: 100,
        activeTokens: 80,
        tokensByPlatform: {
          ios: 30,
          android: 40,
          web: 10
        },
        recentlyUsedTokens: 60
      };

      mockDeviceTokenRepository.getTokenStatistics.mockResolvedValue(mockStats);

      const result = await service.getTokenStatistics();

      expect(result).toEqual({
        totalTokens: 100,
        activeTokens: 80,
        tokensByPlatform: {
          ios: 30,
          android: 40,
          web: 10
        }
      });
    });

    it('should cleanup inactive tokens', async () => {
      const daysInactive = 30;
      const cleanedCount = 15;

      mockDeviceTokenRepository.cleanupInactiveTokens.mockResolvedValue(cleanedCount);

      const result = await service.cleanupInactiveTokens(daysInactive);

      expect(result).toBe(cleanedCount);
      expect(mockDeviceTokenRepository.cleanupInactiveTokens).toHaveBeenCalledWith(daysInactive);
    });
  });

  describe('User Preferences', () => {
    it('should get user notification preferences', async () => {
      const userId = 'user-123';
      const mockTokens = [
        {
          id: 'token-1',
          userId,
          token: 'token-123',
          platform: 'android' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        }
      ];

      mockDeviceTokenRepository.getDeviceTokensByUser.mockResolvedValue(mockTokens);

      const result = await service.getUserNotificationPreferences(userId);

      expect(result).toEqual({
        pushEnabled: true,
        platforms: ['android'],
        quietHours: undefined
      });
    });

    it('should return disabled preferences for users with no tokens', async () => {
      const userId = 'user-123';

      mockDeviceTokenRepository.getDeviceTokensByUser.mockResolvedValue([]);

      const result = await service.getUserNotificationPreferences(userId);

      expect(result).toEqual({
        pushEnabled: false,
        platforms: [],
        quietHours: undefined
      });
    });
  });

  describe('Helper Methods', () => {
    it('should group tokens by platform correctly', async () => {
      const tokens = [
        {
          id: 'token-1',
          userId: 'user-1',
          token: 'ios-token',
          platform: 'ios' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        },
        {
          id: 'token-2',
          userId: 'user-1',
          token: 'android-token',
          platform: 'android' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        },
        {
          id: 'token-3',
          userId: 'user-1',
          token: 'web-token',
          platform: 'web' as DevicePlatform,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        }
      ];

      const grouped = (service as any).groupTokensByPlatform(tokens);

      expect(grouped).toEqual({
        ios: ['ios-token'],
        android: ['android-token'],
        web: ['web-token']
      });
    });

    it('should stringify data correctly', () => {
      const data = {
        string: 'test',
        number: 123,
        boolean: true,
        object: { nested: 'value' },
        array: [1, 2, 3]
      };

      const stringified = (service as any).stringifyData(data);

      expect(stringified).toEqual({
        string: 'test',
        number: '123',
        boolean: 'true',
        object: '{"nested":"value"}',
        array: '[1,2,3]'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle FCM initialization errors gracefully', () => {
      const invalidConfig = {
        fcm: {
          serviceAccount: null as any
        }
      };

      // Should not throw during construction
      expect(() => {
        new PushNotificationService(mockDb, invalidConfig);
      }).not.toThrow();
    });

    it('should handle APNS initialization errors gracefully', () => {
      const invalidConfig = {
        apns: {
          keyId: '',
          teamId: '',
          keyPath: '/invalid/path',
          bundleId: ''
        }
      };

      // Should not throw during construction
      expect(() => {
        new PushNotificationService(mockDb, invalidConfig);
      }).not.toThrow();
    });
  });
});