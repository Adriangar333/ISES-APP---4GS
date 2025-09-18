import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../app';
import { AuthService } from '../../services/AuthService';
import { UserRepository } from '../../repositories/UserRepository';

// Mock the services
jest.mock('../../services/AuthService');
jest.mock('../../repositories/UserRepository');

describe('Role Routes', () => {
  let app: Application;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'inspector' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    
    // Create mock instances
    mockAuthService = {
      verifyToken: jest.fn(),
      hasPermission: jest.fn(),
    } as any;

    mockUserRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    } as any;

    // Replace the service constructors to return our mocks
    (AuthService as jest.MockedClass<typeof AuthService>).mockImplementation(() => mockAuthService);
    (UserRepository as jest.MockedClass<typeof UserRepository>).mockImplementation(() => mockUserRepository);
  });

  describe('GET /roles', () => {
    it('should return all roles for admin', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toHaveProperty('role');
      expect(response.body.data[0]).toHaveProperty('description');
      expect(response.body.data[0]).toHaveProperty('capabilities');
    });

    it('should return 403 for inspector', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'inspector',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', 'Bearer valid-user-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /roles/:role/permissions', () => {
    it('should return permissions for valid role', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles/supervisor/permissions')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('supervisor');
      expect(response.body.data).toHaveProperty('permissions');
    });

    it('should return 400 for invalid role', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles/invalid-role/permissions')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /roles/assign', () => {
    it('should allow admin to assign any role', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        sessionId: 'session-123',
      });

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({
        ...mockUser,
        role: 'supervisor',
      });

      const response = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          userId: 'user-123',
          role: 'supervisor',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', { role: 'supervisor' });
    });

    it('should allow supervisor to assign inspector role', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'supervisor-123',
        email: 'supervisor@example.com',
        role: 'supervisor',
        sessionId: 'session-123',
      });

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', 'Bearer valid-supervisor-token')
        .send({
          userId: 'user-123',
          role: 'inspector',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not allow supervisor to assign admin role', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'supervisor-123',
        email: 'supervisor@example.com',
        role: 'supervisor',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', 'Bearer valid-supervisor-token')
        .send({
          userId: 'user-123',
          role: 'admin',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent user', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        sessionId: 'session-123',
      });

      mockUserRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/roles/assign')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({
          userId: 'non-existent-user',
          role: 'inspector',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /roles/check-permission', () => {
    it('should check permission for authenticated user', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'supervisor',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles/check-permission')
        .query({ resource: 'routes', action: 'read' })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('hasPermission');
      expect(response.body.data.role).toBe('supervisor');
    });

    it('should return 400 for missing parameters', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'supervisor',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles/check-permission')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /roles/hierarchy', () => {
    it('should return role hierarchy for admin', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles/hierarchy')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].level).toBeGreaterThan(response.body.data[1].level);
    });
  });

  describe('GET /roles/allowed-fields/:resource', () => {
    it('should return allowed fields for resource', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'supervisor',
        sessionId: 'session-123',
      });

      const response = await request(app)
        .get('/api/v1/roles/allowed-fields/users')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('allowedFields');
      expect(response.body.data.resource).toBe('users');
    });
  });
});