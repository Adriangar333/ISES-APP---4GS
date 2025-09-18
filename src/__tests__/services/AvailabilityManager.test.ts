import { AvailabilityManager, TimeSlot } from '../../services/AvailabilityManager';
import { InspectorRepository } from '../../repositories/InspectorRepository';
import { Inspector, AvailabilitySchedule } from '../../types';

// Mock the InspectorRepository
jest.mock('../../repositories/InspectorRepository');

const MockedInspectorRepository = InspectorRepository as jest.MockedClass<typeof InspectorRepository>;

describe('AvailabilityManager', () => {
  let availabilityManager: AvailabilityManager;
  let mockInspectorRepo: jest.Mocked<InspectorRepository>;

  const mockInspector: Inspector = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Juan Pérez',
    identification: '12345678',
    email: 'juan.perez@example.com',
    phone: '+57 300 123 4567',
    preferredZones: ['zone-1'],
    maxDailyRoutes: 5,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };

  const mockAvailability: AvailabilitySchedule[] = [
    {
      inspectorId: mockInspector.id,
      dayOfWeek: 1, // Monday
      startTime: '08:00',
      endTime: '12:00',
      isActive: true
    },
    {
      inspectorId: mockInspector.id,
      dayOfWeek: 1, // Monday
      startTime: '13:00',
      endTime: '17:00',
      isActive: true
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockInspectorRepo = new MockedInspectorRepository() as jest.Mocked<InspectorRepository>;
    MockedInspectorRepository.mockImplementation(() => mockInspectorRepo);
    
    availabilityManager = new AvailabilityManager();
  });

  describe('getInspectorDayAvailability', () => {
    it('should return day availability for inspector', async () => {
      mockInspectorRepo.getAvailability.mockResolvedValue(mockAvailability);

      const result = await availabilityManager.getInspectorDayAvailability(mockInspector.id, 1);

      expect(mockInspectorRepo.getAvailability).toHaveBeenCalledWith(mockInspector.id, 1);
      expect(result).toBeTruthy();
      expect(result!.dayOfWeek).toBe(1);
      expect(result!.timeSlots).toHaveLength(2);
      expect(result!.totalHours).toBe(8); // 4 hours morning + 4 hours afternoon
    });

    it('should return null when no availability found', async () => {
      mockInspectorRepo.getAvailability.mockResolvedValue([]);

      const result = await availabilityManager.getInspectorDayAvailability(mockInspector.id, 1);

      expect(result).toBeNull();
    });

    it('should filter out inactive availability slots', async () => {
      const availabilityWithInactive = [
        ...mockAvailability,
        {
          inspectorId: mockInspector.id,
          dayOfWeek: 1,
          startTime: '18:00',
          endTime: '20:00',
          isActive: false
        }
      ];

      mockInspectorRepo.getAvailability.mockResolvedValue(availabilityWithInactive);

      const result = await availabilityManager.getInspectorDayAvailability(mockInspector.id, 1);

      expect(result!.timeSlots).toHaveLength(2); // Should exclude inactive slot
    });
  });

  describe('getInspectorWeeklyAvailability', () => {
    it('should return weekly availability for inspector', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getAvailability.mockImplementation((inspectorId, dayOfWeek) => {
        if (dayOfWeek === 1 || dayOfWeek === 2) {
          return Promise.resolve(mockAvailability);
        }
        return Promise.resolve([]);
      });

      const result = await availabilityManager.getInspectorWeeklyAvailability(mockInspector.id);

      expect(result).toBeTruthy();
      expect(result!.inspectorId).toBe(mockInspector.id);
      expect(result!.inspectorName).toBe(mockInspector.name);
      expect(result!.days).toHaveLength(2); // Monday and Tuesday
      expect(result!.totalWeeklyHours).toBe(16); // 8 hours × 2 days
    });

    it('should return null when inspector not found', async () => {
      mockInspectorRepo.findById.mockResolvedValue(null);

      const result = await availabilityManager.getInspectorWeeklyAvailability('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('isInspectorAvailable', () => {
    const timeSlot: TimeSlot = { startTime: '09:00', endTime: '11:00' };

    it('should return true when inspector is available', async () => {
      mockInspectorRepo.getAvailability.mockResolvedValue(mockAvailability);

      const result = await availabilityManager.isInspectorAvailable(mockInspector.id, 1, timeSlot);

      expect(result).toBe(true);
    });

    it('should return false when inspector is not available', async () => {
      mockInspectorRepo.getAvailability.mockResolvedValue([]);

      const result = await availabilityManager.isInspectorAvailable(mockInspector.id, 1, timeSlot);

      expect(result).toBe(false);
    });

    it('should return false when time slot is outside availability', async () => {
      const outsideTimeSlot: TimeSlot = { startTime: '18:00', endTime: '20:00' };
      mockInspectorRepo.getAvailability.mockResolvedValue(mockAvailability);

      const result = await availabilityManager.isInspectorAvailable(mockInspector.id, 1, outsideTimeSlot);

      expect(result).toBe(false);
    });
  });

  describe('findAvailableInspectors', () => {
    const timeSlot: TimeSlot = { startTime: '09:00', endTime: '11:00' };

    it('should find available inspectors in zone', async () => {
      mockInspectorRepo.findByPreferredZone.mockResolvedValue([mockInspector]);
      mockInspectorRepo.getAvailability.mockResolvedValue(mockAvailability);

      const result = await availabilityManager.findAvailableInspectors(1, timeSlot, 'zone-1');

      expect(mockInspectorRepo.findByPreferredZone).toHaveBeenCalledWith('zone-1');
      expect(result).toContain(mockInspector.id);
    });

    it('should find available inspectors across all zones', async () => {
      mockInspectorRepo.findActive.mockResolvedValue([mockInspector]);
      mockInspectorRepo.getAvailability.mockResolvedValue(mockAvailability);

      const result = await availabilityManager.findAvailableInspectors(1, timeSlot);

      expect(mockInspectorRepo.findActive).toHaveBeenCalled();
      expect(result).toContain(mockInspector.id);
    });
  });

  describe('validateAvailabilitySchedule', () => {
    it('should detect overlapping time slots', () => {
      const overlappingSchedule = [
        {
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '12:00',
          isActive: true
        },
        {
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '14:00',
          isActive: true
        }
      ];

      const conflicts = availabilityManager.validateAvailabilitySchedule(overlappingSchedule);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].reason).toBe('Overlapping time slots');
      expect(conflicts[0].dayOfWeek).toBe(1);
    });

    it('should not detect conflicts for non-overlapping slots', () => {
      const nonOverlappingSchedule = [
        {
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '12:00',
          isActive: true
        },
        {
          dayOfWeek: 1,
          startTime: '13:00',
          endTime: '17:00',
          isActive: true
        }
      ];

      const conflicts = availabilityManager.validateAvailabilitySchedule(nonOverlappingSchedule);

      expect(conflicts).toHaveLength(0);
    });

    it('should ignore inactive slots when checking conflicts', () => {
      const scheduleWithInactive = [
        {
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '12:00',
          isActive: true
        },
        {
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '14:00',
          isActive: false // Inactive, should be ignored
        }
      ];

      const conflicts = availabilityManager.validateAvailabilitySchedule(scheduleWithInactive);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('getAvailabilityStatistics', () => {
    it('should calculate availability statistics', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getAvailability.mockImplementation((inspectorId, dayOfWeek) => {
        if (dayOfWeek === 1) {
          return Promise.resolve(mockAvailability);
        }
        return Promise.resolve([]);
      });

      const result = await availabilityManager.getAvailabilityStatistics([mockInspector.id]);

      expect(result.totalInspectors).toBe(1);
      expect(result.averageWeeklyHours).toBe(8); // 8 hours on Monday only
      expect(result.inspectorStats).toHaveLength(1);
      expect(result.inspectorStats[0].weeklyHours).toBe(8);
      expect(result.inspectorStats[0].availableDays).toBe(1);
    });

    it('should handle empty inspector list', async () => {
      const result = await availabilityManager.getAvailabilityStatistics([]);

      expect(result.totalInspectors).toBe(0);
      expect(result.averageWeeklyHours).toBe(0);
      expect(result.inspectorStats).toHaveLength(0);
    });
  });
});