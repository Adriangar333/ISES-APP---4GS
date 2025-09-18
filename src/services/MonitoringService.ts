import { Route, Inspector, Zone, RoutePoint } from '../types';
import { RouteRepository } from '../repositories/RouteRepository';
import { InspectorRepository } from '../repositories/InspectorRepository';
import { ZoneRepository } from '../repositories/ZoneRepository';
import { RoutePointRepository } from '../repositories/RoutePointRepository';
import { getWebSocketService, Alert, InspectorLocation } from './WebSocketService';

export interface ZoneMonitoringData {
  zone: Zone;
  totalRoutes: number;
  activeRoutes: number;
  completedRoutes: number;
  pendingRoutes: number;
  assignedInspectors: number;
  activeInspectors: number;
  completionRate: number;
  averageTimePerRoute: number;
  delayedRoutes: number;
  color: string; // KMZ color for visualization
}

export interface InspectorMonitoringData {
  inspector: Inspector;
  currentLocation?: InspectorLocation;
  assignedRoutes: number;
  activeRoutes: number;
  completedRoutes: number;
  completedPoints: number;
  totalPoints: number;
  progressPercentage: number;
  estimatedTimeRemaining: number; // minutes
  isOnline: boolean;
  lastUpdate: Date;
  currentZone?: Zone;
}

export interface RouteMonitoringData {
  route: Route;
  inspector?: Inspector;
  zone?: Zone;
  completedPoints: number;
  totalPoints: number;
  progressPercentage: number;
  estimatedTimeRemaining: number;
  isDelayed: boolean;
  delayMinutes: number;
  lastUpdate: Date;
}

export interface MonitoringDashboardData {
  zones: ZoneMonitoringData[];
  inspectors: InspectorMonitoringData[];
  routes: RouteMonitoringData[];
  alerts: Alert[];
  summary: {
    totalRoutes: number;
    activeRoutes: number;
    completedRoutes: number;
    totalInspectors: number;
    activeInspectors: number;
    onlineInspectors: number;
    totalAlerts: number;
    criticalAlerts: number;
    systemEfficiency: number;
    averageCompletionTime: number;
  };
}

export interface ZonePerformanceMetrics {
  zoneId: string;
  zoneName: string;
  type: 'metropolitana' | 'rural';
  totalRoutes: number;
  completedRoutes: number;
  averageCompletionTime: number; // minutes
  efficiency: number; // percentage
  inspectorUtilization: number; // percentage
  delayRate: number; // percentage
  pointsPerHour: number;
  coverage: number; // percentage of zone covered
}

export class MonitoringService {
  private routeRepository: RouteRepository;
  private inspectorRepository: InspectorRepository;
  private zoneRepository: ZoneRepository;
  private routePointRepository: RoutePointRepository;

  // Zone colors from KMZ file (predefined)
  private readonly zoneColors: { [key: string]: string } = {
    'Zona I - Metropolitana Suroriente': '#FF6B6B',
    'Zona II - Metropolitana Suroccidente': '#4ECDC4',
    'Zona III - Metropolitana Centro Oriente': '#45B7D1',
    'Zona IV - Metropolitana Centro Occidente': '#96CEB4',
    'Zona V - Metropolitana Noroccidente': '#FFEAA7',
    'Zona VI - Metropolitana Nororiente': '#DDA0DD',
    'Zona VII - Rural Oriental Norte': '#98D8C8',
    'Zona VIII - Rural Occidental Norte': '#F7DC6F',
    'Zona IX - Rural Occidental Sur': '#BB8FCE',
    'Zona X - Rural Oriental Sur': '#85C1E9',
    'Zona XI - Rural Occidental Centro': '#F8C471'
  };

  constructor() {
    this.routeRepository = new RouteRepository();
    this.inspectorRepository = new InspectorRepository();
    this.zoneRepository = new ZoneRepository();
    this.routePointRepository = new RoutePointRepository();
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getMonitoringDashboardData(): Promise<MonitoringDashboardData> {
    const [zones, inspectors, routes] = await Promise.all([
      this.zoneRepository.findAll(),
      this.inspectorRepository.findAll(),
      this.routeRepository.findAll()
    ]);

    const webSocketService = getWebSocketService();
    const inspectorLocations = webSocketService.getInspectorLocations();
    const alerts = webSocketService.getActiveAlerts();

    // Get zone monitoring data
    const zoneMonitoringData = await Promise.all(
      zones.map(zone => this.getZoneMonitoringData(zone, routes, inspectors))
    );

    // Get inspector monitoring data
    const inspectorMonitoringData = await Promise.all(
      inspectors.map(inspector => this.getInspectorMonitoringData(inspector, routes, inspectorLocations, zones))
    );

    // Get route monitoring data
    const routeMonitoringData = await Promise.all(
      routes.filter(route => route.status !== 'completed' && route.status !== 'cancelled')
        .map(route => this.getRouteMonitoringData(route, inspectors, zones))
    );

    // Calculate summary statistics
    const summary = this.calculateSummaryStatistics(
      zoneMonitoringData,
      inspectorMonitoringData,
      routeMonitoringData,
      alerts
    );

    return {
      zones: zoneMonitoringData,
      inspectors: inspectorMonitoringData,
      routes: routeMonitoringData,
      alerts,
      summary
    };
  }

  /**
   * Get monitoring data for a specific zone
   */
  private async getZoneMonitoringData(
    zone: Zone,
    allRoutes: Route[],
    allInspectors: Inspector[]
  ): Promise<ZoneMonitoringData> {
    const zoneRoutes = allRoutes.filter(route => route.zoneId === zone.id);
    const zoneInspectors = allInspectors.filter(inspector => 
      inspector.preferredZones.includes(zone.id)
    );

    const totalRoutes = zoneRoutes.length;
    const activeRoutes = zoneRoutes.filter(route => 
      route.status === 'in_progress' || route.status === 'assigned'
    ).length;
    const completedRoutes = zoneRoutes.filter(route => route.status === 'completed').length;
    const pendingRoutes = zoneRoutes.filter(route => route.status === 'pending').length;

    const assignedInspectors = zoneInspectors.length;
    const activeInspectors = zoneRoutes.filter(route => 
      route.status === 'in_progress' && route.assignedInspectorId
    ).length;

    const completionRate = totalRoutes > 0 ? (completedRoutes / totalRoutes) * 100 : 0;

    // Calculate average time per route
    const completedRoutesWithDuration = zoneRoutes.filter(route => 
      route.status === 'completed' && route.estimatedDuration
    );
    const averageTimePerRoute = completedRoutesWithDuration.length > 0
      ? completedRoutesWithDuration.reduce((sum, route) => sum + (route.estimatedDuration || 0), 0) / completedRoutesWithDuration.length
      : 0;

    // Check for delayed routes
    const now = new Date();
    const delayedRoutes = zoneRoutes.filter(route => {
      if (route.status !== 'in_progress') return false;
      const expectedDuration = route.estimatedDuration || 240;
      const routeStartTime = new Date(route.updatedAt);
      const elapsedMinutes = (now.getTime() - routeStartTime.getTime()) / (1000 * 60);
      return elapsedMinutes > expectedDuration * 1.2;
    }).length;

    return {
      zone,
      totalRoutes,
      activeRoutes,
      completedRoutes,
      pendingRoutes,
      assignedInspectors,
      activeInspectors,
      completionRate,
      averageTimePerRoute,
      delayedRoutes,
      color: this.zoneColors[zone.name] || '#95A5A6'
    };
  }

  /**
   * Get monitoring data for a specific inspector
   */
  private async getInspectorMonitoringData(
    inspector: Inspector,
    allRoutes: Route[],
    inspectorLocations: InspectorLocation[],
    allZones: Zone[]
  ): Promise<InspectorMonitoringData> {
    const inspectorRoutes = allRoutes.filter(route => route.assignedInspectorId === inspector.id);
    const currentLocation = inspectorLocations.find(loc => loc.inspectorId === inspector.id);

    const assignedRoutes = inspectorRoutes.length;
    const activeRoutes = inspectorRoutes.filter(route => route.status === 'in_progress').length;
    const completedRoutes = inspectorRoutes.filter(route => route.status === 'completed').length;

    // Get route points data for progress calculation
    let completedPoints = 0;
    let totalPoints = 0;
    let estimatedTimeRemaining = 0;

    for (const route of inspectorRoutes.filter(r => r.status === 'in_progress')) {
      const routePoints = await this.routePointRepository.findByRoute(route.id);
      const completed = routePoints.filter(point => point.status === 'completed').length;
      const total = routePoints.length;
      
      completedPoints += completed;
      totalPoints += total;

      // Estimate remaining time
      const remainingPoints = total - completed;
      const avgTimePerPoint = route.estimatedDuration ? route.estimatedDuration / total : 15;
      estimatedTimeRemaining += remainingPoints * avgTimePerPoint;
    }

    const progressPercentage = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

    // Determine if inspector is online (location updated within last 10 minutes)
    const isOnline = currentLocation ? 
      (new Date().getTime() - currentLocation.timestamp.getTime()) < 10 * 60 * 1000 : false;

    const lastUpdate = currentLocation?.timestamp || new Date(inspector.updatedAt);

    // Determine current zone based on location
    let currentZone: Zone | undefined;
    if (currentLocation) {
      // This would require geospatial query - simplified for now
      currentZone = allZones.find(zone => inspector.preferredZones.includes(zone.id));
    }

    return {
      inspector,
      currentLocation,
      assignedRoutes,
      activeRoutes,
      completedRoutes,
      completedPoints,
      totalPoints,
      progressPercentage,
      estimatedTimeRemaining,
      isOnline,
      lastUpdate,
      currentZone
    };
  }

  /**
   * Get monitoring data for a specific route
   */
  private async getRouteMonitoringData(
    route: Route,
    allInspectors: Inspector[],
    allZones: Zone[]
  ): Promise<RouteMonitoringData> {
    const inspector = allInspectors.find(i => i.id === route.assignedInspectorId);
    const zone = allZones.find(z => z.id === route.zoneId);

    // Get route points for progress calculation
    const routePoints = await this.routePointRepository.findByRoute(route.id);
    const completedPoints = routePoints.filter(point => point.status === 'completed').length;
    const totalPoints = routePoints.length;
    const progressPercentage = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

    // Calculate estimated time remaining
    const remainingPoints = totalPoints - completedPoints;
    const avgTimePerPoint = route.estimatedDuration ? route.estimatedDuration / totalPoints : 15;
    const estimatedTimeRemaining = remainingPoints * avgTimePerPoint;

    // Check if route is delayed
    const now = new Date();
    const expectedDuration = route.estimatedDuration || 240;
    const routeStartTime = new Date(route.updatedAt);
    const elapsedMinutes = (now.getTime() - routeStartTime.getTime()) / (1000 * 60);
    const isDelayed = route.status === 'in_progress' && elapsedMinutes > expectedDuration * 1.2;
    const delayMinutes = isDelayed ? Math.round(elapsedMinutes - expectedDuration) : 0;

    return {
      route,
      inspector,
      zone,
      completedPoints,
      totalPoints,
      progressPercentage,
      estimatedTimeRemaining,
      isDelayed,
      delayMinutes,
      lastUpdate: new Date(route.updatedAt)
    };
  }

  /**
   * Calculate summary statistics for the dashboard
   */
  private calculateSummaryStatistics(
    zones: ZoneMonitoringData[],
    inspectors: InspectorMonitoringData[],
    routes: RouteMonitoringData[],
    alerts: Alert[]
  ): MonitoringDashboardData['summary'] {
    const totalRoutes = zones.reduce((sum, zone) => sum + zone.totalRoutes, 0);
    const activeRoutes = zones.reduce((sum, zone) => sum + zone.activeRoutes, 0);
    const completedRoutes = zones.reduce((sum, zone) => sum + zone.completedRoutes, 0);

    const totalInspectors = inspectors.length;
    const activeInspectors = inspectors.filter(i => i.activeRoutes > 0).length;
    const onlineInspectors = inspectors.filter(i => i.isOnline).length;

    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length;

    // Calculate system efficiency (completed routes / total routes)
    const systemEfficiency = totalRoutes > 0 ? (completedRoutes / totalRoutes) * 100 : 0;

    // Calculate average completion time
    const averageCompletionTime = zones.reduce((sum, zone) => sum + zone.averageTimePerRoute, 0) / zones.length;

    return {
      totalRoutes,
      activeRoutes,
      completedRoutes,
      totalInspectors,
      activeInspectors,
      onlineInspectors,
      totalAlerts,
      criticalAlerts,
      systemEfficiency,
      averageCompletionTime
    };
  }

  /**
   * Get zone performance metrics for analytics
   */
  async getZonePerformanceMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<ZonePerformanceMetrics[]> {
    const zones = await this.zoneRepository.findAll();
    const routes = await this.routeRepository.findAll();

    // Filter routes by date range if provided
    const filteredRoutes = routes.filter(route => {
      if (!startDate && !endDate) return true;
      const routeDate = new Date(route.createdAt);
      if (startDate && routeDate < startDate) return false;
      if (endDate && routeDate > endDate) return false;
      return true;
    });

    const metrics = await Promise.all(
      zones.map(async (zone) => {
        const zoneRoutes = filteredRoutes.filter(route => route.zoneId === zone.id);
        const completedRoutes = zoneRoutes.filter(route => route.status === 'completed');

        const totalRoutes = zoneRoutes.length;
        const completedCount = completedRoutes.length;

        // Calculate average completion time
        const averageCompletionTime = completedRoutes.length > 0
          ? completedRoutes.reduce((sum, route) => sum + (route.estimatedDuration || 0), 0) / completedRoutes.length
          : 0;

        // Calculate efficiency (completed vs total)
        const efficiency = totalRoutes > 0 ? (completedCount / totalRoutes) * 100 : 0;

        // Calculate inspector utilization for this zone
        const zoneInspectors = await this.inspectorRepository.findByPreferredZone(zone.id);
        const activeInspectors = zoneRoutes.filter(route => 
          route.status === 'in_progress' && route.assignedInspectorId
        ).length;
        const inspectorUtilization = zoneInspectors.length > 0 
          ? (activeInspectors / zoneInspectors.length) * 100 
          : 0;

        // Calculate delay rate
        const now = new Date();
        const delayedRoutes = zoneRoutes.filter(route => {
          if (route.status !== 'in_progress') return false;
          const expectedDuration = route.estimatedDuration || 240;
          const routeStartTime = new Date(route.updatedAt);
          const elapsedMinutes = (now.getTime() - routeStartTime.getTime()) / (1000 * 60);
          return elapsedMinutes > expectedDuration * 1.2;
        }).length;
        const delayRate = totalRoutes > 0 ? (delayedRoutes / totalRoutes) * 100 : 0;

        // Calculate points per hour (simplified)
        const totalPoints = await Promise.all(
          completedRoutes.map(route => this.routePointRepository.findByRoute(route.id))
        );
        const pointCount = totalPoints.flat().length;
        const totalHours = completedRoutes.reduce((sum, route) => sum + (route.estimatedDuration || 0), 0) / 60;
        const pointsPerHour = totalHours > 0 ? pointCount / totalHours : 0;

        // Coverage calculation (simplified - would need more complex geospatial analysis)
        const coverage = Math.min(100, (completedCount / Math.max(1, totalRoutes)) * 100);

        return {
          zoneId: zone.id,
          zoneName: zone.name,
          type: zone.type,
          totalRoutes,
          completedRoutes: completedCount,
          averageCompletionTime,
          efficiency,
          inspectorUtilization,
          delayRate,
          pointsPerHour,
          coverage
        };
      })
    );

    return metrics;
  }

  /**
   * Get comparative analysis between metropolitan and rural zones
   */
  async getZoneTypeComparison(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    metropolitana: {
      totalZones: number;
      totalRoutes: number;
      completedRoutes: number;
      averageEfficiency: number;
      averageCompletionTime: number;
      averageDelayRate: number;
    };
    rural: {
      totalZones: number;
      totalRoutes: number;
      completedRoutes: number;
      averageEfficiency: number;
      averageCompletionTime: number;
      averageDelayRate: number;
    };
  }> {
    const metrics = await this.getZonePerformanceMetrics(startDate, endDate);
    
    const metropolitanaMetrics = metrics.filter(m => m.type === 'metropolitana');
    const ruralMetrics = metrics.filter(m => m.type === 'rural');

    const calculateAverages = (zoneMetrics: ZonePerformanceMetrics[]) => ({
      totalZones: zoneMetrics.length,
      totalRoutes: zoneMetrics.reduce((sum, m) => sum + m.totalRoutes, 0),
      completedRoutes: zoneMetrics.reduce((sum, m) => sum + m.completedRoutes, 0),
      averageEfficiency: zoneMetrics.length > 0 
        ? zoneMetrics.reduce((sum, m) => sum + m.efficiency, 0) / zoneMetrics.length 
        : 0,
      averageCompletionTime: zoneMetrics.length > 0
        ? zoneMetrics.reduce((sum, m) => sum + m.averageCompletionTime, 0) / zoneMetrics.length
        : 0,
      averageDelayRate: zoneMetrics.length > 0
        ? zoneMetrics.reduce((sum, m) => sum + m.delayRate, 0) / zoneMetrics.length
        : 0
    });

    return {
      metropolitana: calculateAverages(metropolitanaMetrics),
      rural: calculateAverages(ruralMetrics)
    };
  }

  /**
   * Check for issues and create alerts
   */
  async checkSystemHealth(): Promise<void> {
    const webSocketService = getWebSocketService();
    const [routes, inspectors] = await Promise.all([
      this.routeRepository.findAll(),
      this.inspectorRepository.findAll()
    ]);

    // Check for delayed routes
    await webSocketService.checkForDelays(routes, inspectors);

    // Check for offline inspectors with active routes
    const inspectorLocations = webSocketService.getInspectorLocations();
    const now = new Date();

    for (const inspector of inspectors) {
      const activeRoutes = routes.filter(route => 
        route.assignedInspectorId === inspector.id && route.status === 'in_progress'
      );

      if (activeRoutes.length > 0) {
        const location = inspectorLocations.find(loc => loc.inspectorId === inspector.id);
        const isOffline = !location || 
          (now.getTime() - location.timestamp.getTime()) > 15 * 60 * 1000; // 15 minutes

        if (isOffline) {
          webSocketService.createAlert({
            type: 'issue',
            severity: 'medium',
            title: 'Inspector Offline',
            message: `Inspector ${inspector.name} has active routes but appears to be offline`,
            inspectorId: inspector.id
          });
        }
      }
    }

    // Check for unassigned routes
    const unassignedRoutes = routes.filter(route => 
      route.status === 'pending' && !route.assignedInspectorId
    );

    if (unassignedRoutes.length > 5) {
      webSocketService.createAlert({
        type: 'issue',
        severity: 'high',
        title: 'High Number of Unassigned Routes',
        message: `${unassignedRoutes.length} routes are pending assignment`,
      });
    }
  }

  /**
   * Get zone color for visualization
   */
  getZoneColor(zoneName: string): string {
    return this.zoneColors[zoneName] || '#95A5A6';
  }

  /**
   * Get all zone colors for frontend
   */
  getAllZoneColors(): { [key: string]: string } {
    return { ...this.zoneColors };
  }
}