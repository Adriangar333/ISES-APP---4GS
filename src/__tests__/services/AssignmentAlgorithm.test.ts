import { AssignmentAlgorithm, AssignmentOptions } from '../../services/AssignmentAlgorithm';
import { InspectorRepository } from '../../repositories/InspectorRepository';
import { RouteRepository } from '../../repositories/RouteRepository';
import { WorkloadCalculator } from '../../services/WorkloadCalculator';
import { AvailabilityManager } from '../../services/AvailabilityManager';
import { Route, Inspector, AssignmentResult } from '../../types';

// Mock the dependencies
jest.mock('../../repositories/InspectorRepository');
jest.mock('../../repositories/RouteRepository');
jest.mock('../../services/WorkloadCalculator');
jest.mock('../../services/AvailabilityManager');

describe('AssignmentAlgorithm', () => {
  let assignmentAlgorithm: AssignmentAlgorithm;
  let mockInspectorRepository: jest.Mocked<InspectorRepository>;
  let mockRouteRepository: jest.Mocked<RouteRepository>;
  let mockWorkloadCalculator: jest.Mocked<WorkloadCalculator>;
  let mockAvailabilityManager: jest.Mocked<AvailabilityManager>;

  // Test data
  const mockInspectors: Inspector[] = [
    {
      id: 'inspector-1',
      name: 'Juan Pérez',
      identification: '12345678',
      email: 'juan@test.com',
      phone: '555-0001',
      preferredZones: ['zone-1', 'zone-2'],
      maxDailyRoutes: 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'inspector-2',
      name: 'María García',
      identification: '87654321',
      email: 'maria@test.com',
      phone: '555-0002',
      preferredZones: ['zone-2', 'zone-3'],
      maxDailyRoutes: 4,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'inspector-3',
      name: 'Carlos López',
      identification: '11223344',
      email: 'carlos@test.com',
      phone: '555-0003',
      preferredZones: ['zone-1'],
      maxDailyRoutes: 6,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockRoutes: Route[] = [
    {
      id: 'route-1',
      name: 'Ruta Centro 1',
      estimatedDuration: 120,
      priority: 'high',
      zoneId: 'zone-1',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'route-2',
      name: 'Ruta Norte 1',
      estimatedDuration: 90,
      priority: 'medium',
      zoneId: 'zone-2',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'route-3',
      name: 'Ruta Sur 1',
      estimatedDuration: 60,
      priority: 'low',
      zoneId: 'zone-3',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockWorkloadMetrics = [
    {
      inspectorId: 'inspector-1',
      inspectorName: 'Juan Pérez',
      currentRoutes: 2,
      maxDailyRoutes: 5,
      utilizationPercentage: 40,
      availableCapacity: 3,
      estimatedWorkHours: 4,
      zoneDistribution: []
    },
    {
      inspectorId: 'inspector-2',
      inspectorName: 'María García',
      currentRoutes: 3,
      maxDailyRoutes: 4,
      utilizationPercentage: 75,
      availableCapacity: 1,
      estimatedWorkHours: 5,
      zoneDistribution: []
    },
    {
      inspectorId: 'inspector-3',
      inspectorName: 'Carlos López',
      currentRoutes: 1,
      maxDailyRoutes: 6,
      utilizationPercentage: 17,
      availableCapacity: 5,
      estimatedWorkHours: 2,
      zoneDistribution: []
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create algorithm instance
    assignmentAlgorithm = new AssignmentAlgorithm();

    // Get mocked instances
    mockInspectorRepository = InspectorRepository.prototype as jest.Mocked<InspectorRepository>;
    mockRouteRepository = RouteRepository.prototype as jest.Mocked<RouteRepository>;
    mockWorkloadCalculator = WorkloadCalculator.prototype as jest.Mocked<WorkloadCalculator>;
    mockAvailabilityManager = AvailabilityManager.prototype as jest.Mocked<AvailabilityManager>;

    // Setup default mock implementations
    mockInspectorRepository.findActive.mockResolvedValue(mockInspectors);
    mockInspectorRepository.findById.mockImplementation(async (id: string) => 
      mockInspectors.find(i => i.id === id) || null
    );

    mockRouteRepository.findById.mockImplementation(async (id: string) => 
      mockRoutes.find(r => r.id === id) || null
    );
    mockRouteRepository.findByStatus.mockResolvedValue(mockRoutes);

    mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(mockWorkloadMetrics);
  });

  describe('assignRoutes', () => {
    it('should assign routes to inspectors based on zone preference', async () => {
      const routeIds = ['route-1', 'route-2'];
      const options: AssignmentOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: false,
        balanceWorkload: true,
        considerAvailability: true
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      expect(result.assignments).toHaveLength(2);
      expect(result.unassignedRoutes).toHaveLength(0);
      expect(result.summary.totalRoutes).toBe(2);
      expect(result.summary.assignedRoutes).toBe(2);
      expect(result.summary.unassignedRoutes).toBe(0);

      // Verify assignments respect zone preferences
      const route1Assignment = result.assignments.find((a: any) => a.routeId === 'route-1');
      const route2Assignment = result.assignments.find((a: any) => a.routeId === 'route-2');

      expect(route1Assignment).toBeDefined();
      expect(route2Assignment).toBeDefined();

      // Route 1 (zone-1) should be assigned to inspector with zone-1 preference
      const inspector1 = mockInspectors.find(i => i.id === route1Assignment!.inspectorId);
      expect(inspector1?.preferredZones).toContain('zone-1');

      // Route 2 (zone-2) should be assigned to inspector with zone-2 preference
      const inspector2 = mockInspectors.find(i => i.id === route2Assignment!.inspectorId);
      expect(inspector2?.preferredZones).toContain('zone-2');
    });

    it('should balance workload when option is enabled', async () => {
      const routeIds = ['route-1', 'route-2', 'route-3'];
      const options: AssignmentOptions = {
        prioritizeZonePreference: false,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      expect(result.assignments).toHaveLength(3);
      
      // Check that routes are distributed considering workload balance
      const assignmentsByInspector = new Map<string, number>();
      result.assignments.forEach((assignment: any) => {
        const count = assignmentsByInspector.get(assignment.inspectorId) || 0;
        assignmentsByInspector.set(assignment.inspectorId, count + 1);
      });

      // Inspector 3 (lowest utilization) should get at least one assignment
      expect(assignmentsByInspector.has('inspector-3')).toBe(true);
    });

    it('should prioritize high priority routes', async () => {
      const routeIds = ['route-1', 'route-2', 'route-3']; // route-1 is high priority
      const options: AssignmentOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: false,
        considerAvailability: true
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      expect(result.assignments).toHaveLength(3);
      
      // High priority route should be assigned to best available inspector
      const highPriorityAssignment = result.assignments.find((a: any) => a.routeId === 'route-1');
      expect(highPriorityAssignment).toBeDefined();
    });

    it('should respect utilization threshold', async () => {
      const routeIds = ['route-1', 'route-2'];
      const options: AssignmentOptions = {
        prioritizeZonePreference: false,
        maxUtilizationThreshold: 50, // Low threshold
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      // Only inspector-3 (17% utilization) should be eligible
      result.assignments.forEach((assignment: any) => {
        const inspector = mockInspectors.find(i => i.id === assignment.inspectorId);
        const metrics = mockWorkloadMetrics.find(m => m.inspectorId === assignment.inspectorId);
        expect(metrics?.utilizationPercentage).toBeLessThanOrEqual(50);
      });
    });

    it('should handle cross-zone assignment when allowed', async () => {
      const routeIds = ['route-3']; // zone-3 route, no inspector has this as preferred
      const options: AssignmentOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      expect(result.assignments).toHaveLength(1);
      expect(result.unassignedRoutes).toHaveLength(0);
    });

    it('should leave routes unassigned when cross-zone assignment is disabled', async () => {
      const routeIds = ['route-3']; // zone-3 route, no inspector has this as preferred
      const options: AssignmentOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: false,
        balanceWorkload: true,
        considerAvailability: true
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      expect(result.assignments).toHaveLength(0);
      expect(result.unassignedRoutes).toHaveLength(1);
      expect(result.unassignedRoutes[0].id).toBe('route-3');
    });

    it('should handle empty route list', async () => {
      const result = await assignmentAlgorithm.assignRoutes([]);

      expect(result.assignments).toHaveLength(0);
      expect(result.unassignedRoutes).toHaveLength(0);
      expect(result.summary.totalRoutes).toBe(0);
    });

    it('should handle non-existent routes', async () => {
      const routeIds = ['non-existent-route'];

      const result = await assignmentAlgorithm.assignRoutes(routeIds);

      expect(result.assignments).toHaveLength(0);
      expect(result.unassignedRoutes).toHaveLength(0);
      expect(result.summary.totalRoutes).toBe(0);
    });
  });

  describe('assignAllPendingRoutes', () => {
    it('should assign all pending routes', async () => {
      const result = await assignmentAlgorithm.assignAllPendingRoutes();

      expect(mockRouteRepository.findByStatus).toHaveBeenCalledWith('pending');
      expect(result.assignments.length).toBeGreaterThan(0);
    });
  });

  describe('reassignInspectorRoutes', () => {
    it('should reassign routes from one inspector to others', async () => {
      const inspectorRoutes: Route[] = [
        { 
          id: 'route-1',
          name: 'Ruta Centro 1',
          estimatedDuration: 120,
          priority: 'high',
          zoneId: 'zone-1',
          status: 'assigned' as const, 
          assignedInspectorId: 'inspector-1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: 'route-2',
          name: 'Ruta Norte 1',
          estimatedDuration: 90,
          priority: 'medium',
          zoneId: 'zone-2',
          status: 'assigned' as const, 
          assignedInspectorId: 'inspector-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRouteRepository.findByInspector.mockResolvedValue(inspectorRoutes);
      mockRouteRepository.unassignFromInspector.mockResolvedValue(inspectorRoutes[0]!);

      const result = await assignmentAlgorithm.reassignInspectorRoutes('inspector-1');

      expect(mockRouteRepository.findByInspector).toHaveBeenCalledWith('inspector-1');
      expect(mockRouteRepository.unassignFromInspector).toHaveBeenCalledTimes(2);
      expect(result.assignments.length).toBeGreaterThan(0);
    });
  });

  describe('getAssignmentRecommendations', () => {
    it('should identify overloaded and underutilized inspectors', async () => {
      // Mock overloaded inspector
      const overloadedMetrics = [
        ...mockWorkloadMetrics,
        {
          inspectorId: 'inspector-4',
          inspectorName: 'Ana Martínez',
          currentRoutes: 6,
          maxDailyRoutes: 5,
          utilizationPercentage: 120,
          availableCapacity: -1,
          estimatedWorkHours: 8,
          zoneDistribution: []
        }
      ];

      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(overloadedMetrics);

      const recommendations = await assignmentAlgorithm.getAssignmentRecommendations();

      expect(recommendations.overloadedInspectors).toContain('inspector-4');
      expect(recommendations.underutilizedInspectors).toContain('inspector-3'); // 17% utilization
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      mockInspectorRepository.findActive.mockRejectedValue(new Error('Database error'));

      await expect(assignmentAlgorithm.assignRoutes(['route-1'])).rejects.toThrow('Database error');
    });

    it('should handle workload calculator errors', async () => {
      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockRejectedValue(new Error('Calculation error'));

      await expect(assignmentAlgorithm.assignRoutes(['route-1'])).rejects.toThrow('Calculation error');
    });
  });

  describe('assignment scoring', () => {
    it('should calculate higher scores for zone-matched assignments', async () => {
      const routeIds = ['route-1']; // zone-1 route
      const options: AssignmentOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: false,
        considerAvailability: false
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      expect(result.assignments).toHaveLength(1);
      
      // Should be assigned to inspector with zone-1 preference (inspector-1 or inspector-3)
      const assignment = result.assignments[0];
      const assignedInspector = mockInspectors.find(i => i.id === assignment.inspectorId);
      expect(assignedInspector?.preferredZones).toContain('zone-1');
    });

    it('should consider workload balance in scoring', async () => {
      const routeIds = ['route-1', 'route-2'];
      const options: AssignmentOptions = {
        prioritizeZonePreference: false,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: false
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      expect(result.assignments).toHaveLength(2);
      
      // Inspector-3 (lowest utilization) should get at least one assignment
      const inspector3Assignments = result.assignments.filter((a: any) => a.inspectorId === 'inspector-3');
      expect(inspector3Assignments.length).toBeGreaterThan(0);
    });
  });

  describe('conflict detection', () => {
    it('should detect capacity conflicts', async () => {
      // Mock inspector at full capacity
      const fullCapacityMetrics = mockWorkloadMetrics.map(m => 
        m.inspectorId === 'inspector-2' 
          ? { ...m, currentRoutes: 4, availableCapacity: 0, utilizationPercentage: 100 }
          : m
      );

      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(fullCapacityMetrics);

      const routeIds = ['route-2']; // zone-2 route, inspector-2 prefers zone-2 but is at capacity
      const options: AssignmentOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: false,
        balanceWorkload: false,
        considerAvailability: false
      };

      const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

      // Should still assign to inspector-1 who also prefers zone-2
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].inspectorId).toBe('inspector-1');
    });
  });
});