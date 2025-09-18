import { WorkloadCalculator, WorkloadMetrics } from '../../services/WorkloadCalculator';
import { InspectorRepository } from '../../repositories/InspectorRepository';
import { RouteRepository } from '../../repositories/RouteRepository';
import { Inspector, Route } from '../../types';

// Mock the repositories
jest.mock('../../repositories/InspectorRepository');
jest.mock('../../repositories/RouteRepository');

const MockedInspectorRepository = InspectorRepository as jest.MockedClass<typeof InspectorRepository>;
const MockedRouteRepository = RouteRepository as jest.MockedClass<typeof RouteRepository>;

describe('WorkloadCalculator', () => {
  let workloadCalculator: WorkloadCalculator;
  let mockInspectorRepo: jest.Mocked<InspectorRepository>;
  let mockRouteRepo: jest.Mocked<RouteRepository>;

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

  const mockRoutes: Route[] = [
    {
      id: 'route-1',
      name: 'Ruta Centro',
      estimatedDuration: 120, // 2 hours
      priority: 'medium',
      zoneId: 'zone-1',
      status: 'assigned',
      assignedInspectorId: mockInspector.id,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    {
      id: 'route-2',
      name: 'Ruta Norte',
      estimatedDuration: 180, // 3 hours
      priority: 'high',
      zoneId: 'zone-1',
      status: 'assigned',
      assignedInspectorId: mockInspector.id,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockInspectorRepo = new MockedInspectorRepository() as jest.Mocked<InspectorRepository>;
    mockRouteRepo = new MockedRouteRepository() as jest.Mocked<RouteRepository>;
    
    MockedInspectorRepository.mockImplementation(() => mockInspectorRepo);
    MockedRouteRepository.mockImplementation(() => mockRouteRepo);
    
    workloadCalculator = new WorkloadCalculator();
  });

  describe('calculateInspectorWorkload', () => {
    it('should calculate workload metrics for inspector', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2);
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.calculateInspectorWorkload(mockInspector.id);

      expect(result).toBeTruthy();
      expect(result!.inspectorId).toBe(mockInspector.id);
      expect(result!.inspectorName).toBe(mockInspector.name);
      expect(result!.currentRoutes).toBe(2);
      expect(result!.maxDailyRoutes).toBe(5);
      expect(result!.utilizationPercentage).toBe(40); // 2/5 * 100
      expect(result!.availableCapacity).toBe(3); // 5 - 2
      expect(result!.estimatedWorkHours).toBe(5); // (120 + 180) / 60
    });

    it('should return null when inspector not found', async () => {
      mockInspectorRepo.findById.mockResolvedValue(null);

      const result = await workloadCalculator.calculateInspectorWorkload('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle inspector with no assigned routes', async () => {
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(0);
      mockRouteRepo.findByInspector.mockResolvedValue([]);

      const result = await workloadCalculator.calculateInspectorWorkload(mockInspector.id);

      expect(result).toBeTruthy();
      expect(result!.currentRoutes).toBe(0);
      expect(result!.utilizationPercentage).toBe(0);
      expect(result!.availableCapacity).toBe(5);
      expect(result!.estimatedWorkHours).toBe(0);
    });
  });

  describe('calculateAllInspectorWorkloads', () => {
    it('should calculate workload for all active inspectors', async () => {
      const inspector2: Inspector = { ...mockInspector, id: 'inspector-2', name: 'María García' };
      
      mockInspectorRepo.findActive.mockResolvedValue([mockInspector, inspector2]);
      mockInspectorRepo.findById
        .mockResolvedValueOnce(mockInspector)
        .mockResolvedValueOnce(inspector2);
      mockInspectorRepo.getCurrentWorkload
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(4);
      mockRouteRepo.findByInspector
        .mockResolvedValueOnce(mockRoutes)
        .mockResolvedValueOnce([mockRoutes[0]]);

      const result = await workloadCalculator.calculateAllInspectorWorkloads();

      expect(result).toHaveLength(2);
      expect(result[0].utilizationPercentage).toBeGreaterThanOrEqual(result[1].utilizationPercentage);
    });

    it('should return empty array when no active inspectors', async () => {
      mockInspectorRepo.findActive.mockResolvedValue([]);

      const result = await workloadCalculator.calculateAllInspectorWorkloads();

      expect(result).toHaveLength(0);
    });
  });

  describe('findInspectorsWithCapacity', () => {
    it('should find inspectors with available capacity', async () => {
      mockInspectorRepo.findActive.mockResolvedValue([mockInspector]);
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2);
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.findInspectorsWithCapacity(2);

      expect(result).toHaveLength(1);
      expect(result[0].availableCapacity).toBeGreaterThanOrEqual(2);
    });

    it('should filter by zone when specified', async () => {
      mockInspectorRepo.findByPreferredZone.mockResolvedValue([mockInspector]);
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(1);
      mockRouteRepo.findByInspector.mockResolvedValue([mockRoutes[0]]);

      const result = await workloadCalculator.findInspectorsWithCapacity(1, 'zone-1');

      expect(mockInspectorRepo.findByPreferredZone).toHaveBeenCalledWith('zone-1');
      expect(result).toHaveLength(1);
    });

    it('should exclude inspectors without sufficient capacity', async () => {
      const overloadedInspector = { ...mockInspector, maxDailyRoutes: 2 };
      
      mockInspectorRepo.findActive.mockResolvedValue([overloadedInspector]);
      mockInspectorRepo.findById.mockResolvedValue(overloadedInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2); // At capacity
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.findInspectorsWithCapacity(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('predictWorkloadImpact', () => {
    it('should predict workload impact of assignments', async () => {
      const assignments = [
        { routeId: 'route-3', inspectorId: mockInspector.id },
        { routeId: 'route-4', inspectorId: mockInspector.id }
      ];

      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2);
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.predictWorkloadImpact(assignments);

      expect(result.beforeAssignment).toHaveLength(1);
      expect(result.afterAssignment).toHaveLength(1);
      expect(result.impactSummary).toHaveLength(1);
      
      const impact = result.impactSummary[0];
      expect(impact.inspectorId).toBe(mockInspector.id);
      expect(impact.currentUtilization).toBe(40); // 2/5 * 100
      expect(impact.projectedUtilization).toBe(80); // 4/5 * 100
      expect(impact.utilizationChange).toBe(40);
      expect(impact.willExceedCapacity).toBe(false);
    });

    it('should detect capacity overflow', async () => {
      const assignments = [
        { routeId: 'route-3', inspectorId: mockInspector.id },
        { routeId: 'route-4', inspectorId: mockInspector.id },
        { routeId: 'route-5', inspectorId: mockInspector.id },
        { routeId: 'route-6', inspectorId: mockInspector.id }
      ];

      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2);
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.predictWorkloadImpact(assignments);

      const impact = result.impactSummary[0];
      expect(impact.willExceedCapacity).toBe(true);
      expect(impact.projectedUtilization).toBeGreaterThan(100);
    });
  });

  describe('getWorkloadBalanceRecommendations', () => {
    it('should identify overloaded inspectors', async () => {
      const overloadedInspector = { ...mockInspector, maxDailyRoutes: 1 };
      
      mockInspectorRepo.findActive.mockResolvedValue([overloadedInspector]);
      mockInspectorRepo.findById.mockResolvedValue(overloadedInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2); // Over capacity
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.getWorkloadBalanceRecommendations();

      expect(result.overloadedInspectors).toHaveLength(1);
      expect(result.recommendations.some(r => r.type === 'redistribute' && r.priority === 'high')).toBe(true);
    });

    it('should identify underutilized inspectors', async () => {
      const underutilizedInspector = { ...mockInspector, maxDailyRoutes: 10 };
      
      mockInspectorRepo.findActive.mockResolvedValue([underutilizedInspector]);
      mockInspectorRepo.findById.mockResolvedValue(underutilizedInspector);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2); // 20% utilization
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.getWorkloadBalanceRecommendations();

      expect(result.underutilizedInspectors).toHaveLength(1);
      expect(result.recommendations.some(r => r.type === 'optimize' && r.priority === 'low')).toBe(true);
    });

    it('should detect unbalanced workload distribution', async () => {
      const inspector1 = { ...mockInspector, id: 'inspector-1', maxDailyRoutes: 5 };
      const inspector2 = { ...mockInspector, id: 'inspector-2', maxDailyRoutes: 5 };
      
      mockInspectorRepo.findActive.mockResolvedValue([inspector1, inspector2]);
      mockInspectorRepo.findById
        .mockResolvedValueOnce(inspector1)
        .mockResolvedValueOnce(inspector2);
      mockInspectorRepo.getCurrentWorkload
        .mockResolvedValueOnce(5) // 100% utilization
        .mockResolvedValueOnce(1); // 20% utilization
      mockRouteRepo.findByInspector
        .mockResolvedValueOnce(mockRoutes)
        .mockResolvedValueOnce([mockRoutes[0]]);

      const result = await workloadCalculator.getWorkloadBalanceRecommendations();

      expect(result.recommendations.some(r => r.type === 'optimize' && r.priority === 'medium')).toBe(true);
    });
  });

  describe('getSystemWorkloadOverview', () => {
    it('should provide comprehensive system overview', async () => {
      const allInspectors = [mockInspector, { ...mockInspector, id: 'inspector-2', isActive: false }];
      const allRoutes = [...mockRoutes, { ...mockRoutes[0], id: 'route-3', assignedInspectorId: undefined }];
      
      mockInspectorRepo.findAll.mockResolvedValue(allInspectors);
      mockRouteRepo.findAll.mockResolvedValue(allRoutes);
      mockInspectorRepo.getCurrentWorkload.mockResolvedValue(2);

      // Mock the methods that will be called
      mockInspectorRepo.findActive.mockResolvedValue([mockInspector]);
      mockInspectorRepo.findById.mockResolvedValue(mockInspector);
      mockRouteRepo.findByInspector.mockResolvedValue(mockRoutes);

      const result = await workloadCalculator.getSystemWorkloadOverview();

      expect(result.totalInspectors).toBe(2);
      expect(result.activeInspectors).toBe(1);
      expect(result.totalRoutes).toBe(3);
      expect(result.assignedRoutes).toBe(2);
      expect(result.unassignedRoutes).toBe(1);
      expect(result.systemUtilization).toBeGreaterThan(0);
      expect(result.inspectorMetrics).toHaveLength(1);
    });
  });
});