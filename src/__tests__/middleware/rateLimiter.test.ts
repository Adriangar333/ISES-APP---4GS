import request from 'supertest';
import { createApp } from '../../app';
import { RateLimiter } from '../../middleware/rateLimiter';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue('0'),
    multi: jest.fn(() => ({
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([])
    })),
    decr: jest.fn().mockResolvedValue(0)
  }))
}));

describe('Rate Limiter Middleware', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
  });

  describe('RateLimiter class', () => {
    it('should create rate limiter with default options', () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      expect(rateLimiter).toBeDefined();
    });

    it('should allow requests within limit', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      const middleware = rateLimiter.middleware();
      const req = { ip: '127.0.0.1' } as any;
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': expect.any(String),
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should block requests exceeding limit', async () => {
      // Mock Redis to return count exceeding limit
      const mockRedisClient = require('redis').createClient();
      mockRedisClient.get.mockResolvedValue('11');

      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      const middleware = rateLimiter.middleware();
      const req = { ip: '127.0.0.1' } as any;
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: '429',
          message: expect.any(String),
          retryAfter: expect.any(Number),
          timestamp: expect.any(String)
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const customKeyGenerator = jest.fn().mockReturnValue('custom-key');
      
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: customKeyGenerator
      });

      const middleware = rateLimiter.middleware();
      const req = { ip: '127.0.0.1', user: { id: 'user123' } } as any;
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      await middleware(req, res, next);

      expect(customKeyGenerator).toHaveBeenCalledWith(req);
    });

    it('should handle Redis errors gracefully', async () => {
      // Mock Redis to throw error
      const mockRedisClient = require('redis').createClient();
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      const middleware = rateLimiter.middleware();
      const req = { ip: '127.0.0.1' } as any;
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      await middleware(req, res, next);

      // Should continue without rate limiting when Redis fails
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Integration with Express app', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      // Make multiple requests to auth endpoint
      const promises = Array(12).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'test@test.com', password: 'password' })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should set rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should have different limits for different endpoints', async () => {
      // Test general endpoint
      const generalResponse = await request(app)
        .get('/api/v1/health');

      // Test auth endpoint
      const authResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@test.com', password: 'password' });

      // Auth should have stricter limits
      const generalLimit = parseInt(generalResponse.headers['x-ratelimit-limit']);
      const authLimit = parseInt(authResponse.headers['x-ratelimit-limit']);

      expect(authLimit).toBeLessThan(generalLimit);
    });
  });
});