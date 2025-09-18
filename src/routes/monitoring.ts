import { Router } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { getWebSocketService } from '../services/WebSocketService';

const router = Router();
const monitoringService = new MonitoringService();

/**
 * GET /monitoring/dashboard
 * Get comprehensive monitoring dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await monitoringService.getMonitoringDashboardData();
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching monitoring dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monitoring dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /monitoring/zones/performance
 * Get zone performance metrics
 */
router.get('/zones/performance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const metrics = await monitoringService.getZonePerformanceMetrics(start, end);
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching zone performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zone performance metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /monitoring/zones/comparison
 * Get comparative analysis between metropolitan and rural zones
 */
router.get('/zones/comparison', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const comparison = await monitoringService.getZoneTypeComparison(start, end);
    
    res.json({
      success: true,
      data: comparison,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching zone comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zone comparison',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /monitoring/alerts
 * Get active alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const webSocketService = getWebSocketService();
    const alerts = webSocketService.getActiveAlerts();
    
    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /monitoring/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { supervisorId } = req.body;
    
    if (!supervisorId) {
      return res.status(400).json({
        success: false,
        message: 'Supervisor ID is required'
      });
    }
    
    const webSocketService = getWebSocketService();
    webSocketService.acknowledgeAlert(alertId, supervisorId);
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /monitoring/alerts/:alertId
 * Remove an alert
 */
router.delete('/alerts/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const webSocketService = getWebSocketService();
    webSocketService.removeAlert(alertId);
    
    res.json({
      success: true,
      message: 'Alert removed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error removing alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove alert',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /monitoring/inspector-locations
 * Get current inspector locations
 */
router.get('/inspector-locations', async (req, res) => {
  try {
    const webSocketService = getWebSocketService();
    const locations = webSocketService.getInspectorLocations();
    
    res.json({
      success: true,
      data: locations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching inspector locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspector locations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /monitoring/connection-stats
 * Get WebSocket connection statistics
 */
router.get('/connection-stats', async (req, res) => {
  try {
    const webSocketService = getWebSocketService();
    const stats = webSocketService.getConnectionStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching connection stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch connection stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /monitoring/health-check
 * Trigger system health check
 */
router.post('/health-check', async (req, res) => {
  try {
    await monitoringService.checkSystemHealth();
    
    res.json({
      success: true,
      message: 'System health check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during health check:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete health check',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /monitoring/zone-colors
 * Get zone colors for visualization
 */
router.get('/zone-colors', async (req, res) => {
  try {
    const colors = monitoringService.getAllZoneColors();
    
    res.json({
      success: true,
      data: colors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching zone colors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zone colors',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /monitoring/broadcast
 * Broadcast announcement to all users
 */
router.post('/broadcast', async (req, res) => {
  try {
    const { title, message, type, targetAudience } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }
    
    const webSocketService = getWebSocketService();
    webSocketService.broadcastAnnouncement({
      title,
      message,
      type: type || 'info',
      targetAudience: targetAudience || 'all'
    });
    
    res.json({
      success: true,
      message: 'Announcement broadcasted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error broadcasting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to broadcast announcement',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;