import { AssignmentAlgorithm } from './AssignmentAlgorithm';
import type { AssignmentOptions, AssignmentConflict } from './AssignmentAlgorithm';
import { InspectorRepository } from '../repositories/InspectorRepository';
import { RouteRepository } from '../repositories/RouteRepository';
import { WorkloadCalculator, WorkloadMetrics } from './WorkloadCalculator';
import { GeospatialService } from './GeospatialService';
import { 
  Route, 
  Inspector, 
  AssignmentResult, 
  RouteAssignment 
} from '../types';

export interface OptimizationOptions {
  prioritizeZonePreference: boolean;
  maxUtilizationThreshold: number;
  allowCrossZoneAssignment: boolean;
  balanceWorkload: boolean;
  considerAvailability: boolean;
  enableCrossZoneOptimization: boolean;
  maxCrossZoneDistance: number; // in kilometers
  enableAutomaticReassignment: boolean;
  optimizationStrategy: 'balanced' | 'zone_priority' | 'efficiency';
}

export interface ReassignmentSuggestion {
  routeId: string;
  fromInspectorId: string;
  toInspectorId: string;
  reason: string;
  expectedImprovement: {
    workloadBalance: number;
    zoneOptimization: number;
    totalScore: number;
  };
  crossZone: boolean;
  distance?: number;
}

export interface AssignmentValidationResult {
  isValid: boolean;
  conflicts: AssignmentConflict[];
  suggestions: ReassignmentSuggestion[];
  metrics: {
    totalAssignments: number;
    crossZoneAssignments: number;
    utilizationVariance: number;
    averageUtilization: number;
  };
}

export class AssignmentOptimizer {
  private assignmentAlgorithm: AssignmentAlgorithm;
  private inspectorRepository: InspectorRepository;
  private routeRepository: RouteRepository;
  private workloadCalculator: WorkloadCalculator;
  private geospatialService: GeospatialService;

  constructor() {
    this.assignmentAlgorithm = new AssignmentAlgorithm();
    this.inspectorRepository = new InspectorRepository();
    this.routeRepository = new RouteRepository();
    this.workloadCalculator = new WorkloadCalculator();
    this.geospatialService = new GeospatialService();
  }

  /**
   * Enhanced assignment with optimization and fallback logic
   */
  async optimizedAssignment(
    routeIds: string[], 
    options: OptimizationOptions = this.getDefaultOptimizationOptions()
  ): Promise<AssignmentResult> {
    // First attempt: Standard assignment
    let result = await this.assignmentAlgorithm.assignRoutes(routeIds, options);

    // If there are unassigned routes and cross-zone optimization is enabled
    if (result.unassignedRoutes.length > 0 && options.enableCrossZoneOptimization) {
      const crossZoneResult = await this.handleCrossZoneAssignment(
        result.unassignedRoutes, 
        options
      );
      
      // Merge results
      result.assignments.push(...crossZoneResult.assignments);
      result.unassignedRoutes = crossZoneResult.unassignedRoutes;
      result.summary.assignedRoutes = result.assignments.length;
      result.summary.unassignedRoutes = result.unassignedRoutes.length;
    }

    // Apply optimization strategy
    if (options.optimizationStrategy !== 'zone_priority') {
      result = await this.applyOptimizationStrategy(result, options);
    }

    // Generate updated workload distribution
    result.workloadDistribution = await this.generateOptimizedWorkloadDistribution(result.assignments);

    return result;
  }

  /**
   * Handle cross-zone assignment for unassigned routes
   */
  private async handleCrossZoneAssignment(
    unassignedRoutes: Route[], 
    options: OptimizationOptions
  ): Promise<AssignmentResult> {
    const assignments: RouteAssignment[] = [];
    const stillUnassigned: Route[] = [];
    const inspectors = await this.inspectorRepository.findActive();
    const workloadMetrics = await this.workloadCalculator.calculateAllInspectorWorkloads();

    for (const route of unassignedRoutes) {
      const crossZoneAssignment = await this.findCrossZoneAssignment(
        route, 
        inspectors, 
        workloadMetrics, 
        options
      );

      if (crossZoneAssignment) {
        assignments.push(crossZoneAssignment);
        // Update workload metrics for next iteration
        this.updateWorkloadMetrics(workloadMetrics, crossZoneAssignment.inspectorId, route);
      } else {
        stillUnassigned.push(route);
      }
    }

    return {
      assignments,
      unassignedRoutes: stillUnassigned,
      workloadDistribution: [],
      summary: {
        totalRoutes: unassignedRoutes.length,
        assignedRoutes: assignments.length,
        unassignedRoutes: stillUnassigned.length
      }
    };
  }

  /**
   * Find suitable cross-zone assignment for a route
   */
  private async findCrossZoneAssignment(
    route: Route,
    inspectors: Inspector[],
    workloadMetrics: WorkloadMetrics[],
    options: OptimizationOptions
  ): Promise<RouteAssignment | null> {
    if (!route.zoneId) return null;

    // Find inspectors from adjacent zones or with available capacity
    const candidates = await this.findCrossZoneCandidates(route, inspectors, workloadMetrics, options);
    
    if (candidates.length === 0) return null;

    // Sort by suitability score
    candidates.sort((a, b) => b.score - a.score);

    // Try to assign to the best candidate
    const bestCandidate = candidates[0];
    if (!bestCandidate) return null;
    
    const inspector = inspectors.find(i => i.id === bestCandidate.inspectorId);
    
    if (!inspector) return null;

    // Verify assignment is still valid
    const conflicts = await this.detectCrossZoneConflicts(route, inspector, workloadMetrics, options);
    
    if (conflicts.length === 0 || this.canResolveCrossZoneConflicts(conflicts, options)) {
      return {
        routeId: route.id,
        inspectorId: inspector.id,
        assignedAt: new Date(),
        estimatedStartTime: new Date(),
        estimatedEndTime: new Date(Date.now() + (route.estimatedDuration || 60) * 60 * 1000)
      };
    }

    return null;
  }

  /**
   * Find candidates for cross-zone assignment
   */
  private async findCrossZoneCandidates(
    route: Route,
    inspectors: Inspector[],
    workloadMetrics: WorkloadMetrics[],
    options: OptimizationOptions
  ): Promise<Array<{ inspectorId: string; score: number; distance?: number }>> {
    const candidates = [];

    for (const inspector of inspectors) {
      const metrics = workloadMetrics.find(m => m.inspectorId === inspector.id);
      if (!metrics || metrics.availableCapacity <= 0) continue;

      // Skip if inspector is over utilization threshold
      if (metrics.utilizationPercentage > options.maxUtilizationThreshold) continue;

      // Calculate distance if route has coordinates
      let distance = 0;
      if (route.zoneId && options.maxCrossZoneDistance > 0) {
        distance = await this.calculateZoneDistance(route.zoneId, inspector.preferredZones);
        if (distance > options.maxCrossZoneDistance) continue;
      }

      // Calculate suitability score
      const score = this.calculateCrossZoneScore(route, inspector, metrics, distance, options);
      
      candidates.push({
        inspectorId: inspector.id,
        score,
        distance
      });
    }

    return candidates;
  }

  /**
   * Calculate cross-zone assignment score
   */
  private calculateCrossZoneScore(
    route: Route,
    inspector: Inspector,
    metrics: WorkloadMetrics,
    distance: number,
    options: OptimizationOptions
  ): number {
    let score = 0;

    // Capacity score (higher available capacity = higher score)
    const capacityScore = (metrics.availableCapacity / inspector.maxDailyRoutes) * 100;
    score += capacityScore * 0.4;

    // Workload balance score (lower utilization = higher score)
    const balanceScore = Math.max(0, 100 - metrics.utilizationPercentage);
    score += balanceScore * 0.3;

    // Distance penalty (closer = higher score)
    const distanceScore = options.maxCrossZoneDistance > 0 
      ? Math.max(0, 100 - (distance / options.maxCrossZoneDistance) * 100)
      : 50;
    score += distanceScore * 0.2;

    // Priority bonus
    const priorityScore = route.priority === 'high' ? 100 : 
                         route.priority === 'medium' ? 70 : 40;
    score += priorityScore * 0.1;

    return Math.round(score);
  }

  /**
   * Calculate distance between zones (simplified implementation)
   */
  private async calculateZoneDistance(routeZoneId: string, inspectorZones: string[]): Promise<number> {
    // This is a simplified implementation
    // In a real system, you would calculate actual geographic distance between zone centroids
    
    if (inspectorZones.includes(routeZoneId)) {
      return 0; // Same zone
    }

    // For now, return a fixed distance for cross-zone assignments
    // This should be replaced with actual geospatial calculations
    return 10; // 10km as default cross-zone distance
  }

  /**
   * Detect conflicts for cross-zone assignments
   */
  private async detectCrossZoneConflicts(
    route: Route,
    inspector: Inspector,
    workloadMetrics: WorkloadMetrics[],
    options: OptimizationOptions
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
        description: `Inspector has no available capacity`,
        severity: 'high'
      });
    }

    // Check utilization threshold
    const projectedUtilization = ((metrics.currentRoutes + 1) / metrics.maxDailyRoutes) * 100;
    if (projectedUtilization > options.maxUtilizationThreshold) {
      conflicts.push({
        routeId: route.id,
        inspectorId: inspector.id,
        conflictType: 'capacity_exceeded',
        description: `Cross-zone assignment would exceed utilization threshold`,
        severity: 'medium'
      });
    }

    return conflicts;
  }

  /**
   * Check if cross-zone conflicts can be resolved
   */
  private canResolveCrossZoneConflicts(conflicts: AssignmentConflict[], options: OptimizationOptions): boolean {
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
    return highSeverityConflicts.length === 0 && options.enableCrossZoneOptimization;
  }

  /**
   * Apply optimization strategy to assignment results
   */
  private async applyOptimizationStrategy(
    result: AssignmentResult, 
    options: OptimizationOptions
  ): Promise<AssignmentResult> {
    switch (options.optimizationStrategy) {
      case 'balanced':
        return await this.applyBalancedOptimization(result, options);
      case 'efficiency':
        return await this.applyEfficiencyOptimization(result, options);
      default:
        return result;
    }
  }

  /**
   * Apply balanced workload optimization
   */
  private async applyBalancedOptimization(
    result: AssignmentResult, 
    options: OptimizationOptions
  ): Promise<AssignmentResult> {
    if (!options.enableAutomaticReassignment) return result;

    const workloadMetrics = await this.workloadCalculator.calculateAllInspectorWorkloads();
    const reassignments = await this.generateBalancingReassignments(result.assignments, workloadMetrics);

    // Apply reassignments
    for (const reassignment of reassignments) {
      const assignmentIndex = result.assignments.findIndex(a => a.routeId === reassignment.routeId);
      if (assignmentIndex >= 0 && result.assignments[assignmentIndex]) {
        result.assignments[assignmentIndex]!.inspectorId = reassignment.toInspectorId;
        result.assignments[assignmentIndex]!.assignedAt = new Date();
      }
    }

    return result;
  }

  /**
   * Apply efficiency optimization
   */
  private async applyEfficiencyOptimization(
    result: AssignmentResult, 
    options: OptimizationOptions
  ): Promise<AssignmentResult> {
    // This would implement route optimization based on geographic efficiency
    // For now, return the result as-is
    return result;
  }

  /**
   * Generate reassignments for workload balancing
   */
  private async generateBalancingReassignments(
    assignments: RouteAssignment[], 
    workloadMetrics: WorkloadMetrics[]
  ): Promise<ReassignmentSuggestion[]> {
    const reassignments: ReassignmentSuggestion[] = [];
    
    // Find overloaded and underutilized inspectors
    const overloaded = workloadMetrics.filter(m => m.utilizationPercentage > 100);
    const underutilized = workloadMetrics.filter(m => m.utilizationPercentage < 50 && m.availableCapacity > 0);

    if (overloaded.length === 0 || underutilized.length === 0) {
      return reassignments;
    }

    // For each overloaded inspector, try to move routes to underutilized ones
    for (const overloadedInspector of overloaded) {
      const inspectorAssignments = assignments.filter(a => a.inspectorId === overloadedInspector.inspectorId);
      
      // Sort assignments by route priority (move low priority routes first)
      const sortedAssignments = await this.sortAssignmentsByMovability(inspectorAssignments);

      for (const assignment of sortedAssignments) {
        const bestTarget = this.findBestReassignmentTarget(underutilized, overloadedInspector);
        
        if (bestTarget) {
          reassignments.push({
            routeId: assignment.routeId,
            fromInspectorId: overloadedInspector.inspectorId,
            toInspectorId: bestTarget.inspectorId,
            reason: 'Workload balancing - reducing overload',
            expectedImprovement: {
              workloadBalance: 20,
              zoneOptimization: 0,
              totalScore: 20
            },
            crossZone: false
          });

          // Update metrics for next iteration
          overloadedInspector.currentRoutes -= 1;
          overloadedInspector.utilizationPercentage = Math.round(
            (overloadedInspector.currentRoutes / overloadedInspector.maxDailyRoutes) * 100
          );
          
          bestTarget.currentRoutes += 1;
          bestTarget.utilizationPercentage = Math.round(
            (bestTarget.currentRoutes / bestTarget.maxDailyRoutes) * 100
          );

          // Stop if inspector is no longer overloaded
          if (overloadedInspector.utilizationPercentage <= 100) break;
        }
      }
    }

    return reassignments;
  }

  /**
   * Sort assignments by how easily they can be moved
   */
  private async sortAssignmentsByMovability(assignments: RouteAssignment[]): Promise<RouteAssignment[]> {
    const assignmentsWithRoutes = await Promise.all(
      assignments.map(async (assignment) => {
        const route = await this.routeRepository.findById(assignment.routeId);
        return { assignment, route };
      })
    );

    // Sort by priority (low priority routes are more movable)
    return assignmentsWithRoutes
      .filter(item => item.route !== null)
      .sort((a, b) => {
        const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3 };
        return priorityOrder[a.route!.priority] - priorityOrder[b.route!.priority];
      })
      .map(item => item.assignment);
  }

  /**
   * Find best target for reassignment
   */
  private findBestReassignmentTarget(
    underutilized: WorkloadMetrics[], 
    overloadedInspector: WorkloadMetrics
  ): WorkloadMetrics | null {
    if (underutilized.length === 0) return null;

    // Sort by available capacity (highest first)
    const sorted = [...underutilized].sort((a, b) => b.availableCapacity - a.availableCapacity);
    return sorted[0] || null;
  }

  /**
   * Validate assignment results and provide suggestions
   */
  async validateAssignmentResult(result: AssignmentResult): Promise<AssignmentValidationResult> {
    const conflicts: AssignmentConflict[] = [];
    const suggestions: ReassignmentSuggestion[] = [];
    
    // Get current workload metrics
    const workloadMetrics = await this.workloadCalculator.calculateAllInspectorWorkloads();
    
    // Check for capacity violations
    for (const metrics of workloadMetrics) {
      if (metrics.utilizationPercentage > 100) {
        conflicts.push({
          routeId: '',
          inspectorId: metrics.inspectorId,
          conflictType: 'capacity_exceeded',
          description: `Inspector ${metrics.inspectorName} is overloaded (${metrics.utilizationPercentage}%)`,
          severity: 'high'
        });
      }
    }

    // Calculate metrics
    const crossZoneAssignments = await this.countCrossZoneAssignments(result.assignments);
    const utilizationVariance = this.calculateUtilizationVariance(workloadMetrics);
    const averageUtilization = workloadMetrics.reduce((sum, m) => sum + m.utilizationPercentage, 0) / workloadMetrics.length;

    // Generate suggestions for improvement
    if (utilizationVariance > 25) {
      const balancingSuggestions = await this.generateBalancingReassignments(result.assignments, workloadMetrics);
      suggestions.push(...balancingSuggestions);
    }

    return {
      isValid: conflicts.filter(c => c.severity === 'high').length === 0,
      conflicts,
      suggestions,
      metrics: {
        totalAssignments: result.assignments.length,
        crossZoneAssignments,
        utilizationVariance: Math.round(utilizationVariance),
        averageUtilization: Math.round(averageUtilization)
      }
    };
  }

  /**
   * Count cross-zone assignments
   */
  private async countCrossZoneAssignments(assignments: RouteAssignment[]): Promise<number> {
    let crossZoneCount = 0;

    for (const assignment of assignments) {
      const route = await this.routeRepository.findById(assignment.routeId);
      const inspector = await this.inspectorRepository.findById(assignment.inspectorId);
      
      if (route && inspector && route.zoneId && !inspector.preferredZones.includes(route.zoneId)) {
        crossZoneCount++;
      }
    }

    return crossZoneCount;
  }

  /**
   * Calculate utilization variance
   */
  private calculateUtilizationVariance(metrics: WorkloadMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const utilizations = metrics.map(m => m.utilizationPercentage);
    const mean = utilizations.reduce((sum, util) => sum + util, 0) / utilizations.length;
    const variance = utilizations.reduce((sum, util) => sum + Math.pow(util - mean, 2), 0) / utilizations.length;
    
    return Math.sqrt(variance);
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
   * Generate optimized workload distribution
   */
  private async generateOptimizedWorkloadDistribution(assignments: RouteAssignment[]): Promise<any[]> {
    // This would generate an optimized workload distribution
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get default optimization options
   */
  private getDefaultOptimizationOptions(): OptimizationOptions {
    return {
      prioritizeZonePreference: true,
      maxUtilizationThreshold: 100,
      allowCrossZoneAssignment: true,
      balanceWorkload: true,
      considerAvailability: true,
      enableCrossZoneOptimization: true,
      maxCrossZoneDistance: 15, // 15km
      enableAutomaticReassignment: true,
      optimizationStrategy: 'balanced'
    };
  }
}