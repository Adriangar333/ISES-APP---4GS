import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createRateLimiters } from './middleware/rateLimiter';
import { createSanitizers } from './middleware/sanitization';
import { createSecurityMiddleware } from './middleware/securityHeaders';
import routes from './routes';

export const createApp = (): Application => {
  const app: Application = express();

  // Initialize security middleware
  const rateLimiters = createRateLimiters();
  const sanitizers = createSanitizers();
  const securityMiddleware = createSecurityMiddleware();

  // HTTPS enforcement (production only)
  if (config.NODE_ENV === 'production') {
    app.use(securityMiddleware.httpsEnforcement);
  }

  // Request size limiting
  app.use(securityMiddleware.requestSizeLimiter);

  // General rate limiting
  app.use(rateLimiters.general.middleware());

  // Enhanced security headers
  app.use(securityMiddleware.securityHeaders);

  // Helmet for additional security headers
  app.use(helmet({
    contentSecurityPolicy: false, // We handle this in securityHeaders
    crossOriginEmbedderPolicy: false, // We handle this in securityHeaders
  }));

  // CORS configuration
  app.use(cors({
    origin: config.NODE_ENV === 'production' 
      ? ['https://yourdomain.com', 'https://n8n-n8n.zvkdyr.easypanel.host'] // Replace with actual domain
      : ['http://localhost:3000', 'http://localhost:3001', 'https://n8n-n8n.zvkdyr.easypanel.host'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-api-key'],
  }));

  // Compression middleware
  app.use(compression());

  // Body parsing middleware with security limits
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      // Additional verification can be added here
      if (buf.length === 0) {
        throw new Error('Empty request body');
      }
    }
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 100 // Limit number of parameters
  }));

  // Input sanitization
  app.use(sanitizers.general.middleware());

  // Logging middleware
  if (config.NODE_ENV === 'production') {
    app.use(morgan(config.logging.format));
  } else {
    app.use(requestLogger);
  }

  // Apply specific rate limiters to different routes
  app.use('/api/v1/auth', rateLimiters.auth.middleware());
  app.use('/api/v1/admin/import', rateLimiters.upload.middleware());
  app.use('/api/v1/export', rateLimiters.export.middleware());
  app.use(['/api/v1/zones', '/api/v1/inspectors', '/api/v1/routes'], rateLimiters.creation.middleware());

  // API routes
  app.use(config.API_PREFIX, routes);

  // Serve static files from React build
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendBuildPath));

  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    // Don't serve React app for API routes
    if (req.path.startsWith(config.API_PREFIX)) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};

// Export app instance for testing
export const app = createApp();