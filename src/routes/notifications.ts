import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { NotificationService } from '../services/NotificationService';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import { ApiResponse, NotificationType, NotificationPriority, NotificationChannel } from '../types';

export const createNotificationRoutes = (db: Pool): Router => {
  const router = Router();
  
  // Initialize notification service with configuration
  const notificationService = new NotificationService(db, {
    email: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'noreply@routeassignment.com'
    },
    websocket: {
      enabled: true
    }
  });

  // Get notifications for current user
  router.get(
    '/',
    authenticate,
    [
      query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
      query('offset').optional().isInt({ min: 0 }).toInt(),
      query('status').optional().isIn(['pending', 'sent', 'delivered', 'read', 'failed'])
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'User not authenticated'
          } as ApiResponse);
        }

        const { limit = 50, offset = 0, status } = req.query;

        const notifications = await notificationService.getNotificationsByRecipient(
          userId,
          'user',
          limit as number,
          offset as number,
          status as any
        );

        res.json({
          success: true,
          data: notifications,
          message: 'Notifications retrieved successfully'
        } as ApiResponse);

      } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch notifications'
        } as ApiResponse);
      }
    }
  );

  // Mark notification as read
  router.patch(
    '/:id/read',
    authenticate,
    [param('id').isUUID()],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        
        await notificationService.markAsRead(id);

        res.json({
          success: true,
          message: 'Notification marked as read'
        } as ApiResponse);

      } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to mark notification as read'
        } as ApiResponse);
      }
    }
  );

  // Mark multiple notifications as read
  router.patch(
    '/read-multiple',
    authenticate,
    [
      body('notificationIds')
        .isArray({ min: 1 })
        .withMessage('notificationIds must be a non-empty array'),
      body('notificationIds.*').isUUID().withMessage('Each notification ID must be a valid UUID')
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const { notificationIds } = req.body;
        
        await notificationService.markMultipleAsRead(notificationIds);

        res.json({
          success: true,
          message: `${notificationIds.length} notifications marked as read`
        } as ApiResponse);

      } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to mark notifications as read'
        } as ApiResponse);
      }
    }
  );

  // Get user notification preferences
  router.get(
    '/preferences',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'User not authenticated'
          } as ApiResponse);
        }

        const preferences = await notificationService.getUserPreferences(userId);

        res.json({
          success: true,
          data: preferences,
          message: 'Notification preferences retrieved successfully'
        } as ApiResponse);

      } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch notification preferences'
        } as ApiResponse);
      }
    }
  );

  // Update notification preference
  router.patch(
    '/preferences/:type',
    authenticate,
    [
      param('type').isIn([
        'route_assigned', 'route_completed', 'route_delayed', 'route_cancelled',
        'inspector_location_update', 'system_alert', 'assignment_change',
        'incident_reported', 'zone_boundary_update', 'workload_warning', 'maintenance_notice'
      ]),
      body('channels').optional().isArray(),
      body('channels.*').optional().isIn(['websocket', 'email', 'push', 'sms']),
      body('isEnabled').optional().isBoolean(),
      body('quietHoursStart').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      body('quietHoursEnd').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'User not authenticated'
          } as ApiResponse);
        }

        const { type } = req.params;
        const updates = req.body;

        await notificationService.updateUserPreference(
          userId,
          type as NotificationType,
          updates
        );

        res.json({
          success: true,
          message: 'Notification preference updated successfully'
        } as ApiResponse);

      } catch (error) {
        console.error('Error updating notification preference:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to update notification preference'
        } as ApiResponse);
      }
    }
  );

  // Create notification (admin/supervisor only)
  router.post(
    '/',
    authenticate,
    requirePermission('notifications', 'create'),
    [
      body('type').isIn([
        'route_assigned', 'route_completed', 'route_delayed', 'route_cancelled',
        'inspector_location_update', 'system_alert', 'assignment_change',
        'incident_reported', 'zone_boundary_update', 'workload_warning', 'maintenance_notice'
      ]),
      body('recipientId').notEmpty().withMessage('Recipient ID is required'),
      body('recipientType').isIn(['user', 'inspector', 'zone', 'all']),
      body('data').optional().isObject(),
      body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
      body('channels').optional().isArray(),
      body('channels.*').optional().isIn(['websocket', 'email', 'push', 'sms']),
      body('scheduledFor').optional().isISO8601().toDate(),
      body('expiresAt').optional().isISO8601().toDate()
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const createdBy = req.user?.userId;
        const notificationData = {
          ...req.body,
          createdBy
        };

        const notificationId = await notificationService.createNotification(notificationData);

        res.status(201).json({
          success: true,
          data: { id: notificationId },
          message: 'Notification created successfully'
        } as ApiResponse);

      } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to create notification'
        } as ApiResponse);
      }
    }
  );

  // Get notification statistics (admin/supervisor only)
  router.get(
    '/stats',
    authenticate,
    requirePermission('notifications', 'read'),
    [
      query('startDate').optional().isISO8601().toDate(),
      query('endDate').optional().isISO8601().toDate(),
      query('recipientId').optional().notEmpty()
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const { startDate, endDate, recipientId } = req.query;

        const stats = await notificationService.getNotificationStats(
          startDate as Date,
          endDate as Date,
          recipientId as string
        );

        res.json({
          success: true,
          data: stats,
          message: 'Notification statistics retrieved successfully'
        } as ApiResponse);

      } catch (error) {
        console.error('Error fetching notification statistics:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch notification statistics'
        } as ApiResponse);
      }
    }
  );

  // Convenience endpoints for common notification types

  // Notify route assignment
  router.post(
    '/route-assigned',
    authenticate,
    requirePermission('notifications', 'create'),
    [
      body('routeId').isUUID(),
      body('inspectorId').isUUID(),
      body('routeName').notEmpty(),
      body('zoneName').notEmpty(),
      body('estimatedDuration').isInt({ min: 1 })
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const { routeId, inspectorId, routeName, zoneName, estimatedDuration } = req.body;

        const notificationId = await notificationService.notifyRouteAssigned(
          routeId,
          inspectorId,
          routeName,
          zoneName,
          estimatedDuration
        );

        res.status(201).json({
          success: true,
          data: { id: notificationId },
          message: 'Route assignment notification sent'
        } as ApiResponse);

      } catch (error) {
        console.error('Error sending route assignment notification:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to send route assignment notification'
        } as ApiResponse);
      }
    }
  );

  // Notify route delay
  router.post(
    '/route-delayed',
    authenticate,
    requirePermission('notifications', 'create'),
    [
      body('routeId').isUUID(),
      body('routeName').notEmpty(),
      body('delayMinutes').isInt({ min: 1 }),
      body('inspectorName').notEmpty(),
      body('supervisorIds').isArray({ min: 1 }),
      body('supervisorIds.*').isUUID()
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const { routeId, routeName, delayMinutes, inspectorName, supervisorIds } = req.body;

        const notificationIds = await notificationService.notifyRouteDelayed(
          routeId,
          routeName,
          delayMinutes,
          inspectorName,
          supervisorIds
        );

        res.status(201).json({
          success: true,
          data: { ids: notificationIds },
          message: 'Route delay notifications sent'
        } as ApiResponse);

      } catch (error) {
        console.error('Error sending route delay notifications:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to send route delay notifications'
        } as ApiResponse);
      }
    }
  );

  // Send system alert
  router.post(
    '/system-alert',
    authenticate,
    requirePermission('notifications', 'create'),
    [
      body('message').notEmpty(),
      body('alertType').notEmpty(),
      body('targetAudience').optional().isIn(['all', 'supervisors', 'inspectors'])
    ],
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const { message, alertType, targetAudience = 'all' } = req.body;

        const notificationId = await notificationService.notifySystemAlert(
          message,
          alertType,
          targetAudience
        );

        res.status(201).json({
          success: true,
          data: { id: notificationId },
          message: 'System alert sent'
        } as ApiResponse);

      } catch (error) {
        console.error('Error sending system alert:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to send system alert'
        } as ApiResponse);
      }
    }
  );

  return router;
};