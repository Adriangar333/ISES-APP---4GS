import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import userRoutes from './users';
import roleRoutes from './roles';
import zoneRoutes from './zones';
import inspectorRoutes from './inspectors';
import routeRoutes from './routes';
import adminRoutes from './admin';
import assignmentRoutes from './assignments';
import monitoringRoutes from './monitoring';
import exportRoutes from './exports';
import { createNotificationRoutes } from './notifications';
import { createPushNotificationRoutes } from './push-notifications';
import { DatabaseConnection } from '../config/database';
import { PushNotificationService } from '../services/PushNotificationService';
import { config } from '../config';

const router = Router();

// Health check routes
router.use('/health', healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// User management routes
router.use('/users', userRoutes);

// Role management routes
router.use('/roles', roleRoutes);

// Zone management routes
router.use('/zones', zoneRoutes);

// Inspector management routes
router.use('/inspectors', inspectorRoutes);

// Route management routes
router.use('/routes', routeRoutes);

// Admin routes for KMZ upload and zone boundary setup
router.use('/admin', adminRoutes);

// Assignment routes for automatic route assignment
router.use('/assignments', assignmentRoutes);

// Monitoring routes for supervisor dashboard
router.use('/monitoring', monitoringRoutes);

// Export routes for data export functionality
router.use('/exports', exportRoutes);

// Notification routes for real-time notifications
const db = DatabaseConnection.getInstance();
router.use('/notifications', createNotificationRoutes(db));

// Push notification routes for mobile notifications
const pushNotificationService = new PushNotificationService(db, {
  fcm: config.FCM_CONFIG,
  apns: config.APNS_CONFIG
});
router.use('/push', createPushNotificationRoutes(db, pushNotificationService));

// API root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Route Assignment System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/v1/health',
      ready: '/api/v1/health/ready',
      'auth-login': '/api/v1/auth/login',
      'auth-register': '/api/v1/auth/register',
      'auth-refresh': '/api/v1/auth/refresh',
      'auth-logout': '/api/v1/auth/logout',
      'auth-me': '/api/v1/auth/me',
      'auth-verify': '/api/v1/auth/verify',
      'auth-password-reset': '/api/v1/auth/password-reset/request',
      'auth-password-confirm': '/api/v1/auth/password-reset/confirm',
      'auth-change-password': '/api/v1/auth/change-password',
      users: '/api/v1/users',
      roles: '/api/v1/roles',
      'roles-permissions': '/api/v1/roles/:role/permissions',
      'roles-assign': '/api/v1/roles/assign',
      'roles-check-permission': '/api/v1/roles/check-permission',
      'roles-hierarchy': '/api/v1/roles/hierarchy',
      zones: '/api/v1/zones',
      inspectors: '/api/v1/inspectors',
      'inspectors-availability': '/api/v1/inspectors/availability',
      'inspectors-workload': '/api/v1/inspectors/workload',
      routes: '/api/v1/routes',
      'routes-statistics': '/api/v1/routes/statistics',
      'admin-kmz-upload': '/api/v1/admin/zones/upload-kmz',
      'admin-validate-boundaries': '/api/v1/admin/zones/validate-boundaries',
      'admin-zone-colors': '/api/v1/admin/zones/color-mapping',
      'admin-test-boundaries': '/api/v1/admin/zones/test-boundaries',
      'admin-setup-status': '/api/v1/admin/zones/setup-status',
      'assignments-assign': '/api/v1/assignments/assign',
      'assignments-optimize': '/api/v1/assignments/optimize',
      'assignments-assign-all': '/api/v1/assignments/assign-all',
      'assignments-reassign': '/api/v1/assignments/reassign/:inspectorId',
      'assignments-validate': '/api/v1/assignments/validate',
      'assignments-recommendations': '/api/v1/assignments/recommendations',
      'assignments-options': '/api/v1/assignments/options/default',
      'monitoring-dashboard': '/api/v1/monitoring/dashboard',
      'monitoring-zones-performance': '/api/v1/monitoring/zones/performance',
      'monitoring-zones-comparison': '/api/v1/monitoring/zones/comparison',
      'monitoring-alerts': '/api/v1/monitoring/alerts',
      'monitoring-inspector-locations': '/api/v1/monitoring/inspector-locations',
      'exports-templates': '/api/v1/exports/templates',
      'exports-generate': '/api/v1/exports/generate',
      'exports-preview': '/api/v1/exports/preview',
      notifications: '/api/v1/notifications',
      'notifications-preferences': '/api/v1/notifications/preferences',
      'notifications-read': '/api/v1/notifications/:id/read',
      'notifications-read-multiple': '/api/v1/notifications/read-multiple',
      'notifications-stats': '/api/v1/notifications/stats',
      'notifications-route-assigned': '/api/v1/notifications/route-assigned',
      'notifications-route-delayed': '/api/v1/notifications/route-delayed',
      'notifications-system-alert': '/api/v1/notifications/system-alert',
      'push-register-token': '/api/v1/push/tokens',
      'push-unregister-token': '/api/v1/push/tokens/:token',
      'push-get-tokens': '/api/v1/push/tokens',
      'push-send': '/api/v1/push/send',
      'push-preferences': '/api/v1/push/preferences',
      'push-statistics': '/api/v1/push/statistics',
      'push-test': '/api/v1/push/test',
      'push-cleanup': '/api/v1/push/cleanup',
    },
  });
});

export default router;