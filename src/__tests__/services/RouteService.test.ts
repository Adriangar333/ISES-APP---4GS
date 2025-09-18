import { RouteService, CreateRouteRequest } from '../../services/RouteService';
import { RouteRepository } from '../../repositories/RouteRepository';
import { RoutePointRepository } from '../../repositories/RoutePointRepository';
import { CoordinateRepository } from '../../repositories/CoordinateRepository';
import { ZoneRepository } from '../../repositories/ZoneRepository';
import { GeospatialService } from '../../services/GeospatialService';
import { Route, Coordinate, RoutePoint } from '../../types';

// Mock the repositories and services
jest.mock('../../repositories/RouteRepository');
jest.mock('../../repositories/RoutePointRepository');
jest.mock('../../repositories/CoordinateRepository');
jest.mock('../../repositories/ZoneRepository');
jest.mock('../../services/GeospatialService');

describe('RouteService', () => {
  let routeService: RouteService;
  let mockRouteRepository: jest.Mocked<RouteRepository>;
  let mockRoutePointRepository: jest.Mocked<RoutePointRepository>;
  let mockCoordinateRepository: jest.Mocked<CoordinateRepository>;
  let mockZoneRepository: jest.Mocked<ZoneRepository>;
  let mockGeospatialService: jest.Mocked<GeospatialService>;

  const mockCoordinate1: Coordinate = {
    id: 'coord-1',
    latitude: 6.2442,
    longitude: -75.5812,
    address: 'Test Address 1',
    zoneId: 'zone-1',
    createdAt: new Date()
  };

  const mockCoordinate2: Coordinate = {
    id: 'coord-2',
    latitude: 6.2500,
    longitude: -75.5900,
    address: 'Test Address 2',
    zoneId: 'zone-1',
    createdAt: new Date()
  };

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

  const mockRoutePoint: RoutePoint = {
    id: 'point-1',
    routeId: 'route-1',
    coordinateId: 'coord-1',
    pointOrder: 1,
    estimatedTime: 15,
    status: 'pending'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRouteRepository = new RouteRepository() as jest.Mocked<RouteRepository>;
    mockRoutePointRepository = new RoutePointRepository() as jest.Mocked<RoutePointRepository>;
    mockCoordinateRepository = new CoordinateRepository() as jest.Mocked<CoordinateRepository>;
    mockZoneRepository = new ZoneRepository() as jest.Mocked<ZoneRepository>;
    mockGeospatialService = new GeospatialService() as jest.Mocked<GeospatialService>;

    // Replace the constructor calls with our mocks
    (RouteRepository as jest.Mock).mockImplementation(() => mockRouteRepository);
    (RoutePointRepository as jest.Mock).mockImplementation(() => mockRoutePointRepository);
    (CoordinateRepository as jest.Mock).mockImplementation(() => mockCoordinateRepository);
    (ZoneRepository as jest.Mock).mockImplementation(() => mockZoneRepository);
    (GeospatialService as jest.Mock).mockImplementation(() => mockGeospatialService);

    routeService = new RouteService();
  });

  describe('createRoute', () => {
    it('should create a route with valid coordinates', async () => {
      const createRequest: CreateRouteRequest = {
        name: 'Test Route',
        coordinateIds: ['coord-1', 'coord-2'],
        priority: 'high',
        estimatedTimePerPoint: 20
      };

      // Mock coordinate validation
      mockCoordinateRepository.findById
        .mockResolvedValueOnce(mockCoordinate1)
        .mockResolvedValueOnce(mockCoordinate2);

      // Mock zone detection
      mockGeospatialService.detectZoneForCoordinate.mockResolvedValue({
        coordinate: mockCoordinate1,
        detectedZone: {
          id: 'zone-1',
          name: 'Test Zone',
          type: 'metropolitana',
          boundaries: { coordinates: [], type: 'Polygon' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        confidence: 1.0
      });

      // Mock coordinate update
      mockCoordinateRepository.update.mockResolvedValue(mockCoordinate1);

      // Mock zone repository for validation
      mockZoneRepository.findById.mockResolvedValue({
        id: 'zone-1',
        name: 'Test Zone',
        type: 'metropolitana',
        boundaries: { coordinates: [], type: 'Polygon' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock route creation
      mockRouteRepository.create.mockResolvedValue(mockRoute);

      // Mock route points creation
      mockRoutePointRepository.createBulk.mockResolvedValue([mockRoutePoint]);

      // Mock route with points retrieval
      mockRouteRepository.findWithPoints.mockResolvedValue([{
        ...mockRoute,
        priority: 'high',
        points: [mockRoutePoint]
      }]);

      mockRoutePointRepository.findByRouteWithCoordinates.mockResolvedValue([{
        ...mockRoutePoint,
        coordinate: {
          latitude: mockCoordinate1.latitude,
          longitude: mockCoordinate1.longitude,
          address: 'Test Address 1'
        }
      }]);

      mockGeospatialService.calculateDistanceMeters.mockReturnValue(1.5);

      const result = await routeService.createRoute(createRequest);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Route');
      expect(result.priority).toBe('high');
      expect(result.zoneId).toBe('zone-1');
      expect(mockRouteRepository.create).toHaveBeenCalledWith({
        name: 'Test Route',
        estimatedDuration: 40, // 2 coordinates * 20 minutes
        priority: 'high',
        zoneId: 'zone-1',
        status: 'pending'
      });
    });

    it('should throw error when coordinates do not exist', async () => {
      const createRequest: CreateRouteRequest = {
        name: 'Test Route',
        coordinateIds: ['invalid-coord'],
        priority: 'medium'
      };

      mockCoordinateRepository.findById.mockResolvedValue(null);

      await expect(routeService.createRoute(createRequest)).rejects.toThrow(
        'Coordinates not found: invalid-coord'
      );
    });

    it('should throw error when no coordinates provided', async () => {
      const createRequest: CreateRouteRequest = {
        name: 'Test Route',
        coordinateIds: [],
        priority: 'medium'
      };

      await expect(routeService.createRoute(createRequest)).rejects.toThrow(
        'At least one coordinate is required'
      );
    });
  });

  describe('deleteRoute', () => {
    it('should delete route successfully', async () => {
      mockRouteRepository.findById.mockResolvedValue(mockRoute);
      mockRoutePointRepository.deleteByRoute.mockResolvedValue();
      mockRouteRepository.deleteById.mockResolvedValue(true);

      const result = await routeService.deleteRoute('route-1');

      expect(result).toBe(true);
      expect(mockRoutePointRepository.deleteByRoute).toHaveBeenCalledWith('route-1');
      expect(mockRouteRepository.deleteById).toHaveBeenCalledWith('route-1');
    });

    it('should return false for non-existent route', async () => {
      mockRouteRepository.findById.mockResolvedValue(null);

      const result = await routeService.deleteRoute('invalid-route');

      expect(result).toBe(false);
      expect(mockRoutePointRepository.deleteByRoute).not.toHaveBeenCalled();
      expect(mockRouteRepository.deleteById).not.toHaveBeenCalled();
    });

    it('should throw error when trying to delete assigned route', async () => {
      const assignedRoute = {
        ...mockRoute,
        status: 'assigned' as const,
        assignedInspectorId: 'inspector-1'
      };

      mockRouteRepository.findById.mockResolvedValue(assignedRoute);

      await expect(routeService.deleteRoute('route-1')).rejects.toThrow(
        'Cannot delete route that is assigned or in progress'
      );
    });
  });

  describe('assignRoute', () => {
    it('should assign route to inspector', async () => {
      const assignedRoute = {
        ...mockRoute,
        status: 'assigned' as const,
        assignedInspectorId: 'inspector-1'
      };

      mockRouteRepository.assignToInspector.mockResolvedValue(assignedRoute);

      const result = await routeService.assignRoute('route-1', 'inspector-1');

      expect(result).toEqual(assignedRoute);
      expect(mockRouteRepository.assignToInspector).toHaveBeenCalledWith('route-1', 'inspector-1');
    });
  });

  describe('unassignRoute', () => {
    it('should unassign route from inspector', async () => {
      const unassignedRoute: Route = {
        ...mockRoute,
        status: 'pending' as const
      };

      mockRouteRepository.unassignFromInspector.mockResolvedValue(unassignedRoute);

      const result = await routeService.unassignRoute('route-1');

      expect(result).toEqual(unassignedRoute);
      expect(mockRouteRepository.unassignFromInspector).toHaveBeenCalledWith('route-1');
    });
  });
});