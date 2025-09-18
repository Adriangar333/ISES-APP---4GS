import { GeospatialService } from '../../services/GeospatialService';
import { ZoneRepository } from '../../repositories/ZoneRepository';
import { Coordinate, Zone, GeoPolygon } from '../../types';

// Mock ZoneRepository
jest.mock('../../repositories/ZoneRepository');

describe('GeospatialService', () => {
  let geospatialService: GeospatialService;
  let mockZoneRepository: jest.Mocked<ZoneRepository>;

  // Test data
  const mockZones: Zone[] = [
    {
      id: 'zone-1',
      name: 'Zona I - Metropolitana Suroriente',
      type: 'metropolitana',
      boundaries: {
        type: 'Polygon',
        coordinates: [
          { latitude: 4.5, longitude: -74.2 },
          { latitude: 4.7, longitude: -74.2 },
          { latitude: 4.7, longitude: -74.0 },
          { latitude: 4.5, longitude: -74.0 },
          { latitude: 4.5, longitude: -74.2 }
        ]
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'zone-2',
      name: 'Zona II - Metropolitana Suroccidente',
      type: 'metropolitana',
      boundaries: {
        type: 'Polygon',
        coordinates: [
          { latitude: 4.3, longitude: -74.2 },
          { latitude: 4.5, longitude: -74.2 },
          { latitude: 4.5, longitude: -74.0 },
          { latitude: 4.3, longitude: -74.0 },
          { latitude: 4.3, longitude: -74.2 }
        ]
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const testCoordinates: Coordinate[] = [
    {
      id: '1',
      latitude: 4.6,
      longitude: -74.1,
      address: 'Inside Zone 1',
      createdAt: new Date()
    },
    {
      id: '2',
      latitude: 4.4,
      longitude: -74.1,
      address: 'Inside Zone 2',
      createdAt: new Date()
    },
    {
      id: '3',
      latitude: 4.8,
      longitude: -74.1,
      address: 'Outside zones',
      createdAt: new Date()
    }
  ];

  beforeEach(() => {
    mockZoneRepository = new ZoneRepository() as jest.Mocked<ZoneRepository>;
    mockZoneRepository.findAll.mockResolvedValue(mockZones);
    mockZoneRepository.findAllActive.mockResolvedValue(mockZones);
    mockZoneRepository.findZoneContainingPoint.mockImplementation(async (lat, lng) => {
      // Mock zone detection based on coordinates
      if (lat === 4.6 && lng === -74.1) return mockZones[0]!; // Zone 1
      if (lat === 4.4 && lng === -74.1) return mockZones[1]!; // Zone 2
      return null; // Outside zones
    });
    
    geospatialService = new GeospatialService(mockZoneRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectZoneForCoordinate', () => {
    it('should detect correct zone for coordinate inside polygon', async () => {
      const coordinate = testCoordinates[0]!; // Inside Zone 1
      
      const result = await geospatialService.detectZoneForCoordinate(coordinate);
      
      expect(result.coordinate).toBe(coordinate);
      expect(result.detectedZone?.id).toBe('zone-1');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect correct zone for coordinate in different zone', async () => {
      const coordinate = testCoordinates[1]!; // Inside Zone 2
      
      const result = await geospatialService.detectZoneForCoordinate(coordinate);
      
      expect(result.coordinate).toBe(coordinate);
      expect(result.detectedZone?.id).toBe('zone-2');
      expect(result.confidence).toBe(1.0);
    });

    it('should find closest zone for coordinate outside all zones', async () => {
      const coordinate = testCoordinates[2]!; // Outside zones
      
      const result = await geospatialService.detectZoneForCoordinate(coordinate);
      
      expect(result.coordinate).toBe(coordinate);
      expect(result.detectedZone).toBeDefined();
      expect(result.confidence).toBeLessThan(1.0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle error gracefully', async () => {
      mockZoneRepository.findZoneContainingPoint.mockRejectedValue(new Error('Database error'));
      mockZoneRepository.findAllActive.mockRejectedValue(new Error('Database error'));
      
      const coordinate = testCoordinates[0]!;
      const result = await geospatialService.detectZoneForCoordinate(coordinate);
      
      expect(result.coordinate).toBe(coordinate);
      expect(result.detectedZone).toBeUndefined();
      expect(result.confidence).toBe(0);
    });
  });

  describe('calculateDistanceMeters', () => {
    it('should calculate distance between two coordinates correctly', () => {
      const coord1: Coordinate = {
        id: '1',
        latitude: 4.6097,
        longitude: -74.0817,
        createdAt: new Date()
      };
      
      const coord2: Coordinate = {
        id: '2',
        latitude: 4.6351,
        longitude: -74.0703,
        createdAt: new Date()
      };
      
      const distance = geospatialService.calculateDistanceMeters(coord1, coord2);
      
      // Distance should be approximately 3.2 km
      expect(distance).toBeGreaterThan(3000);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for identical coordinates', () => {
      const coord1: Coordinate = {
        id: '1',
        latitude: 4.6097,
        longitude: -74.0817,
        createdAt: new Date()
      };
      
      const coord2: Coordinate = {
        id: '2',
        latitude: 4.6097,
        longitude: -74.0817,
        createdAt: new Date()
      };
      
      const distance = geospatialService.calculateDistanceMeters(coord1, coord2);
      
      expect(distance).toBe(0);
    });
  });

  describe('detectDuplicateCoordinates', () => {
    it('should detect duplicate coordinates within threshold', () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6097,
          longitude: -74.0817,
          address: 'Location 1',
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 4.6097,
          longitude: -74.0817,
          address: 'Location 2 (duplicate)',
          createdAt: new Date()
        },
        {
          id: '3',
          latitude: 4.6351,
          longitude: -74.0703,
          address: 'Location 3',
          createdAt: new Date()
        }
      ];
      
      const duplicates = geospatialService.detectDuplicateCoordinates(coordinates, 10);
      
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toHaveLength(2);
      expect(duplicates[0]![0]!.id).toBe('1');
      expect(duplicates[0]![1]!.id).toBe('2');
    });

    it('should not detect duplicates when coordinates are far apart', () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6097,
          longitude: -74.0817,
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 4.6351,
          longitude: -74.0703,
          createdAt: new Date()
        }
      ];
      
      const duplicates = geospatialService.detectDuplicateCoordinates(coordinates, 10);
      
      expect(duplicates).toHaveLength(0);
    });

    it('should handle multiple duplicate groups', () => {
      const coordinates: Coordinate[] = [
        // Group 1
        { id: '1', latitude: 4.6097, longitude: -74.0817, createdAt: new Date() },
        { id: '2', latitude: 4.6097, longitude: -74.0817, createdAt: new Date() },
        // Group 2
        { id: '3', latitude: 4.6351, longitude: -74.0703, createdAt: new Date() },
        { id: '4', latitude: 4.6351, longitude: -74.0703, createdAt: new Date() },
        // Non-duplicate
        { id: '5', latitude: 4.7110, longitude: -74.0721, createdAt: new Date() }
      ];
      
      const duplicates = geospatialService.detectDuplicateCoordinates(coordinates, 10);
      
      expect(duplicates).toHaveLength(2);
      expect(duplicates[0]).toHaveLength(2);
      expect(duplicates[1]).toHaveLength(2);
    });
  });

  describe('processCoordinatesWithZoneMapping', () => {
    it('should process coordinates with zone mapping and duplicate detection', async () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Test Location 1',
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Test Location 2 (duplicate)',
          createdAt: new Date()
        },
        {
          id: '3',
          latitude: 4.4,
          longitude: -74.1,
          address: 'Test Location 3',
          createdAt: new Date()
        }
      ];

      const options = {
        enableDuplicateDetection: true,
        duplicateThresholdMeters: 10,
        enableZoneValidation: true
      };

      const result = await geospatialService.processCoordinatesWithZoneMapping(coordinates, options);

      expect(result.processedCoordinates).toHaveLength(3);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]).toHaveLength(2);
      expect(Object.keys(result.zoneAssignments)).toHaveLength(3);
      expect(result.processingErrors).toHaveLength(0);
    });

    it('should handle processing errors gracefully', async () => {
      mockZoneRepository.findAll.mockRejectedValue(new Error('Database error'));

      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          createdAt: new Date()
        }
      ];

      const options = {
        enableDuplicateDetection: false,
        duplicateThresholdMeters: 10,
        enableZoneValidation: true
      };

      const result = await geospatialService.processCoordinatesWithZoneMapping(coordinates, options);

      // The coordinate should still be processed even if zone detection fails
      expect(result.processedCoordinates).toHaveLength(1);
      expect(result.processingErrors).toHaveLength(0); // Error is handled gracefully in detectZoneForCoordinate
      expect(Object.keys(result.zoneAssignments)).toHaveLength(0); // No zone assignments due to error
    });
  });

  describe('validateCoordinateForColombia', () => {
    it('should validate coordinates within Colombia bounds', () => {
      const validCoordinate: Coordinate = {
        id: '1',
        latitude: 4.6097,
        longitude: -74.0817,
        createdAt: new Date()
      };

      const isValid = geospatialService.validateCoordinateForColombia(validCoordinate);
      expect(isValid).toBe(true);
    });

    it('should reject coordinates outside Colombia bounds', () => {
      const invalidCoordinate: Coordinate = {
        id: '1',
        latitude: 40.7128, // New York latitude
        longitude: -74.0060, // New York longitude
        createdAt: new Date()
      };

      const isValid = geospatialService.validateCoordinateForColombia(invalidCoordinate);
      expect(isValid).toBe(false);
    });

    it('should reject coordinates with extreme values', () => {
      const extremeCoordinate: Coordinate = {
        id: '1',
        latitude: 91, // Invalid latitude
        longitude: -181, // Invalid longitude
        createdAt: new Date()
      };

      const isValid = geospatialService.validateCoordinateForColombia(extremeCoordinate);
      expect(isValid).toBe(false);
    });
  });

  describe('cleanCoordinateData', () => {
    it('should clean and normalize coordinate data', () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.60971234567, // Will be normalized
          longitude: -74.08171234567, // Will be normalized
          address: 'Valid coordinate',
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 40.7128, // Outside Colombia bounds
          longitude: -74.0060,
          address: 'Invalid coordinate',
          createdAt: new Date()
        },
        {
          id: '3',
          latitude: 4.6351,
          longitude: -74.0703,
          address: 'Another valid coordinate',
          createdAt: new Date()
        }
      ];

      const result = geospatialService.cleanCoordinateData(coordinates);

      expect(result.cleanedCoordinates).toHaveLength(2);
      expect(result.removedCoordinates).toHaveLength(1);
      expect(result.cleanedCoordinates[0]?.latitude).toBe(4.609712); // Normalized to 6 decimal places
      expect(result.cleanedCoordinates[0]?.longitude).toBe(-74.081712);
      expect(result.cleaningReport).toContain('Total coordinates processed: 3');
      expect(result.cleaningReport).toContain('Coordinates kept: 2');
      expect(result.cleaningReport).toContain('Coordinates removed (out of bounds): 1');
    });

    it('should handle empty coordinate array', () => {
      const coordinates: Coordinate[] = [];

      const result = geospatialService.cleanCoordinateData(coordinates);

      expect(result.cleanedCoordinates).toHaveLength(0);
      expect(result.removedCoordinates).toHaveLength(0);
      expect(result.cleaningReport).toContain('Total coordinates processed: 0');
    });
  });

  describe('validatePolygon', () => {
    it('should validate a simple valid polygon', async () => {
      const validPolygon = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.2 } // Closed polygon
      ];

      const isValid = await geospatialService.validatePolygon(validPolygon);
      expect(isValid).toBe(true);
    });

    it('should validate a polygon that is not explicitly closed', async () => {
      const unclosedPolygon = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.0 }
        // Not explicitly closed - should still be valid
      ];

      const isValid = await geospatialService.validatePolygon(unclosedPolygon);
      expect(isValid).toBe(true);
    });

    it('should reject polygon with less than 3 points', async () => {
      const invalidPolygon = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 }
      ];

      const isValid = await geospatialService.validatePolygon(invalidPolygon);
      expect(isValid).toBe(false);
    });

    it('should reject polygon with zero area (collinear points)', async () => {
      const collinearPolygon = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.6, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 },
        { latitude: 4.5, longitude: -74.2 }
      ];

      const isValid = await geospatialService.validatePolygon(collinearPolygon);
      expect(isValid).toBe(false);
    });

    it('should reject self-intersecting polygon', async () => {
      const selfIntersectingPolygon = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.0 },
        { latitude: 4.7, longitude: -74.2 },
        { latitude: 4.5, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.2 }
      ];

      const isValid = await geospatialService.validatePolygon(selfIntersectingPolygon);
      expect(isValid).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      // Pass invalid data that might cause an error
      const invalidData = null as any;

      const isValid = await geospatialService.validatePolygon(invalidData);
      expect(isValid).toBe(false);
    });
  });

  describe('calculatePolygonArea', () => {
    it('should calculate area of a simple rectangle', async () => {
      const rectangle = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.0 }
      ];

      const area = await geospatialService.calculatePolygonArea(rectangle);
      expect(area).toBeGreaterThan(0);
      // Area should be approximately 0.2 * 0.2 degrees squared converted to square meters
      expect(area).toBeGreaterThan(1000000); // Should be over 1 million square meters
    });

    it('should return zero area for collinear points', async () => {
      const collinearPoints = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.6, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 }
      ];

      const area = await geospatialService.calculatePolygonArea(collinearPoints);
      expect(area).toBe(0);
    });
  });

  describe('calculatePolygonPerimeter', () => {
    it('should calculate perimeter of a simple rectangle', async () => {
      const rectangle = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.0 }
      ];

      const perimeter = await geospatialService.calculatePolygonPerimeter(rectangle);
      expect(perimeter).toBeGreaterThan(0);
      
      // Calculate expected perimeter manually
      const coord1 = { id: '1', latitude: 4.5, longitude: -74.2, createdAt: new Date() };
      const coord2 = { id: '2', latitude: 4.7, longitude: -74.2, createdAt: new Date() };
      const coord3 = { id: '3', latitude: 4.7, longitude: -74.0, createdAt: new Date() };
      const coord4 = { id: '4', latitude: 4.5, longitude: -74.0, createdAt: new Date() };
      
      const side1 = geospatialService.calculateDistanceMeters(coord1, coord2);
      const side2 = geospatialService.calculateDistanceMeters(coord2, coord3);
      const side3 = geospatialService.calculateDistanceMeters(coord3, coord4);
      const side4 = geospatialService.calculateDistanceMeters(coord4, coord1);
      
      const expectedPerimeter = side1 + side2 + side3 + side4;
      
      // Allow for small rounding differences
      expect(Math.abs(perimeter - expectedPerimeter)).toBeLessThan(1);
    });

    it('should handle triangle perimeter calculation', async () => {
      const triangle = [
        { latitude: 4.5, longitude: -74.2 },
        { latitude: 4.7, longitude: -74.2 },
        { latitude: 4.6, longitude: -74.0 }
      ];

      const perimeter = await geospatialService.calculatePolygonPerimeter(triangle);
      expect(perimeter).toBeGreaterThan(0);
    });
  });

  describe('batchAssignZones', () => {
    it('should batch assign zones to coordinates', async () => {
      const coordinates: Coordinate[] = [
        { id: '1', latitude: 4.6, longitude: -74.1, createdAt: new Date() },
        { id: '2', latitude: 4.4, longitude: -74.1, createdAt: new Date() },
        { id: '3', latitude: 4.8, longitude: -74.1, createdAt: new Date() }
      ];

      mockZoneRepository.findZoneContainingPoint
        .mockResolvedValueOnce(mockZones[0]!) // First coordinate in zone 1
        .mockResolvedValueOnce(mockZones[1]!) // Second coordinate in zone 2
        .mockResolvedValueOnce(null); // Third coordinate not in any zone

      const result = await geospatialService.batchAssignZones(coordinates);

      expect(result.assignedCoordinates).toHaveLength(2);
      expect(result.unassignedCoordinates).toHaveLength(1);
      expect(Object.keys(result.zoneAssignments)).toHaveLength(2);
      expect(result.processingStats.totalProcessed).toBe(3);
      expect(result.processingStats.successfulAssignments).toBe(2);
      expect(result.processingStats.failedAssignments).toBe(1);
      expect(result.processingStats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateCentroid', () => {
    it('should calculate centroid of coordinates', () => {
      const coordinates: Coordinate[] = [
        { id: '1', latitude: 4.5, longitude: -74.2, createdAt: new Date() },
        { id: '2', latitude: 4.7, longitude: -74.0, createdAt: new Date() }
      ];

      const centroid = geospatialService.calculateCentroid(coordinates);

      expect(centroid).not.toBeNull();
      expect(centroid!.latitude).toBe(4.6);
      expect(centroid!.longitude).toBe(-74.1);
    });

    it('should return null for empty coordinates array', () => {
      const centroid = geospatialService.calculateCentroid([]);
      expect(centroid).toBeNull();
    });
  });

  describe('findCoordinatesWithinRadius', () => {
    it('should find coordinates within specified radius', () => {
      const coordinates: Coordinate[] = [
        { id: '1', latitude: 4.6097, longitude: -74.0817, createdAt: new Date() },
        { id: '2', latitude: 4.6351, longitude: -74.0703, createdAt: new Date() },
        { id: '3', latitude: 4.7110, longitude: -74.0721, createdAt: new Date() }
      ];

      const centerPoint = { latitude: 4.6097, longitude: -74.0817 };
      const radiusMeters = 5000; // 5km

      const nearbyCoordinates = geospatialService.findCoordinatesWithinRadius(
        coordinates,
        centerPoint,
        radiusMeters
      );

      expect(nearbyCoordinates).toHaveLength(2); // First two should be within 5km
      expect(nearbyCoordinates[0]!.id).toBe('1');
      expect(nearbyCoordinates[1]!.id).toBe('2');
    });
  });

  describe('calculateBoundingBox', () => {
    it('should calculate bounding box for coordinates', () => {
      const coordinates: Coordinate[] = [
        { id: '1', latitude: 4.5, longitude: -74.2, createdAt: new Date() },
        { id: '2', latitude: 4.7, longitude: -74.0, createdAt: new Date() },
        { id: '3', latitude: 4.6, longitude: -74.1, createdAt: new Date() }
      ];

      const boundingBox = geospatialService.calculateBoundingBox(coordinates);

      expect(boundingBox).not.toBeNull();
      expect(boundingBox!.north).toBe(4.7);
      expect(boundingBox!.south).toBe(4.5);
      expect(boundingBox!.east).toBe(-74.0);
      expect(boundingBox!.west).toBe(-74.2);
      expect(boundingBox!.center.latitude).toBe(4.6);
      expect(boundingBox!.center.longitude).toBe(-74.1);
    });

    it('should return null for empty coordinates array', () => {
      const boundingBox = geospatialService.calculateBoundingBox([]);
      expect(boundingBox).toBeNull();
    });
  });

  describe('optimizeRoutePoints', () => {
    it('should optimize route points using nearest neighbor', () => {
      const coordinates: Coordinate[] = [
        { id: '1', latitude: 4.5, longitude: -74.2, createdAt: new Date() },
        { id: '2', latitude: 4.7, longitude: -74.0, createdAt: new Date() },
        { id: '3', latitude: 4.6, longitude: -74.1, createdAt: new Date() }
      ];

      const optimized = geospatialService.optimizeRoutePoints(coordinates);

      expect(optimized).toHaveLength(3);
      expect(optimized[0]!.id).toBe('1'); // Should start with first coordinate
      
      // Verify that the route is optimized (nearest neighbor should be next)
      const distance1to3 = geospatialService.calculateDistanceMeters(optimized[0]!, optimized[1]!);
      const distance1to2 = geospatialService.calculateDistanceMeters(optimized[0]!, coordinates[1]!);
      
      // The optimized route should choose the nearest neighbor
      expect(distance1to3).toBeLessThanOrEqual(distance1to2);
    });

    it('should handle small arrays without optimization', () => {
      const coordinates: Coordinate[] = [
        { id: '1', latitude: 4.5, longitude: -74.2, createdAt: new Date() }
      ];

      const optimized = geospatialService.optimizeRoutePoints(coordinates);
      expect(optimized).toEqual(coordinates);
    });

    it('should start with specified start point', () => {
      const coordinates: Coordinate[] = [
        { id: '1', latitude: 4.5, longitude: -74.2, createdAt: new Date() },
        { id: '2', latitude: 4.7, longitude: -74.0, createdAt: new Date() },
        { id: '3', latitude: 4.6, longitude: -74.1, createdAt: new Date() }
      ];

      const startPoint = coordinates[1]!; // Start with second coordinate
      const optimized = geospatialService.optimizeRoutePoints(coordinates, startPoint);

      expect(optimized).toHaveLength(3);
      expect(optimized[0]!.id).toBe('2'); // Should start with specified point
    });
  });
});