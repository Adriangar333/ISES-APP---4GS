import { Pool } from 'pg';
import { NotificationService } from '../../services/NotificationService';
import { NotificationRepository } from '../../repositories/NotificationRepository';
import { NotificationType, NotificationPriority, NotificationChannel } from '../../types';

// Mock the WebSocketService
jest.mock('../../services/WebSocketService', () => ({
  getWebSocketService: jest.fn(() => ({
    notifyInspector: jest.fn(),
    broadcastAnnouncement: jest.fn()
  }))
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

describe('NotificationService', () => {
  let mockDb: jest.Mocked<Pool>;
  let notificationService: NotificationService;
  let mockRepository: jest.Mocked<NotificationRepository>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn()
    } as any;

    // Mock the repository methods
    mockRepository = {
      createNotification: jest.fn(),
      getNotificationById: jest.fn(),
      getNotificationsByRecipient: jest.fn(),
      getPendingNotifications: jest.fn(),
      updateNotificationStatus: jest.fn(),
      markAsRead: jest.fn(),
      markMultipleAsRead: jest.fn(),
      getNotificationTemplate: jest.fn(),
      getAllNotificationTemplates: jest.fn(),
      updateNotificationTemplate: jest.fn(),
      getUserNotificationPreferences: jest.fn(),
      updateNotificationPreference: jest.fn(),
      addNotificationHistory: jest.fn(),
      getNotificationHistory: jest.fn(),
      getNotificationStats: jest.fn(),
      cleanupExpiredNotifications: jest.fn()
    } as any;

    // Create service with test configuration
    notificationService = new NotificationService(mockDb, {
      email: {
        host: 'test-smtp.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'testpass'
        },
        from: 'test@example.com'
      },
      websocket: {
        enabled: true
      }
    });

    // Replace the repository instance
    (notificationService as any).repository = mockRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification with template processing', async () => {
      const mockTemplate = {
        id: 'template-1',
        type: 'route_assigned' as NotificationType,
        name: 'Route Assignment',
        title: 'New Route: {{routeName}}',
        messageTemplate: 'You have been assigned to route {{routeName}} in {{zoneName}}',
        emailTemplate: null,
        pushTemplate: null,
        defaultChannels: ['websocket', 'push'] as NotificationChannel[],
        defaultPriority: 'medium' as NotificationPriority,
        isActive: true,
        variables: ['routeName', 'zoneName'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockNotification = {
        id: 'notification-1',
        type: 'route_assigned' as NotificationType,
        priority: 'medium' as NotificationPriority,
        title: 'New Route: Test Route',
        message: 'You have been assigned to route Test Route in Zone A',
        data: { routeName: 'Test Route', zoneName: 'Zone A' },
        recipientId: 'inspector-1',
        recipientType: 'inspector' as const,
        channels: ['websocket', 'push'] as NotificationChannel[],
        status: 'pending' as const,
        scheduledFor: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        expiresAt: null,
        retryCount: 0,
        maxRetries: 3,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.getNotificationTemplate.mockResolvedValue(mockTemplate);
      mockRepository.createNotification.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        type: 'route_assigned',
        recipientId: 'inspector-1',
        recipientType: 'inspector',
        data: { routeName: 'Test Route', zoneName: 'Zone A' },
        createdBy: 'admin-1'
      });

      expect(result).toBe('notification-1');
      expect(mockRepository.getNotificationTemplate).toHaveBeenCalledWith('route_assigned');
      expect(mockRepository.createNotification).toHaveBeenCalledWith({
        type: 'route_assigned',
        priority: 'medium',
        title: 'New Route: Test Route',
        message: 'You have been assigned to route Test Route in Zone A',
        data: { routeName: 'Test Route', zoneName: 'Zone A' },
        recipientId: 'inspector-1',
        recipientType: 'inspector',
        channels: ['websocket', 'push'],
        status: 'pending',
        scheduledFor: null,
        expiresAt: null,
        retryCount: 0,
        maxRetries: 3,
        createdBy: 'admin-1'
      });
    });

    it('should throw error if template not found', async () => {
      mockRepository.getNotificationTemplate.mockResolvedValue(null);

      await expect(
        notificationService.createNotification({
          type: 'route_assigned',
          recipientId: 'inspector-1',
          recipientType: 'inspector'
        })
      ).rejects.toThrow('No template found for notification type: route_assigned');
    });

    it('should use custom priority and channels when provided', async () => {
      const mockTemplate = {
        id: 'template-1',
        type: 'route_assigned' as NotificationType,
        name: 'Route Assignment',
        title: 'New Route: {{routeName}}',
        messageTemplate: 'You have been assigned to route {{routeName}}',
        emailTemplate: null,
        pushTemplate: null,
        defaultChannels: ['websocket'] as NotificationChannel[],
        defaultPriority: 'medium' as NotificationPriority,
        isActive: true,
        variables: ['routeName'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockNotification = {
        id: 'notification-1',
        type: 'route_assigned' as NotificationType,
        priority: 'high' as NotificationPriority,
        title: 'New Route: Test Route',
        message: 'You have been assigned to route Test Route',
        data: { routeName: 'Test Route' },
        recipientId: 'inspector-1',
        recipientType: 'inspector' as const,
        channels: ['email', 'push'] as NotificationChannel[],
        status: 'pending' as const,
        scheduledFor: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        expiresAt: null,
        retryCount: 0,
        maxRetries: 3,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.getNotificationTemplate.mockResolvedValue(mockTemplate);
      mockRepository.createNotification.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        type: 'route_assigned',
        recipientId: 'inspector-1',
        recipientType: 'inspector',
        data: { routeName: 'Test Route' },
        priority: 'high',
        channels: ['email', 'push']
      });

      expect(result).toBe('notification-1');
      expect(mockRepository.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
          channels: ['email', 'push']
        })
      );
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      const mockTemplate = {
        id: 'template-1',
        type: 'route_assigned' as NotificationType,
        name: 'Route Assignment',
        title: 'New Route Assigned',
        messageTemplate: 'You have been assigned to route {{routeName}} in {{zoneName}}. Estimated duration: {{estimatedDuration}} minutes.',
        emailTemplate: null,
        pushTemplate: null,
        defaultChannels: ['websocket', 'push'] as NotificationChannel[],
        defaultPriority: 'medium' as NotificationPriority,
        isActive: true,
        variables: ['routeName', 'zoneName', 'estimatedDuration'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.getNotificationTemplate.mockResolvedValue(mockTemplate);
      mockRepository.createNotification.mockResolvedValue({
        id: 'notification-1',
        type: 'route_assigned',
        priority: 'medium',
        title: 'New Route Assigned',
        message: 'You have been assigned to route Test Route in Zone A. Estimated duration: 120 minutes.',
        data: { routeName: 'Test Route', zoneName: 'Zone A', estimatedDuration: 120 },
        recipientId: 'inspector-1',
        recipientType: 'inspector',
        channels: ['websocket', 'push'],
        status: 'pending',
        scheduledFor: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        expiresAt: null,
        retryCount: 0,
        maxRetries: 3,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);
    });

    it('should notify route assignment', async () => {
      const result = await notificationService.notifyRouteAssigned(
        'route-1',
        'inspector-1',
        'Test Route',
        'Zone A',
        120
      );

      expect(result).toBe('notification-1');
      expect(mockRepository.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'route_assigned',
          recipientId: 'inspector-1',
          recipientType: 'inspector',
          data: {
            routeId: 'route-1',
            routeName: 'Test Route',
            zoneName: 'Zone A',
            estimatedDuration: 120
          },
          priority: 'medium'
        })
      );
    });

    it('should notify route completion to multiple supervisors', async () => {
      const mockTemplate = {
        id: 'template-2',
        type: 'route_completed' as NotificationType,
        name: 'Route Completion',
        title: 'Route Completed',
        messageTemplate: 'Route {{routeName}} has been completed by {{inspectorName}}.',
        emailTemplate: null,
        pushTemplate: null,
        defaultChannels: ['websocket'] as NotificationChannel[],
        defaultPriority: 'low' as NotificationPriority,
        isActive: true,
        variables: ['routeName', 'inspectorName'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.getNotificationTemplate.mockResolvedValue(mockTemplate);
      mockRepository.createNotification
        .mockResolvedValueOnce({ id: 'notification-1' } as any)
        .mockResolvedValueOnce({ id: 'notification-2' } as any);

      const result = await notificationService.notifyRouteCompleted(
        'route-1',
        'Test Route',
        'John Doe',
        ['supervisor-1', 'supervisor-2']
      );

      expect(result).toEqual(['notification-1', 'notification-2']);
      expect(mockRepository.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should notify system alert', async () => {
      const mockTemplate = {
        id: 'template-3',
        type: 'system_alert' as NotificationType,
        name: 'System Alert',
        title: 'System Alert',
        messageTemplate: '{{alertMessage}}',
        emailTemplate: null,
        pushTemplate: null,
        defaultChannels: ['websocket', 'email'] as NotificationChannel[],
        defaultPriority: 'high' as NotificationPriority,
        isActive: true,
        variables: ['alertMessage', 'alertType'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.getNotificationTemplate.mockResolvedValue(mockTemplate);
      mockRepository.createNotification.mockResolvedValue({ id: 'notification-1' } as any);

      const result = await notificationService.notifySystemAlert(
        'System maintenance scheduled',
        'maintenance',
        'all'
      );

      expect(result).toBe('notification-1');
      expect(mockRepository.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_alert',
          recipientId: 'all',
          recipientType: 'all',
          data: {
            alertMessage: 'System maintenance scheduled',
            alertType: 'maintenance'
          },
          priority: 'high'
        })
      );
    });
  });

  describe('user preferences', () => {
    it('should get user notification preferences', async () => {
      const mockPreferences = [
        {
          id: 'pref-1',
          userId: 'user-1',
          notificationType: 'route_assigned' as NotificationType,
          channels: ['websocket', 'push'] as NotificationChannel[],
          isEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.getUserNotificationPreferences.mockResolvedValue(mockPreferences);

      const result = await notificationService.getUserPreferences('user-1');

      expect(result).toEqual(mockPreferences);
      expect(mockRepository.getUserNotificationPreferences).toHaveBeenCalledWith('user-1');
    });

    it('should update user notification preference', async () => {
      await notificationService.updateUserPreference(
        'user-1',
        'route_assigned',
        { channels: ['email'], isEnabled: false }
      );

      expect(mockRepository.updateNotificationPreference).toHaveBeenCalledWith(
        'user-1',
        'route_assigned',
        { channels: ['email'], isEnabled: false }
      );
    });
  });

  describe('notification management', () => {
    it('should mark notification as read', async () => {
      await notificationService.markAsRead('notification-1');

      expect(mockRepository.markAsRead).toHaveBeenCalledWith('notification-1');
    });

    it('should mark multiple notifications as read', async () => {
      const notificationIds = ['notification-1', 'notification-2'];
      
      await notificationService.markMultipleAsRead(notificationIds);

      expect(mockRepository.markMultipleAsRead).toHaveBeenCalledWith(notificationIds);
    });

    it('should get notifications by recipient', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          type: 'route_assigned' as NotificationType,
          priority: 'medium' as NotificationPriority,
          title: 'Test Notification',
          message: 'Test message',
          data: {},
          recipientId: 'user-1',
          recipientType: 'user' as const,
          channels: ['websocket'] as NotificationChannel[],
          status: 'sent' as const,
          scheduledFor: null,
          sentAt: new Date(),
          deliveredAt: null,
          readAt: null,
          expiresAt: null,
          retryCount: 0,
          maxRetries: 3,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.getNotificationsByRecipient.mockResolvedValue(mockNotifications);

      const result = await notificationService.getNotificationsByRecipient(
        'user-1',
        'user',
        50,
        0,
        'sent'
      );

      expect(result).toEqual(mockNotifications);
      expect(mockRepository.getNotificationsByRecipient).toHaveBeenCalledWith(
        'user-1',
        'user',
        50,
        0,
        'sent'
      );
    });

    it('should get notification statistics', async () => {
      const mockStats = {
        totalSent: 100,
        totalDelivered: 95,
        totalRead: 80,
        totalFailed: 5,
        byChannel: {
          websocket: { sent: 50, delivered: 48, failed: 2 },
          email: { sent: 30, delivered: 29, failed: 1 },
          push: { sent: 20, delivered: 18, failed: 2 },
          sms: { sent: 0, delivered: 0, failed: 0 }
        },
        byType: {} as any,
        byPriority: {} as any
      };

      mockRepository.getNotificationStats.mockResolvedValue(mockStats);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await notificationService.getNotificationStats(startDate, endDate, 'user-1');

      expect(result).toEqual(mockStats);
      expect(mockRepository.getNotificationStats).toHaveBeenCalledWith(startDate, endDate, 'user-1');
    });
  });
});