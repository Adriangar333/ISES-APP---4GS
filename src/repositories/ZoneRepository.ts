import { BaseRepository } from './BaseRepository';
import { Zone, GeoPoint } from '../types';
import { validateZone } from '../schemas/validation';

export class ZoneRepository extends BaseRepository<Zone> {
  constructor() {
    super('zones');
  }

  /**
   * Create a new zone
   */
  async create(zoneData: Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>): Promise<Zone> {
    const { error, value } = validateZone(zoneData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const query = `
      INSERT INTO zones (name, type, boundaries, is_active)
      VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4)
      RETURNING id, name, type, ST_AsGeoJSON(boundaries)::json as boundaries, is_active, created_at, updated_at
    `;

    const boundariesGeoJSON = {
      type: 'Polygon',
      coordinates: [value.boundaries.coordinates.map((point: GeoPoint) => [point.longitude, point.latitude])]
    };

    const result = await this.executeCustomQuerySingle<Zone>(query, [
      value.name,
      value.type,
      JSON.stringify(boundariesGeoJSON),
      value.isActive
    ]);

    if (!result) {
      throw new Error('Failed to create zone');
    }

    return this.transformDatabaseResult(result);
  }

  /**
   * Update an existing zone
   */
  async update(id: string, zoneData: Partial<Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Zone | null> {
    const existingZone = await this.findById(id);
    if (!existingZone) {
      return null;
    }

    const updatedData = { ...existingZone, ...zoneData };
    const { error, value } = validateZone(updatedData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (zoneData.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      params.push(value.name);
    }

    if (zoneData.type !== undefined) {
      setParts.push(`type = $${paramIndex++}`);
      params.push(value.type);
    }

    if (zoneData.boundaries !== undefined) {
      const boundariesGeoJSON = {
        type: 'Polygon',
        coordinates: [value.boundaries.coordinates.map((point: GeoPoint) => [point.longitude, point.latitude])]
      };
      setParts.push(`boundaries = ST_GeomFromGeoJSON($${paramIndex++})`);
      params.push(JSON.stringify(boundariesGeoJSON));
    }

    if (zoneData.isActive !== undefined) {
      setParts.push(`is_active = $${paramIndex++}`);
      params.push(value.isActive);
    }

    if (setParts.length === 0) {
      return existingZone;
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE zones 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, type, ST_AsGeoJSON(boundaries)::json as boundaries, is_active, created_at, updated_at
    `;

    const result = await this.executeCustomQuerySingle<Zone>(query, params);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Find zones by type
   */
  async findByType(type: 'metropolitana' | 'rural'): Promise<Zone[]> {
    const query = `
      SELECT id, name, type, ST_AsGeoJSON(boundaries)::json as boundaries, is_active, created_at, updated_at
      FROM zones 
      WHERE type = $1 AND is_active = true
      ORDER BY name
    `;
    
    const results = await this.executeCustomQuery<Zone>(query, [type]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find zone containing a specific point
   */
  async findZoneContainingPoint(latitude: number, longitude: number): Promise<Zone | null> {
    const query = `
      SELECT id, name, type, ST_AsGeoJSON(boundaries)::json as boundaries, is_active, created_at, updated_at
      FROM zones 
      WHERE ST_Contains(boundaries, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      AND is_active = true
      LIMIT 1
    `;
    
    const result = await this.executeCustomQuerySingle<Zone>(query, [longitude, latitude]);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Get all active zones with their boundaries
   */
  async findAllActive(): Promise<Zone[]> {
    const query = `
      SELECT id, name, type, ST_AsGeoJSON(boundaries)::json as boundaries, is_active, created_at, updated_at
      FROM zones 
      WHERE is_active = true
      ORDER BY 
        CASE 
          WHEN type = 'metropolitana' THEN 1 
          ELSE 2 
        END,
        name
    `;
    
    const results = await this.executeCustomQuery<Zone>(query);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Check if zones overlap
   */
  async checkZoneOverlap(boundaries: GeoPoint[], excludeZoneId?: string): Promise<boolean> {
    const boundariesGeoJSON = {
      type: 'Polygon',
      coordinates: [boundaries.map(point => [point.longitude, point.latitude])]
    };

    let query = `
      SELECT COUNT(*) as count
      FROM zones 
      WHERE ST_Overlaps(boundaries, ST_GeomFromGeoJSON($1))
      AND is_active = true
    `;

    const params: any[] = [JSON.stringify(boundariesGeoJSON)];

    if (excludeZoneId) {
      query += ` AND id != $2`;
      params.push(excludeZoneId);
    }

    const result = await this.executeCustomQuerySingle<{ count: string }>(query, params);
    return parseInt(result?.count || '0') > 0;
  }

  /**
   * Transform database result to match Zone interface
   */
  private transformDatabaseResult(dbResult: any): Zone {
    return {
      id: dbResult.id,
      name: dbResult.name,
      type: dbResult.type,
      boundaries: {
        type: 'Polygon',
        coordinates: dbResult.boundaries.coordinates[0].map((coord: [number, number]) => ({
          longitude: coord[0],
          latitude: coord[1]
        }))
      },
      isActive: dbResult.is_active,
      createdAt: new Date(dbResult.created_at),
      updatedAt: new Date(dbResult.updated_at)
    };
  }
}