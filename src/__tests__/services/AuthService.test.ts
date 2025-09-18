import { AuthService } from '../../services/AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import { UserProfileRepository } from '../../repositories/UserProfileRepository';
import { RefreshTokenRepository } from '../../repositories/RefreshTokenRepository';
import { UserSessionRepository } from '../../repositories/UserSessionRepository';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// Mock the repositories
jest.mock('../../repositories/UserRepository');
jest.mock('../../repositories/UserProfileRepository');
jest.mock('../../repositories/RefreshTokenRepository');
jest.mock('../../repositories/UserSessionRepository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockUserProfileRepository: jest.Mocked<UserProfileRepository>;
  let mockRefreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let mockUserSessionRepository: jest.Mocked<UserSessionRepository>;

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

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    sessionToken: 'session-token-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockUserProfileRepository = new UserProfileRepository() as jest.Mocked<UserProfileRepository>;
    mockRefreshTokenRepository = new RefreshTokenRepository() as jest.Mocked<RefreshTokenRepository>;
    mockUserSessionRepository = new UserSessionRepository() as jest.Mocked<UserSessionRepository>;

    authService = new AuthService();
    
    // Replace the repositories with mocks
    (authService as any).userRepository = mockUserRepository;
    (authService as any).userProfileRepository = mockUserProfileRepository;
    (authService as any).refreshTokenRepository = mockRefreshTokenRepository;
    (authService as any).userSessionRepository = mockUserSessionRepository;
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getPasswordHash.mockResolvedValue('hashed-password');
      mockUserRepository.updateLastLogin.mockResolvedValue();
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockProfile);
      mockUserSessionRepository.create.mockResolvedValue(mockSession);
      mockRefreshTokenRepository.create.mockResolvedValue({
        id: 'refresh-123',
        userId: 'user-123',
        tokenHash: 'token-hash',
        expiresAt: new Date(),
        isRevoked: false,
        createdAt: new Date(),
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
      (jwt.decode as jest.Mock).mockReturnValue({ exp: 1234567890, iat: 1234567800 });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');

      const result = await authService.login(loginData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
      expect(result).toHaveProperty('tokens');
      expect(result.user).toEqual(mockUser);
      expect(result.profile).toEqual(mockProfile);
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error for invalid email', async () => {
      const loginData = {
        email: 'invalid@example.com',
        password: 'password123',
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      await expect(authService.login(loginData)).rejects.toThrow('Account is deactivated');
    });

    it('should throw error for invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.getPasswordHash.mockResolvedValue('hashed-password');
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'password123',
        role: 'inspector' as const,
        firstName: 'Jane',
        lastName: 'Smith',
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockUserProfileRepository.create.mockResolvedValue(mockProfile);
      mockUserSessionRepository.create.mockResolvedValue(mockSession);
      mockRefreshTokenRepository.create.mockResolvedValue({
        id: 'refresh-123',
        userId: 'user-123',
        tokenHash: 'token-hash',
        expiresAt: new Date(),
        isRevoked: false,
        createdAt: new Date(),
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');
      (jwt.decode as jest.Mock).mockReturnValue({ exp: 1234567890, iat: 1234567800 });

      const result = await authService.register(registerData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profile');
      expect(result).toHaveProperty('tokens');
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: registerData.email,
        passwordHash: 'hashed-password',
        role: registerData.role,
      });
    });

    it('should throw error if user already exists', async () => {
      const registerData = {
        email: 'existing@example.com',
        password: 'password123',
        role: 'inspector' as const,
      };

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(registerData)).rejects.toThrow('User already exists with this email');
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      const token = 'valid-jwt-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'inspector' as const,
        sessionId: 'session-123',
      };

      (jwt.verify as jest.Mock).mockReturnValue(payload);
      mockUserSessionRepository.findById.mockResolvedValue(mockSession);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.verifyToken(token);

      expect(result).toEqual(payload);
      expect(jwt.verify).toHaveBeenCalledWith(token, config.jwt.secret);
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid token');
    });

    it('should throw error for expired session', async () => {
      const token = 'valid-jwt-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'inspector' as const,
        sessionId: 'session-123',
      };

      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      (jwt.verify as jest.Mock).mockReturnValue(payload);
      mockUserSessionRepository.findById.mockResolvedValue(expiredSession);

      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid token');
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin with any permission', () => {
      const result = authService.hasPermission('admin', 'zones', 'delete');
      expect(result).toBe(true);
    });

    it('should return true for supervisor with allowed permission', () => {
      const result = authService.hasPermission('supervisor', 'routes', 'read');
      expect(result).toBe(true);
    });

    it('should return false for inspector with disallowed permission', () => {
      const result = authService.hasPermission('inspector', 'zones', 'delete');
      expect(result).toBe(false);
    });

    it('should return true for inspector with allowed permission', () => {
      const result = authService.hasPermission('inspector', 'routes', 'read');
      expect(result).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const changeRequest = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.getPasswordHash.mockResolvedValue('old-hashed-password');
      mockUserRepository.updatePassword.mockResolvedValue();
      mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue();

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await authService.changePassword('user-123', changeRequest);

      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith('user-123', 'new-hashed-password');
      expect(mockRefreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-123');
    });

    it('should throw error for incorrect current password', async () => {
      const changeRequest = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.getPasswordHash.mockResolvedValue('old-hashed-password');
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.changePassword('user-123', changeRequest))
        .rejects.toThrow('Current password is incorrect');
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue();
      mockUserSessionRepository.deactivate.mockResolvedValue();

      await authService.logout('user-123', 'session-123');

      expect(mockRefreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-123');
      expect(mockUserSessionRepository.deactivate).toHaveBeenCalledWith('session-123');
    });

    it('should deactivate all sessions when no sessionId provided', async () => {
      mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue();
      mockUserSessionRepository.deactivateAllForUser.mockResolvedValue();

      await authService.logout('user-123');

      expect(mockRefreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-123');
      expect(mockUserSessionRepository.deactivateAllForUser).toHaveBeenCalledWith('user-123');
    });
  });
});