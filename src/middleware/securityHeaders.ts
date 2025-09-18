import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
  };
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  referrerPolicy?: string;
  permissionsPolicy?: Record<string, string[]>;
  crossOriginEmbedderPolicy?: string;
  crossOriginOpenerPolicy?: string;
  crossOriginResourcePolicy?: string;
}

export class SecurityHeaders {
  private options: SecurityHeadersOptions;

  constructor(options: SecurityHeadersOptions = {}) {
    this.options = {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for some mapping libraries
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "wss:", "https:"],
          mediaSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: []
        },
        reportOnly: false
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: ["'self'"],
        microphone: ["'none'"],
        geolocation: ["'self'"],
        payment: ["'none'"],
        usb: ["'none'"],
        magnetometer: ["'none'"],
        gyroscope: ["'none'"],
        accelerometer: ["'none'"]
      },
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
      ...options
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Content Security Policy
      if (this.options.contentSecurityPolicy) {
        const csp = this.buildCSP(this.options.contentSecurityPolicy);
        const headerName = this.options.contentSecurityPolicy.reportOnly 
          ? 'Content-Security-Policy-Report-Only' 
          : 'Content-Security-Policy';
        res.setHeader(headerName, csp);
      }

      // HTTP Strict Transport Security (only for HTTPS)
      if (req.secure && this.options.hsts) {
        const hsts = this.buildHSTS(this.options.hsts);
        res.setHeader('Strict-Transport-Security', hsts);
      }

      // Referrer Policy
      if (this.options.referrerPolicy) {
        res.setHeader('Referrer-Policy', this.options.referrerPolicy);
      }

      // Permissions Policy
      if (this.options.permissionsPolicy) {
        const permissionsPolicy = this.buildPermissionsPolicy(this.options.permissionsPolicy);
        res.setHeader('Permissions-Policy', permissionsPolicy);
      }

      // Cross-Origin Embedder Policy
      if (this.options.crossOriginEmbedderPolicy) {
        res.setHeader('Cross-Origin-Embedder-Policy', this.options.crossOriginEmbedderPolicy);
      }

      // Cross-Origin Opener Policy
      if (this.options.crossOriginOpenerPolicy) {
        res.setHeader('Cross-Origin-Opener-Policy', this.options.crossOriginOpenerPolicy);
      }

      // Cross-Origin Resource Policy
      if (this.options.crossOriginResourcePolicy) {
        res.setHeader('Cross-Origin-Resource-Policy', this.options.crossOriginResourcePolicy);
      }

      // Additional security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('X-Download-Options', 'noopen');
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

      // Remove server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');

      next();
    };
  }

  private buildCSP(csp: NonNullable<SecurityHeadersOptions['contentSecurityPolicy']>): string {
    const directives: string[] = [];

    for (const [directive, sources] of Object.entries(csp.directives || {})) {
      if (sources.length === 0) {
        directives.push(this.camelToKebab(directive));
      } else {
        directives.push(`${this.camelToKebab(directive)} ${sources.join(' ')}`);
      }
    }

    return directives.join('; ');
  }

  private buildHSTS(hsts: NonNullable<SecurityHeadersOptions['hsts']>): string {
    let hstsValue = `max-age=${hsts.maxAge}`;

    if (hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains';
    }

    if (hsts.preload) {
      hstsValue += '; preload';
    }

    return hstsValue;
  }

  private buildPermissionsPolicy(permissions: Record<string, string[]>): string {
    const policies: string[] = [];

    for (const [feature, allowlist] of Object.entries(permissions)) {
      const policy = `${this.camelToKebab(feature)}=(${allowlist.join(' ')})`;
      policies.push(policy);
    }

    return policies.join(', ');
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }
}

// API Key management middleware
export class ApiKeyManager {
  private validApiKeys: Set<string>;

  constructor(apiKeys: string[] = []) {
    this.validApiKeys = new Set(apiKeys);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Skip API key validation for certain routes
      const skipRoutes = ['/health', '/api/v1/auth/login', '/api/v1/auth/register'];
      if (skipRoutes.some(route => req.path.startsWith(route))) {
        return next();
      }

      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        res.status(401).json({
          error: {
            code: '401',
            message: 'API key required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!this.validApiKeys.has(apiKey)) {
        res.status(401).json({
          error: {
            code: '401',
            message: 'Invalid API key',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      next();
    };
  }

  addApiKey(apiKey: string): void {
    this.validApiKeys.add(apiKey);
  }

  removeApiKey(apiKey: string): void {
    this.validApiKeys.delete(apiKey);
  }

  isValidApiKey(apiKey: string): boolean {
    return this.validApiKeys.has(apiKey);
  }
}

// HTTPS enforcement middleware
export const httpsEnforcement = (options: { trustProxy?: boolean } = {}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in development
    if (config.NODE_ENV === 'development') {
      return next();
    }

    const isSecure = options.trustProxy 
      ? req.headers['x-forwarded-proto'] === 'https'
      : req.secure;

    if (!isSecure) {
      const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;
      res.redirect(301, httpsUrl);
      return;
    }

    next();
  };
};

// Request size limiter
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        res.status(413).json({
          error: {
            code: '413',
            message: 'Request entity too large',
            maxSize,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    }

    next();
  };
};

// Helper function to parse size strings like '10mb', '1gb', etc.
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const [, value, unit] = match;
  return parseFloat(value) * units[unit];
}

// Create security middleware with production-ready defaults
export const createSecurityMiddleware = () => {
  const securityHeaders = new SecurityHeaders({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "wss:", "https:"],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : undefined
      }
    }
  });

  return {
    securityHeaders: securityHeaders.middleware(),
    httpsEnforcement: httpsEnforcement({ trustProxy: true }),
    requestSizeLimiter: requestSizeLimiter('50mb') // Larger for file uploads
  };
};