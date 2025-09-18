import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import { kml } from '@tmcw/togeojson';
import { GeoPoint, GeoPolygon, Zone } from '../types';

export interface KMZZoneData {
  name: string;
  type: 'metropolitana' | 'rural';
  boundaries: GeoPolygon;
  color?: string | undefined;
  description?: string | undefined;
}

export interface KMZParsingResult {
  zones: KMZZoneData[];
  errors: string[];
  metadata: {
    totalPlacemarks: number;
    processedZones: number;
    skippedPlacemarks: number;
    parsingTimeMs: number;
  };
}

export interface KMZValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  zoneCompleteness: {
    expectedZones: number;
    foundZones: number;
    missingZones: string[];
  };
}

export class KMZParser {
  private readonly EXPECTED_ZONES = [
    'Zona I - Metropolitana Suroriente',
    'Zona II - Metropolitana Suroccidente', 
    'Zona III - Metropolitana Centro Oriente',
    'Zona IV - Metropolitana Centro Occidente',
    'Zona V - Metropolitana Noroccidente',
    'Zona VI - Metropolitana Nororiente',
    'Zona VII - Rural Oriental Norte',
    'Zona VIII - Rural Occidental Norte',
    'Zona IX - Rural Occidental Sur',
    'Zona X - Rural Oriental Sur',
    'Zona XI - Rural Occidental Centro'
  ];

  /**
   * Parse KMZ file and extract zone boundaries with color information
   */
  async parseKMZFile(kmzBuffer: Buffer): Promise<KMZParsingResult> {
    const startTime = Date.now();
    const zones: KMZZoneData[] = [];
    const errors: string[] = [];
    let totalPlacemarks = 0;
    let skippedPlacemarks = 0;

    try {
      // Extract KML from KMZ
      const zip = await JSZip.loadAsync(kmzBuffer);
      const kmlFile = zip.file(/\.kml$/i)[0];
      
      if (!kmlFile) {
        throw new Error('No KML file found in KMZ archive');
      }

      const kmlContent = await kmlFile.async('text');
      
      // Parse KML using DOMParser
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
      
      // Convert KML to GeoJSON
      const geoJson = kml(kmlDoc);
      
      if (!geoJson.features || geoJson.features.length === 0) {
        throw new Error('No features found in KML file');
      }

      totalPlacemarks = geoJson.features.length;

      // Process each feature
      for (const feature of geoJson.features) {
        try {
          const zoneData = this.processKMLFeature(feature);
          if (zoneData) {
            zones.push(zoneData);
          } else {
            skippedPlacemarks++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error processing feature';
          errors.push(`Error processing feature: ${errorMsg}`);
          skippedPlacemarks++;
        }
      }

      const parsingTimeMs = Date.now() - startTime;

      return {
        zones,
        errors,
        metadata: {
          totalPlacemarks,
          processedZones: zones.length,
          skippedPlacemarks,
          parsingTimeMs
        }
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      errors.push(`KMZ parsing failed: ${errorMsg}`);
      
      return {
        zones: [],
        errors,
        metadata: {
          totalPlacemarks: 0,
          processedZones: 0,
          skippedPlacemarks: 0,
          parsingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Process individual KML feature and extract zone data
   */
  private processKMLFeature(feature: any): KMZZoneData | null {
    if (!feature.properties || !feature.geometry) {
      return null;
    }

    const name = feature.properties.name;
    if (!name || typeof name !== 'string') {
      return null;
    }

    // Check if this is one of our expected zones
    const matchedZone = this.EXPECTED_ZONES.find(expectedZone => 
      this.normalizeZoneName(name).includes(this.normalizeZoneName(expectedZone)) ||
      this.normalizeZoneName(expectedZone).includes(this.normalizeZoneName(name))
    );

    if (!matchedZone) {
      return null;
    }

    // Extract geometry
    const boundaries = this.extractPolygonFromGeometry(feature.geometry);
    if (!boundaries) {
      return null;
    }

    // Determine zone type
    const type = matchedZone.toLowerCase().includes('metropolitana') ? 'metropolitana' : 'rural';

    // Extract color information
    const color = this.extractColorFromFeature(feature);

    return {
      name: matchedZone,
      type,
      boundaries,
      color: color || undefined,
      description: feature.properties.description || undefined
    };
  }

  /**
   * Extract polygon coordinates from GeoJSON geometry
   */
  private extractPolygonFromGeometry(geometry: any): GeoPolygon | null {
    if (!geometry || !geometry.coordinates) {
      return null;
    }

    let coordinates: number[][];

    switch (geometry.type) {
      case 'Polygon':
        coordinates = geometry.coordinates[0]; // Take exterior ring
        break;
      case 'MultiPolygon':
        // Take the largest polygon
        const polygons = geometry.coordinates;
        let largestPolygon = polygons[0][0];
        let largestArea = this.calculatePolygonArea(largestPolygon);
        
        for (let i = 1; i < polygons.length; i++) {
          const polygon = polygons[i][0];
          const area = this.calculatePolygonArea(polygon);
          if (area > largestArea) {
            largestPolygon = polygon;
            largestArea = area;
          }
        }
        coordinates = largestPolygon;
        break;
      default:
        return null;
    }

    if (!coordinates || coordinates.length < 3) {
      return null;
    }

    // Convert to GeoPoint format
    const geoPoints: GeoPoint[] = coordinates.map(coord => ({
      longitude: coord[0] || 0,
      latitude: coord[1] || 0
    }));

    return {
      type: 'Polygon',
      coordinates: geoPoints
    };
  }

  /**
   * Extract color information from KML feature
   */
  private extractColorFromFeature(feature: any): string | undefined {
    // Try to extract color from various possible locations
    const properties = feature.properties || {};
    
    // Check for style information
    if (properties.styleUrl) {
      // This would require parsing the style from the KML document
      // For now, we'll use a default mapping based on zone name
      return this.getDefaultZoneColor(properties.name);
    }

    // Check for direct color properties
    if (properties.fill || properties.color || properties['marker-color']) {
      return properties.fill || properties.color || properties['marker-color'];
    }

    // Check for stroke color
    if (properties.stroke || properties['stroke-color']) {
      return properties.stroke || properties['stroke-color'];
    }

    // Fallback to default color based on zone name
    return this.getDefaultZoneColor(properties.name);
  }

  /**
   * Get default color for zone based on name
   */
  private getDefaultZoneColor(zoneName: string): string {
    const colorMap: { [key: string]: string } = {
      'zona i': '#FF0000',      // Red
      'zona ii': '#00FF00',     // Green  
      'zona iii': '#0000FF',    // Blue
      'zona iv': '#FFFF00',     // Yellow
      'zona v': '#FF00FF',      // Magenta
      'zona vi': '#00FFFF',     // Cyan
      'zona vii': '#FFA500',    // Orange
      'zona viii': '#800080',   // Purple
      'zona ix': '#FFC0CB',     // Pink
      'zona x': '#A52A2A',      // Brown
      'zona xi': '#808080'      // Gray
    };

    const normalizedName = this.normalizeZoneName(zoneName);
    
    for (const [key, color] of Object.entries(colorMap)) {
      if (normalizedName.includes(key)) {
        return color;
      }
    }

    return '#000000'; // Default black
  }

  /**
   * Normalize zone name for comparison
   */
  private normalizeZoneName(name: string): string {
    return name.toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  /**
   * Calculate approximate area of polygon for comparison
   */
  private calculatePolygonArea(coordinates: number[][]): number {
    if (!coordinates || coordinates.length < 3) {
      return 0;
    }

    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const coord_i = coordinates[i];
      const coord_j = coordinates[j];
      if (coord_i && coord_j && coord_i[0] !== undefined && coord_i[1] !== undefined && coord_j[0] !== undefined && coord_j[1] !== undefined) {
        area += coord_i[0] * coord_j[1];
        area -= coord_j[0] * coord_i[1];
      }
    }

    return Math.abs(area) / 2;
  }

  /**
   * Validate parsed KMZ data for completeness and accuracy
   */
  async validateKMZData(zones: KMZZoneData[]): Promise<KMZValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check zone completeness
    const foundZoneNames = zones.map(z => z.name);
    const missingZones = this.EXPECTED_ZONES.filter(expected => 
      !foundZoneNames.some(found => 
        this.normalizeZoneName(found) === this.normalizeZoneName(expected)
      )
    );

    if (missingZones.length > 0) {
      errors.push(`Missing zones: ${missingZones.join(', ')}`);
    }

    // Validate each zone
    for (const zone of zones) {
      // Check boundaries
      if (!zone.boundaries || !zone.boundaries.coordinates || zone.boundaries.coordinates.length < 3) {
        errors.push(`Zone "${zone.name}" has invalid boundaries`);
        continue;
      }

      // Check if polygon is closed
      const coords = zone.boundaries.coordinates;
      const first = coords[0];
      const last = coords[coords.length - 1];
      
      if (first && last && (
        Math.abs(first.latitude - last.latitude) > 0.000001 ||
        Math.abs(first.longitude - last.longitude) > 0.000001
      )) {
        warnings.push(`Zone "${zone.name}" polygon may not be properly closed`);
      }

      // Check coordinate bounds for Colombia
      for (const coord of coords) {
        if (coord.latitude < -4.2 || coord.latitude > 13.5 ||
            coord.longitude < -81.8 || coord.longitude > -66.8) {
          warnings.push(`Zone "${zone.name}" has coordinates outside Colombia bounds`);
          break;
        }
      }

      // Check minimum area
      const area = this.calculatePolygonArea(
        coords.map(c => [c.longitude, c.latitude])
      );
      
      if (area < 0.001) { // Very small area threshold
        warnings.push(`Zone "${zone.name}" has very small area, may be invalid`);
      }
    }

    // Check for overlapping zones
    const overlaps = await this.detectZoneOverlaps(zones);
    if (overlaps.length > 0) {
      warnings.push(`Potential zone overlaps detected: ${overlaps.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      zoneCompleteness: {
        expectedZones: this.EXPECTED_ZONES.length,
        foundZones: zones.length,
        missingZones
      }
    };
  }

  /**
   * Detect potential overlaps between zones
   */
  private async detectZoneOverlaps(zones: KMZZoneData[]): Promise<string[]> {
    const overlaps: string[] = [];
    
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const zone1 = zones[i];
        const zone2 = zones[j];
        
        if (zone1 && zone2 && this.doPolygonsOverlap(zone1.boundaries, zone2.boundaries)) {
          overlaps.push(`${zone1.name} and ${zone2.name}`);
        }
      }
    }
    
    return overlaps;
  }

  /**
   * Simple polygon overlap detection
   */
  private doPolygonsOverlap(poly1: GeoPolygon, poly2: GeoPolygon): boolean {
    // Simple bounding box check first
    const bbox1 = this.calculateBoundingBox(poly1.coordinates);
    const bbox2 = this.calculateBoundingBox(poly2.coordinates);
    
    return !(bbox1.maxLng < bbox2.minLng || bbox2.maxLng < bbox1.minLng ||
             bbox1.maxLat < bbox2.minLat || bbox2.maxLat < bbox1.minLat);
  }

  /**
   * Calculate bounding box for polygon
   */
  private calculateBoundingBox(coordinates: GeoPoint[]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    for (const coord of coordinates) {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLng = Math.min(minLng, coord.longitude);
      maxLng = Math.max(maxLng, coord.longitude);
    }
    
    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Convert KMZ zone data to database-compatible format
   */
  convertToPostGISFormat(zones: KMZZoneData[]): Array<Omit<Zone, 'id' | 'createdAt' | 'updatedAt'>> {
    return zones.map(zone => ({
      name: zone.name,
      type: zone.type,
      boundaries: zone.boundaries,
      isActive: true
    }));
  }

  /**
   * Generate zone color mapping for frontend visualization
   */
  generateColorMapping(zones: KMZZoneData[]): { [zoneName: string]: string } {
    const colorMapping: { [zoneName: string]: string } = {};
    
    for (const zone of zones) {
      colorMapping[zone.name] = zone.color || this.getDefaultZoneColor(zone.name);
    }
    
    return colorMapping;
  }
}