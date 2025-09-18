import { BaseRepository } from './BaseRepository';
import { Inspector, AvailabilitySchedule } from '../types';
import { validateInspector, validateAvailabilitySchedule } from '../schemas/validation';

export class InspectorRepository extends BaseRepository<Inspector> {
  constructor() {
    super('inspectors');
  }

  /**
   * Create a new inspector
   */
  async create(inspectorData: Omit<Inspector, 'id' | 'createdAt' | 'updatedAt'>): Promise<Inspector> {
    const { error, value } = validateInspector(inspectorData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const query = `
      INSERT INTO inspectors (name, identification, email, phone, preferred_zones, max_daily_routes, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<Inspector>(query, [
      value.name,
      value.identification,
      value.email,
      value.phone,
      value.preferredZones,
      value.maxDailyRoutes,
      value.isActive
    ]);

    if (!result) {
      throw new Error('Failed to create inspector');
    }

    return this.transformDatabaseResult(result);
  }

  /**
   * Update an existing inspector
   */
  async update(id: string, inspectorData: Partial<Omit<Inspector, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Inspector | null> {
    const existingInspector = await this.findById(id);
    if (!existingInspector) {
      return null;
    }

    const updatedData = { ...existingInspector, ...inspectorData };
    const { error, value } = validateInspector(updatedData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (inspectorData.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      params.push(value.name);
    }

    if (inspectorData.identification !== undefined) {
      setParts.push(`identification = $${paramIndex++}`);
      params.push(value.identification);
    }

    if (inspectorData.email !== undefined) {
      setParts.push(`email = $${paramIndex++}`);
      params.push(value.email);
    }

    if (inspectorData.phone !== undefined) {
      setParts.push(`phone = $${paramIndex++}`);
      params.push(value.phone);
    }

    if (inspectorData.preferredZones !== undefined) {
      setParts.push(`preferred_zones = $${paramIndex++}`);
      params.push(value.preferredZones);
    }

    if (inspectorData.maxDailyRoutes !== undefined) {
      setParts.push(`max_daily_routes = $${paramIndex++}`);
      params.push(value.maxDailyRoutes);
    }

    if (inspectorData.isActive !== undefined) {
      setParts.push(`is_active = $${paramIndex++}`);
      params.push(value.isActive);
    }

    if (setParts.length === 0) {
      return existingInspector;
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE inspectors 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<Inspector>(query, params);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Find inspector by identification
   */
  async findByIdentification(identification: string): Promise<Inspector | null> {
    const result = await this.findOne('identification = $1', [identification]);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Find active inspectors
   */
  async findActive(): Promise<Inspector[]> {
    const results = await this.findAll('is_active = true');
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find inspectors by preferred zone
   */
  async findByPreferredZone(zoneId: string): Promise<Inspector[]> {
    const query = `
      SELECT * FROM inspectors 
      WHERE $1 = ANY(preferred_zones) AND is_active = true
      ORDER BY name
    `;
    
    const results = await this.executeCustomQuery<Inspector>(query, [zoneId]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Get inspector availability for a specific day
   */
  async getAvailability(inspectorId: string, dayOfWeek?: number): Promise<AvailabilitySchedule[]> {
    let query = `
      SELECT * FROM inspector_availability 
      WHERE inspector_id = $1 AND is_active = true
    `;
    const params: any[] = [inspectorId];

    if (dayOfWeek !== undefined) {
      query += ` AND day_of_week = $2`;
      params.push(dayOfWeek);
    }

    query += ` ORDER BY day_of_week, start_time`;

    const results = await this.executeCustomQuery<any>(query, params);
    return results.map(result => ({
      inspectorId: result.inspector_id,
      dayOfWeek: result.day_of_week,
      startTime: result.start_time,
      endTime: result.end_time,
      isActive: result.is_active
    }));
  }

  /**
   * Set inspector availability
   */
  async setAvailability(inspectorId: string, availability: Omit<AvailabilitySchedule, 'inspectorId'>[]): Promise<void> {
    // Validate all availability entries
    for (const avail of availability) {
      const { error } = validateAvailabilitySchedule({ ...avail, inspectorId });
      if (error) {
        throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    const queries = [
      // First, deactivate all existing availability
      {
        query: 'UPDATE inspector_availability SET is_active = false WHERE inspector_id = $1',
        params: [inspectorId]
      }
    ];

    // Then insert new availability
    for (const avail of availability) {
      queries.push({
        query: `
          INSERT INTO inspector_availability (inspector_id, day_of_week, start_time, end_time, is_active)
          VALUES ($1, $2, $3, $4, $5)
        `,
        params: [inspectorId, avail.dayOfWeek.toString(), avail.startTime, avail.endTime, avail.isActive.toString()]
      });
    }

    await this.executeInTransaction(queries);
  }

  /**
   * Get inspector workload (current assigned routes)
   */
  async getCurrentWorkload(inspectorId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM routes 
      WHERE assigned_inspector_id = $1 
      AND status IN ('assigned', 'in_progress')
    `;

    const result = await this.executeCustomQuerySingle<{ count: string }>(query, [inspectorId]);
    return parseInt(result?.count || '0');
  }

  /**
   * Get inspectors with their current workload
   */
  async findWithWorkload(): Promise<Array<Inspector & { currentWorkload: number }>> {
    const query = `
      SELECT 
        i.*,
        COALESCE(r.route_count, 0) as current_workload
      FROM inspectors i
      LEFT JOIN (
        SELECT 
          assigned_inspector_id,
          COUNT(*) as route_count
        FROM routes 
        WHERE status IN ('assigned', 'in_progress')
        GROUP BY assigned_inspector_id
      ) r ON i.id = r.assigned_inspector_id
      WHERE i.is_active = true
      ORDER BY i.name
    `;

    const results = await this.executeCustomQuery<any>(query);
    return results.map(result => ({
      ...this.transformDatabaseResult(result),
      currentWorkload: parseInt(result.current_workload || '0')
    }));
  }

  /**
   * Transform database result to match Inspector interface
   */
  private transformDatabaseResult(dbResult: any): Inspector {
    return {
      id: dbResult.id,
      name: dbResult.name,
      identification: dbResult.identification,
      email: dbResult.email,
      phone: dbResult.phone,
      preferredZones: dbResult.preferred_zones || [],
      maxDailyRoutes: dbResult.max_daily_routes,
      isActive: dbResult.is_active,
      createdAt: new Date(dbResult.created_at),
      updatedAt: new Date(dbResult.updated_at)
    };
  }
}