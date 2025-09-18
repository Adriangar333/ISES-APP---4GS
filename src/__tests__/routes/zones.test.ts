import request from 'supertest';
import { createApp } from '../../app';
import { ZoneRepository } from '../../repositories/ZoneRepository';
import { GeospatialService } from '../../services/GeospatialService';
import { Zone, GeoPoint } from '../../types';

// Mock the repositories and services
jest.mock('../../repositories/ZoneRepository');
jest.mock('../../services/GeospatialService');

const MockedZoneRepository = ZoneRepository as jest.MockedClass<typeof ZoneRepository>;
const MockedGeospatialService = GeospatialService as jest.MockedClass<typeof GeospatialService>;

describe('Zone Routes', () => {
  let app: any;
  let mockZoneRepository: jest.Mocked<ZoneRepository>;
  let mockGeospatialService: jest.Mocked<GeospatialService>;

  const sampleZone: Zone = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Zona I - Metropolitana Suroriente',
    type: 'metropolitana',
    boundaries: {
      type: 'Polygon',
      coordinates: [
        { latitude: 4.5981, longitude: -74.0758 },
        { latitude: 4.5981, longitude: -74.0658 },
        { latitude: 4.6081, longitude: -74.0658 },
        { latitude: 4.6081, longitude: -74.0758 },
        { latitude: 4.5981, longitude: -74.0758 }
      ]
    },
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };

  const sampleBoundaries: GeoPoint[] = [
    { latitude: 4.5981, longitude: -74.0758 },
    { latitude: 4.5981, longitude: -74.0658 },
    { latitude: 4.6081, longitude: -74.0658 },
    { latitude: 4.6081, longitude: -74.0758 },
    { latitude: 4.5981, longitude: -74.0758 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockZoneRepository = new MockedZoneRepository() as jest.Mocked<ZoneRepository>;
    mockGeospatialService = new MockedGeospatialService() as jest.Mocked<GeospatialService>;
    
    // Mock the constructor calls
    MockedZoneRepository.mockImplementation(() => mockZoneRepository);
    MockedGeospatialService.mockImplementation(() => mockGeospatialService);
    
    app = createApp();
  });

  describe('GET /zones', () => {
    it('should return all active zones', async () => {
      mockZoneRepository.findAllActive.mockResolvedValue([sampleZone]);

      const response = await request(app)
        .get('/api/v1/zones')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: sampleZone.id,
        name: sampleZone.name,
        type: sampleZone.type
      });
      expect(mockZoneRepository.findAllActive).toHaveBeenCalledTimes(1);
    });

    it('should filter zones by type when type parameter is provided', async () => {
      mockZoneRepository.findByType.mockResolvedValue([sampleZone]);

      const response = await request(app)
        .get('/api/v1/zones?type=metropolitana')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(mockZoneRepository.findByType).toHaveBeenCalledWith('metropolitana');
    });

    it('should handle errors gracefully', async () => {
      mockZoneRepository.findAllActive.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/zones')
        .expect(500);

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('GET /zones/:id', () => {
    it('should return a specific zone by ID', async () => {
      mockZoneRepository.findById.mockResolvedValue(sampleZone);

      const response = await request(app)
        .get(`/api/v1/zones/${sampleZone.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sampleZone.id);
      expect(mockZoneRepository.findById).toHaveBeenCalledWith(sampleZone.id);
    });

    it('should return 404 when zone is not found', async () => {
      mockZoneRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/zones/nonexistent-id')
        .expect(404);

      expect(response.body.error.code).toBe('ZONE_NOT_FOUND');
    });
  });

  describe('POST /zones', () => {
    const newZoneData = {
      name: 'Test Zone',
      type: 'metropolitana',
      boundaries: {
        type: 'Polygon',
        coordinates: sampleBoundaries
      },
      isActive: true
    };

    it('should create a new zone successfully', async () => {
      mockGeospatialService.validatePolygon.mockResolvedValue(true);
      mockZoneRepository.checkZoneOverlap.mockResolvedValue(false);
      mockZoneRepository.create.mockResolvedValue(sampleZone);

      const response = await request(app)
        .post('/api/v1/zones')
        .send(newZoneData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sampleZone.id);
      expect(mockGeospatialService.validatePolygon).toHaveBeenCalledWith(sampleBoundaries);
      expect(mockZoneRepository.checkZoneOverlap).toHaveBeenCalledWith(sampleBoundaries);
      expect(mockZoneRepository.create).toHaveBeenCalled();
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        type: 'invalid-type',
        boundaries: {
          type: 'Polygon',
          coordinates: [] // Invalid: empty coordinates
        }
      };

      const response = await request(app)
        .post('/api/v1/zones')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error when zone boundaries overlap', async () => {
      mockGeospatialService.validatePolygon.mockResolvedValue(true);
      mockZoneRepository.checkZoneOverlap.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/zones')
        .send(newZoneData)
        .expect(409);

      expect(response.body.error.code).toBe('ZONE_OVERLAP');
    });

    it('should return error for invalid polygon geometry', async () => {
      mockGeospatialService.validatePolygon.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/zones')
        .send(newZoneData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_POLYGON');
    });
  });

  describe('PUT /zones/:id', () => {
    const updateData = {
      name: 'Updated Zone Name',
      boundaries: {
        type: 'Polygon',
        coordinates: sampleBoundaries
      }
    };

    it('should update an existing zone successfully', async () => {
      const updatedZone = { ...sampleZone, name: 'Updated Zone Name' };
      
      mockZoneRepository.findById.mockResolvedValue(sampleZone);
      mockGeospatialService.validatePolygon.mockResolvedValue(true);
      mockZoneRepository.checkZoneOverlap.mockResolvedValue(false);
      mockZoneRepository.update.mockResolvedValue(updatedZone);

      const response = await request(app)
        .put(`/api/v1/zones/${sampleZone.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Zone Name');
      expect(mockZoneRepository.update).toHaveBeenCalledWith(sampleZone.id, updateData);
    });

    it('should return 404 when trying to update non-existent zone', async () => {
      mockZoneRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/zones/nonexistent-id')
        .send(updateData)
        .expect(404);

      expect(response.body.error.code).toBe('ZONE_NOT_FOUND');
    });

    it('should validate boundaries when updating', async () => {
      mockZoneRepository.findById.mockResolvedValue(sampleZone);
      mockGeospatialService.validatePolygon.mockResolvedValue(false);

      const response = await request(app)
        .put(`/api/v1/zones/${sampleZone.id}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_POLYGON');
    });
  });

  describe('DELETE /zones/:id', () => {
    it('should soft delete a zone successfully', async () => {
      mockZoneRepository.findById.mockResolvedValue(sampleZone);
      mockZoneRepository.update.mockResolvedValue({ ...sampleZone, isActive: false });

      const response = await request(app)
        .delete(`/api/v1/zones/${sampleZone.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockZoneRepository.update).toHaveBeenCalledWith(sampleZone.id, { isActive: false });
    });

    it('should return 404 when trying to delete non-existent zone', async () => {
      mockZoneRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/v1/zones/nonexistent-id')
        .expect(404);

      expect(response.body.error.code).toBe('ZONE_NOT_FOUND');
    });
  });

  describe('POST /zones/validate-boundaries', () => {
    it('should validate boundaries successfully', async () => {
      mockGeospatialService.validatePolygon.mockResolvedValue(true);
      mockZoneRepository.checkZoneOverlap.mockResolvedValue(false);
      mockGeospatialService.calculatePolygonArea.mockResolvedValue(1000000); // 1 km²
      mockGeospatialService.calculatePolygonPerimeter.mockResolvedValue(4000); // 4 km

      const response = await request(app)
        .post('/api/v1/zones/validate-boundaries')
        .send({ boundaries: { coordinates: sampleBoundaries } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.hasOverlap).toBe(false);
      expect(response.body.data.area).toBe(1000000);
      expect(response.body.data.perimeter).toBe(4000);
    });

    it('should return error for invalid boundaries format', async () => {
      const response = await request(app)
        .post('/api/v1/zones/validate-boundaries')
        .send({ boundaries: { coordinates: null } })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_BOUNDARIES');
    });
  });

  describe('GET /zones/point/:latitude/:longitude', () => {
    it('should find zone containing a point', async () => {
      mockZoneRepository.findZoneContainingPoint.mockResolvedValue(sampleZone);

      const response = await request(app)
        .get('/api/v1/zones/point/4.6/74.08')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sampleZone.id);
      expect(mockZoneRepository.findZoneContainingPoint).toHaveBeenCalledWith(4.6, 74.08);
    });

    it('should return null when point is not in any zone', async () => {
      mockZoneRepository.findZoneContainingPoint.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/zones/point/0/0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toContain('not within any zone');
    });

    it('should return error for invalid coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/zones/point/invalid/invalid')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_COORDINATES');
    });

    it('should return error for out-of-range coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/zones/point/91/181')
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_COORDINATES');
    });
  });
});