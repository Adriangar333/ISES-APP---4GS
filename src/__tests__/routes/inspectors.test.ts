import request from 'supertest';
import { Application } from 'express';
import { InspectorRepository } from '../../repositories/InspectorRepository';
import { ZoneRepository } from '../../repositories/ZoneRepository';
import { Inspector, Zone, AvailabilitySchedule } from '../../types';

// Mock the repositories
jest.mock('../../repositories/InspectorRepository');
jest.mock('../../repositories/ZoneRepository');

const MockedInspectorRepository = InspectorRepository as jest.MockedClass<typeof InspectorRepository>;
const MockedZoneRepository = ZoneRepository as jest.MockedClass<typeof ZoneRepository>;

// Mock app setup
let app: Application;

beforeAll(async () => {
  // Import app after mocking
  const { createApp } = await import('../../app');
  app = createApp();
});

describe('Inspector Routes', () => {
  let mockInspectorRepo: jest.Mocked<InspectorRepository>;
  let mockZoneRepo: jest.Mocked<ZoneRepository>;

  const mockInspector: Inspector = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Juan Pérez',
    identification: '12345678',
    email: 'juan.perez@example.com',
    phone: '+57 300 123 4567',
    preferredZones: ['zone-1', 'zone-2'],
    maxDailyRoutes: 5,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };

  const mockZone: Zone = {
    id: 'zone-1',
    name: 'Zona I - Metropolitana Suroriente',
    type: 'metropolitana',
    boundaries: {
      coordinates: [
        { latitude: 4.5, longitude: -74.1 },
        { latitude: 4.6, longitude: -74.1 },
        { latitude: 4.6, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.0 },
        { latitude: 4.5, longitude: -74.1 }
      ],
      type: 'Polygon'
    },
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };

  const mockAvailability: AvailabilitySchedule[] = [
    {
      inspectorId: mockInspector.id,
      dayOfWeek: 1, // Monday
      startTime: '08:00',
      endTime: '17:00',
      isActive: true
    },
    {
      inspectorId: mockInspector.id,
      dayOfWeek: 2, // Tuesday
      startTime: '08:00',
      endTime: '17:00',
      isActive: true
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create fresh mock instances
    mockInspectorRepo = new MockedInspectorRepository() as jest.Mocked<InspectorRepository>;
    mockZoneRepo = new MockedZoneRepository() as jest.Mocked<ZoneRepository>;
    
    // Set up constructor mocks
    MockedInspectorRepository.mockImplementation(() => mockInspectorRepo);
    MockedZoneRepository.mockImplementation(() => mockZoneRepo);
  });

  describe('GET /inspectors', () => {
    it('should return all inspectors', async () => {
      mockInspectorRepo.findAll.mockResolvedValue([mockInspector]);

      const response = await request(app)
        .get('/api/v1/inspectors')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: mockInspector.id,
        name: mockInspector.name,
        identification: mockInspector.identification
      });
    });

    it('should return active inspectors when active=true', async () => {
      mockInspectorRepo.findActive.mockResolvedValue([mockInspector]);

      const response = await request(app)
        .get('/api/v1/inspectors?active=true')
        .expect(200);

      expect(mockInspectorRepo.findActive).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return inspectors with workload when withWorkload=true', async () => {
      const inspectorWithWorkload = { ...mockInspector, currentWorkload: 3 };
      mockInspectorRepo.findWithWorkload.mockResolvedValue([inspectorWithWorkload]);

      const response = await request(app)
        .get('/api/v1/inspectors?withWorkload=true')
        .expect(200);

      expect(mockInspectorRepo.findWithWorkload).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].currentWorkload).toBe(3);
    });

    it('should return inspectors by zone when zone parameter is provided', async () => {
      mockInspectorRepo.findByPreferredZone.mockResolvedValue([mockInspector]);

      const response = await request(app)
        .get('/api/v1/inspectors?zone=zone-1')
        .expect(200);

      expect(mockInspectorRepo.findByPreferredZone).toHaveBeenCalledWith('zone-1');
      expect(response.body.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockInspectorRepo.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/inspectors')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch inspectors');
    });
  });

  describe('GET /inspectors/:id', () => {
    it('should return inspector by ID', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);

      const response = await request(app)
        .get(`/api/v1/inspectors/${mockInspector.id}`)
        .expect(200);

      expect(mockInspectorRepo.findById).toHaveBeenCalledWith(mockInspector.id);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockInspector.id);
    });

    it('should return 404 when inspector not found', async () => {
      mockInspectorRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/inspectors/nonexistent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector not found');
    });
  });

  describe('POST /inspectors', () => {
    const newInspectorData = {
      name: 'María García',
      identification: '87654321',
      email: 'maria.garcia@example.com',
      phone: '+57 300 987 6543',
      preferredZones: ['zone-1'],
      maxDailyRoutes: 4
    };

    it('should create a new inspector', async () => {
      const createdInspector = { ...mockInspector, ...newInspectorData };
      
      mockZoneRepo.findById.mockResolvedValue(mockZone);
      mockInspectorRepo.findByIdentification.mockResolvedValue(null);
      mockInspectorRepo.create.mockResolvedValue(createdInspector);

      const response = await request(app)
        .post('/api/v1/inspectors')
        .send(newInspectorData)
        .expect(201);

      expect(mockInspectorRepo.create).toHaveBeenCalledWith(newInspectorData);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newInspectorData.name);
      expect(response.body.message).toBe('Inspector created successfully');
    });

    it('should validate preferred zones exist', async () => {
      mockZoneRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/inspectors')
        .send(newInspectorData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid zone ID');
    });

    it('should prevent duplicate identification', async () => {
      mockZoneRepo.findById.mockResolvedValue(mockZone);
      mockInspectorRepo.findByIdentification.mockResolvedValue(mockInspector);

      const response = await request(app)
        .post('/api/v1/inspectors')
        .send(newInspectorData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector with this identification already exists');
    });

    it('should handle validation errors', async () => {
      mockZoneRepo.findById.mockResolvedValue(mockZone);
      mockInspectorRepo.findByIdentification.mockResolvedValue(null);
      mockInspectorRepo.create.mockRejectedValue(new Error('Validation error: name is required'));

      const response = await request(app)
        .post('/api/v1/inspectors')
        .send({ ...newInspectorData, name: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation error');
    });
  });

  describe('PUT /inspectors/:id', () => {
    const updateData = {
      name: 'Juan Carlos Pérez',
      email: 'juan.carlos@example.com',
      maxDailyRoutes: 6
    };

    it('should update an existing inspector', async () => {
      const updatedInspector = { ...mockInspector, ...updateData };
      
      mockInspectorRepo.update.mockResolvedValue(updatedInspector);

      const response = await request(app)
        .put(`/api/v1/inspectors/${mockInspector.id}`)
        .send(updateData)
        .expect(200);

      expect(mockInspectorRepo.update).toHaveBeenCalledWith(mockInspector.id, updateData);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.message).toBe('Inspector updated successfully');
    });

    it('should return 404 when inspector not found', async () => {
      mockInspectorRepo.update.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/inspectors/nonexistent-id')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector not found');
    });

    it('should validate preferred zones when updating', async () => {
      const updateWithZones = { ...updateData, preferredZones: ['invalid-zone'] };
      mockZoneRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/v1/inspectors/${mockInspector.id}`)
        .send(updateWithZones)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid zone ID');
    });

    it('should prevent identification conflicts', async () => {
      const anotherInspector = { ...mockInspector, id: 'different-id' };
      mockInspectorRepo.findByIdentification.mockResolvedValue(anotherInspector);

      const response = await request(app)
        .put(`/api/v1/inspectors/${mockInspector.id}`)
        .send({ identification: '99999999' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Another inspector with this identification already exists');
    });
  });

  describe('DELETE /inspectors/:id', () => {
    it('should soft delete an inspector', async () => {
      const deactivatedInspector = { ...mockInspector, isActive: false };
      
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(0);
      mockInspectorRepo.update.mockResolvedValue(deactivatedInspector);

      const response = await request(app)
        .delete(`/api/v1/inspectors/${mockInspector.id}`)
        .expect(200);

      expect(mockInspectorRepo.getCurrentWorkload).toHaveBeenCalledWith(mockInspector.id);
      expect(mockInspectorRepo.update).toHaveBeenCalledWith(mockInspector.id, { isActive: false });
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Inspector deactivated successfully');
    });

    it('should prevent deletion when inspector has active routes', async () => {
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(3);

      const response = await request(app)
        .delete(`/api/v1/inspectors/${mockInspector.id}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot delete inspector with 3 active routes');
    });

    it('should return 404 when inspector not found', async () => {
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(0);
      mockInspectorRepo.update.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/v1/inspectors/nonexistent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector not found');
    });
  });

  describe('GET /inspectors/:id/availability', () => {
    it('should return inspector availability', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getAvailability.mockResolvedValue(mockAvailability);

      const response = await request(app)
        .get(`/api/v1/inspectors/${mockInspector.id}/availability`)
        .expect(200);

      expect(mockInspectorRepo.getAvailability).toHaveBeenCalledWith(mockInspector.id, undefined);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by day of week', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getAvailability.mockResolvedValue([mockAvailability[0]!]);

      const response = await request(app)
        .get(`/api/v1/inspectors/${mockInspector.id}/availability?dayOfWeek=1`)
        .expect(200);

      expect(mockInspectorRepo.getAvailability).toHaveBeenCalledWith(mockInspector.id, 1);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 404 when inspector not found', async () => {
      mockInspectorRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/inspectors/nonexistent-id/availability')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector not found');
    });
  });

  describe('POST /inspectors/:id/availability', () => {
    const availabilityData = [
      {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true
      },
      {
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true
      }
    ];

    it('should set inspector availability', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.setAvailability.mockResolvedValue();
      mockInspectorRepo.getAvailability.mockResolvedValue(mockAvailability);

      const response = await request(app)
        .post(`/api/v1/inspectors/${mockInspector.id}/availability`)
        .send(availabilityData)
        .expect(200);

      expect(mockInspectorRepo.setAvailability).toHaveBeenCalledWith(mockInspector.id, availabilityData);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Inspector availability updated successfully');
    });

    it('should validate availability data format', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);

      const response = await request(app)
        .post(`/api/v1/inspectors/${mockInspector.id}/availability`)
        .send('invalid-data')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Availability data must be an array');
    });

    it('should validate time ranges', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);

      const invalidTimeData = [{
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '09:00', // End before start
        isActive: true
      }];

      const response = await request(app)
        .post(`/api/v1/inspectors/${mockInspector.id}/availability`)
        .send(invalidTimeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid time range');
    });

    it('should return 404 when inspector not found', async () => {
      mockInspectorRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/inspectors/nonexistent-id/availability')
        .send(availabilityData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector not found');
    });
  });

  describe('GET /inspectors/:id/workload', () => {
    it('should return inspector workload', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(3);

      const response = await request(app)
        .get(`/api/v1/inspectors/${mockInspector.id}/workload`)
        .expect(200);

      expect(mockInspectorRepo.getCurrentWorkload).toHaveBeenCalledWith(mockInspector.id);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        inspectorId: mockInspector.id,
        currentWorkload: 3,
        maxDailyRoutes: 5,
        utilizationPercentage: 60
      });
    });

    it('should return 404 when inspector not found', async () => {
      mockInspectorRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/inspectors/nonexistent-id/workload')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Inspector not found');
    });
  });
});