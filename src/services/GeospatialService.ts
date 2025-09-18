import { Coordinate, Zone, GeoPoint, GeoPolygon } from '../types';
import { ZoneRepository } from '../repositories/ZoneRepository';

export interface ZoneDetectionResult {
  coordinate: Coordinate;
  detectedZone: Zone | undefined;
  confidence: number; // 0-1, where 1 is highest confidence
}

export interface CoordinateProcessingOptions {
  enableDuplicateDetection: boolean;
  duplicateThresholdMeters: number;
  enableZoneValidation: boolean;
}

export class GeospatialService {
  private zoneRepository: ZoneRepository;
  private readonly EARTH_RADIUS_KM = 6371;
  private readonly DEFAULT_DUPLICATE_THRESHOLD_METERS = 10; // 10 meters

  constructor(zoneRepository?: ZoneRepository) {
    this.zoneRepository = zoneRepository || new ZoneRepository();
  }

  /**
   * Detect which zone contains the given coordinate using optimized database query
   */
  async detectZoneForCoordinate(coordinate: Coordinate): Promise<ZoneDetectionResult> {
    try {
      // Use optimized database function for zone detection
      const zone = await this.zoneRepository.findZoneContainingPoint(
        coordinate.latitude, 
        coordinate.longitude
      );
      
      if (zone) {
        return {
          coordinate,
          detectedZone: zone,
          confidence: 1.0
        };
      }

      // If no exact match, find the closest zone
      const zones = await this.zoneRepository.findAllActive();
      const closestZone = await this.findClosestZone(coordinate, zones);
      
      return {
        coordinate,
        detectedZone: closestZone?.zone,
        confidence: closestZone?.confidence || 0
      };

    } catch (error) {
      console.error('Error detecting zone for coordinate:', error);
      return {
        coordinate,
        detectedZone: undefined,
        confidence: 0
      };
    }
  }

  /**
   * Process multiple coordinates and assign zones
   */
  async processCoordinatesWithZoneMapping(
    coordinates: Coordinate[],
    options: CoordinateProcessingOptions = {
      enableDuplicateDetection: true,
      duplicateThresholdMeters: this.DEFAULT_DUPLICATE_THRESHOLD_METERS,
      enableZoneValidation: true
    }
  ): Promise<{
    processedCoordinates: Coordinate[];
    duplicates: Coordinate[][];
    zoneAssignments: { [coordinateId: string]: string };
    processingErrors: { coordinate: Coordinate; error: string }[];
  }> {
    const processedCoordinates: Coordinate[] = [];
    const duplicates: Coordinate[][] = [];
    const zoneAssignments: { [coordinateId: string]: string } = {};
    const processingErrors: { coordinate: Coordinate; error: string }[] = [];

    // Step 1: Detect duplicates if enabled
    if (options.enableDuplicateDetection) {
      const duplicateGroups = this.detectDuplicateCoordinates(coordinates, options.duplicateThresholdMeters);
      duplicates.push(...duplicateGroups);
    }

    // Step 2: Process each coordinate for zone assignment
    for (const coordinate of coordinates) {
      try {
        if (options.enableZoneValidation) {
          const zoneResult = await this.detectZoneForCoordinate(coordinate);
          
          if (zoneResult.detectedZone) {
            coordinate.zoneId = zoneResult.detectedZone.id;
            zoneAssignments[coordinate.id] = zoneResult.detectedZone.id;
          }
        }

        processedCoordinates.push(coordinate);

      } catch (error) {
        processingErrors.push({
          coordinate,
          error: error instanceof Error ? error.message : 'Unknown processing error'
        });
        // Still add coordinate to processed list even if zone detection fails
        processedCoordinates.push(coordinate);
      }
    }

    return {
      processedCoordinates,
      duplicates,
      zoneAssignments,
      processingErrors
    };
  }

  /**
   * Detect duplicate coordinates within a threshold distance
   */
  detectDuplicateCoordinates(coordinates: Coordinate[], thresholdMeters: number): Coordinate[][] {
    const duplicateGroups: Coordinate[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < coordinates.length; i++) {
      const coord1 = coordinates[i];
      if (!coord1 || processed.has(coord1.id)) continue;

      const duplicateGroup: Coordinate[] = [coord1];
      processed.add(coord1.id);

      for (let j = i + 1; j < coordinates.length; j++) {
        const coord2 = coordinates[j];
        if (!coord2 || processed.has(coord2.id)) continue;

        const distance = this.calculateDistanceMeters(coord1, coord2);
        
        if (distance <= thresholdMeters) {
          duplicateGroup.push(coord2);
          processed.add(coord2.id);
        }
      }

      if (duplicateGroup.length > 1) {
        duplicateGroups.push(duplicateGroup);
      }
    }

    return duplicateGroups;
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  calculateDistanceMeters(coord1: Coordinate, coord2: Coordinate): number {
    const lat1Rad = this.toRadians(coord1.latitude);
    const lat2Rad = this.toRadians(coord2.latitude);
    const deltaLatRad = this.toRadians(coord2.latitude - coord1.latitude);
    const deltaLngRad = this.toRadians(coord2.longitude - coord1.longitude);

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return this.EARTH_RADIUS_KM * c * 1000; // Convert to meters
  }

  /**
   * Check if a point is inside a polygon using ray casting algorithm
   */
  private isPointInPolygon(coordinate: Coordinate, polygon: GeoPolygon): boolean {
    const { latitude: lat, longitude: lng } = coordinate;
    const vertices = polygon.coordinates;
    
    let inside = false;
    
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i]?.longitude || 0;
      const yi = vertices[i]?.latitude || 0;
      const xj = vertices[j]?.longitude || 0;
      const yj = vertices[j]?.latitude || 0;
      
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Find the closest zone to a coordinate
   */
  private async findClosestZone(
    coordinate: Coordinate, 
    zones: Zone[]
  ): Promise<{ zone: Zone; confidence: number } | null> {
    let closestZone: Zone | null = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const centroid = this.calculatePolygonCentroid(zone.boundaries);
      const distance = this.calculateDistanceMeters(coordinate, {
        id: '',
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        createdAt: new Date()
      });

      if (distance < minDistance) {
        minDistance = distance;
        closestZone = zone;
      }
    }

    if (closestZone && minDistance < 50000) { // Within 50km
      const confidence = Math.max(0, 1 - (minDistance / 50000));
      return { zone: closestZone, confidence };
    }

    return null;
  }

  /**
   * Calculate the centroid of a polygon
   */
  private calculatePolygonCentroid(polygon: GeoPolygon): GeoPoint {
    const vertices = polygon.coordinates;
    let centroidLat = 0;
    let centroidLng = 0;

    for (const vertex of vertices) {
      centroidLat += vertex.latitude;
      centroidLng += vertex.longitude;
    }

    return {
      latitude: centroidLat / vertices.length,
      longitude: centroidLng / vertices.length
    };
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Validate coordinate is within reasonable bounds for Colombia
   */
  validateCoordinateForColombia(coordinate: Coordinate): boolean {
    // Colombia approximate bounds
    const COLOMBIA_BOUNDS = {
      north: 13.5,
      south: -4.2,
      east: -66.8,
      west: -81.8
    };

    return (
      coordinate.latitude >= COLOMBIA_BOUNDS.south &&
      coordinate.latitude <= COLOMBIA_BOUNDS.north &&
      coordinate.longitude >= COLOMBIA_BOUNDS.west &&
      coordinate.longitude <= COLOMBIA_BOUNDS.east
    );
  }

  /**
   * Validate if a polygon is geometrically valid
   */
  async validatePolygon(coordinates: GeoPoint[]): Promise<boolean> {
    try {
      // Check minimum number of points for a polygon (at least 3 unique points)
      if (!coordinates || coordinates.length < 3) {
        return false;
      }

      // Check if first and last points are the same (closed polygon)
      const firstPoint = coordinates[0]!;
      const lastPoint = coordinates[coordinates.length - 1]!;
      const isClosed = firstPoint.latitude === lastPoint.latitude && 
                      firstPoint.longitude === lastPoint.longitude;

      // If not closed, add the first point at the end
      const polygonCoords = isClosed ? coordinates : [...coordinates, firstPoint];

      // Check for self-intersections using a simple approach
      if (this.hasSelfintersections(polygonCoords)) {
        return false;
      }

      // Check if polygon has valid area (not zero)
      const area = this.calculatePolygonAreaFromPoints(polygonCoords);
      if (Math.abs(area) < 1e-10) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating polygon:', error);
      return false;
    }
  }

  /**
   * Calculate the area of a polygon in square meters
   */
  async calculatePolygonArea(coordinates: GeoPoint[]): Promise<number> {
    return Math.abs(this.calculatePolygonAreaFromPoints(coordinates));
  }

  /**
   * Calculate the perimeter of a polygon in meters
   */
  async calculatePolygonPerimeter(coordinates: GeoPoint[]): Promise<number> {
    if (!coordinates || coordinates.length < 2) {
      return 0;
    }
    
    let perimeter = 0;
    
    for (let i = 0; i < coordinates.length; i++) {
      const current = coordinates[i]!;
      const next = coordinates[(i + 1) % coordinates.length]!;
      
      const distance = this.calculateDistanceMeters(
        { id: '', latitude: current.latitude, longitude: current.longitude, createdAt: new Date() },
        { id: '', latitude: next.latitude, longitude: next.longitude, createdAt: new Date() }
      );
      
      perimeter += distance;
    }
    
    return perimeter;
  }

  /**
   * Check if polygon has self-intersections
   */
  private hasSelfintersections(coordinates: GeoPoint[]): boolean {
    const n = coordinates.length;
    
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n - 1; j++) {
        // Don't check adjacent edges or edges that share a vertex
        if (j === i + 1 || (i === 0 && j === n - 2)) continue;
        
        const line1 = {
          start: coordinates[i]!,
          end: coordinates[i + 1]!
        };
        
        const line2 = {
          start: coordinates[j]!,
          end: coordinates[j + 1]!
        };
        
        if (this.doLinesIntersect(line1, line2)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if two line segments intersect
   */
  private doLinesIntersect(
    line1: { start: GeoPoint; end: GeoPoint },
    line2: { start: GeoPoint; end: GeoPoint }
  ): boolean {
    const { start: p1, end: q1 } = line1;
    const { start: p2, end: q2 } = line2;
    
    const orientation = (p: GeoPoint, q: GeoPoint, r: GeoPoint): number => {
      const val = (q.longitude - p.longitude) * (r.latitude - q.latitude) - 
                  (q.latitude - p.latitude) * (r.longitude - q.longitude);
      if (Math.abs(val) < 1e-10) return 0; // collinear
      return val > 0 ? 1 : 2; // clockwise or counterclockwise
    };
    
    const onSegment = (p: GeoPoint, q: GeoPoint, r: GeoPoint): boolean => {
      return q.longitude <= Math.max(p.longitude, r.longitude) &&
             q.longitude >= Math.min(p.longitude, r.longitude) &&
             q.latitude <= Math.max(p.latitude, r.latitude) &&
             q.latitude >= Math.min(p.latitude, r.latitude);
    };
    
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);
    
    // General case
    if (o1 !== o2 && o3 !== o4) return true;
    
    // Special cases
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    
    return false;
  }

  /**
   * Calculate polygon area using the shoelace formula (returns signed area)
   */
  private calculatePolygonAreaFromPoints(coordinates: GeoPoint[]): number {
    if (!coordinates || coordinates.length < 3) return 0;
    
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i]!.longitude * coordinates[j]!.latitude;
      area -= coordinates[j]!.longitude * coordinates[i]!.latitude;
    }
    
    // Convert to square meters (approximate for small areas)
    // This is a simplified calculation - for precise area calculation,
    // we would need to account for Earth's curvature
    const DEGREES_TO_METERS_FACTOR = 111320; // Approximate meters per degree at equator
    return Math.abs(area) * DEGREES_TO_METERS_FACTOR * DEGREES_TO_METERS_FACTOR / 2;
  }

  /**
   * Batch process coordinates for zone assignment using optimized queries
   */
  async batchAssignZones(coordinates: Coordinate[]): Promise<{
    assignedCoordinates: Coordinate[];
    unassignedCoordinates: Coordinate[];
    zoneAssignments: { [coordinateId: string]: string };
    processingStats: {
      totalProcessed: number;
      successfulAssignments: number;
      failedAssignments: number;
      processingTimeMs: number;
    };
  }> {
    const startTime = Date.now();
    const assignedCoordinates: Coordinate[] = [];
    const unassignedCoordinates: Coordinate[] = [];
    const zoneAssignments: { [coordinateId: string]: string } = {};

    // Process coordinates in batches for better performance
    const batchSize = 100;
    let successfulAssignments = 0;
    let failedAssignments = 0;

    for (let i = 0; i < coordinates.length; i += batchSize) {
      const batch = coordinates.slice(i, i + batchSize);
      
      for (const coordinate of batch) {
        try {
          const zone = await this.zoneRepository.findZoneContainingPoint(
            coordinate.latitude,
            coordinate.longitude
          );

          if (zone) {
            coordinate.zoneId = zone.id;
            zoneAssignments[coordinate.id] = zone.id;
            assignedCoordinates.push(coordinate);
            successfulAssignments++;
          } else {
            unassignedCoordinates.push(coordinate);
            failedAssignments++;
          }
        } catch (error) {
          console.error(`Error processing coordinate ${coordinate.id}:`, error);
          unassignedCoordinates.push(coordinate);
          failedAssignments++;
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      assignedCoordinates,
      unassignedCoordinates,
      zoneAssignments,
      processingStats: {
        totalProcessed: coordinates.length,
        successfulAssignments,
        failedAssignments,
        processingTimeMs
      }
    };
  }

  /**
   * Calculate the centroid of multiple coordinates
   */
  calculateCentroid(coordinates: Coordinate[]): GeoPoint | null {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }

    let totalLat = 0;
    let totalLng = 0;

    for (const coord of coordinates) {
      totalLat += coord.latitude;
      totalLng += coord.longitude;
    }

    return {
      latitude: totalLat / coordinates.length,
      longitude: totalLng / coordinates.length
    };
  }

  /**
   * Find coordinates within a radius of a center point
   */
  findCoordinatesWithinRadius(
    coordinates: Coordinate[],
    centerPoint: GeoPoint,
    radiusMeters: number
  ): Coordinate[] {
    const centerCoord: Coordinate = {
      id: 'center',
      latitude: centerPoint.latitude,
      longitude: centerPoint.longitude,
      createdAt: new Date()
    };

    return coordinates.filter(coord => {
      const distance = this.calculateDistanceMeters(centerCoord, coord);
      return distance <= radiusMeters;
    });
  }

  /**
   * Calculate bounding box for a set of coordinates
   */
  calculateBoundingBox(coordinates: Coordinate[]): {
    north: number;
    south: number;
    east: number;
    west: number;
    center: GeoPoint;
  } | null {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }

    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;

    for (const coord of coordinates) {
      north = Math.max(north, coord.latitude);
      south = Math.min(south, coord.latitude);
      east = Math.max(east, coord.longitude);
      west = Math.min(west, coord.longitude);
    }

    return {
      north,
      south,
      east,
      west,
      center: {
        latitude: (north + south) / 2,
        longitude: (east + west) / 2
      }
    };
  }

  /**
   * Optimize route points using nearest neighbor algorithm
   */
  optimizeRoutePoints(coordinates: Coordinate[], startPoint?: Coordinate): Coordinate[] {
    if (!coordinates || coordinates.length <= 2) {
      return coordinates;
    }

    const optimized: Coordinate[] = [];
    const remaining = [...coordinates];
    
    // Start with the specified start point or the first coordinate
    let current = startPoint || remaining[0]!;
    if (startPoint) {
      const startIndex = remaining.findIndex(c => c.id === startPoint.id);
      if (startIndex >= 0) {
        remaining.splice(startIndex, 1);
      }
    } else {
      remaining.shift();
    }
    
    optimized.push(current);

    // Use nearest neighbor algorithm
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const distance = this.calculateDistanceMeters(current, remaining[i]!);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      current = remaining[nearestIndex]!;
      optimized.push(current);
      remaining.splice(nearestIndex, 1);
    }

    return optimized;
  }

  /**
   * Clean and normalize coordinate data
   */
  cleanCoordinateData(coordinates: Coordinate[]): {
    cleanedCoordinates: Coordinate[];
    removedCoordinates: Coordinate[];
    cleaningReport: string;
  } {
    const cleanedCoordinates: Coordinate[] = [];
    const removedCoordinates: Coordinate[] = [];
    let normalizedCount = 0;

    for (const coordinate of coordinates) {
      // Check if coordinate is within Colombia bounds
      if (!this.validateCoordinateForColombia(coordinate)) {
        removedCoordinates.push(coordinate);
        continue;
      }

      // Normalize precision to 6 decimal places (approximately 0.1 meter precision)
      const cleanedCoordinate: Coordinate = {
        ...coordinate,
        latitude: Math.round(coordinate.latitude * 1000000) / 1000000,
        longitude: Math.round(coordinate.longitude * 1000000) / 1000000
      };

      if (cleanedCoordinate.latitude !== coordinate.latitude || 
          cleanedCoordinate.longitude !== coordinate.longitude) {
        normalizedCount++;
      }

      cleanedCoordinates.push(cleanedCoordinate);
    }

    const cleaningReport = `
Coordinate Cleaning Report:
- Total coordinates processed: ${coordinates.length}
- Coordinates kept: ${cleanedCoordinates.length}
- Coordinates removed (out of bounds): ${removedCoordinates.length}
- Coordinates normalized (precision adjusted): ${normalizedCount}
    `.trim();

    return {
      cleanedCoordinates,
      removedCoordinates,
      cleaningReport
    };
  }
}