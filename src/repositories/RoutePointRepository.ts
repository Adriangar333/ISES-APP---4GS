import { BaseRepository } from './BaseRepository';
import { RoutePoint } from '../types';
import { validateRoutePoint } from '../schemas/validation';

export class RoutePointRepository extends BaseRepository<RoutePoint> {
  constructor() {
    super('route_points');
  }

  /**
   * Create a new route point
   */
  async create(routePointData: Omit<RoutePoint, 'id'>): Promise<RoutePoint> {
    const { error, value } = validateRoutePoint(routePointData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const query = `
      INSERT INTO route_points (route_id, coordinate_id, point_order, estimated_time, status, completed_at, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<RoutePoint>(query, [
      value.routeId,
      value.coordinateId,
      value.pointOrder,
      value.estimatedTime,
      value.status,
      value.completedAt,
      value.notes
    ]);

    if (!result) {
      throw new Error('Failed to create route point');
    }

    return this.transformDatabaseResult(result);
  }

  /**
   * Bulk create route points
   */
  async createBulk(routePoints: Omit<RoutePoint, 'id'>[]): Promise<RoutePoint[]> {
    if (routePoints.length === 0) {
      return [];
    }

    // Validate all route points
    for (const point of routePoints) {
      const { error } = validateRoutePoint(point);
      if (error) {
        throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    routePoints.forEach((point) => {
      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      params.push(
        point.routeId,
        point.coordinateId,
        point.pointOrder,
        point.estimatedTime,
        point.status,
        point.completedAt,
        point.notes
      );
    });

    const query = `
      INSERT INTO route_points (route_id, coordinate_id, point_order, estimated_time, status, completed_at, notes)
      VALUES ${values.join(', ')}
      RETURNING *
    `;

    const results = await this.executeCustomQuery<RoutePoint>(query, params);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Update an existing route point
   */
  async update(id: string, routePointData: Partial<Omit<RoutePoint, 'id'>>): Promise<RoutePoint | null> {
    const existingPoint = await this.findById(id);
    if (!existingPoint) {
      return null;
    }

    const updatedData = { ...existingPoint, ...routePointData };
    const { error, value } = validateRoutePoint(updatedData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (routePointData.routeId !== undefined) {
      setParts.push(`route_id = $${paramIndex++}`);
      params.push(value.routeId);
    }

    if (routePointData.coordinateId !== undefined) {
      setParts.push(`coordinate_id = $${paramIndex++}`);
      params.push(value.coordinateId);
    }

    if (routePointData.pointOrder !== undefined) {
      setParts.push(`point_order = $${paramIndex++}`);
      params.push(value.pointOrder);
    }

    if (routePointData.estimatedTime !== undefined) {
      setParts.push(`estimated_time = $${paramIndex++}`);
      params.push(value.estimatedTime);
    }

    if (routePointData.status !== undefined) {
      setParts.push(`status = $${paramIndex++}`);
      params.push(value.status);
    }

    if (routePointData.completedAt !== undefined) {
      setParts.push(`completed_at = $${paramIndex++}`);
      params.push(value.completedAt);
    }

    if (routePointData.notes !== undefined) {
      setParts.push(`notes = $${paramIndex++}`);
      params.push(value.notes);
    }

    if (setParts.length === 0) {
      return existingPoint;
    }

    params.push(id);

    const query = `
      UPDATE route_points 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<RoutePoint>(query, params);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Find route points by route ID
   */
  async findByRoute(routeId: string): Promise<RoutePoint[]> {
    const results = await this.findAll('route_id = $1 ORDER BY point_order', [routeId]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find route points with coordinate details
   */
  async findByRouteWithCoordinates(routeId: string): Promise<Array<RoutePoint & {
    coordinate: {
      latitude: number;
      longitude: number;
      address?: string;
    }
  }>> {
    const query = `
      SELECT 
        rp.*,
        c.latitude,
        c.longitude,
        c.address
      FROM route_points rp
      JOIN coordinates c ON rp.coordinate_id = c.id
      WHERE rp.route_id = $1
      ORDER BY rp.point_order
    `;

    const results = await this.executeCustomQuery<any>(query, [routeId]);
    return results.map(result => ({
      ...this.transformDatabaseResult(result),
      coordinate: {
        latitude: parseFloat(result.latitude),
        longitude: parseFloat(result.longitude),
        address: result.address
      }
    }));
  }

  /**
   * Mark route point as completed
   */
  async markCompleted(id: string, notes?: string): Promise<RoutePoint | null> {
    return this.update(id, {
      status: 'completed',
      completedAt: new Date(),
      ...(notes !== undefined && { notes })
    });
  }

  /**
   * Mark route point as skipped
   */
  async markSkipped(id: string, notes?: string): Promise<RoutePoint | null> {
    return this.update(id, {
      status: 'skipped',
      ...(notes !== undefined && { notes })
    });
  }

  /**
   * Reorder route points
   */
  async reorderPoints(routeId: string, pointOrders: Array<{ pointId: string; newOrder: number }>): Promise<void> {
    const queries = pointOrders.map(({ pointId, newOrder }) => ({
      query: 'UPDATE route_points SET point_order = $1 WHERE id = $2 AND route_id = $3',
      params: [newOrder, pointId, routeId]
    }));

    await this.executeInTransaction(queries);
  }

  /**
   * Get route completion statistics
   */
  async getRouteCompletionStats(routeId: string): Promise<{
    totalPoints: number;
    completedPoints: number;
    skippedPoints: number;
    pendingPoints: number;
    completionPercentage: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_points,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_points,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped_points,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_points
      FROM route_points
      WHERE route_id = $1
    `;

    const result = await this.executeCustomQuerySingle<any>(query, [routeId]);
    
    if (!result) {
      return {
        totalPoints: 0,
        completedPoints: 0,
        skippedPoints: 0,
        pendingPoints: 0,
        completionPercentage: 0
      };
    }

    const totalPoints = parseInt(result.total_points || '0');
    const completedPoints = parseInt(result.completed_points || '0');
    const completionPercentage = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

    return {
      totalPoints,
      completedPoints: completedPoints,
      skippedPoints: parseInt(result.skipped_points || '0'),
      pendingPoints: parseInt(result.pending_points || '0'),
      completionPercentage: Math.round(completionPercentage * 100) / 100
    };
  }

  /**
   * Delete all points for a route
   */
  async deleteByRoute(routeId: string): Promise<void> {
    await this.executeCustomQuery('DELETE FROM route_points WHERE route_id = $1', [routeId]);
  }

  /**
   * Get next point order for a route
   */
  async getNextPointOrder(routeId: string): Promise<number> {
    const query = `
      SELECT COALESCE(MAX(point_order), 0) + 1 as next_order
      FROM route_points
      WHERE route_id = $1
    `;

    const result = await this.executeCustomQuerySingle<{ next_order: number }>(query, [routeId]);
    return result?.next_order || 1;
  }

  /**
   * Transform database result to match RoutePoint interface
   */
  private transformDatabaseResult(dbResult: any): RoutePoint {
    const result: RoutePoint = {
      id: dbResult.id,
      routeId: dbResult.route_id,
      coordinateId: dbResult.coordinate_id,
      pointOrder: dbResult.point_order,
      estimatedTime: dbResult.estimated_time,
      status: dbResult.status
    };
    
    if (dbResult.completed_at) {
      result.completedAt = new Date(dbResult.completed_at);
    }
    
    if (dbResult.notes) {
      result.notes = dbResult.notes;
    }
    
    return result;
  }
}