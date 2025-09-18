import { BaseRepository } from './BaseRepository';
import { Route, RoutePoint } from '../types';
import { validateRoute, validateRoutePoint } from '../schemas/validation';

export class RouteRepository extends BaseRepository<Route> {
  constructor() {
    super('routes');
  }

  /**
   * Create a new route
   */
  async create(routeData: Omit<Route, 'id' | 'createdAt' | 'updatedAt'>): Promise<Route> {
    const { error, value } = validateRoute(routeData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const query = `
      INSERT INTO routes (name, estimated_duration, priority, zone_id, status, assigned_inspector_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<Route>(query, [
      value.name,
      value.estimatedDuration,
      value.priority,
      value.zoneId,
      value.status,
      value.assignedInspectorId
    ]);

    if (!result) {
      throw new Error('Failed to create route');
    }

    return this.transformDatabaseResult(result);
  }

  /**
   * Update an existing route
   */
  async update(id: string, routeData: Partial<Omit<Route, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Route | null> {
    const existingRoute = await this.findById(id);
    if (!existingRoute) {
      return null;
    }

    const updatedData = { ...existingRoute, ...routeData };
    const { error, value } = validateRoute(updatedData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (routeData.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      params.push(value.name);
    }

    if (routeData.estimatedDuration !== undefined) {
      setParts.push(`estimated_duration = $${paramIndex++}`);
      params.push(value.estimatedDuration);
    }

    if (routeData.priority !== undefined) {
      setParts.push(`priority = $${paramIndex++}`);
      params.push(value.priority);
    }

    if (routeData.zoneId !== undefined) {
      setParts.push(`zone_id = $${paramIndex++}`);
      params.push(value.zoneId);
    }

    if (routeData.status !== undefined) {
      setParts.push(`status = $${paramIndex++}`);
      params.push(value.status);
    }

    if (routeData.assignedInspectorId !== undefined) {
      setParts.push(`assigned_inspector_id = $${paramIndex++}`);
      params.push(value.assignedInspectorId);
    }

    if (setParts.length === 0) {
      return existingRoute;
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE routes 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<Route>(query, params);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Find routes by status
   */
  async findByStatus(status: Route['status']): Promise<Route[]> {
    const results = await this.findAll('status = $1', [status]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find routes by zone
   */
  async findByZone(zoneId: string): Promise<Route[]> {
    const results = await this.findAll('zone_id = $1', [zoneId]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find routes assigned to an inspector
   */
  async findByInspector(inspectorId: string): Promise<Route[]> {
    const results = await this.findAll('assigned_inspector_id = $1', [inspectorId]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find routes with their points
   */
  async findWithPoints(routeId?: string): Promise<Array<Route & { points: RoutePoint[] }>> {
    let query = `
      SELECT 
        r.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', rp.id,
              'routeId', rp.route_id,
              'coordinateId', rp.coordinate_id,
              'pointOrder', rp.point_order,
              'estimatedTime', rp.estimated_time,
              'status', rp.status,
              'completedAt', rp.completed_at,
              'notes', rp.notes
            ) ORDER BY rp.point_order
          ) FILTER (WHERE rp.id IS NOT NULL),
          '[]'::json
        ) as points
      FROM routes r
      LEFT JOIN route_points rp ON r.id = rp.route_id
    `;

    const params: any[] = [];
    if (routeId) {
      query += ` WHERE r.id = $1`;
      params.push(routeId);
    }

    query += ` GROUP BY r.id ORDER BY r.created_at DESC`;

    const results = await this.executeCustomQuery<any>(query, params);
    return results.map(result => ({
      ...this.transformDatabaseResult(result),
      points: result.points || []
    }));
  }

  /**
   * Assign route to inspector
   */
  async assignToInspector(routeId: string, inspectorId: string): Promise<Route | null> {
    return this.update(routeId, {
      assignedInspectorId: inspectorId,
      status: 'assigned'
    });
  }

  /**
   * Unassign route from inspector
   */
  async unassignFromInspector(routeId: string): Promise<Route | null> {
    const updateData: Partial<Omit<Route, 'id' | 'createdAt' | 'updatedAt'>> = {
      status: 'pending'
    };
    
    // Use a custom query to set assignedInspectorId to NULL
    const query = `
      UPDATE routes 
      SET assigned_inspector_id = NULL, status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await this.executeCustomQuerySingle<Route>(query, ['pending', routeId]);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Get route statistics by zone
   */
  async getStatsByZone(): Promise<Array<{
    zoneId: string;
    zoneName: string;
    totalRoutes: number;
    pendingRoutes: number;
    assignedRoutes: number;
    completedRoutes: number;
  }>> {
    const query = `
      SELECT 
        z.id as zone_id,
        z.name as zone_name,
        COUNT(r.id) as total_routes,
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_routes,
        COUNT(CASE WHEN r.status = 'assigned' THEN 1 END) as assigned_routes,
        COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_routes
      FROM zones z
      LEFT JOIN routes r ON z.id = r.zone_id
      WHERE z.is_active = true
      GROUP BY z.id, z.name
      ORDER BY z.name
    `;

    const results = await this.executeCustomQuery<any>(query);
    return results.map(result => ({
      zoneId: result.zone_id,
      zoneName: result.zone_name,
      totalRoutes: parseInt(result.total_routes || '0'),
      pendingRoutes: parseInt(result.pending_routes || '0'),
      assignedRoutes: parseInt(result.assigned_routes || '0'),
      completedRoutes: parseInt(result.completed_routes || '0')
    }));
  }

  /**
   * Get route statistics by inspector
   */
  async getStatsByInspector(): Promise<Array<{
    inspectorId: string;
    inspectorName: string;
    totalRoutes: number;
    activeRoutes: number;
    completedRoutes: number;
    averageDuration: number;
  }>> {
    const query = `
      SELECT 
        i.id as inspector_id,
        i.name as inspector_name,
        COUNT(r.id) as total_routes,
        COUNT(CASE WHEN r.status IN ('assigned', 'in_progress') THEN 1 END) as active_routes,
        COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_routes,
        COALESCE(AVG(r.estimated_duration), 0) as average_duration
      FROM inspectors i
      LEFT JOIN routes r ON i.id = r.assigned_inspector_id
      WHERE i.is_active = true
      GROUP BY i.id, i.name
      ORDER BY i.name
    `;

    const results = await this.executeCustomQuery<any>(query);
    return results.map(result => ({
      inspectorId: result.inspector_id,
      inspectorName: result.inspector_name,
      totalRoutes: parseInt(result.total_routes || '0'),
      activeRoutes: parseInt(result.active_routes || '0'),
      completedRoutes: parseInt(result.completed_routes || '0'),
      averageDuration: parseFloat(result.average_duration || '0')
    }));
  }

  /**
   * Transform database result to match Route interface
   */
  private transformDatabaseResult(dbResult: any): Route {
    return {
      id: dbResult.id,
      name: dbResult.name,
      estimatedDuration: dbResult.estimated_duration,
      priority: dbResult.priority,
      zoneId: dbResult.zone_id,
      status: dbResult.status,
      assignedInspectorId: dbResult.assigned_inspector_id,
      createdAt: new Date(dbResult.created_at),
      updatedAt: new Date(dbResult.updated_at)
    };
  }
}