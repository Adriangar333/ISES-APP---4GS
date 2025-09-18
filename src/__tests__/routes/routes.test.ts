import request from 'supertest';
import { app } from '../../app';
import { RouteService } from '../../services/RouteService';
import { Route } from '../../types';

// Mock the RouteService
jest.mock('../../services/RouteService');

describe('Route API Endpoints', () => {
  let mockRouteService: jest.Mocked<RouteService>;

  const mockRoute: Route = {
    id: 'route-1',
    name: 'Test Route',
    estimatedDuration: 30,
    priority: 'medium',
    zoneId: 'zone-1',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockRouteWithDetails = {
    ...mockRoute,
    points: [
      {
        id: 'point-1',
        routeId: 'route-1',
        coordinateId: 'coord-1',
        pointOrder: 1,
        estimatedTime: 15,
        status: 'pending' as const,
        coordinate: {
          latitude: 6.2442,
          longitude: -75.5812,
          address: 'Test Address'
        }
      }
    ],
    totalDistance: 0,
    optimizedOrder: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteService = new RouteService() as jest.Mocked<RouteService>;
    (RouteService as jest.Mock).mockImplementation(() => mockRouteService);
  });

  describe('POST /api/v1/routes', () => {
    it('should create a new route', async () => {
      const createRequest = {
        name: 'Test Route',
        coordinateIds: ['coord-1', 'coord-2'],
        priority: 'high',
        estimatedTimePerPoint: 20
      };

      mockRouteService.createRoute.mockResolvedValue(mockRouteWithDetails);

      const response = await request(app)
        .post('/api/v1/routes')
        .send(createRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRouteWithDetails);
      expect(response.body.message).toBe('Route created successfully');
      expect(mockRouteService.createRoute).toHaveBeenCalledWith(createRequest);
    });

    it('should return 400 when name is missing', async () => {
      const createRequest = {
        coordinateIds: ['coord-1', 'coord-2']
      };

      const response = await request(app)
        .post('/api/v1/routes')
        .send(createRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Name and at least one coordinate ID are required');
    });

    it('should return 400 when coordinateIds is empty', async () => {
      const createRequest = {
        name: 'Test Route',
        coordinateIds: []
      };

      const response = await request(app)
        .post('/api/v1/routes')
        .send(createRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Name and at least one coordinate ID are required');
    });

    it('should return 500 when service throws error', async () => {
      const createRequest = {
        name: 'Test Route',
        coordinateIds: ['invalid-coord']
      };

      mockRouteService.createRoute.mockRejectedValue(new Error('Coordinates not found'));

      const response = await request(app)
        .post('/api/v1/routes')
        .send(createRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Coordinates not found');
    });
  });

  describe('GET /api/v1/routes/statistics', () => {
    it('should return route statistics', async () => {
      const mockStats = {
        byZone: [{
          zoneId: 'zone-1',
          zoneName: 'Test Zone',
          totalRoutes: 10,
          pendingRoutes: 5,
          assignedRoutes: 3,
          completedRoutes: 2
        }],
        byInspector: [{
          inspectorId: 'inspector-1',
          inspectorName: 'Test Inspector',
          totalRoutes: 5,
          activeRoutes: 2,
          completedRoutes: 3,
          averageDuration: 45.5
        }]
      };

      mockRouteService.getRouteStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/routes/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(response.body.message).toBe('Route statistics retrieved successfully');
    });

    it('should return 500 when service throws error', async () => {
      mockRouteService.getRouteStatistics.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/routes/statistics')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to retrieve route statistics');
    });
  });

  describe('GET /api/v1/routes', () => {
    it('should return all routes without filters', async () => {
      mockRouteService.getRoutes.mockResolvedValue([mockRouteWithDetails]);

      const response = await request(app)
        .get('/api/v1/routes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([mockRouteWithDetails]);
      expect(response.body.message).toBe('Retrieved 1 routes');
      expect(mockRouteService.getRoutes).toHaveBeenCalledWith({});
    });

    it('should return filtered routes by status', async () => {
      mockRouteService.getRoutes.mockResolvedValue([mockRouteWithDetails]);

      const response = await request(app)
        .get('/api/v1/routes?status=pending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRouteService.getRoutes).toHaveBeenCalledWith({ status: 'pending' });
    });

    it('should return filtered routes by zone', async () => {
      mockRouteService.getRoutes.mockResolvedValue([mockRouteWithDetails]);

      const response = await request(app)
        .get('/api/v1/routes?zoneId=zone-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRouteService.getRoutes).toHaveBeenCalledWith({ zoneId: 'zone-1' });
    });

    it('should return filtered routes by inspector', async () => {
      mockRouteService.getRoutes.mockResolvedValue([mockRouteWithDetails]);

      const response = await request(app)
        .get('/api/v1/routes?inspectorId=inspector-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRouteService.getRoutes).toHaveBeenCalledWith({ inspectorId: 'inspector-1' });
    });

    it('should return 500 when service throws error', async () => {
      mockRouteService.getRoutes.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/routes')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to retrieve routes');
    });
  });

  describe('GET /api/v1/routes/:id', () => {
    it('should return specific route by ID', async () => {
      mockRouteService.getRouteWithDetails.mockResolvedValue(mockRouteWithDetails);

      const response = await request(app)
        .get('/api/v1/routes/route-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRouteWithDetails);
      expect(response.body.message).toBe('Route retrieved successfully');
      expect(mockRouteService.getRouteWithDetails).toHaveBeenCalledWith('route-1');
    });

    it('should return 404 when route not found', async () => {
      mockRouteService.getRouteWithDetails.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/routes/invalid-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Route not found');
    });

    it('should return 500 when service throws error', async () => {
      mockRouteService.getRouteWithDetails.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/routes/route-1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to retrieve route');
    });
  });

  describe('PUT /api/v1/routes/:id', () => {
    it('should update route successfully', async () => {
      const updateRequest = {
        name: 'Updated Route Name',
        priority: 'high'
      };

      const updatedRoute = {
        ...mockRouteWithDetails,
        name: 'Updated Route Name',
        priority: 'high' as const
      };

      mockRouteService.updateRoute.mockResolvedValue(updatedRoute);

      const response = await request(app)
        .put('/api/v1/routes/route-1')
        .send(updateRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedRoute);
      expect(response.body.message).toBe('Route updated successfully');
      expect(mockRouteService.updateRoute).toHaveBeenCalledWith('route-1', updateRequest);
    });

    it('should return 404 when route not found', async () => {
      mockRouteService.updateRoute.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/routes/invalid-route')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Route not found');
    });

    it('should return 500 when service throws error', async () => {
      mockRouteService.updateRoute.mockRejectedValue(new Error('Validation error'));

      const response = await request(app)
        .put('/api/v1/routes/route-1')
        .send({ name: 'Updated Name' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });
  });

  describe('DELETE /api/v1/routes/:id', () => {
    it('should delete route successfully', async () => {
      mockRouteService.deleteRoute.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/v1/routes/route-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Route deleted successfully');
      expect(mockRouteService.deleteRoute).toHaveBeenCalledWith('route-1');
    });

    it('should return 404 when route not found', async () => {
      mockRouteService.deleteRoute.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/routes/invalid-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Route not found');
    });

    it('should return 500 when service throws error', async () => {
      mockRouteService.deleteRoute.mockRejectedValue(new Error('Cannot delete assigned route'));

      const response = await request(app)
        .delete('/api/v1/routes/route-1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cannot delete assigned route');
    });
  });

  describe('POST /api/v1/routes/:id/assign', () => {
    it('should assign route to inspector', async () => {
      const assignedRoute = {
        ...mockRoute,
        status: 'assigned' as const,
        assignedInspectorId: 'inspector-1'
      };

      mockRouteService.assignRoute.mockResolvedValue(assignedRoute);

      const response = await request(app)
        .post('/api/v1/routes/route-1/assign')
        .send({ inspectorId: 'inspector-1' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(assignedRoute);
      expect(response.body.message).toBe('Route assigned successfully');
      expect(mockRouteService.assignRoute).toHaveBeenCalledWith('route-1', 'inspector-1');
    });

    it('should return 400 when inspectorId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/routes/route-1/assign')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector ID is required');
    });

    it('should return 404 when route not found', async () => {
      mockRouteService.assignRoute.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/routes/invalid-route/assign')
        .send({ inspectorId: 'inspector-1' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Route not found');
    });
  });

  describe('POST /api/v1/routes/:id/unassign', () => {
    it('should unassign route from inspector', async () => {
      const unassignedRoute: Route = {
        ...mockRoute,
        status: 'pending' as const
      };

      mockRouteService.unassignRoute.mockResolvedValue(unassignedRoute);

      const response = await request(app)
        .post('/api/v1/routes/route-1/unassign')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(unassignedRoute);
      expect(response.body.message).toBe('Route unassigned successfully');
      expect(mockRouteService.unassignRoute).toHaveBeenCalledWith('route-1');
    });

    it('should return 404 when route not found', async () => {
      mockRouteService.unassignRoute.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/routes/invalid-route/unassign')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Route not found');
    });
  });
});