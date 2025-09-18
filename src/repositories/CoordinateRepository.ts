import { BaseRepository } from './BaseRepository';
import { Coordinate } from '../types';
import { validateCoordinate } from '../schemas/validation';

export class CoordinateRepository extends BaseRepository<Coordinate> {
  constructor() {
    super('coordinates');
  }

  /**
   * Create a new coordinate
   */
  async create(coordinateData: Omit<Coordinate, 'id' | 'createdAt'>): Promise<Coordinate> {
    const { error, value } = validateCoordinate(coordinateData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const query = `
      INSERT INTO coordinates (latitude, longitude, address, zone_id, imported_from)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<Coordinate>(query, [
      value.latitude,
      value.longitude,
      value.address,
      value.zoneId,
      value.importedFrom
    ]);

    if (!result) {
      throw new Error('Failed to create coordinate');
    }

    return this.transformDatabaseResult(result);
  }

  /**
   * Bulk create coordinates
   */
  async createBulk(coordinates: Omit<Coordinate, 'id' | 'createdAt'>[]): Promise<Coordinate[]> {
    if (coordinates.length === 0) {
      return [];
    }

    // Validate all coordinates
    for (const coord of coordinates) {
      const { error } = validateCoordinate(coord);
      if (error) {
        throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    coordinates.forEach((coord) => {
      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      params.push(coord.latitude, coord.longitude, coord.address, coord.zoneId, coord.importedFrom);
    });

    const query = `
      INSERT INTO coordinates (latitude, longitude, address, zone_id, imported_from)
      VALUES ${values.join(', ')}
      RETURNING *
    `;

    const results = await this.executeCustomQuery<Coordinate>(query, params);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Update an existing coordinate
   */
  async update(id: string, coordinateData: Partial<Omit<Coordinate, 'id' | 'createdAt'>>): Promise<Coordinate | null> {
    const existingCoordinate = await this.findById(id);
    if (!existingCoordinate) {
      return null;
    }

    const updatedData = { ...existingCoordinate, ...coordinateData };
    const { error, value } = validateCoordinate(updatedData);
    if (error) {
      throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
    }

    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (coordinateData.latitude !== undefined) {
      setParts.push(`latitude = $${paramIndex++}`);
      params.push(value.latitude);
    }

    if (coordinateData.longitude !== undefined) {
      setParts.push(`longitude = $${paramIndex++}`);
      params.push(value.longitude);
    }

    if (coordinateData.address !== undefined) {
      setParts.push(`address = $${paramIndex++}`);
      params.push(value.address);
    }

    if (coordinateData.zoneId !== undefined) {
      setParts.push(`zone_id = $${paramIndex++}`);
      params.push(value.zoneId);
    }

    if (coordinateData.importedFrom !== undefined) {
      setParts.push(`imported_from = $${paramIndex++}`);
      params.push(value.importedFrom);
    }

    if (setParts.length === 0) {
      return existingCoordinate;
    }

    params.push(id);

    const query = `
      UPDATE coordinates 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.executeCustomQuerySingle<Coordinate>(query, params);
    return result ? this.transformDatabaseResult(result) : null;
  }

  /**
   * Find coordinates by zone
   */
  async findByZone(zoneId: string): Promise<Coordinate[]> {
    const results = await this.findAll('zone_id = $1', [zoneId]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find coordinates within a radius of a point
   */
  async findWithinRadius(latitude: number, longitude: number, radiusKm: number): Promise<Coordinate[]> {
    const query = `
      SELECT *,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1000 as distance_km
      FROM coordinates
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3 * 1000
      )
      ORDER BY distance_km
    `;

    const results = await this.executeCustomQuery<any>(query, [latitude, longitude, radiusKm]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Find coordinates by import source
   */
  async findByImportSource(importedFrom: string): Promise<Coordinate[]> {
    const results = await this.findAll('imported_from = $1', [importedFrom]);
    return results.map(result => this.transformDatabaseResult(result));
  }

  /**
   * Auto-assign zones to coordinates without zone assignment
   */
  async autoAssignZones(): Promise<number> {
    const query = `
      UPDATE coordinates 
      SET zone_id = z.id
      FROM zones z
      WHERE coordinates.zone_id IS NULL
      AND ST_Contains(z.boundaries, coordinates.point)
      AND z.is_active = true
    `;

    const result = await this.executeCustomQuery(query);
    return result.length;
  }

  /**
   * Get coordinates statistics by zone
   */
  async getStatsByZone(): Promise<Array<{ zoneId: string; zoneName: string; count: number }>> {
    const query = `
      SELECT 
        z.id as zone_id,
        z.name as zone_name,
        COUNT(c.id) as count
      FROM zones z
      LEFT JOIN coordinates c ON z.id = c.zone_id
      WHERE z.is_active = true
      GROUP BY z.id, z.name
      ORDER BY z.name
    `;

    const results = await this.executeCustomQuery<any>(query);
    return results.map(result => ({
      zoneId: result.zone_id,
      zoneName: result.zone_name,
      count: parseInt(result.count || '0')
    }));
  }

  /**
   * Find duplicate coordinates (same lat/lng)
   */
  async findDuplicates(): Promise<Array<{ latitude: number; longitude: number; count: number; ids: string[] }>> {
    const query = `
      SELECT 
        latitude,
        longitude,
        COUNT(*) as count,
        ARRAY_AGG(id) as ids
      FROM coordinates
      GROUP BY latitude, longitude
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const results = await this.executeCustomQuery<any>(query);
    return results.map(result => ({
      latitude: parseFloat(result.latitude),
      longitude: parseFloat(result.longitude),
      count: parseInt(result.count),
      ids: result.ids
    }));
  }

  /**
   * Calculate distance between two coordinates
   */
  async calculateDistance(coord1Id: string, coord2Id: string): Promise<number | null> {
    const query = `
      SELECT ST_Distance(
        c1.point::geography,
        c2.point::geography
      ) / 1000 as distance_km
      FROM coordinates c1, coordinates c2
      WHERE c1.id = $1 AND c2.id = $2
    `;

    const result = await this.executeCustomQuerySingle<{ distance_km: string }>(query, [coord1Id, coord2Id]);
    return result ? parseFloat(result.distance_km) : null;
  }

  /**
   * Transform database result to match Coordinate interface
   */
  private transformDatabaseResult(dbResult: any): Coordinate {
    return {
      id: dbResult.id,
      latitude: parseFloat(dbResult.latitude),
      longitude: parseFloat(dbResult.longitude),
      address: dbResult.address,
      zoneId: dbResult.zone_id,
      importedFrom: dbResult.imported_from,
      createdAt: new Date(dbResult.created_at)
    };
  }
}