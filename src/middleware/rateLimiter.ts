import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { config } from '../config';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private redisClient: any;
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = {
      message: 'Too many requests, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req: Request) => req.ip || 'unknown',
      ...options
    };

    // Initialize Redis client for rate limiting
    this.redisClient = createClient({
      url: config.REDIS_URL
    });

    this.redisClient.on('error', (err: Error) => {
      console.error('Redis rate limiter error:', err);
    });

    this.redisClient.connect().catch(console.error);
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.generateKey(req);
        const now = Date.now();
        const windowStart = now - this.options.windowMs;

        // Get current count for this key
        const rateLimitInfo = await this.getCurrentCount(key, windowStart, now);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.options.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, this.options.maxRequests - rateLimitInfo.count).toString(),
          'X-RateLimit-Reset': new Date(rateLimitInfo.resetTime).toISOString()
        });

        // Check if limit exceeded
        if (rateLimitInfo.count > this.options.maxRequests) {
          res.status(429).json({
            error: {
              code: '429',
              message: this.options.message,
              retryAfter: Math.ceil((rateLimitInfo.resetTime - now) / 1000),
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Increment counter
        await this.incrementCounter(key, now);

        // Handle response to potentially skip counting
        if (this.options.skipSuccessfulRequests || this.options.skipFailedRequests) {
          const originalSend = res.send;
          res.send = function(body: any) {
            const statusCode = res.statusCode;
            const shouldSkip = 
              (statusCode < 400 && this.options.skipSuccessfulRequests) ||
              (statusCode >= 400 && this.options.skipFailedRequests);

            if (shouldSkip) {
              // Decrement counter if we should skip this request
              this.decrementCounter(key).catch(console.error);
            }

            return originalSend.call(this, body);
          }.bind(this);
        }

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // Continue without rate limiting if Redis is down
        next();
      }
    };
  }

  private generateKey(req: Request): string {
    const baseKey = this.options.keyGenerator!(req);
    return `rate_limit:${baseKey}:${Math.floor(Date.now() / this.options.windowMs)}`;
  }

  private async getCurrentCount(key: string, windowStart: number, now: number): Promise<RateLimitInfo> {
    try {
      const count = await this.redisClient.get(key);
      const resetTime = windowStart + this.options.windowMs;
      
      return {
        count: count ? parseInt(count, 10) : 0,
        resetTime
      };
    } catch (error) {
      console.error('Error getting rate limit count:', error);
      return { count: 0, resetTime: now + this.options.windowMs };
    }
  }

  private async incrementCounter(key: string, now: number): Promise<void> {
    try {
      const pipeline = this.redisClient.multi();
      pipeline.incr(key);
      pipeline.expire(key, Math.ceil(this.options.windowMs / 1000));
      await pipeline.exec();
    } catch (error) {
      console.error('Error incrementing rate limit counter:', error);
    }
  }

  private async decrementCounter(key: string): Promise<void> {
    try {
      await this.redisClient.decr(key);
    } catch (error) {
      console.error('Error decrementing rate limit counter:', error);
    }
  }
}

// Predefined rate limiters for different endpoints
export const createRateLimiters = () => {
  return {
    // General API rate limiter
    general: new RateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 requests per 15 minutes
      message: 'Too many requests from this IP, please try again later.'
    }),

    // Authentication rate limiter (stricter)
    auth: new RateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 login attempts per 15 minutes
      message: 'Too many authentication attempts, please try again later.',
      keyGenerator: (req: Request) => `auth:${req.ip}:${req.body.email || 'unknown'}`
    }),

    // File upload rate limiter
    upload: new RateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20, // 20 uploads per hour
      message: 'Too many file uploads, please try again later.'
    }),

    // API creation endpoints (stricter)
    creation: new RateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 100, // 100 creations per hour
      message: 'Too many creation requests, please try again later.'
    }),

    // Export endpoints
    export: new RateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 50, // 50 exports per hour
      message: 'Too many export requests, please try again later.'
    })
  };
};