import request from 'supertest';
import { createApp } from '../../app';
import { SecurityHeaders, ApiKeyManager, httpsEnforcement } from '../../middleware/securityHeaders';

describe('Security Headers Middleware', () => {
  describe('SecurityHeaders class', () => {
    it('should set default security headers', () => {
      const securityHeaders = new SecurityHeaders();
      const middleware = securityHeaders.middleware();

      const req = {} as any;
      const res = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(res.removeHeader).toHaveBeenCalledWith('Server');
      expect(next).toHaveBeenCalled();
    });

    it('should set HSTS header for HTTPS requests', () => {
      const securityHeaders = new SecurityHeaders();
      const middleware = securityHeaders.middleware();

      const req = { secure: true } as any;
      const res = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should not set HSTS header for HTTP requests', () => {
      const securityHeaders = new SecurityHeaders();
      const middleware = securityHeaders.middleware();

      const req = { secure: false } as any;
      const res = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.any(String)
      );
    });

    it('should build CSP header correctly', () => {
      const securityHeaders = new SecurityHeaders({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"]
          }
        }
      });

      const middleware = securityHeaders.middleware();
      const req = {} as any;
      const res = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      const cspCall = res.setHeader.mock.calls.find(call => call[0] === 'Content-Security-Policy');
      expect(cspCall[1]).toContain("default-src 'self'");
      expect(cspCall[1]).toContain("script-src 'self' 'unsafe-inline'");
      expect(cspCall[1]).toContain("style-src 'self' https://fonts.googleapis.com");
    });

    it('should set CSP report-only header when configured', () => {
      const securityHeaders = new SecurityHeaders({
        contentSecurityPolicy: {
          directives: { defaultSrc: ["'self'"] },
          reportOnly: true
        }
      });

      const middleware = securityHeaders.middleware();
      const req = {} as any;
      const res = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy-Report-Only',
        expect.any(String)
      );
    });

    it('should build Permissions Policy header correctly', () => {
      const securityHeaders = new SecurityHeaders({
        permissionsPolicy: {
          camera: ["'self'"],
          microphone: ["'none'"],
          geolocation: ["'self'", "https://example.com"]
        }
      });

      const middleware = securityHeaders.middleware();
      const req = {} as any;
      const res = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      const permissionsCall = res.setHeader.mock.calls.find(call => call[0] === 'Permissions-Policy');
      expect(permissionsCall[1]).toContain("camera=('self')");
      expect(permissionsCall[1]).toContain("microphone=('none')");
      expect(permissionsCall[1]).toContain("geolocation=('self' https://example.com)");
    });
  });

  describe('ApiKeyManager class', () => {
    let apiKeyManager: ApiKeyManager;

    beforeEach(() => {
      apiKeyManager = new ApiKeyManager(['valid-key-1', 'valid-key-2']);
    });

    it('should allow requests with valid API key', () => {
      const middleware = apiKeyManager.middleware();
      const req = {
        path: '/api/v1/zones',
        headers: { 'x-api-key': 'valid-key-1' }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject requests without API key', () => {
      const middleware = apiKeyManager.middleware();
      const req = {
        path: '/api/v1/zones',
        headers: {}
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: '401',
          message: 'API key required',
          timestamp: expect.any(String)
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid API key', () => {
      const middleware = apiKeyManager.middleware();
      const req = {
        path: '/api/v1/zones',
        headers: { 'x-api-key': 'invalid-key' }
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: '401',
          message: 'Invalid API key',
          timestamp: expect.any(String)
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should skip API key validation for excluded routes', () => {
      const middleware = apiKeyManager.middleware();
      const req = {
        path: '/health',
        headers: {}
      } as any;
      const res = {} as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should manage API keys correctly', () => {
      expect(apiKeyManager.isValidApiKey('valid-key-1')).toBe(true);
      expect(apiKeyManager.isValidApiKey('invalid-key')).toBe(false);

      apiKeyManager.addApiKey('new-key');
      expect(apiKeyManager.isValidApiKey('new-key')).toBe(true);

      apiKeyManager.removeApiKey('valid-key-1');
      expect(apiKeyManager.isValidApiKey('valid-key-1')).toBe(false);
    });
  });

  describe('HTTPS enforcement', () => {
    it('should redirect HTTP to HTTPS in production', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = httpsEnforcement();
      const req = {
        secure: false,
        get: jest.fn().mockReturnValue('example.com'),
        originalUrl: '/api/v1/test'
      } as any;
      const res = {
        redirect: jest.fn()
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith(301, 'https://example.com/api/v1/test');
      expect(next).not.toHaveBeenCalled();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should allow HTTPS requests in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = httpsEnforcement();
      const req = { secure: true } as any;
      const res = {} as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip enforcement in development', () => {
      const middleware = httpsEnforcement();
      const req = { secure: false } as any;
      const res = {} as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should trust proxy headers when configured', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = httpsEnforcement({ trustProxy: true });
      const req = {
        secure: false,
        headers: { 'x-forwarded-proto': 'https' }
      } as any;
      const res = {} as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Integration with Express app', () => {
    let app: any;

    beforeEach(() => {
      app = createApp();
    });

    it('should set security headers on responses', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/v1/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    it('should handle large request bodies appropriately', async () => {
      const largeData = 'x'.repeat(60 * 1024 * 1024); // 60MB

      const response = await request(app)
        .post('/api/v1/zones')
        .send({ data: largeData });

      expect(response.status).toBe(413);
    });
  });
});