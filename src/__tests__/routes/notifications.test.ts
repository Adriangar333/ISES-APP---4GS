import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createNotificationRoutes } from '../../routes/notifications';
import { NotificationService } from '../../services/NotificationService';

// Mock the NotificationService
jest.mock('../../services/NotificationService');
jest.mock('../../services/WebSocketService', () => ({
  getWebSocketService: jest.fn(() => ({
    notifyInspector: jest.fn(),
    broadcastAnnouncement: jest.fn()
  }))
}));

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id', role: 'admin' };
    next();
  },
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
  }
}));

describe('Notification Routes', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<Pool>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn()
    } as any;

    app = express();
    app.use(express.json());
    app.use('/api/notifications', createNotificationRoutes(mockDb));

    // Get the mocked service instance
    mockNotificationService = jest.mocked(NotificationService).mock.instances[0] as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should get notifications for authenticated user', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          type: 'route_assigned',
          priority: 'medium',
          title: 'New Route Assigned',
          message: 'You have been assigned a new route',
          data: {},
          recipientId: 'test-user-id',
          recipientType: 'user',
          channels: ['websocket'],
          status: 'sent',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockNotificationService.getNotificationsByRecipient = jest.fn().mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/notifications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNotifications);
      expect(mockNotificationService.getNotificationsByRecipient).toHaveBeenCalledWith(
        'test-user-id',
        'user',
        50,
        0,
        undefined
      );
    });

    it('should handle query parameters', async () => {
      mockNotificationService.getNotificationsByRecipient = jest.fn().mockResolvedValue([]);

      await request(app)
        .get('/api/notifications?limit=10&offset=20&status=read')
        .expect(200);

      expect(mockNotificationService.getNotificationsByRecipient).toHaveBeenCalledWith(
        'test-user-id',
        'user',
        10,
        20,
        'read'
      );
    });

    it('should validate query parameters', async () => {
      await request(app)
        .get('/api/notifications?limit=invalid')
        .expect(400);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      mockNotificationService.markAsRead = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .patch('/api/notifications/550e8400-e29b-41d4-a716-446655440000/read')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should validate UUID format', async () => {
      await request(app)
        .patch('/api/notifications/invalid-uuid/read')
        .expect(400);
    });
  });

  describe('PATCH /api/notifications/read-multiple', () => {
    it('should mark multiple notifications as read', async () => {
      const notificationIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001'
      ];

      mockNotificationService.markMultipleAsRead = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .patch('/api/notifications/read-multiple')
        .send({ notificationIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockNotificationService.markMultipleAsRead).toHaveBeenCalledWith(notificationIds);
    });

    it('should validate notification IDs array', async () => {
      await request(app)
        .patch('/api/notifications/read-multiple')
        .send({ notificationIds: [] })
        .expect(400);

      await request(app)
        .patch('/api/notifications/read-multiple')
        .send({ notificationIds: ['invalid-uuid'] })
        .expect(400);
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should get user notification preferences', async () => {
      const mockPreferences = [
        {
          id: 'pref-1',
          userId: 'test-user-id',
          notificationType: 'route_assigned',
          channels: ['websocket', 'email'],
          isEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockNotificationService.getUserPreferences = jest.fn().mockResolvedValue(mockPreferences);

      const response = await request(app)
        .get('/api/notifications/preferences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPreferences);
      expect(mockNotificationService.getUserPreferences).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('PATCH /api/notifications/preferences/:type', () => {
    it('should update notification preference', async () => {
      mockNotificationService.updateUserPreference = jest.fn().mockResolvedValue(undefined);

      const updates = {
        channels: ['email'],
        isEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };

      const response = await request(app)
        .patch('/api/notifications/preferences/route_assigned')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockNotificationService.updateUserPreference).toHaveBeenCalledWith(
        'test-user-id',
        'route_assigned',
        updates
      );
    });

    it('should validate notification type', async () => {
      await request(app)
        .patch('/api/notifications/preferences/invalid_type')
        .send({ isEnabled: false })
        .expect(400);
    });

    it('should validate time format', async () => {
      await request(app)
        .patch('/api/notifications/preferences/route_assigned')
        .send({ quietHoursStart: '25:00' })
        .expect(400);
    });
  });

  describe('POST /api/notifications', () => {
    it('should create notification (admin only)', async () => {
      mockNotificationService.createNotification = jest.fn().mockResolvedValue('notification-1');

      const notificationData = {
        type: 'system_alert',
        recipientId: 'user-1',
        recipientType: 'user',
        data: { message: 'Test alert' },
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/notifications')
        .send(notificationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('notification-1');
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        ...notificationData,
        createdBy: 'test-user-id'
      });
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/notifications')
        .send({})
        .expect(400);
    });

    it('should validate notification type', async () => {
      await request(app)
        .post('/api/notifications')
        .send({
          type: 'invalid_type',
          recipientId: 'user-1',
          recipientType: 'user'
        })
        .expect(400);
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('should get notification statistics (admin only)', async () => {
      const mockStats = {
        totalSent: 100,
        totalDelivered: 95,
        totalRead: 80,
        totalFailed: 5,
        byChannel: {},
        byType: {},
        byPriority: {}
      };

      mockNotificationService.getNotificationStats = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/notifications/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockNotificationService.getNotificationStats).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined
      );
    });

    it('should handle date parameters', async () => {
      mockNotificationService.getNotificationStats = jest.fn().mockResolvedValue({} as any);

      await request(app)
        .get('/api/notifications/stats?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&recipientId=user-1')
        .expect(200);

      expect(mockNotificationService.getNotificationStats).toHaveBeenCalledWith(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-31T23:59:59Z'),
        'user-1'
      );
    });
  });

  describe('Convenience endpoints', () => {
    describe('POST /api/notifications/route-assigned', () => {
      it('should send route assignment notification', async () => {
        mockNotificationService.notifyRouteAssigned = jest.fn().mockResolvedValue('notification-1');

        const requestData = {
          routeId: '550e8400-e29b-41d4-a716-446655440000',
          inspectorId: '550e8400-e29b-41d4-a716-446655440001',
          routeName: 'Test Route',
          zoneName: 'Zone A',
          estimatedDuration: 120
        };

        const response = await request(app)
          .post('/api/notifications/route-assigned')
          .send(requestData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('notification-1');
        expect(mockNotificationService.notifyRouteAssigned).toHaveBeenCalledWith(
          requestData.routeId,
          requestData.inspectorId,
          requestData.routeName,
          requestData.zoneName,
          requestData.estimatedDuration
        );
      });

      it('should validate required fields', async () => {
        await request(app)
          .post('/api/notifications/route-assigned')
          .send({})
          .expect(400);
      });
    });

    describe('POST /api/notifications/route-delayed', () => {
      it('should send route delay notifications', async () => {
        mockNotificationService.notifyRouteDelayed = jest.fn().mockResolvedValue(['notification-1', 'notification-2']);

        const requestData = {
          routeId: '550e8400-e29b-41d4-a716-446655440000',
          routeName: 'Test Route',
          delayMinutes: 30,
          inspectorName: 'John Doe',
          supervisorIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']
        };

        const response = await request(app)
          .post('/api/notifications/route-delayed')
          .send(requestData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.ids).toEqual(['notification-1', 'notification-2']);
        expect(mockNotificationService.notifyRouteDelayed).toHaveBeenCalledWith(
          requestData.routeId,
          requestData.routeName,
          requestData.delayMinutes,
          requestData.inspectorName,
          requestData.supervisorIds
        );
      });
    });

    describe('POST /api/notifications/system-alert', () => {
      it('should send system alert', async () => {
        mockNotificationService.notifySystemAlert = jest.fn().mockResolvedValue('notification-1');

        const requestData = {
          message: 'System maintenance scheduled',
          alertType: 'maintenance',
          targetAudience: 'all'
        };

        const response = await request(app)
          .post('/api/notifications/system-alert')
          .send(requestData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('notification-1');
        expect(mockNotificationService.notifySystemAlert).toHaveBeenCalledWith(
          requestData.message,
          requestData.alertType,
          requestData.targetAudience
        );
      });

      it('should default target audience to all', async () => {
        mockNotificationService.notifySystemAlert = jest.fn().mockResolvedValue('notification-1');

        await request(app)
          .post('/api/notifications/system-alert')
          .send({
            message: 'Test alert',
            alertType: 'info'
          })
          .expect(201);

        expect(mockNotificationService.notifySystemAlert).toHaveBeenCalledWith(
          'Test alert',
          'info',
          'all'
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should handle service errors', async () => {
      mockNotificationService.getNotificationsByRecipient = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/notifications')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch notifications');
    });

    it('should handle template not found error', async () => {
      mockNotificationService.createNotification = jest.fn().mockRejectedValue(new Error('No template found for notification type: invalid_type'));

      const response = await request(app)
        .post('/api/notifications')
        .send({
          type: 'system_alert',
          recipientId: 'user-1',
          recipientType: 'user'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No template found for notification type: invalid_type');
    });
  });
});