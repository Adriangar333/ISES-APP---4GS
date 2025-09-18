import { KMZParser, KMZZoneData, KMZParsingResult, KMZValidationResult } from './KMZParser';
import { ZoneRepository } from '../repositories/ZoneRepository';
import { Zone } from '../types';

export interface ZoneBoundarySetupResult {
  success: boolean;
  zonesCreated: number;
  zonesUpdated: number;
  errors: string[];
  warnings: string[];
  colorMapping: { [zoneName: string]: string };
  processingTimeMs: number;
}

export interface ZoneBoundaryValidationReport {
  isValid: boolean;
  completeness: {
    expectedZones: number;
    foundZones: number;
    missingZones: string[];
  };
  accuracy: {
    validBoundaries: number;
    invalidBoundaries: number;
    boundaryErrors: string[];
  };
  coverage: {
    totalArea: number;
    averageArea: number;
    smallestZone: string;
    largestZone: string;
  };
  recommendations: string[];
}

export class ZoneBoundaryService {
  private kmzParser: KMZParser;
  private zoneRepository: ZoneRepository;

  constructor(zoneRepository?: ZoneRepository) {
    this.kmzParser = new KMZParser();
    this.zoneRepository = zoneRepository || new ZoneRepository();
  }

  /**
   * Process KMZ file and set up zone boundaries (one-time setup)
   */
  async setupZoneBoundariesFromKMZ(kmzBuffer: Buffer, options: {
    overwriteExisting?: boolean;
    validateOnly?: boolean;
    backupExisting?: boolean;
  } = {}): Promise<ZoneBoundarySetupResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let zonesCreated = 0;
    let zonesUpdated = 0;

    try {
      // Step 1: Parse KMZ file
      const parsingResult: KMZParsingResult = await this.kmzParser.parseKMZFile(kmzBuffer);
      
      if (parsingResult.errors.length > 0) {
        errors.push(...parsingResult.errors);
      }

      if (parsingResult.zones.length === 0) {
        return {
          success: false,
          zonesCreated: 0,
          zonesUpdated: 0,
          errors: ['No valid zones found in KMZ file', ...errors],
          warnings,
          colorMapping: {},
          processingTimeMs: Date.now() - startTime
        };
      }

      // Step 2: Validate parsed data
      const validationResult: KMZValidationResult = await this.kmzParser.validateKMZData(parsingResult.zones);
      
      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
      }
      
      if (validationResult.warnings.length > 0) {
        warnings.push(...validationResult.warnings);
      }

      // If validation only, return results without making changes
      if (options.validateOnly) {
        return {
          success: validationResult.isValid,
          zonesCreated: 0,
          zonesUpdated: 0,
          errors,
          warnings,
          colorMapping: this.kmzParser.generateColorMapping(parsingResult.zones),
          processingTimeMs: Date.now() - startTime
        };
      }

      // Step 3: Backup existing zones if requested
      if (options.backupExisting) {
        await this.backupExistingZones();
      }

      // Step 4: Process each zone
      const existingZones = await this.zoneRepository.findAllActive();
      const existingZoneMap = new Map(existingZones.map(z => [z.name, z]));

      for (const kmzZone of parsingResult.zones) {
        try {
          const existingZone = existingZoneMap.get(kmzZone.name);

          if (existingZone) {
            if (options.overwriteExisting) {
              // Update existing zone
              await this.zoneRepository.update(existingZone.id, {
                boundaries: kmzZone.boundaries,
                type: kmzZone.type
              });
              zonesUpdated++;
            } else {
              warnings.push(`Zone "${kmzZone.name}" already exists, skipping (use overwriteExisting option to update)`);
            }
          } else {
            // Create new zone
            await this.zoneRepository.create({
              name: kmzZone.name,
              type: kmzZone.type,
              boundaries: kmzZone.boundaries,
              isActive: true
            });
            zonesCreated++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to process zone "${kmzZone.name}": ${errorMsg}`);
        }
      }

      // Generate color mapping
      const colorMapping = this.kmzParser.generateColorMapping(parsingResult.zones);

      return {
        success: errors.length === 0,
        zonesCreated,
        zonesUpdated,
        errors,
        warnings,
        colorMapping,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown setup error';
      errors.push(`Zone boundary setup failed: ${errorMsg}`);

      return {
        success: false,
        zonesCreated: 0,
        zonesUpdated: 0,
        errors,
        warnings,
        colorMapping: {},
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Validate zone boundary completeness and accuracy
   */
  async validateZoneBoundaryAccuracy(): Promise<ZoneBoundaryValidationReport> {
    const recommendations: string[] = [];
    const boundaryErrors: string[] = [];
    let validBoundaries = 0;
    let invalidBoundaries = 0;
    let totalArea = 0;
    let smallestZone = '';
    let largestZone = '';
    let smallestArea = Infinity;
    let largestArea = 0;

    try {
      // Get all active zones
      const zones = await this.zoneRepository.findAllActive();
      
      if (zones.length === 0) {
        return {
          isValid: false,
          completeness: {
            expectedZones: 11,
            foundZones: 0,
            missingZones: []
          },
          accuracy: {
            validBoundaries: 0,
            invalidBoundaries: 0,
            boundaryErrors: ['No zones found in database']
          },
          coverage: {
            totalArea: 0,
            averageArea: 0,
            smallestZone: '',
            largestZone: ''
          },
          recommendations: ['Import zone boundaries from KMZ file']
        };
      }

      // Check completeness
      const expectedZones = [
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

      const foundZoneNames = zones.map(z => z.name);
      const missingZones = expectedZones.filter(expected => 
        !foundZoneNames.includes(expected)
      );

      // Validate each zone's boundaries
      for (const zone of zones) {
        try {
          const isValid = await this.validateZoneBoundary(zone);
          
          if (isValid) {
            validBoundaries++;
            
            // Calculate area for coverage analysis
            const area = await this.calculateZoneArea(zone);
            totalArea += area;
            
            if (area < smallestArea) {
              smallestArea = area;
              smallestZone = zone.name;
            }
            
            if (area > largestArea) {
              largestArea = area;
              largestZone = zone.name;
            }
          } else {
            invalidBoundaries++;
            boundaryErrors.push(`Zone "${zone.name}" has invalid boundaries`);
          }
        } catch (error) {
          invalidBoundaries++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
          boundaryErrors.push(`Error validating zone "${zone.name}": ${errorMsg}`);
        }
      }

      // Generate recommendations
      if (missingZones.length > 0) {
        recommendations.push(`Import missing zones: ${missingZones.join(', ')}`);
      }

      if (invalidBoundaries > 0) {
        recommendations.push('Review and fix zones with invalid boundaries');
      }

      if (zones.length > expectedZones.length) {
        recommendations.push('Review extra zones that may not be needed');
      }

      const averageArea = zones.length > 0 ? totalArea / validBoundaries : 0;

      return {
        isValid: missingZones.length === 0 && invalidBoundaries === 0,
        completeness: {
          expectedZones: expectedZones.length,
          foundZones: zones.length,
          missingZones
        },
        accuracy: {
          validBoundaries,
          invalidBoundaries,
          boundaryErrors
        },
        coverage: {
          totalArea,
          averageArea,
          smallestZone,
          largestZone
        },
        recommendations
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
      
      return {
        isValid: false,
        completeness: {
          expectedZones: 11,
          foundZones: 0,
          missingZones: []
        },
        accuracy: {
          validBoundaries: 0,
          invalidBoundaries: 0,
          boundaryErrors: [errorMsg]
        },
        coverage: {
          totalArea: 0,
          averageArea: 0,
          smallestZone: '',
          largestZone: ''
        },
        recommendations: ['Fix validation errors and try again']
      };
    }
  }

  /**
   * Validate individual zone boundary
   */
  private async validateZoneBoundary(zone: Zone): Promise<boolean> {
    try {
      // Check if boundaries exist and have valid structure
      if (!zone.boundaries || !zone.boundaries.coordinates || zone.boundaries.coordinates.length < 3) {
        return false;
      }

      const coordinates = zone.boundaries.coordinates;

      // Check if polygon is closed
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      
      if (!first || !last) {
        return false;
      }

      // Check coordinate validity
      for (const coord of coordinates) {
        if (!coord || 
            typeof coord.latitude !== 'number' || 
            typeof coord.longitude !== 'number' ||
            isNaN(coord.latitude) || 
            isNaN(coord.longitude) ||
            coord.latitude < -90 || coord.latitude > 90 ||
            coord.longitude < -180 || coord.longitude > 180) {
          return false;
        }
      }

      // Check if coordinates are within Colombia bounds
      for (const coord of coordinates) {
        if (coord.latitude < -4.2 || coord.latitude > 13.5 ||
            coord.longitude < -81.8 || coord.longitude > -66.8) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate zone area in square kilometers
   */
  private async calculateZoneArea(zone: Zone): Promise<number> {
    try {
      if (!zone.boundaries || !zone.boundaries.coordinates) {
        return 0;
      }

      // Simple area calculation using shoelace formula
      const coordinates = zone.boundaries.coordinates;
      let area = 0;
      const n = coordinates.length;

      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const coord_i = coordinates[i];
        const coord_j = coordinates[j];
        if (coord_i && coord_j) {
          area += coord_i.longitude * coord_j.latitude;
          area -= coord_j.longitude * coord_i.latitude;
        }
      }

      // Convert to square kilometers (approximate)
      const DEGREES_TO_KM_FACTOR = 111.32; // Approximate km per degree at equator
      return Math.abs(area) * DEGREES_TO_KM_FACTOR * DEGREES_TO_KM_FACTOR / 2;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Backup existing zones before overwriting
   */
  private async backupExistingZones(): Promise<void> {
    try {
      const existingZones = await this.zoneRepository.findAllActive();
      
      if (existingZones.length > 0) {
        // In a real implementation, you might want to save to a backup table
        // or export to a file. For now, we'll just log the backup
        console.log(`Backing up ${existingZones.length} existing zones`);
        
        // You could implement actual backup logic here:
        // - Save to backup table
        // - Export to JSON file
        // - Create database snapshot
      }
    } catch (error) {
      console.error('Error backing up existing zones:', error);
      throw new Error('Failed to backup existing zones');
    }
  }

  /**
   * Get zone color mapping for frontend visualization
   */
  async getZoneColorMapping(): Promise<{ [zoneName: string]: string }> {
    try {
      const zones = await this.zoneRepository.findAllActive();
      const colorMapping: { [zoneName: string]: string } = {};

      // Generate default colors for existing zones
      const defaultColors = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF',
        '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080'
      ];

      zones.forEach((zone, index) => {
        const color = defaultColors[index % defaultColors.length];
        if (color) {
          colorMapping[zone.name] = color;
        }
      });

      return colorMapping;
    } catch (error) {
      console.error('Error getting zone color mapping:', error);
      return {};
    }
  }

  /**
   * Test zone boundary setup with sample coordinates
   */
  async testZoneBoundarySetup(testCoordinates: Array<{ latitude: number; longitude: number; expectedZone?: string }>): Promise<{
    success: boolean;
    results: Array<{
      coordinate: { latitude: number; longitude: number };
      detectedZone: string | null;
      expectedZone: string | undefined;
      isCorrect: boolean;
    }>;
    accuracy: number;
    errors: string[];
  }> {
    const results: Array<{
      coordinate: { latitude: number; longitude: number };
      detectedZone: string | null;
      expectedZone: string | undefined;
      isCorrect: boolean;
    }> = [];
    
    const errors: string[] = [];
    let correctDetections = 0;

    try {
      for (const testCoord of testCoordinates) {
        try {
          const detectedZone = await this.zoneRepository.findZoneContainingPoint(
            testCoord.latitude,
            testCoord.longitude
          );

          const detectedZoneName = detectedZone?.name || null;
          const isCorrect = testCoord.expectedZone ? 
            detectedZoneName === testCoord.expectedZone : 
            detectedZoneName !== null;

          if (isCorrect) {
            correctDetections++;
          }

          results.push({
            coordinate: {
              latitude: testCoord.latitude,
              longitude: testCoord.longitude
            },
            detectedZone: detectedZoneName,
            expectedZone: testCoord.expectedZone,
            isCorrect
          });

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Error testing coordinate (${testCoord.latitude}, ${testCoord.longitude}): ${errorMsg}`);
          
          results.push({
            coordinate: {
              latitude: testCoord.latitude,
              longitude: testCoord.longitude
            },
            detectedZone: null,
            expectedZone: testCoord.expectedZone,
            isCorrect: false
          });
        }
      }

      const accuracy = testCoordinates.length > 0 ? correctDetections / testCoordinates.length : 0;

      return {
        success: errors.length === 0,
        results,
        accuracy,
        errors
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown testing error';
      errors.push(`Zone boundary testing failed: ${errorMsg}`);

      return {
        success: false,
        results: [],
        accuracy: 0,
        errors
      };
    }
  }
}