import { InspectorRepository } from '../../repositories/InspectorRepository';
import { Inspector, AvailabilitySchedule } from '../../types';
import { Pool } from 'pg';

// Mock the database pool
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }))
}));

// Mock the validation functions
jest.mock('../../schemas/validation', () => ({
  validateInspector: jest.fn(),
  validateAvailabilitySchedule: jest.fn()
}));

const { validateInspector, validateAvailabilitySchedule } = require('../../schemas/validation');

describe('InspectorRepository', () => {
  let repository: InspectorRepository;
  let mockPool: jest.Mocked<Pool>;

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

  const mockDbResult = {
    id: mockInspector.id,
    name: mockInspector.name,
    identification: mockInspector.identification,
    email: mockInspector.email,
    phone: mockInspector.phone,
    preferred_zones: mockInspector.preferredZones,
    max_daily_routes: mockInspector.maxDailyRoutes,
    is_active: mockInspector.isActive,
    created_at: mockInspector.createdAt.toISOString(),
    updated_at: mockInspector.updatedAt.toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock pool instance with proper typing
    const mockQuery = jest.fn();
    mockPool = {
      query: mockQuery,
      connect: jest.fn(),
      end: jest.fn()
    } as any;

    // Mock Pool constructor to return our mock
    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);
    
    repository = new InspectorRepository();

    // Setup default validation mocks
    validateInspector.mockReturnValue({ error: null, value: mockInspector });
    validateAvailabilitySchedule.mockReturnValue({ error: null, value: {} });
  });

  describe('create', () => {
    it('should create a new inspector', async () => {
      const newInspectorData = {
        name: 'María García',
        identification: '87654321',
        email: 'maria.garcia@example.com',
        phone: '+57 300 987 6543',
        preferredZones: ['zone-1'],
        maxDailyRoutes: 4,
        isActive: true
      };

      const createdInspector = { ...mockInspector, ...newInspectorData };
      const createdDbResult = { ...mockDbResult, ...newInspectorData };

      validateInspector.mockReturnValue({ error: null, value: newInspectorData });
      mockPool.query.mockResolvedValue({ rows: [createdDbResult] });

      const result = await repository.create(newInspectorData);

      expect(validateInspector).toHaveBeenCalledWith(newInspectorData);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inspectors'),
        [
          newInspectorData.name,
          newInspectorData.identification,
          newInspectorData.email,
          newInspectorData.phone,
          newInspectorData.preferredZones,
          newInspectorData.maxDailyRoutes,
          newInspectorData.isActive
        ]
      );
      expect(result.name).toBe(newInspectorData.name);
      expect(result.identification).toBe(newInspectorData.identification);
    });

    it('should throw validation error for invalid data', async () => {
      const invalidData = { name: '', identification: '123' };
      const validationError = {
        error: {
          details: [{ message: 'name is required' }]
        }
      };

      validateInspector.mockReturnValue(validationError);

      await expect(repository.create(invalidData as any)).rejects.toThrow('Validation error: name is required');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should throw error when creation fails', async () => {
      const newInspectorData = {
        name: 'Test Inspector',
        identification: '12345678',
        preferredZones: [],
        maxDailyRoutes: 5,
        isActive: true
      };

      validateInspector.mockReturnValue({ error: null, value: newInspectorData });
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(repository.create(newInspectorData)).rejects.toThrow('Failed to create inspector');
    });
  });

  describe('update', () => {
    it('should update an existing inspector', async () => {
      const updateData = { name: 'Juan Carlos Pérez', maxDailyRoutes: 6 };
      const updatedInspector = { ...mockInspector, ...updateData };
      const updatedDbResult = { ...mockDbResult, ...updateData };

      // Mock findById to return existing inspector
      mockPool.query
        .mockResolvedValueOnce({ rows: [mockDbResult] }) // findById call
        .mockResolvedValueOnce({ rows: [updatedDbResult] }); // update call

      validateInspector.mockReturnValue({ error: null, value: updatedInspector });

      const result = await repository.update(mockInspector.id, updateData);

      expect(result).toBeTruthy();
      expect(result!.name).toBe(updateData.name);
      expect(result!.maxDailyRoutes).toBe(updateData.maxDailyRoutes);
    });

    it('should return null when inspector not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.update('nonexistent-id', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should return existing inspector when no changes provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbResult] });

      const result = await repository.update(mockInspector.id, {});

      expect(result).toEqual(mockInspector);
    });
  });

  describe('findByIdentification', () => {
    it('should find inspector by identification', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbResult] });

      const result = await repository.findByIdentification('12345678');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE identification = $1'),
        ['12345678']
      );
      expect(result).toEqual(mockInspector);
    });

    it('should return null when inspector not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByIdentification('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findActive', () => {
    it('should find all active inspectors', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbResult] });

      const result = await repository.findActive();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true'),
        []
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockInspector);
    });
  });

  describe('findByPreferredZone', () => {
    it('should find inspectors by preferred zone', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbResult] });

      const result = await repository.findByPreferredZone('zone-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE $1 = ANY(preferred_zones)'),
        ['zone-1']
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockInspector);
    });
  });

  describe('getAvailability', () => {
    const mockAvailabilityDb = [
      {
        inspector_id: mockInspector.id,
        day_of_week: 1,
        start_time: '08:00:00',
        end_time: '17:00:00',
        is_active: true
      },
      {
        inspector_id: mockInspector.id,
        day_of_week: 2,
        start_time: '08:00:00',
        end_time: '17:00:00',
        is_active: true
      }
    ];

    const expectedAvailability: AvailabilitySchedule[] = [
      {
        inspectorId: mockInspector.id,
        dayOfWeek: 1,
        startTime: '08:00:00',
        endTime: '17:00:00',
        isActive: true
      },
      {
        inspectorId: mockInspector.id,
        dayOfWeek: 2,
        startTime: '08:00:00',
        endTime: '17:00:00',
        isActive: true
      }
    ];

    it('should get all availability for inspector', async () => {
      mockPool.query.mockResolvedValue({ rows: mockAvailabilityDb });

      const result = await repository.getAvailability(mockInspector.id);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE inspector_id = $1'),
        [mockInspector.id]
      );
      expect(result).toEqual(expectedAvailability);
    });

    it('should filter by day of week', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockAvailabilityDb[0]!] });

      const result = await repository.getAvailability(mockInspector.id, 1);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND day_of_week = $2'),
        [mockInspector.id, 1]
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.dayOfWeek).toBe(1);
    });
  });

  describe('setAvailability', () => {
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
      validateAvailabilitySchedule.mockReturnValue({ error: null, value: {} });
      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.setAvailability(mockInspector.id, availabilityData);

      // Should call validation for each availability entry
      expect(validateAvailabilitySchedule).toHaveBeenCalledTimes(2);
      
      // Should execute transaction with deactivation + inserts
      expect(mockPool.query).toHaveBeenCalledTimes(3); // 1 deactivate + 2 inserts
    });

    it('should throw validation error for invalid availability', async () => {
      const validationError = {
        error: {
          details: [{ message: 'Invalid time format' }]
        }
      };

      validateAvailabilitySchedule.mockReturnValue(validationError);

      await expect(repository.setAvailability(mockInspector.id, availabilityData))
        .rejects.toThrow('Validation error: Invalid time format');
    });
  });

  describe('getCurrentWorkload', () => {
    it('should return current workload count', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await repository.getCurrentWorkload(mockInspector.id);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as count'),
        [mockInspector.id]
      );
      expect(result).toBe(3);
    });

    it('should return 0 when no workload found', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: null }] });

      const result = await repository.getCurrentWorkload(mockInspector.id);

      expect(result).toBe(0);
    });
  });

  describe('findWithWorkload', () => {
    it('should find inspectors with their current workload', async () => {
      const mockDbResultWithWorkload = {
        ...mockDbResult,
        current_workload: '3'
      };

      mockPool.query.mockResolvedValue({ rows: [mockDbResultWithWorkload] });

      const result = await repository.findWithWorkload();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN'),
        []
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockInspector,
        currentWorkload: 3
      });
    });
  });

  describe('transformDatabaseResult', () => {
    it('should transform database result to Inspector interface', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDbResult] });

      const result = await repository.findById(mockInspector.id);

      expect(result).toEqual(mockInspector);
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle null preferred_zones', async () => {
      const dbResultWithNullZones = { ...mockDbResult, preferred_zones: null };
      mockPool.query.mockResolvedValue({ rows: [dbResultWithNullZones] });

      const result = await repository.findById(mockInspector.id);

      expect(result!.preferredZones).toEqual([]);
    });
  });
});