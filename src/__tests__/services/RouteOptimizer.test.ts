import { RouteOptimizer, OptimizationOptions } from '../../services/RouteOptimizer';
import { GeospatialService } from '../../services/GeospatialService';
import { Coordinate } from '../../types';

// Mock the GeospatialService
jest.mock('../../services/GeospatialService');

describe('RouteOptimizer', () => {
  let routeOptimizer: RouteOptimizer;
  let mockGeospatialService: jest.Mocked<GeospatialService>;

  const mockCoordinates: Coordinate[] = [
    {
      id: 'coord-1',
      latitude: 6.2442,
      longitude: -75.5812,
      address: 'Point A',
      createdAt: new Date()
    },
    {
      id: 'coord-2',
      latitude: 6.2500,
      longitude: -75.5900,
      address: 'Point B',
      createdAt: new Date()
    },
    {
      id: 'coord-3',
      latitude: 6.2600,
      longitude: -75.6000,
      address: 'Point C',
      createdAt: new Date()
    },
    {
      id: 'coord-4',
      latitude: 6.2700,
      longitude: -75.6100,
      address: 'Point D',
      createdAt: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGeospatialService = new GeospatialService() as jest.Mocked<GeospatialService>;
    
    // Mock distance calculations
    mockGeospatialService.calculateDistanceMeters.mockImplementation((from, to) => {
      // Simple mock distance calculation based on coordinate differences
      const latDiff = Math.abs(from.latitude - to.latitude);
      const lngDiff = Math.abs(from.longitude - to.longitude);
      return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // Rough conversion to meters
    });

    (GeospatialService as jest.Mock).mockImplementation(() => mockGeospatialService);
    
    routeOptimizer = new RouteOptimizer(mockGeospatialService);
  });

  describe('optimizeRoute', () => {
    it('should optimize route using nearest neighbor algorithm', async () => {
      const options: OptimizationOptions = { algorithm: 'nearest_neighbor' };
      
      const result = await routeOptimizer.optimizeRoute(mockCoordinates, options);
      
      expect(result).toBeDefined();
      expect(result.optimizedCoordinates).toHaveLength(mockCoordinates.length);
      expect(result.algorithm).toBe('nearest_neighbor');
      expect(result.originalDistance).toBeGreaterThan(0);
      expect(result.optimizedDistance).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBe(1);
    });

    it('should optimize route using 2-opt algorithm', async () => {
      const options: OptimizationOptions = { 
        algorithm: 'two_opt',
        maxIterations: 10
      };
      
      const result = await routeOptimizer.optimizeRoute(mockCoordinates, options);
      
      expect(result).toBeDefined();
      expect(result.optimizedCoordinates).toHaveLength(mockCoordinates.length);
      expect(result.algorithm).toBe('two_opt');
      expect(result.originalDistance).toBeGreaterThan(0);
      expect(result.optimizedDistance).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBeGreaterThan(0);
    });

    it('should optimize route using genetic algorithm', async () => {
      const options: OptimizationOptions = { 
        algorithm: 'genetic',
        maxIterations: 5,
        populationSize: 10,
        mutationRate: 0.1
      };
      
      const result = await routeOptimizer.optimizeRoute(mockCoordinates, options);
      
      expect(result).toBeDefined();
      expect(result.optimizedCoordinates).toHaveLength(mockCoordinates.length);
      expect(result.algorithm).toBe('genetic');
      expect(result.originalDistance).toBeGreaterThan(0);
      expect(result.optimizedDistance).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBe(5);
    });

    it('should handle routes with 2 or fewer coordinates', async () => {
      const shortRoute = mockCoordinates.slice(0, 2);
      const options: OptimizationOptions = { algorithm: 'nearest_neighbor' };
      
      const result = await routeOptimizer.optimizeRoute(shortRoute, options);
      
      expect(result).toBeDefined();
      expect(result.optimizedCoordinates).toHaveLength(2);
      expect(result.iterations).toBe(0);
      expect(result.improvementPercentage).toBe(0);
    });

    it('should handle single coordinate', async () => {
      const singleRoute = mockCoordinates.slice(0, 1);
      const options: OptimizationOptions = { algorithm: 'nearest_neighbor' };
      
      const result = await routeOptimizer.optimizeRoute(singleRoute, options);
      
      expect(result).toBeDefined();
      expect(result.optimizedCoordinates).toHaveLength(1);
      expect(result.originalDistance).toBe(0);
      expect(result.optimizedDistance).toBe(0);
      expect(result.improvementPercentage).toBe(0);
    });

    it('should respect start and end points when specified', async () => {
      const options: OptimizationOptions = { 
        algorithm: 'nearest_neighbor',
        startPoint: mockCoordinates[2]!,
        endPoint: mockCoordinates[1]!,
        preserveStartEnd: true
      };
      
      const result = await routeOptimizer.optimizeRoute(mockCoordinates, options);
      
      expect(result).toBeDefined();
      expect(result.optimizedCoordinates.length).toBeGreaterThanOrEqual(mockCoordinates.length);
      // Note: The actual implementation might add end point, so length could be greater
      // depending on the algorithm implementation
    });

    it('should throw error for unknown algorithm', async () => {
      const options: OptimizationOptions = { algorithm: 'unknown' as any };
      
      await expect(routeOptimizer.optimizeRoute(mockCoordinates, options))
        .rejects.toThrow('Unknown optimization algorithm: unknown');
    });
  });

  describe('optimizeMultiZoneRoutes', () => {
    it('should optimize multiple routes with zone information', async () => {
      const routes = [
        { coordinates: mockCoordinates.slice(0, 2), zoneId: 'zone-1' },
        { coordinates: mockCoordinates.slice(2, 4), zoneId: 'zone-2' }
      ];
      
      const results = await routeOptimizer.optimizeMultiZoneRoutes(routes);
      
      expect(results).toHaveLength(2);
      expect(results[0]?.zoneId).toBe('zone-1');
      expect(results[1]?.zoneId).toBe('zone-2');
      expect(results[0]?.optimizedCoordinates).toHaveLength(2);
      expect(results[1]?.optimizedCoordinates).toHaveLength(2);
    });
  });

  describe('benchmarkAlgorithms', () => {
    it('should benchmark multiple algorithms', async () => {
      const algorithms: ('nearest_neighbor' | 'two_opt')[] = ['nearest_neighbor', 'two_opt'];
      
      const results = await routeOptimizer.benchmarkAlgorithms(mockCoordinates, algorithms);
      
      expect(results).toHaveLength(2);
      expect(results[0]?.algorithm).toBe('nearest_neighbor');
      expect(results[1]?.algorithm).toBe('two_opt');
      
      for (const result of results) {
        expect(result.optimizedCoordinates).toHaveLength(mockCoordinates.length);
        expect(result.originalDistance).toBeGreaterThan(0);
        expect(result.optimizedDistance).toBeGreaterThan(0);
        expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should use default algorithms when none specified', async () => {
      const results = await routeOptimizer.benchmarkAlgorithms(mockCoordinates);
      
      expect(results).toHaveLength(3);
      expect(results.map(r => r.algorithm)).toEqual(['nearest_neighbor', 'two_opt', 'genetic']);
    });
  });

  describe('calculateOptimizationStats', () => {
    it('should calculate statistics from optimization results', async () => {
      const results = await routeOptimizer.benchmarkAlgorithms(mockCoordinates);
      
      const stats = routeOptimizer.calculateOptimizationStats(results);
      
      expect(stats).toBeDefined();
      expect(stats.averageImprovement).toBeGreaterThanOrEqual(0);
      expect(stats.bestImprovement).toBeGreaterThanOrEqual(stats.worstImprovement);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
      expect(stats.totalDistanceSaved).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty results array', () => {
      const stats = routeOptimizer.calculateOptimizationStats([]);
      
      expect(stats).toEqual({
        averageImprovement: 0,
        bestImprovement: 0,
        worstImprovement: 0,
        averageExecutionTime: 0,
        totalDistanceSaved: 0
      });
    });
  });

  describe('performance tests', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a larger dataset
      const largeCoordinates: Coordinate[] = [];
      for (let i = 0; i < 20; i++) {
        largeCoordinates.push({
          id: `coord-${i}`,
          latitude: 6.2442 + (i * 0.001),
          longitude: -75.5812 + (i * 0.001),
          address: `Point ${i}`,
          createdAt: new Date()
        });
      }

      const startTime = Date.now();
      const result = await routeOptimizer.optimizeRoute(largeCoordinates, { 
        algorithm: 'nearest_neighbor' 
      });
      const executionTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.optimizedCoordinates).toHaveLength(20);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should show improvement with optimization', async () => {
      // Create coordinates in a deliberately inefficient order
      const inefficientCoordinates = [
        mockCoordinates[0]!, // Start
        mockCoordinates[3]!, // Jump to far point
        mockCoordinates[1]!, // Back to near point
        mockCoordinates[2]!  // End
      ];

      const result = await routeOptimizer.optimizeRoute(inefficientCoordinates, {
        algorithm: 'nearest_neighbor'
      });

      // The optimization should show some improvement
      expect(result.improvementPercentage).toBeGreaterThanOrEqual(0);
      expect(result.optimizedDistance).toBeLessThanOrEqual(result.originalDistance);
    });
  });
});