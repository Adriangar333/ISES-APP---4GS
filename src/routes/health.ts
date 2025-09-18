import { Router, Request, Response } from 'express';
import { DatabaseConnection } from '../config/database';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    redis: 'connected' | 'disconnected' | 'error';
  };
  uptime: number;
  version: string;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'disconnected',
      redis: 'disconnected',
    },
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check database connection
  try {
    const isConnected = await DatabaseConnection.testConnection();
    healthStatus.services.database = isConnected ? 'connected' : 'error';
    if (!isConnected) {
      healthStatus.status = 'unhealthy';
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    healthStatus.services.database = 'error';
    healthStatus.status = 'unhealthy';
  }

  // Check Redis connection (simplified for now)
  try {
    // TODO: Implement Redis health check when Redis client is set up
    healthStatus.services.redis = 'connected';
  } catch (error) {
    console.error('Redis health check failed:', error);
    healthStatus.services.redis = 'error';
    healthStatus.status = 'unhealthy';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if all critical services are ready
    const isDbReady = await DatabaseConnection.testConnection();
    
    if (!isDbReady) {
      throw new Error('Database not ready');
    }
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Services not available',
    });
  }
});

export default router;