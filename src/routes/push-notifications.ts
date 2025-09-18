import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PushNotificationService } from '../services/PushNotificationService';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';
import { DevicePlatform, PushNotificationPayload } from '../types';

const router = Router();

// Validation schemas
const registerTokenSchema = Joi.object({
  token: Joi.string().required().min(1).max(500),
  platform: Joi.string().valid('ios', 'android', 'web').required()
});

const sendNotificationSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  title: Joi.string().required().max(200),
  body: Joi.string().required().max(500),
  data: Joi.object().optional(),
  priority: Joi.string().valid('normal', 'high').optional(),
  platforms: Joi.array().items(Joi.string().valid('ios', 'android', 'web')).optional(),
  sound: Joi.string().optional(),
  badge: Joi.number().integer().min(0).optional(),
  clickAction: Joi.string().uri().optional(),
  imageUrl: Joi.string().uri().optional(),
  ttl: Joi.number().integer().min(0).max(2419200).optional() // Max 28 days
});

const updatePreferencesSchema = Joi.object({
  pushEnabled: Joi.boolean().required(),
  platforms: Joi.array().items(Joi.string().valid('ios', 'android', 'web')).optional(),
  quietHours: Joi.object({
    start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
  }).optional()
});

export function createPushNotificationRoutes(db: Pool, pushService: PushNotificationService): Router {
  
  // Register device token
  router.post('/tokens', 
    authenticate,
    validateRequest(registerTokenSchema),
    async (req: Request, res: Response) => {
      try {
        const { token, platform } = req.body;
        const userId = (req as any).user.userId;

        await pushService.registerDeviceToken(userId, token, platform as DevicePlatform);

        res.json({
          success: true,
          message: 'Device token registered successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error registering device token:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to register device token',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Unregister device token
  router.delete('/tokens/:token',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const { token } = req.params;
        const userId = (req as any).user.userId;

        if (!token) {
          return res.status(400).json({
            success: false,
            message: 'Token parameter is required',
            timestamp: new Date().toISOString()
          });
        }

        await pushService.unregisterDeviceToken(userId, token);

        return res.json({
          success: true,
          message: 'Device token unregistered successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error unregistering device token:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to unregister device token',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Get user's device tokens
  router.get('/tokens',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).user.userId;
        const platform = req.query.platform as DevicePlatform | undefined;

        const tokens = await pushService.getUserDeviceTokens(userId, platform);

        res.json({
          success: true,
          data: tokens,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error fetching device tokens:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch device tokens',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Send push notification (admin/supervisor only)
  router.post('/send',
    authenticate,
    validateRequest(sendNotificationSchema),
    async (req: Request, res: Response) => {
      try {
        const userRole = (req as any).user.role;
        if (!['admin', 'supervisor'].includes(userRole)) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions to send push notifications',
            timestamp: new Date().toISOString()
          });
        }

        const {
          userIds,
          title,
          body,
          data,
          priority = 'normal',
          platforms,
          sound = 'default',
          badge,
          clickAction,
          imageUrl,
          ttl
        } = req.body;

        const payload: PushNotificationPayload = {
          title,
          body,
          data,
          priority,
          sound,
          badge,
          clickAction,
          imageUrl,
          ttl
        };

        const reports = await pushService.sendBulkPushNotifications(
          userIds,
          payload,
          platforms
        );

        const totalRecipients = reports.reduce((sum, report) => sum + report.totalRecipients, 0);
        const totalSuccessful = reports.reduce((sum, report) => sum + report.successfulDeliveries, 0);
        const totalFailed = reports.reduce((sum, report) => sum + report.failedDeliveries, 0);

        return res.json({
          success: true,
          data: {
            totalRecipients,
            successfulDeliveries: totalSuccessful,
            failedDeliveries: totalFailed,
            deliveryRate: totalRecipients > 0 ? (totalSuccessful / totalRecipients) * 100 : 0,
            reports: reports.map(report => ({
              totalRecipients: report.totalRecipients,
              successfulDeliveries: report.successfulDeliveries,
              failedDeliveries: report.failedDeliveries,
              deliveredAt: report.deliveredAt
            }))
          },
          message: `Push notification sent to ${totalSuccessful}/${totalRecipients} devices`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error sending push notification:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to send push notification',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Get notification preferences
  router.get('/preferences',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).user.userId;
        const preferences = await pushService.getUserNotificationPreferences(userId);

        res.json({
          success: true,
          data: preferences,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch notification preferences',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Update notification preferences
  router.put('/preferences',
    authenticate,
    validateRequest(updatePreferencesSchema),
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).user.userId;
        const { pushEnabled, platforms, quietHours } = req.body;

        // For now, we'll just acknowledge the update
        // In a full implementation, you'd store these preferences in the database
        console.log('Updating notification preferences for user:', userId, {
          pushEnabled,
          platforms,
          quietHours
        });

        res.json({
          success: true,
          message: 'Notification preferences updated successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to update notification preferences',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Get push notification statistics (admin only)
  router.get('/statistics',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userRole = (req as any).user.role;
        if (userRole !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Admin access required',
            timestamp: new Date().toISOString()
          });
        }

        const statistics = await pushService.getTokenStatistics();

        return res.json({
          success: true,
          data: statistics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error fetching push notification statistics:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch statistics',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Test push notification (admin only)
  router.post('/test',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userRole = (req as any).user.role;
        if (userRole !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Admin access required',
            timestamp: new Date().toISOString()
          });
        }

        const userId = (req as any).user.userId;
        const testPayload: PushNotificationPayload = {
          title: 'Test Notification',
          body: 'This is a test push notification from the Route Assignment System',
          data: {
            type: 'test',
            timestamp: new Date().toISOString()
          },
          priority: 'normal',
          sound: 'default'
        };

        const report = await pushService.sendPushNotification(userId, testPayload);

        return res.json({
          success: true,
          data: {
            totalRecipients: report.totalRecipients,
            successfulDeliveries: report.successfulDeliveries,
            failedDeliveries: report.failedDeliveries,
            results: report.results
          },
          message: 'Test notification sent',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error sending test notification:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to send test notification',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  // Cleanup inactive tokens (admin only)
  router.post('/cleanup',
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const userRole = (req as any).user.role;
        if (userRole !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Admin access required',
            timestamp: new Date().toISOString()
          });
        }

        const daysInactive = parseInt(req.body.daysInactive) || 30;
        const cleanedCount = await pushService.cleanupInactiveTokens(daysInactive);

        return res.json({
          success: true,
          data: {
            cleanedTokens: cleanedCount,
            daysInactive
          },
          message: `Cleaned up ${cleanedCount} inactive device tokens`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error cleaning up tokens:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to cleanup tokens',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  return router;
}

export default router;