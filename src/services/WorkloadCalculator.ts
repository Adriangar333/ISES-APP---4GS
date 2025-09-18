import { InspectorRepository } from '../repositories/InspectorRepository';
import { RouteRepository } from '../repositories/RouteRepository';
import { Inspector, Route, WorkloadSummary } from '../types';

export interface WorkloadMetrics {
  inspectorId: string;
  inspectorName: string;
  currentRoutes: number;
  maxDailyRoutes: number;
  utilizationPercentage: number;
  availableCapacity: number;
  estimatedWorkHours: number;
  zoneDistribution: Array<{
    zoneId: string;
    zoneName: string;
    routeCount: number;
  }>;
}

export interface ZoneWorkloadSummary {
  zoneId: string;
  zoneName: string;
  totalRoutes: number;
  assignedRoutes: number;
  unassignedRoutes: number;
  inspectorCount: number;
  averageUtilization: number;
  capacity: {
    total: number;
    used: number;
    available: number;
  };
}

export interface SystemWorkloadOverview {
  totalInspectors: number;
  activeInspectors: number;
  totalRoutes: number;
  assignedRoutes: number;
  unassignedRoutes: number;
  systemUtilization: number;
  zoneBreakdown: ZoneWorkloadSummary[];
  inspectorMetrics: WorkloadMetrics[];
}

export class WorkloadCalculator {
  private inspectorRepository: InspectorRepository;
  private routeRepository: RouteRepository;

  constructor() {
    this.inspectorRepository = new InspectorRepository();
    this.routeRepository = new RouteRepository();
  }

  /**
   * Calculate workload metrics for a specific inspector
   */
  async calculateInspectorWorkload(inspectorId: string): Promise<WorkloadMetrics | null> {
    const inspector = await this.inspectorRepository.findById(inspectorId);
    if (!inspector) {
      return null;
    }

    const currentRoutes = await this.inspectorRepository.getCurrentWorkload(inspectorId);
    const assignedRoutes = await this.routeRepository.findByInspector(inspectorId);
    
    const utilizationPercentage = Math.round((currentRoutes / inspector.maxDailyRoutes) * 100);
    const availableCapacity = inspector.maxDailyRoutes - currentRoutes;
    
    // Calculate estimated work hours based on route durations
    const estimatedWorkHours = assignedRoutes.reduce((total, route) => {
      return total + (route.estimatedDuration || 0);
    }, 0) / 60; // Convert minutes to hours

    // Calculate zone distribution
    const zoneDistribution = await this.calculateZoneDistribution(assignedRoutes);

    return {
      inspectorId,
      inspectorName: inspector.name,
      currentRoutes,
      maxDailyRoutes: inspector.maxDailyRoutes,
      utilizationPercentage,
      availableCapacity,
      estimatedWorkHours,
      zoneDistribution
    };
  }

  /**
   * Calculate workload for all active inspectors
   */
  async calculateAllInspectorWorkloads(): Promise<WorkloadMetrics[]> {
    const inspectors = await this.inspectorRepository.findActive();
    const workloadMetrics: WorkloadMetrics[] = [];

    for (const inspector of inspectors) {
      const metrics = await this.calculateInspectorWorkload(inspector.id);
      if (metrics) {
        workloadMetrics.push(metrics);
      }
    }

    return workloadMetrics.sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
  }

  /**
   * Calculate workload summary for a specific zone
   */
  async calculateZoneWorkload(zoneId: string): Promise<ZoneWorkloadSummary | null> {
    const zone = await this.getZoneInfo(zoneId);
    if (!zone) {
      return null;
    }

    const zoneRoutes = await this.routeRepository.findByZone(zoneId);
    const zoneInspectors = await this.inspectorRepository.findByPreferredZone(zoneId);
    
    const totalRoutes = zoneRoutes.length;
    const assignedRoutes = zoneRoutes.filter(route => route.assignedInspectorId).length;
    const unassignedRoutes = totalRoutes - assignedRoutes;

    // Calculate capacity metrics
    const totalCapacity = zoneInspectors.reduce((sum, inspector) => sum + inspector.maxDailyRoutes, 0);
    const usedCapacity = await this.calculateUsedCapacityInZone(zoneId, zoneInspectors);
    const availableCapacity = totalCapacity - usedCapacity;

    // Calculate average utilization
    const inspectorUtilizations = await Promise.all(
      zoneInspectors.map(async (inspector) => {
        const workload = await this.inspectorRepository.getCurrentWorkload(inspector.id);
        return (workload / inspector.maxDailyRoutes) * 100;
      })
    );
    
    const averageUtilization = inspectorUtilizations.length > 0 
      ? inspectorUtilizations.reduce((sum, util) => sum + util, 0) / inspectorUtilizations.length 
      : 0;

    return {
      zoneId,
      zoneName: zone.name,
      totalRoutes,
      assignedRoutes,
      unassignedRoutes,
      inspectorCount: zoneInspectors.length,
      averageUtilization: Math.round(averageUtilization),
      capacity: {
        total: totalCapacity,
        used: usedCapacity,
        available: availableCapacity
      }
    };
  }

  /**
   * Get system-wide workload overview
   */
  async getSystemWorkloadOverview(): Promise<SystemWorkloadOverview> {
    const allInspectors = await this.inspectorRepository.findAll();
    const activeInspectors = allInspectors.filter(inspector => inspector.isActive);
    const allRoutes = await this.routeRepository.findAll();
    
    const assignedRoutes = allRoutes.filter(route => route.assignedInspectorId).length;
    const unassignedRoutes = allRoutes.length - assignedRoutes;

    // Calculate system utilization
    const totalCapacity = activeInspectors.reduce((sum, inspector) => sum + inspector.maxDailyRoutes, 0);
    const totalUsedCapacity = await this.calculateTotalUsedCapacity(activeInspectors);
    const systemUtilization = totalCapacity > 0 ? Math.round((totalUsedCapacity / totalCapacity) * 100) : 0;

    // Get zone breakdown
    const zoneBreakdown = await this.calculateAllZoneWorkloads();
    
    // Get inspector metrics
    const inspectorMetrics = await this.calculateAllInspectorWorkloads();

    return {
      totalInspectors: allInspectors.length,
      activeInspectors: activeInspectors.length,
      totalRoutes: allRoutes.length,
      assignedRoutes,
      unassignedRoutes,
      systemUtilization,
      zoneBreakdown,
      inspectorMetrics
    };
  }

  /**
   * Find inspectors with available capacity
   */
  async findInspectorsWithCapacity(minCapacity: number = 1, zoneId?: string): Promise<WorkloadMetrics[]> {
    let inspectors;
    
    if (zoneId) {
      inspectors = await this.inspectorRepository.findByPreferredZone(zoneId);
    } else {
      inspectors = await this.inspectorRepository.findActive();
    }

    const availableInspectors: WorkloadMetrics[] = [];

    for (const inspector of inspectors) {
      const metrics = await this.calculateInspectorWorkload(inspector.id);
      if (metrics && metrics.availableCapacity >= minCapacity) {
        availableInspectors.push(metrics);
      }
    }

    // Sort by available capacity (descending)
    return availableInspectors.sort((a, b) => b.availableCapacity - a.availableCapacity);
  }

  /**
   * Predict workload impact of assigning routes
   */
  async predictWorkloadImpact(assignments: Array<{ routeId: string; inspectorId: string }>): Promise<{
    beforeAssignment: WorkloadMetrics[];
    afterAssignment: WorkloadMetrics[];
    impactSummary: {
      inspectorId: string;
      currentUtilization: number;
      projectedUtilization: number;
      utilizationChange: number;
      willExceedCapacity: boolean;
    }[];
  }> {
    // Get current workload metrics
    const affectedInspectorIds = [...new Set(assignments.map(a => a.inspectorId))];
    const beforeAssignment = await Promise.all(
      affectedInspectorIds.map(id => this.calculateInspectorWorkload(id))
    );

    // Calculate projected workload
    const routesByInspector = new Map<string, string[]>();
    assignments.forEach(assignment => {
      if (!routesByInspector.has(assignment.inspectorId)) {
        routesByInspector.set(assignment.inspectorId, []);
      }
      routesByInspector.get(assignment.inspectorId)!.push(assignment.routeId);
    });

    const afterAssignment: WorkloadMetrics[] = [];
    const impactSummary = [];

    for (const inspectorId of affectedInspectorIds) {
      const currentMetrics = beforeAssignment.find(m => m?.inspectorId === inspectorId);
      if (!currentMetrics) continue;

      const additionalRoutes = routesByInspector.get(inspectorId) || [];
      const projectedRoutes = currentMetrics.currentRoutes + additionalRoutes.length;
      const projectedUtilization = Math.round((projectedRoutes / currentMetrics.maxDailyRoutes) * 100);

      const projectedMetrics: WorkloadMetrics = {
        ...currentMetrics,
        currentRoutes: projectedRoutes,
        utilizationPercentage: projectedUtilization,
        availableCapacity: currentMetrics.maxDailyRoutes - projectedRoutes
      };

      afterAssignment.push(projectedMetrics);

      impactSummary.push({
        inspectorId,
        currentUtilization: currentMetrics.utilizationPercentage,
        projectedUtilization,
        utilizationChange: projectedUtilization - currentMetrics.utilizationPercentage,
        willExceedCapacity: projectedRoutes > currentMetrics.maxDailyRoutes
      });
    }

    return {
      beforeAssignment: beforeAssignment.filter(m => m !== null) as WorkloadMetrics[],
      afterAssignment,
      impactSummary
    };
  }

  /**
   * Get workload balance recommendations
   */
  async getWorkloadBalanceRecommendations(): Promise<{
    overloadedInspectors: WorkloadMetrics[];
    underutilizedInspectors: WorkloadMetrics[];
    recommendations: Array<{
      type: 'redistribute' | 'hire' | 'optimize';
      priority: 'high' | 'medium' | 'low';
      description: string;
      affectedInspectors: string[];
    }>;
  }> {
    const allMetrics = await this.calculateAllInspectorWorkloads();
    
    const overloadedInspectors = allMetrics.filter(m => m.utilizationPercentage > 100);
    const underutilizedInspectors = allMetrics.filter(m => m.utilizationPercentage < 50);
    
    const recommendations = [];

    // High priority: Overloaded inspectors
    if (overloadedInspectors.length > 0) {
      recommendations.push({
        type: 'redistribute' as const,
        priority: 'high' as const,
        description: `${overloadedInspectors.length} inspector(es) están sobrecargados. Redistribuir rutas urgentemente.`,
        affectedInspectors: overloadedInspectors.map(i => i.inspectorId)
      });
    }

    // Medium priority: Unbalanced workload
    const utilizationVariance = this.calculateUtilizationVariance(allMetrics);
    if (utilizationVariance > 25) {
      recommendations.push({
        type: 'optimize' as const,
        priority: 'medium' as const,
        description: 'La carga de trabajo está desbalanceada entre interventores. Considerar redistribución.',
        affectedInspectors: allMetrics.map(i => i.inspectorId)
      });
    }

    // Low priority: Underutilized inspectors
    if (underutilizedInspectors.length > 0) {
      recommendations.push({
        type: 'optimize' as const,
        priority: 'low' as const,
        description: `${underutilizedInspectors.length} inspector(es) están subutilizados. Optimizar asignaciones.`,
        affectedInspectors: underutilizedInspectors.map(i => i.inspectorId)
      });
    }

    return {
      overloadedInspectors,
      underutilizedInspectors,
      recommendations
    };
  }

  /**
   * Helper method to calculate zone distribution for routes
   */
  private async calculateZoneDistribution(routes: Route[]): Promise<Array<{
    zoneId: string;
    zoneName: string;
    routeCount: number;
  }>> {
    const zoneMap = new Map<string, number>();
    
    routes.forEach(route => {
      if (route.zoneId) {
        zoneMap.set(route.zoneId, (zoneMap.get(route.zoneId) || 0) + 1);
      }
    });

    const distribution = [];
    for (const [zoneId, routeCount] of zoneMap.entries()) {
      const zone = await this.getZoneInfo(zoneId);
      distribution.push({
        zoneId,
        zoneName: zone?.name || 'Zona Desconocida',
        routeCount
      });
    }

    return distribution.sort((a, b) => b.routeCount - a.routeCount);
  }

  /**
   * Helper method to calculate used capacity in a zone
   */
  private async calculateUsedCapacityInZone(zoneId: string, inspectors: Inspector[]): Promise<number> {
    let usedCapacity = 0;
    
    for (const inspector of inspectors) {
      const workload = await this.inspectorRepository.getCurrentWorkload(inspector.id);
      usedCapacity += workload;
    }
    
    return usedCapacity;
  }

  /**
   * Helper method to calculate total used capacity across all inspectors
   */
  private async calculateTotalUsedCapacity(inspectors: Inspector[]): Promise<number> {
    let totalUsed = 0;
    
    for (const inspector of inspectors) {
      const workload = await this.inspectorRepository.getCurrentWorkload(inspector.id);
      totalUsed += workload;
    }
    
    return totalUsed;
  }

  /**
   * Helper method to calculate workload for all zones
   */
  private async calculateAllZoneWorkloads(): Promise<ZoneWorkloadSummary[]> {
    // This would need to be implemented based on your zone data structure
    // For now, returning empty array as placeholder
    const zones = await this.getAllZones();
    const zoneWorkloads: ZoneWorkloadSummary[] = [];

    for (const zone of zones) {
      const workload = await this.calculateZoneWorkload(zone.id);
      if (workload) {
        zoneWorkloads.push(workload);
      }
    }

    return zoneWorkloads;
  }

  /**
   * Helper method to calculate utilization variance
   */
  private calculateUtilizationVariance(metrics: WorkloadMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const utilizations = metrics.map(m => m.utilizationPercentage);
    const mean = utilizations.reduce((sum, util) => sum + util, 0) / utilizations.length;
    const variance = utilizations.reduce((sum, util) => sum + Math.pow(util - mean, 2), 0) / utilizations.length;
    
    return Math.sqrt(variance); // Standard deviation
  }

  /**
   * Placeholder method to get zone info - should be implemented based on your zone repository
   */
  private async getZoneInfo(zoneId: string): Promise<{ id: string; name: string } | null> {
    // This should be replaced with actual zone repository call
    // For now, returning a placeholder
    return { id: zoneId, name: `Zona ${zoneId}` };
  }

  /**
   * Placeholder method to get all zones - should be implemented based on your zone repository
   */
  private async getAllZones(): Promise<Array<{ id: string; name: string }>> {
    // This should be replaced with actual zone repository call
    // For now, returning empty array
    return [];
  }
}