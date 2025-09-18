import * as XLSX from 'xlsx';
import { Route, Inspector, Zone, RoutePoint } from '../types';
import { RouteRepository } from '../repositories/RouteRepository';
import { InspectorRepository } from '../repositories/InspectorRepository';
import { ZoneRepository } from '../repositories/ZoneRepository';
import { RoutePointRepository } from '../repositories/RoutePointRepository';
import { MonitoringService } from './MonitoringService';

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'excel' | 'csv' | 'pdf';
  fields: string[];
  filters?: {
    dateRange?: { start: Date; end: Date };
    zones?: string[];
    inspectors?: string[];
    status?: string[];
  };
}

export interface ExportRequest {
  templateId: string;
  format: 'excel' | 'csv' | 'pdf';
  filters?: {
    startDate?: Date;
    endDate?: Date;
    zoneIds?: string[];
    inspectorIds?: string[];
    routeStatus?: string[];
  };
  customFields?: string[];
}

export interface ExportResult {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
  generatedAt: Date;
}

export interface ScheduledExport {
  id: string;
  name: string;
  templateId: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  recipients: string[];
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
}

export class ExportService {
  private routeRepository: RouteRepository;
  private inspectorRepository: InspectorRepository;
  private zoneRepository: ZoneRepository;
  private routePointRepository: RoutePointRepository;
  private monitoringService: MonitoringService;

  // Predefined export templates
  private readonly templates: ExportTemplate[] = [
    {
      id: 'routes_summary',
      name: 'Routes Summary Report',
      description: 'Overview of all routes with basic statistics',
      format: 'excel',
      fields: ['route_name', 'zone', 'inspector', 'status', 'created_date', 'completion_date', 'estimated_duration', 'actual_duration', 'points_count']
    },
    {
      id: 'inspector_performance',
      name: 'Inspector Performance Report',
      description: 'Detailed performance metrics for inspectors',
      format: 'excel',
      fields: ['inspector_name', 'inspector_id', 'assigned_routes', 'completed_routes', 'completion_rate', 'avg_time_per_route', 'total_points_completed', 'efficiency_score']
    },
    {
      id: 'zone_analytics',
      name: 'Zone Analytics Report',
      description: 'Comprehensive zone performance and coverage analysis',
      format: 'excel',
      fields: ['zone_name', 'zone_type', 'total_routes', 'completed_routes', 'completion_rate', 'avg_completion_time', 'delay_rate', 'inspector_utilization', 'coverage_percentage']
    },
    {
      id: 'daily_operations',
      name: 'Daily Operations Report',
      description: 'Daily summary of operations and activities',
      format: 'excel',
      fields: ['date', 'total_routes', 'completed_routes', 'active_inspectors', 'system_efficiency', 'alerts_count', 'avg_completion_time']
    },
    {
      id: 'route_details',
      name: 'Detailed Route Report',
      description: 'Complete route information with all points',
      format: 'excel',
      fields: ['route_name', 'zone', 'inspector', 'status', 'priority', 'points_list', 'coordinates', 'completion_times', 'notes']
    },
    {
      id: 'comparative_analysis',
      name: 'Metropolitan vs Rural Analysis',
      description: 'Comparative analysis between metropolitan and rural zones',
      format: 'excel',
      fields: ['zone_type', 'total_zones', 'total_routes', 'completion_rate', 'avg_efficiency', 'avg_completion_time', 'delay_rate', 'inspector_count']
    }
  ];

  constructor() {
    this.routeRepository = new RouteRepository();
    this.inspectorRepository = new InspectorRepository();
    this.zoneRepository = new ZoneRepository();
    this.routePointRepository = new RoutePointRepository();
    this.monitoringService = new MonitoringService();
  }

  /**
   * Get all available export templates
   */
  getTemplates(): ExportTemplate[] {
    return [...this.templates];
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): ExportTemplate | null {
    return this.templates.find(t => t.id === templateId) || null;
  }

  /**
   * Export data based on request
   */
  async exportData(request: ExportRequest): Promise<ExportResult> {
    const template = this.getTemplate(request.templateId);
    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    const data = await this.generateExportData(request);
    const buffer = await this.formatData(data, request.format, template);
    
    const filename = this.generateFilename(template, request.format);
    const mimeType = this.getMimeType(request.format);

    return {
      filename,
      buffer,
      mimeType,
      size: buffer.length,
      generatedAt: new Date()
    };
  }

  /**
   * Generate export data based on template and filters
   */
  private async generateExportData(request: ExportRequest): Promise<any[]> {
    const template = this.getTemplate(request.templateId);
    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    switch (request.templateId) {
      case 'routes_summary':
        return this.generateRoutesSummaryData(request.filters);
      
      case 'inspector_performance':
        return this.generateInspectorPerformanceData(request.filters);
      
      case 'zone_analytics':
        return this.generateZoneAnalyticsData(request.filters);
      
      case 'daily_operations':
        return this.generateDailyOperationsData(request.filters);
      
      case 'route_details':
        return this.generateRouteDetailsData(request.filters);
      
      case 'comparative_analysis':
        return this.generateComparativeAnalysisData(request.filters);
      
      default:
        throw new Error(`Unknown template: ${request.templateId}`);
    }
  }

  /**
   * Generate routes summary data
   */
  private async generateRoutesSummaryData(filters?: ExportRequest['filters']): Promise<any[]> {
    let routes = await this.routeRepository.findAll();
    const zones = await this.zoneRepository.findAll();
    const inspectors = await this.inspectorRepository.findAll();

    // Apply filters
    if (filters) {
      if (filters.startDate || filters.endDate) {
        routes = routes.filter(route => {
          const routeDate = new Date(route.createdAt);
          if (filters.startDate && routeDate < filters.startDate) return false;
          if (filters.endDate && routeDate > filters.endDate) return false;
          return true;
        });
      }

      if (filters.zoneIds?.length) {
        routes = routes.filter(route => route.zoneId && filters.zoneIds!.includes(route.zoneId));
      }

      if (filters.inspectorIds?.length) {
        routes = routes.filter(route => route.assignedInspectorId && filters.inspectorIds!.includes(route.assignedInspectorId));
      }

      if (filters.routeStatus?.length) {
        routes = routes.filter(route => filters.routeStatus!.includes(route.status));
      }
    }

    // Generate data
    const data = await Promise.all(routes.map(async (route) => {
      const zone = zones.find(z => z.id === route.zoneId);
      const inspector = inspectors.find(i => i.id === route.assignedInspectorId);
      const routePoints = await this.routePointRepository.findByRoute(route.id);
      
      return {
        route_name: route.name,
        zone: zone?.name || 'Unassigned',
        inspector: inspector?.name || 'Unassigned',
        status: route.status,
        created_date: route.createdAt.toISOString().split('T')[0],
        completion_date: route.status === 'completed' ? route.updatedAt.toISOString().split('T')[0] : '',
        estimated_duration: route.estimatedDuration || 0,
        actual_duration: this.calculateActualDuration(route),
        points_count: routePoints.length
      };
    }));

    return data;
  }

  /**
   * Generate inspector performance data
   */
  private async generateInspectorPerformanceData(filters?: ExportRequest['filters']): Promise<any[]> {
    const inspectors = await this.inspectorRepository.findAll();
    let routes = await this.routeRepository.findAll();

    // Apply date filters to routes
    if (filters?.startDate || filters?.endDate) {
      routes = routes.filter(route => {
        const routeDate = new Date(route.createdAt);
        if (filters.startDate && routeDate < filters.startDate) return false;
        if (filters.endDate && routeDate > filters.endDate) return false;
        return true;
      });
    }

    const data = await Promise.all(inspectors.map(async (inspector) => {
      const inspectorRoutes = routes.filter(route => route.assignedInspectorId === inspector.id);
      const completedRoutes = inspectorRoutes.filter(route => route.status === 'completed');
      
      // Calculate total points completed
      let totalPointsCompleted = 0;
      for (const route of completedRoutes) {
        const routePoints = await this.routePointRepository.findByRoute(route.id);
        totalPointsCompleted += routePoints.filter(point => point.status === 'completed').length;
      }

      const completionRate = inspectorRoutes.length > 0 ? (completedRoutes.length / inspectorRoutes.length) * 100 : 0;
      const avgTimePerRoute = completedRoutes.length > 0 
        ? completedRoutes.reduce((sum, route) => sum + (route.estimatedDuration || 0), 0) / completedRoutes.length 
        : 0;

      return {
        inspector_name: inspector.name,
        inspector_id: inspector.identification,
        assigned_routes: inspectorRoutes.length,
        completed_routes: completedRoutes.length,
        completion_rate: completionRate.toFixed(1),
        avg_time_per_route: Math.round(avgTimePerRoute),
        total_points_completed: totalPointsCompleted,
        efficiency_score: this.calculateEfficiencyScore(inspector, inspectorRoutes, completedRoutes)
      };
    }));

    return data;
  }

  /**
   * Generate zone analytics data
   */
  private async generateZoneAnalyticsData(filters?: ExportRequest['filters']): Promise<any[]> {
    const metrics = await this.monitoringService.getZonePerformanceMetrics(
      filters?.startDate,
      filters?.endDate
    );

    return metrics.map(metric => ({
      zone_name: metric.zoneName,
      zone_type: metric.type,
      total_routes: metric.totalRoutes,
      completed_routes: metric.completedRoutes,
      completion_rate: metric.efficiency.toFixed(1),
      avg_completion_time: Math.round(metric.averageCompletionTime),
      delay_rate: metric.delayRate.toFixed(1),
      inspector_utilization: metric.inspectorUtilization.toFixed(1),
      coverage_percentage: metric.coverage.toFixed(1)
    }));
  }

  /**
   * Generate daily operations data
   */
  private async generateDailyOperationsData(filters?: ExportRequest['filters']): Promise<any[]> {
    const dashboardData = await this.monitoringService.getMonitoringDashboardData();
    
    // For now, return current day data (would be expanded for historical data)
    return [{
      date: new Date().toISOString().split('T')[0],
      total_routes: dashboardData.summary.totalRoutes,
      completed_routes: dashboardData.summary.completedRoutes,
      active_inspectors: dashboardData.summary.activeInspectors,
      system_efficiency: dashboardData.summary.systemEfficiency.toFixed(1),
      alerts_count: dashboardData.summary.totalAlerts,
      avg_completion_time: Math.round(dashboardData.summary.averageCompletionTime)
    }];
  }

  /**
   * Generate route details data
   */
  private async generateRouteDetailsData(filters?: ExportRequest['filters']): Promise<any[]> {
    let routes = await this.routeRepository.findAll();
    const zones = await this.zoneRepository.findAll();
    const inspectors = await this.inspectorRepository.findAll();

    // Apply filters (similar to routes summary)
    if (filters) {
      if (filters.startDate || filters.endDate) {
        routes = routes.filter(route => {
          const routeDate = new Date(route.createdAt);
          if (filters.startDate && routeDate < filters.startDate) return false;
          if (filters.endDate && routeDate > filters.endDate) return false;
          return true;
        });
      }
    }

    const data = await Promise.all(routes.map(async (route) => {
      const zone = zones.find(z => z.id === route.zoneId);
      const inspector = inspectors.find(i => i.id === route.assignedInspectorId);
      const routePoints = await this.routePointRepository.findByRouteWithCoordinates(route.id);
      
      const pointsList = routePoints.map(point => 
        `Point ${point.pointOrder}: ${point.coordinate.address || 'No address'}`
      ).join('; ');
      
      const coordinates = routePoints.map(point => 
        `${point.coordinate.latitude},${point.coordinate.longitude}`
      ).join('; ');

      return {
        route_name: route.name,
        zone: zone?.name || 'Unassigned',
        inspector: inspector?.name || 'Unassigned',
        status: route.status,
        priority: route.priority,
        points_list: pointsList,
        coordinates: coordinates,
        completion_times: routePoints.filter(p => p.completedAt).map(p => 
          p.completedAt!.toISOString()
        ).join('; '),
        notes: routePoints.filter(p => p.notes).map(p => p.notes).join('; ')
      };
    }));

    return data;
  }

  /**
   * Generate comparative analysis data
   */
  private async generateComparativeAnalysisData(filters?: ExportRequest['filters']): Promise<any[]> {
    const comparison = await this.monitoringService.getZoneTypeComparison(
      filters?.startDate,
      filters?.endDate
    );

    return [
      {
        zone_type: 'Metropolitan',
        total_zones: comparison.metropolitana.totalZones,
        total_routes: comparison.metropolitana.totalRoutes,
        completion_rate: ((comparison.metropolitana.completedRoutes / comparison.metropolitana.totalRoutes) * 100).toFixed(1),
        avg_efficiency: comparison.metropolitana.averageEfficiency.toFixed(1),
        avg_completion_time: Math.round(comparison.metropolitana.averageCompletionTime),
        delay_rate: comparison.metropolitana.averageDelayRate.toFixed(1),
        inspector_count: 'N/A' // Would need additional data
      },
      {
        zone_type: 'Rural',
        total_zones: comparison.rural.totalZones,
        total_routes: comparison.rural.totalRoutes,
        completion_rate: ((comparison.rural.completedRoutes / comparison.rural.totalRoutes) * 100).toFixed(1),
        avg_efficiency: comparison.rural.averageEfficiency.toFixed(1),
        avg_completion_time: Math.round(comparison.rural.averageCompletionTime),
        delay_rate: comparison.rural.averageDelayRate.toFixed(1),
        inspector_count: 'N/A' // Would need additional data
      }
    ];
  }

  /**
   * Format data based on export format
   */
  private async formatData(data: any[], format: 'excel' | 'csv' | 'pdf', template: ExportTemplate): Promise<Buffer> {
    switch (format) {
      case 'excel':
        return this.formatAsExcel(data, template);
      case 'csv':
        return this.formatAsCSV(data);
      case 'pdf':
        return this.formatAsPDF(data, template);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Format data as Excel
   */
  private formatAsExcel(data: any[], template: ExportTemplate): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    
    // Add metadata
    const metadataSheet = XLSX.utils.json_to_sheet([
      { Property: 'Report Name', Value: template.name },
      { Property: 'Description', Value: template.description },
      { Property: 'Generated At', Value: new Date().toISOString() },
      { Property: 'Total Records', Value: data.length }
    ]);
    
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  /**
   * Format data as CSV
   */
  private formatAsCSV(data: any[]): Buffer {
    if (data.length === 0) {
      return Buffer.from('No data available');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Format data as PDF (simplified implementation)
   */
  private formatAsPDF(data: any[], template: ExportTemplate): Buffer {
    // This would use a PDF library like PDFKit or jsPDF
    // For now, return a simple text representation
    const content = [
      `Report: ${template.name}`,
      `Description: ${template.description}`,
      `Generated: ${new Date().toISOString()}`,
      `Records: ${data.length}`,
      '',
      'Data:',
      JSON.stringify(data, null, 2)
    ].join('\n');

    return Buffer.from(content, 'utf-8');
  }

  /**
   * Generate filename for export
   */
  private generateFilename(template: ExportTemplate, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const templateName = template.name.toLowerCase().replace(/\s+/g, '_');
    return `${templateName}_${timestamp}.${format}`;
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    switch (format) {
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'csv':
        return 'text/csv';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Calculate actual duration for a route
   */
  private calculateActualDuration(route: Route): number {
    if (route.status !== 'completed') return 0;
    
    const startTime = new Date(route.createdAt);
    const endTime = new Date(route.updatedAt);
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes
  }

  /**
   * Calculate efficiency score for an inspector
   */
  private calculateEfficiencyScore(inspector: Inspector, assignedRoutes: Route[], completedRoutes: Route[]): number {
    if (assignedRoutes.length === 0) return 0;
    
    const completionRate = (completedRoutes.length / assignedRoutes.length) * 100;
    const avgTime = completedRoutes.length > 0 
      ? completedRoutes.reduce((sum, route) => sum + (route.estimatedDuration || 0), 0) / completedRoutes.length 
      : 0;
    
    // Simple efficiency calculation (can be made more sophisticated)
    const timeEfficiency = avgTime > 0 ? Math.max(0, 100 - (avgTime / 240) * 100) : 0; // 240 min as baseline
    
    return Math.round((completionRate * 0.7) + (timeEfficiency * 0.3));
  }

  /**
   * Create custom export template
   */
  createCustomTemplate(template: Omit<ExportTemplate, 'id'>): ExportTemplate {
    const customTemplate: ExportTemplate = {
      ...template,
      id: `custom_${Date.now()}`
    };
    
    // In a real implementation, this would be saved to database
    return customTemplate;
  }

  /**
   * Preview export data (first 10 rows)
   */
  async previewExport(request: ExportRequest): Promise<any[]> {
    const data = await this.generateExportData(request);
    return data.slice(0, 10);
  }
}