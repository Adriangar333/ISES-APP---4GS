import request from 'supertest';
import express from 'express';
import assignmentRoutes from '../../routes/assignments';
import { AssignmentAlgorithm } from '../../services/AssignmentAlgorithm';
import { AssignmentOptimizer } from '../../services/AssignmentOptimizer';

// Mock the services
jest.mock('../../services/AssignmentAlgorithm');
jest.mock('../../services/AssignmentOptimizer');

const app = express();
app.use(express.json());
app.use('/api/assignments', assignmentRoutes);

describe('Assignment Routes', () => {
  let mockAssignmentAlgorithm: jest.Mocked<AssignmentAlgorithm>;
  let mockAssignmentOptimizer: jest.Mocked<AssignmentOptimizer>;

  const mockAssignmentResult = {
    assignments: [
      {
        routeId: 'route-1',
        inspectorId: 'inspector-1',
        assignedAt: new Date(),
        estimatedStartTime: new Date(),
        estimatedEndTime: new Date()
      }
    ],
    unassignedRoutes: [],
    workloadDistribution: [],
    summary: {
      totalRoutes: 1,
      assignedRoutes: 1,
      unassignedRoutes: 0
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAssignmentAlgorithm = AssignmentAlgorithm.prototype as jest.Mocked<AssignmentAlgorithm>;
    mockAssignmentOptimizer = AssignmentOptimizer.prototype as jest.Mocked<AssignmentOptimizer>;

    mockAssignmentAlgorithm.assignRoutes.mockResolvedValue(mockAssignmentResult);
    mockAssignmentOptimizer.optimizedAssignment.mockResolvedValue(mockAssignmentResult);
  });

  describe('POST /api/assignments/assign', () => {
    it('should assign routes successfully', async () => {
      const response = await request(app)
        .post('/api/assignments/assign')
        .send({
          routeIds: ['route-1', 'route-2'],
          options: {
            prioritizeZonePreference: true,
            maxUtilizationThreshold: 100,
            allowCrossZoneAssignment: true,
            balanceWorkload: true,
            considerAvailability: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAssignmentResult);
      expect(mockAssignmentAlgorithm.assignRoutes).toHaveBeenCalledWith(
        ['route-1', 'route-2'],
        expect.any(Object)
      );
    });

    it('should return 400 for invalid routeIds', async () => {
      const response = await request(app)
        .post('/api/assignments/assign')
        .send({
          routeIds: 'invalid',
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('routeIds must be an array');
    });

    it('should return 400 for missing routeIds', async () => {
      const response = await request(app)
        .post('/api/assignments/assign')
        .send({
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle assignment errors', async () => {
      mockAssignmentAlgorithm.assignRoutes.mockRejectedValue(new Error('Assignment failed'));

      const response = await request(app)
        .post('/api/assignments/assign')
        .send({
          routeIds: ['route-1'],
          options: {}
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error during route assignment');
    });
  });

  describe('POST /api/assignments/optimize', () => {
    it('should optimize assignments successfully', async () => {
      const response = await request(app)
        .post('/api/assignments/optimize')
        .send({
          routeIds: ['route-1', 'route-2'],
          options: {
            prioritizeZonePreference: true,
            maxUtilizationThreshold: 100,
            allowCrossZoneAssignment: true,
            balanceWorkload: true,
            considerAvailability: true,
            enableCrossZoneOptimization: true,
            maxCrossZoneDistance: 15,
            enableAutomaticReassignment: true,
            optimizationStrategy: 'balanced'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAssignmentResult);
      expect(mockAssignmentOptimizer.optimizedAssignment).toHaveBeenCalledWith(
        ['route-1', 'route-2'],
        expect.any(Object)
      );
    });

    it('should return 400 for invalid routeIds in optimization', async () => {
      const response = await request(app)
        .post('/api/assignments/optimize')
        .send({
          routeIds: null,
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle optimization errors', async () => {
      mockAssignmentOptimizer.optimizedAssignment.mockRejectedValue(new Error('Optimization failed'));

      const response = await request(app)
        .post('/api/assignments/optimize')
        .send({
          routeIds: ['route-1'],
          options: {}
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error during optimized assignment');
    });
  });

  describe('POST /api/assignments/assign-all', () => {
    it('should assign all pending routes without optimization', async () => {
      mockAssignmentAlgorithm.assignAllPendingRoutes.mockResolvedValue(mockAssignmentResult);

      const response = await request(app)
        .post('/api/assignments/assign-all')
        .send({
          options: {},
          useOptimization: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAssignmentAlgorithm.assignAllPendingRoutes).toHaveBeenCalled();
    });

    it('should assign all pending routes with optimization', async () => {
      mockAssignmentAlgorithm.assignAllPendingRoutes.mockResolvedValue({
        ...mockAssignmentResult,
        unassignedRoutes: [
          {
            id: 'route-2',
            name: 'Unassigned Route',
            priority: 'medium' as const,
            status: 'pending' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      });

      const response = await request(app)
        .post('/api/assignments/assign-all')
        .send({
          options: {},
          useOptimization: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAssignmentOptimizer.optimizedAssignment).toHaveBeenCalled();
    });

    it('should handle assign-all errors', async () => {
      mockAssignmentAlgorithm.assignAllPendingRoutes.mockRejectedValue(new Error('Assign all failed'));

      const response = await request(app)
        .post('/api/assignments/assign-all')
        .send({
          options: {},
          useOptimization: false
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/assignments/reassign/:inspectorId', () => {
    it('should reassign inspector routes successfully', async () => {
      mockAssignmentAlgorithm.reassignInspectorRoutes.mockResolvedValue(mockAssignmentResult);

      const response = await request(app)
        .post('/api/assignments/reassign/inspector-1')
        .send({
          options: {},
          useOptimization: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAssignmentAlgorithm.reassignInspectorRoutes).toHaveBeenCalledWith(
        'inspector-1',
        expect.any(Object)
      );
    });

    it('should reassign with optimization', async () => {
      mockAssignmentAlgorithm.reassignInspectorRoutes.mockResolvedValue({
        ...mockAssignmentResult,
        unassignedRoutes: [
          {
            id: 'route-2',
            name: 'Reassigned Route',
            priority: 'medium' as const,
            status: 'pending' as const,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      });

      const response = await request(app)
        .post('/api/assignments/reassign/inspector-1')
        .send({
          options: {},
          useOptimization: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAssignmentOptimizer.optimizedAssignment).toHaveBeenCalled();
    });

    it('should handle reassignment errors', async () => {
      mockAssignmentAlgorithm.reassignInspectorRoutes.mockRejectedValue(new Error('Reassign failed'));

      const response = await request(app)
        .post('/api/assignments/reassign/inspector-1')
        .send({
          options: {},
          useOptimization: false
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/assignments/validate', () => {
    it('should validate assignment results', async () => {
      const mockValidation = {
        isValid: true,
        conflicts: [],
        suggestions: [],
        metrics: {
          totalAssignments: 1,
          crossZoneAssignments: 0,
          utilizationVariance: 10,
          averageUtilization: 60
        }
      };

      mockAssignmentOptimizer.validateAssignmentResult.mockResolvedValue(mockValidation);

      const response = await request(app)
        .post('/api/assignments/validate')
        .send({
          assignmentResult: mockAssignmentResult
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockValidation);
    });

    it('should return 400 for missing assignment result', async () => {
      const response = await request(app)
        .post('/api/assignments/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Assignment result is required');
    });

    it('should handle validation errors', async () => {
      mockAssignmentOptimizer.validateAssignmentResult.mockRejectedValue(new Error('Validation failed'));

      const response = await request(app)
        .post('/api/assignments/validate')
        .send({
          assignmentResult: mockAssignmentResult
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/assignments/recommendations', () => {
    it('should get assignment recommendations', async () => {
      const mockRecommendations = {
        overloadedInspectors: ['inspector-1'],
        underutilizedInspectors: ['inspector-2'],
        suggestedReassignments: []
      };

      mockAssignmentAlgorithm.getAssignmentRecommendations.mockResolvedValue(mockRecommendations);

      const response = await request(app)
        .get('/api/assignments/recommendations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRecommendations);
    });

    it('should handle recommendations errors', async () => {
      mockAssignmentAlgorithm.getAssignmentRecommendations.mockRejectedValue(new Error('Recommendations failed'));

      const response = await request(app)
        .get('/api/assignments/recommendations');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/assignments/options/default', () => {
    it('should return default options', async () => {
      const response = await request(app)
        .get('/api/assignments/options/default');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('standard');
      expect(response.body.data).toHaveProperty('optimization');
      expect(response.body.data.standard).toHaveProperty('prioritizeZonePreference', true);
      expect(response.body.data.optimization).toHaveProperty('enableCrossZoneOptimization', true);
    });
  });
});