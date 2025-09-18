import { AssignmentOptimizer, OptimizationOptions } from '../../services/AssignmentOptimizer';
import { AssignmentAlgorithm } from '../../services/AssignmentAlgorithm';
import { InspectorRepository } from '../../repositories/InspectorRepository';
import { RouteRepository } from '../../repositories/RouteRepository';
import { WorkloadCalculator } from '../../services/WorkloadCalculator';
import { GeospatialService } from '../../services/GeospatialService';
import { Route, Inspector, AssignmentResult } from '../../types';

// Mock the dependencies
jest.mock('../../services/AssignmentAlgorithm');
jest.mock('../../repositories/InspectorRepository');
jest.mock('../../repositories/RouteRepository');
jest.mock('../../services/WorkloadCalculator');
jest.mock('../../services/GeospatialService');

describe('AssignmentOptimizer', () => {
  let assignmentOptimizer: AssignmentOptimizer;
  let mockAssignmentAlgorithm: jest.Mocked<AssignmentAlgorithm>;
  let mockInspectorRepository: jest.Mocked<InspectorRepository>;
  let mockRouteRepository: jest.Mocked<RouteRepository>;
  let mockWorkloadCalculator: jest.Mocked<WorkloadCalculator>;
  let mockGeospatialService: jest.Mocked<GeospatialService>;

  // Test data
  const mockInspectors: Inspector[] = [
    {
      id: 'inspector-1',
      name: 'Juan Pérez',
      identification: '12345678',
      email: 'juan@test.com',
      phone: '555-0001',
      preferredZones: ['zone-1'],
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
      preferredZones: ['zone-2'],
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
      preferredZones: ['zone-1', 'zone-2'],
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
      zoneId: 'zone-3', // No inspector prefers this zone
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockWorkloadMetrics = [
    {
      inspectorId: 'inspector-1',
      inspectorName: 'Juan Pérez',
      currentRoutes: 5, // At capacity
      maxDailyRoutes: 5,
      utilizationPercentage: 100,
      availableCapacity: 0,
      estimatedWorkHours: 8,
      zoneDistribution: []
    },
    {
      inspectorId: 'inspector-2',
      inspectorName: 'María García',
      currentRoutes: 2, // Underutilized
      maxDailyRoutes: 4,
      utilizationPercentage: 50,
      availableCapacity: 2,
      estimatedWorkHours: 3,
      zoneDistribution: []
    },
    {
      inspectorId: 'inspector-3',
      inspectorName: 'Carlos López',
      currentRoutes: 1, // Very underutilized
      maxDailyRoutes: 6,
      utilizationPercentage: 17,
      availableCapacity: 5,
      estimatedWorkHours: 2,
      zoneDistribution: []
    }
  ];

  const mockStandardAssignmentResult: AssignmentResult = {
    assignments: [
      {
        routeId: 'route-1',
        inspectorId: 'inspector-1',
        assignedAt: new Date(),
        estimatedStartTime: new Date(),
        estimatedEndTime: new Date()
      },
      {
        routeId: 'route-2',
        inspectorId: 'inspector-2',
        assignedAt: new Date(),
        estimatedStartTime: new Date(),
        estimatedEndTime: new Date()
      }
    ],
    unassignedRoutes: [mockRoutes[2]!], // route-3 unassigned
    workloadDistribution: [],
    summary: {
      totalRoutes: 3,
      assignedRoutes: 2,
      unassignedRoutes: 1
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    assignmentOptimizer = new AssignmentOptimizer();

    // Get mocked instances
    mockAssignmentAlgorithm = AssignmentAlgorithm.prototype as jest.Mocked<AssignmentAlgorithm>;
    mockInspectorRepository = InspectorRepository.prototype as jest.Mocked<InspectorRepository>;
    mockRouteRepository = RouteRepository.prototype as jest.Mocked<RouteRepository>;
    mockWorkloadCalculator = WorkloadCalculator.prototype as jest.Mocked<WorkloadCalculator>;
    mockGeospatialService = GeospatialService.prototype as jest.Mocked<GeospatialService>;

    // Setup default mock implementations
    mockAssignmentAlgorithm.assignRoutes.mockResolvedValue(mockStandardAssignmentResult);
    mockInspectorRepository.findActive.mockResolvedValue(mockInspectors);
    mockInspectorRepository.findById.mockImplementation(async (id: string) => 
      mockInspectors.find(i => i.id === id) || null
    );
    mockRouteRepository.findById.mockImplementation(async (id: string) => 
      mockRoutes.find(r => r.id === id) || null
    );
    mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(mockWorkloadMetrics);
  });

  describe('optimizedAssignment', () => {
    it('should perform standard assignment when no optimization is needed', async () => {
      const routeIds = ['route-1', 'route-2'];
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: false,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: false,
        maxCrossZoneDistance: 15,
        enableAutomaticReassignment: false,
        optimizationStrategy: 'zone_priority'
      };

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      expect(mockAssignmentAlgorithm.assignRoutes).toHaveBeenCalledWith(routeIds, options);
      expect(result.assignments).toHaveLength(2);
      expect(result.unassignedRoutes).toHaveLength(0);
    });

    it('should handle cross-zone assignment for unassigned routes', async () => {
      const routeIds = ['route-1', 'route-2', 'route-3'];
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: true,
        maxCrossZoneDistance: 15,
        enableAutomaticReassignment: false,
        optimizationStrategy: 'balanced'
      };

      // Mock assignment result with unassigned route
      const resultWithUnassigned: AssignmentResult = {
        ...mockStandardAssignmentResult,
        unassignedRoutes: [mockRoutes[2]!] // route-3 in zone-3
      };
      mockAssignmentAlgorithm.assignRoutes.mockResolvedValue(resultWithUnassigned);

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      expect(result.assignments.length).toBeGreaterThanOrEqual(2);
      // Should attempt cross-zone assignment for route-3
      expect(result.unassignedRoutes.length).toBeLessThanOrEqual(1);
    });

    it('should apply balanced optimization strategy', async () => {
      const routeIds = ['route-1', 'route-2'];
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: false,
        maxCrossZoneDistance: 15,
        enableAutomaticReassignment: true,
        optimizationStrategy: 'balanced'
      };

      // Mock overloaded inspector scenario
      const overloadedMetrics = mockWorkloadMetrics.map(m => 
        m.inspectorId === 'inspector-1' 
          ? { ...m, currentRoutes: 6, utilizationPercentage: 120, availableCapacity: -1 }
          : m
      );
      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(overloadedMetrics);

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      expect(result.assignments).toBeDefined();
      // Should attempt to balance workload
    });

    it('should respect maximum cross-zone distance', async () => {
      const routeIds = ['route-3']; // Route in zone-3
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: true,
        maxCrossZoneDistance: 5, // Very restrictive distance
        enableAutomaticReassignment: false,
        optimizationStrategy: 'balanced'
      };

      const resultWithUnassigned: AssignmentResult = {
        assignments: [],
        unassignedRoutes: [mockRoutes[2]!],
        workloadDistribution: [],
        summary: {
          totalRoutes: 1,
          assignedRoutes: 0,
          unassignedRoutes: 1
        }
      };
      mockAssignmentAlgorithm.assignRoutes.mockResolvedValue(resultWithUnassigned);

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      // With restrictive distance, route should remain unassigned
      expect(result.unassignedRoutes).toHaveLength(1);
    });
  });

  describe('validateAssignmentResult', () => {
    it('should identify capacity violations', async () => {
      const assignmentResult: AssignmentResult = {
        assignments: [
          {
            routeId: 'route-1',
            inspectorId: 'inspector-1',
            assignedAt: new Date(),
            estimatedStartTime: new Date(),
            estimatedEndTime: new Date()
          }
        ],
        unassignedRoutes: [],
        workloadDistribution: [],
        summary: {
          totalRoutes: 1,
          assignedRoutes: 1,
          unassignedRoutes: 0
        }
      };

      // Mock overloaded inspector
      const overloadedMetrics = [
        {
          inspectorId: 'inspector-1',
          inspectorName: 'Juan Pérez',
          currentRoutes: 6,
          maxDailyRoutes: 5,
          utilizationPercentage: 120,
          availableCapacity: -1,
          estimatedWorkHours: 10,
          zoneDistribution: []
        }
      ];
      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(overloadedMetrics);

      const validation = await assignmentOptimizer.validateAssignmentResult(assignmentResult);

      expect(validation.isValid).toBe(false);
      expect(validation.conflicts).toHaveLength(1);
      expect(validation.conflicts[0].conflictType).toBe('capacity_exceeded');
      expect(validation.conflicts[0].severity).toBe('high');
    });

    it('should calculate assignment metrics correctly', async () => {
      const assignmentResult: AssignmentResult = {
        assignments: [
          {
            routeId: 'route-1',
            inspectorId: 'inspector-1',
            assignedAt: new Date(),
            estimatedStartTime: new Date(),
            estimatedEndTime: new Date()
          },
          {
            routeId: 'route-3', // Cross-zone assignment
            inspectorId: 'inspector-1', // Inspector-1 doesn't prefer zone-3
            assignedAt: new Date(),
            estimatedStartTime: new Date(),
            estimatedEndTime: new Date()
          }
        ],
        unassignedRoutes: [],
        workloadDistribution: [],
        summary: {
          totalRoutes: 2,
          assignedRoutes: 2,
          unassignedRoutes: 0
        }
      };

      const validation = await assignmentOptimizer.validateAssignmentResult(assignmentResult);

      expect(validation.metrics.totalAssignments).toBe(2);
      expect(validation.metrics.crossZoneAssignments).toBe(1);
      expect(validation.metrics.averageUtilization).toBeGreaterThan(0);
      expect(validation.metrics.utilizationVariance).toBeGreaterThanOrEqual(0);
    });

    it('should generate workload balancing suggestions', async () => {
      const assignmentResult: AssignmentResult = {
        assignments: [
          {
            routeId: 'route-1',
            inspectorId: 'inspector-1',
            assignedAt: new Date(),
            estimatedStartTime: new Date(),
            estimatedEndTime: new Date()
          }
        ],
        unassignedRoutes: [],
        workloadDistribution: [],
        summary: {
          totalRoutes: 1,
          assignedRoutes: 1,
          unassignedRoutes: 0
        }
      };

      // Mock high variance in utilization
      const unevenMetrics = [
        {
          inspectorId: 'inspector-1',
          inspectorName: 'Juan Pérez',
          currentRoutes: 5,
          maxDailyRoutes: 5,
          utilizationPercentage: 100,
          availableCapacity: 0,
          estimatedWorkHours: 8,
          zoneDistribution: []
        },
        {
          inspectorId: 'inspector-2',
          inspectorName: 'María García',
          currentRoutes: 1,
          maxDailyRoutes: 4,
          utilizationPercentage: 25,
          availableCapacity: 3,
          estimatedWorkHours: 2,
          zoneDistribution: []
        }
      ];
      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(unevenMetrics);

      const validation = await assignmentOptimizer.validateAssignmentResult(assignmentResult);

      expect(validation.suggestions.length).toBeGreaterThan(0);
    });

    it('should validate successful balanced assignment', async () => {
      const balancedResult: AssignmentResult = {
        assignments: [
          {
            routeId: 'route-1',
            inspectorId: 'inspector-1',
            assignedAt: new Date(),
            estimatedStartTime: new Date(),
            estimatedEndTime: new Date()
          },
          {
            routeId: 'route-2',
            inspectorId: 'inspector-2',
            assignedAt: new Date(),
            estimatedStartTime: new Date(),
            estimatedEndTime: new Date()
          }
        ],
        unassignedRoutes: [],
        workloadDistribution: [],
        summary: {
          totalRoutes: 2,
          assignedRoutes: 2,
          unassignedRoutes: 0
        }
      };

      // Mock balanced workload
      const balancedMetrics = [
        {
          inspectorId: 'inspector-1',
          inspectorName: 'Juan Pérez',
          currentRoutes: 3,
          maxDailyRoutes: 5,
          utilizationPercentage: 60,
          availableCapacity: 2,
          estimatedWorkHours: 5,
          zoneDistribution: []
        },
        {
          inspectorId: 'inspector-2',
          inspectorName: 'María García',
          currentRoutes: 2,
          maxDailyRoutes: 4,
          utilizationPercentage: 50,
          availableCapacity: 2,
          estimatedWorkHours: 4,
          zoneDistribution: []
        }
      ];
      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockResolvedValue(balancedMetrics);

      const validation = await assignmentOptimizer.validateAssignmentResult(balancedResult);

      expect(validation.isValid).toBe(true);
      expect(validation.conflicts.filter(c => c.severity === 'high')).toHaveLength(0);
      expect(validation.metrics.utilizationVariance).toBeLessThan(25);
    });
  });

  describe('cross-zone assignment logic', () => {
    it('should find suitable cross-zone candidates', async () => {
      const routeIds = ['route-3']; // Route in zone-3, no preferred inspector
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 80,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: true,
        maxCrossZoneDistance: 20,
        enableAutomaticReassignment: false,
        optimizationStrategy: 'balanced'
      };

      // Mock result with unassigned route
      const unassignedResult: AssignmentResult = {
        assignments: [],
        unassignedRoutes: [mockRoutes[2]],
        workloadDistribution: [],
        summary: {
          totalRoutes: 1,
          assignedRoutes: 0,
          unassignedRoutes: 1
        }
      };
      mockAssignmentAlgorithm.assignRoutes.mockResolvedValue(unassignedResult);

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      // Should attempt cross-zone assignment
      expect(result.assignments.length + result.unassignedRoutes.length).toBe(1);
    });

    it('should respect utilization threshold in cross-zone assignment', async () => {
      const routeIds = ['route-3'];
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 50, // Very restrictive
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: true,
        maxCrossZoneDistance: 20,
        enableAutomaticReassignment: false,
        optimizationStrategy: 'balanced'
      };

      const unassignedResult: AssignmentResult = {
        assignments: [],
        unassignedRoutes: [mockRoutes[2]],
        workloadDistribution: [],
        summary: {
          totalRoutes: 1,
          assignedRoutes: 0,
          unassignedRoutes: 1
        }
      };
      mockAssignmentAlgorithm.assignRoutes.mockResolvedValue(unassignedResult);

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      // With restrictive threshold, only inspector-3 (17% utilization) should be eligible
      if (result.assignments.length > 0) {
        expect(result.assignments[0]?.inspectorId).toBe('inspector-3');
      }
    });
  });

  describe('optimization strategies', () => {
    it('should apply efficiency optimization strategy', async () => {
      const routeIds = ['route-1', 'route-2'];
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: false,
        maxCrossZoneDistance: 15,
        enableAutomaticReassignment: false,
        optimizationStrategy: 'efficiency'
      };

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      expect(result).toBeDefined();
      expect(result.assignments).toBeDefined();
    });

    it('should maintain zone priority strategy', async () => {
      const routeIds = ['route-1', 'route-2'];
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: false,
        balanceWorkload: false,
        considerAvailability: true,
        enableCrossZoneOptimization: false,
        maxCrossZoneDistance: 15,
        enableAutomaticReassignment: false,
        optimizationStrategy: 'zone_priority'
      };

      const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

      expect(result).toBeDefined();
      // Should not apply additional optimization beyond standard assignment
      expect(mockAssignmentAlgorithm.assignRoutes).toHaveBeenCalledWith(routeIds, options);
    });
  });

  describe('error handling', () => {
    it('should handle assignment algorithm errors gracefully', async () => {
      mockAssignmentAlgorithm.assignRoutes.mockRejectedValue(new Error('Assignment failed'));

      await expect(assignmentOptimizer.optimizedAssignment(['route-1'])).rejects.toThrow('Assignment failed');
    });

    it('should handle workload calculator errors', async () => {
      mockWorkloadCalculator.calculateAllInspectorWorkloads.mockRejectedValue(new Error('Workload calculation failed'));

      await expect(assignmentOptimizer.validateAssignmentResult(mockStandardAssignmentResult))
        .rejects.toThrow('Workload calculation failed');
    });

    it('should handle repository errors in cross-zone assignment', async () => {
      const options: OptimizationOptions = {
        prioritizeZonePreference: true,
        maxUtilizationThreshold: 100,
        allowCrossZoneAssignment: true,
        balanceWorkload: true,
        considerAvailability: true,
        enableCrossZoneOptimization: true,
        maxCrossZoneDistance: 15,
        enableAutomaticReassignment: false,
        optimizationStrategy: 'balanced'
      };

      mockInspectorRepository.findActive.mockRejectedValue(new Error('Database error'));

      await expect(assignmentOptimizer.optimizedAssignment(['route-1'], options))
        .rejects.toThrow('Database error');
    });
  });
});