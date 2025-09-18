import { InspectorRepository } from '../repositories/InspectorRepository';
import { RouteRepository } from '../repositories/RouteRepository';
import { WorkloadCalculator, WorkloadMetrics } from './WorkloadCalculator';
import { AvailabilityManager } from './AvailabilityManager';
import { 
  Route, 
  Inspector, 
  AssignmentResult, 
  RouteAssignment, 
  WorkloadSummary 
} from '../types';

export interface AssignmentOptions {
  prioritizeZonePreference: boolean;
  maxUtilizationThreshold: number; // Percentage (e.g., 100 = 100%)
  allowCrossZoneAssignment: boolean;
  balanceWorkload: boolean;
  considerAvailability: boolean;
}

export interface AssignmentConflict {
  routeId: string;
  inspectorId: string;
  conflictType: 'capacity_exceeded' | 'zone_mismatch' | 'availability_conflict' | 'priority_conflict';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AssignmentScore {
  inspectorId: string;
  routeId: string;
  score: number;
  factors: {
    zoneMatch: number;
    workloadBalance: number;
    availability: number;
    priority: number;
  };
}

export class AssignmentAlgorithm {
  private inspectorRepository: InspectorRepository;
  private routeRepository: RouteRepository;
  private workloadCalculator: WorkloadCalculator;
  private availabilityManager: AvailabilityManager;

  constructor() {
    this.inspectorRepository = new InspectorRepository();
    this.routeRepository = new RouteRepository();
    this.workloadCalculator = new WorkloadCalculator();
    this.availabilityManager = new AvailabilityManager();
  }

  /**
   * Main assignment method - assigns routes to inspectors based on options
   */
  async assignRoutes(routeIds: string[], options: AssignmentOptions = this.getDefaultOptions()): Promise<AssignmentResult> {
    // Get routes and inspectors
    const routes = await this.getRoutesForAssignment(routeIds);
    const inspectors = await this.inspectorRepository.findActive();
    
    if (routes.length === 0) {
      return this.createEmptyResult();
    }

    // Sort routes by priority (high -> medium -> low)
    const sortedRoutes = this.sortRoutesByPriority(routes);
    
    // Get current workload metrics for all inspectors
    const workloadMetrics = await this.workloadCalculator.calculateAllInspectorWorkloads();
    
    const assignments: RouteAssignment[] = [];
    const unassignedRoutes: Route[] = [];
    const conflicts: AssignmentConflict[] = [];

    // Process each route for assignment
    for (const route of sortedRoutes) {
      const assignment = await this.assignSingleRoute(route, inspectors, workloadMetrics, options);
      
      if (assignment.success && assignment.assignment) {
        assignments.push(assignment.assignment);
        // Update workload metrics for the assigned inspector
        this.updateWorkloadMetrics(workloadMetrics, assignment.assignment.inspectorId, route);
      } else {
        unassignedRoutes.push(route);
        if (assignment.conflicts) {
          conflicts.push(...assignment.conflicts);
        }
      }
    }

    // Generate workload distribution summary
    const workloadDistribution = await this.generateWorkloadDistribution(assignments);

    return {
      assignments,
      unassignedRoutes,
      workloadDistribution,
      summary: {
        totalRoutes: routes.length,
        assignedRoutes: assignments.length,
        unassignedRoutes: unassignedRoutes.length
      }
    };
  }

  /**
   * Assign a single route to the best available inspector
   */
  private async assignSingleRoute(
    route: Route, 
    inspectors: Inspector[], 
    workloadMetrics: WorkloadMetrics[], 
    options: AssignmentOptions
  ): Promise<{
    success: boolean;
    assignment?: RouteAssignment;
    conflicts?: AssignmentConflict[];
  }> {
    // Calculate assignment scores for all inspectors
    const scores = await this.calculateAssignmentScores(route, inspectors, workloadMetrics, options);
    
    if (scores.length === 0) {
      return {
        success: false,
        conflicts: [{
          routeId: route.id,
          inspectorId: '',
          conflictType: 'capacity_exceeded',
          description: 'No available inspectors found',
          severity: 'high'
        }]
      };
    }

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);
    
    // Try to assign to the best scoring inspector
    for (const score of scores) {
      const inspector = inspectors.find(i => i.id === score.inspectorId);
      if (!inspector) continue;

      const conflicts = await this.detectConflicts(route, inspector, workloadMetrics, options);
      
      if (conflicts.length === 0 || this.canResolveConflicts(conflicts, options)) {
        // Create assignment
        const assignment: RouteAssignment = {
          routeId: route.id,
          inspectorId: inspector.id,
          assignedAt: new Date(),
          estimatedStartTime: new Date(), // This would be calculated based on schedule
          estimatedEndTime: new Date(Date.now() + (route.estimatedDuration || 60) * 60 * 1000)
        };

        return { success: true, assignment };
      }
    }

    return {
      success: false,
      conflicts: [{
        routeId: route.id,
        inspectorId: scores.length > 0 ? scores[0]!.inspectorId : '',
        conflictType: 'capacity_exceeded',
        description: 'Unable to resolve assignment conflicts',
        severity: 'medium'
      }]
    };
  }

  /**
   * Calculate assignment scores for all inspectors for a given route
   */
  private async calculateAssignmentScores(
    route: Route, 
    inspectors: Inspector[], 
    workloadMetrics: WorkloadMetrics[], 
    options: AssignmentOptions
  ): Promise<AssignmentScore[]> {
    const scores: AssignmentScore[] = [];

    for (const inspector of inspectors) {
      const metrics = workloadMetrics.find(m => m.inspectorId === inspector.id);
      if (!metrics) continue;

      // Skip if inspector is over capacity threshold
      if (metrics.utilizationPercentage > options.maxUtilizationThreshold) {
        continue;
      }

      const score = await this.calculateInspectorScore(route, inspector, metrics, options);
      scores.push(score);
    }

    return scores;
  }

  /**
   * Calculate assignment score for a specific inspector-route pair
   */
  private async calculateInspectorScore(
    route: Route, 
    inspector: Inspector, 
    metrics: WorkloadMetrics, 
    options: AssignmentOptions
  ): Promise<AssignmentScore> {
    let zoneMatch = 0;
    let workloadBalance = 0;
    let availability = 0;
    let priority = 0;

    // Zone preference scoring
    if (options.prioritizeZonePreference && route.zoneId) {
      zoneMatch = inspector.preferredZones.includes(route.zoneId) ? 100 : 
                  (options.allowCrossZoneAssignment ? 30 : 0);
    } else {
      zoneMatch = 50; // Neutral if not considering zone preference
    }

    // Workload balance scoring (lower utilization = higher score)
    if (options.balanceWorkload) {
      workloadBalance = Math.max(0, 100 - metrics.utilizationPercentage);
    } else {
      workloadBalance = 50; // Neutral if not balancing workload
    }

    // Availability scoring (simplified - would need actual schedule checking)
    if (options.considerAvailability) {
      // For now, assume all active inspectors are available
      // In a real implementation, this would check actual schedule conflicts
      availability = 80;
    } else {
      availability = 50; // Neutral if not considering availability
    }

    // Priority scoring (higher priority routes get preference for better inspectors)
    const priorityWeight = route.priority === 'high' ? 100 : 
                          route.priority === 'medium' ? 70 : 40;
    priority = priorityWeight;

    // Calculate weighted score
    const weights = {
      zoneMatch: 0.4,
      workloadBalance: 0.3,
      availability: 0.2,
      priority: 0.1
    };

    const totalScore = 
      (zoneMatch * weights.zoneMatch) +
      (workloadBalance * weights.workloadBalance) +
      (availability * weights.availability) +
      (priority * weights.priority);

    return {
      inspectorId: inspector.id,
      routeId: route.id,
      score: Math.round(totalScore),
      factors: {
        zoneMatch,
        workloadBalance,
        availability,
        priority
      }
    };
  }

  /**
   * Detect conflicts for a potential assignment
   */
  private async detectConflicts(
    route: Route, 
    inspector: Inspector, 
    workloadMetrics: WorkloadMetrics[], 
    options: AssignmentOptions
  ): Promise<AssignmentConflict[]> {
    const conflicts: AssignmentConflict[] = [];
    const metrics = workloadMetrics.find(m => m.inspectorId === inspector.id);

    if (!metrics) {
      conflicts.push({
        routeId: route.id,
        inspectorId: inspector.id,
        conflictType: 'capacity_exceeded',
        description: 'Inspector metrics not available',
        severity: 'high'
      });
      return conflicts;
    }

    // Check capacity
    if (metrics.availableCapacity <= 0) {
      conflicts.push({
        routeId: route.id,
        inspectorId: inspector.id,
        conflictType: 'capacity_exceeded',
        description: `Inspector has no available capacity (${metrics.currentRoutes}/${metrics.maxDailyRoutes})`,
        severity: 'high'
      });
    }

    // Check zone preference
    if (options.prioritizeZonePreference && route.zoneId && 
        !inspector.preferredZones.includes(route.zoneId) && 
        !options.allowCrossZoneAssignment) {
      conflicts.push({
        routeId: route.id,
        inspectorId: inspector.id,
        conflictType: 'zone_mismatch',
        description: `Route zone ${route.zoneId} not in inspector's preferred zones`,
        severity: 'medium'
      });
    }

    // Check utilization threshold
    const projectedUtilization = ((metrics.currentRoutes + 1) / metrics.maxDailyRoutes) * 100;
    if (projectedUtilization > options.maxUtilizationThreshold) {
      conflicts.push({
        routeId: route.id,
        inspectorId: inspector.id,
        conflictType: 'capacity_exceeded',
        description: `Assignment would exceed utilization threshold (${Math.round(projectedUtilization)}% > ${options.maxUtilizationThreshold}%)`,
        severity: 'medium'
      });
    }

    return conflicts;
  }

  /**
   * Check if conflicts can be resolved based on options
   */
  private canResolveConflicts(conflicts: AssignmentConflict[], options: AssignmentOptions): boolean {
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
    
    // Cannot resolve high severity conflicts
    if (highSeverityConflicts.length > 0) {
      return false;
    }

    // Can resolve zone mismatches if cross-zone assignment is allowed
    const zoneMismatches = conflicts.filter(c => c.conflictType === 'zone_mismatch');
    if (zoneMismatches.length > 0 && !options.allowCrossZoneAssignment) {
      return false;
    }

    return true;
  }

  /**
   * Sort routes by priority (high -> medium -> low)
   */
  private sortRoutesByPriority(routes: Route[]): Route[] {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    return [...routes].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  /**
   * Update workload metrics after assignment
   */
  private updateWorkloadMetrics(metrics: WorkloadMetrics[], inspectorId: string, route: Route): void {
    const inspectorMetrics = metrics.find(m => m.inspectorId === inspectorId);
    if (inspectorMetrics) {
      inspectorMetrics.currentRoutes += 1;
      inspectorMetrics.availableCapacity -= 1;
      inspectorMetrics.utilizationPercentage = Math.round(
        (inspectorMetrics.currentRoutes / inspectorMetrics.maxDailyRoutes) * 100
      );
      inspectorMetrics.estimatedWorkHours += (route.estimatedDuration || 60) / 60;
    }
  }

  /**
   * Generate workload distribution summary
   */
  private async generateWorkloadDistribution(assignments: RouteAssignment[]): Promise<WorkloadSummary[]> {
    const distribution = new Map<string, WorkloadSummary>();

    for (const assignment of assignments) {
      const inspector = await this.inspectorRepository.findById(assignment.inspectorId);
      const route = await this.routeRepository.findById(assignment.routeId);
      
      if (!inspector || !route) continue;

      const key = `${assignment.inspectorId}-${route.zoneId || 'unknown'}`;
      
      if (!distribution.has(key)) {
        distribution.set(key, {
          inspectorId: assignment.inspectorId,
          inspectorName: inspector.name,
          zoneId: route.zoneId || 'unknown',
          zoneName: route.zoneId || 'Zona Desconocida',
          assignedRoutes: 0,
          totalEstimatedTime: 0,
          utilizationPercentage: 0
        });
      }

      const summary = distribution.get(key)!;
      summary.assignedRoutes += 1;
      summary.totalEstimatedTime += route.estimatedDuration || 60;
      summary.utilizationPercentage = Math.round(
        (summary.assignedRoutes / inspector.maxDailyRoutes) * 100
      );
    }

    return Array.from(distribution.values()).sort((a, b) => 
      a.inspectorName.localeCompare(b.inspectorName)
    );
  }

  /**
   * Get routes for assignment
   */
  private async getRoutesForAssignment(routeIds: string[]): Promise<Route[]> {
    const routes: Route[] = [];
    
    for (const routeId of routeIds) {
      const route = await this.routeRepository.findById(routeId);
      if (route && route.status === 'pending') {
        routes.push(route);
      }
    }
    
    return routes;
  }

  /**
   * Get default assignment options
   */
  private getDefaultOptions(): AssignmentOptions {
    return {
      prioritizeZonePreference: true,
      maxUtilizationThreshold: 100,
      allowCrossZoneAssignment: true,
      balanceWorkload: true,
      considerAvailability: true
    };
  }

  /**
   * Create empty assignment result
   */
  private createEmptyResult(): AssignmentResult {
    return {
      assignments: [],
      unassignedRoutes: [],
      workloadDistribution: [],
      summary: {
        totalRoutes: 0,
        assignedRoutes: 0,
        unassignedRoutes: 0
      }
    };
  }

  /**
   * Batch assign all pending routes
   */
  async assignAllPendingRoutes(options?: AssignmentOptions): Promise<AssignmentResult> {
    const pendingRoutes = await this.routeRepository.findByStatus('pending');
    const routeIds = pendingRoutes.map(route => route.id);
    
    return this.assignRoutes(routeIds, options);
  }

  /**
   * Reassign routes from one inspector to others
   */
  async reassignInspectorRoutes(fromInspectorId: string, options?: AssignmentOptions): Promise<AssignmentResult> {
    const inspectorRoutes = await this.routeRepository.findByInspector(fromInspectorId);
    const activeRoutes = inspectorRoutes.filter(route => 
      route.status === 'assigned' || route.status === 'in_progress'
    );

    // Unassign routes first
    for (const route of activeRoutes) {
      await this.routeRepository.unassignFromInspector(route.id);
    }

    // Reassign them
    const routeIds = activeRoutes.map(route => route.id);
    return this.assignRoutes(routeIds, options);
  }

  /**
   * Get assignment recommendations for optimization
   */
  async getAssignmentRecommendations(): Promise<{
    overloadedInspectors: string[];
    underutilizedInspectors: string[];
    suggestedReassignments: Array<{
      routeId: string;
      fromInspectorId: string;
      toInspectorId: string;
      reason: string;
      expectedImprovement: number;
    }>;
  }> {
    const workloadMetrics = await this.workloadCalculator.calculateAllInspectorWorkloads();
    
    const overloadedInspectors = workloadMetrics
      .filter(m => m.utilizationPercentage > 100)
      .map(m => m.inspectorId);
    
    const underutilizedInspectors = workloadMetrics
      .filter(m => m.utilizationPercentage < 50 && m.availableCapacity > 0)
      .map(m => m.inspectorId);

    // For now, return basic structure - full implementation would analyze specific reassignments
    return {
      overloadedInspectors,
      underutilizedInspectors,
      suggestedReassignments: []
    };
  }
}