import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../app';
import { AuthService } from '../../services/AuthService';

// Mock the AuthService
jest.mock('../../services/AuthService');

describe('Auth Routes', () => {
  let app: Application;
  let mockAuthService: jest.Mocked<AuthService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'inspector' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile = {
    id: 'profile-123',
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  };

  const mockAuthResponse = {
    user: mockUser,
    profile: mockProfile,
    tokens: mockTokens,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    
    // Create mock instance
    mockAuthService = {
      login: jest.fn(),
      register: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      requestPasswordReset: jest.fn(),
      confirmPasswordReset: jest.fn(),
      changePassword: jest.fn(),
      verifyToken: jest.fn(),
      getUserWithProfile: jest.fn(),
      updateProfile: jest.fn(),
      hasPermission: jest.fn(),
    } as any;

    // Replace the AuthService constructor to return our mock
    (AuthService as jest.MockedClass<typeof AuthService>).mockImplementation(() => mockAuthService);
  });

  describe('POST /auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuthResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { email: 'test@example.com', password: 'password123' },
        expect.any(String), // IP address
        expect.any(String)  // User agent
      );
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('POST /auth/register', () => {
    it('should successfully register new user (admin only)', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        sessionId: 'session-123',
      });
      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          email: 'newuser@example.com',
          password: 'Password123',
          role: 'inspector',
          firstName: 'Jane',
          lastName: 'Smith',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuthResponse);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'Password123',
          role: 'inspector',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-admin users', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'inspector',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Authorization', 'Bearer valid-user-token')
        .send({
          email: 'newuser@example.com',
          password: 'Password123',
          role: 'inspector',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should successfully refresh token', async () => {
      mockAuthService.refreshToken.mockResolvedValue(mockTokens);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTokens);
    });

    it('should return 401 for invalid refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'inspector',
        sessionId: 'session-123',
      });
      mockAuthService.logout.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.logout).toHaveBeenCalledWith('user-123', 'session-123');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'inspector',
        sessionId: 'session-123',
      });
      mockAuthService.getUserWithProfile.mockResolvedValue({
        user: mockUser,
        profile: mockProfile,
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual(mockUser);
      expect(response.body.data.profile).toEqual(mockProfile);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/change-password', () => {
    it('should successfully change password', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'inspector',
        sessionId: 'session-123',
      });
      mockAuthService.changePassword.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-123', {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      });
    });

    it('should return 400 for weak password', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'inspector',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /auth/verify', () => {
    it('should verify valid token', async () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'inspector' as const,
        sessionId: 'session-123',
      };

      mockAuthService.verifyToken.mockResolvedValue(mockPayload);

      const response = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user).toEqual(mockPayload);
    });

    it('should return 401 for invalid token', async () => {
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});