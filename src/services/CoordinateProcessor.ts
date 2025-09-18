import { Coordinate, ImportedData, ValidationError } from '../types';
import { ExcelParser, ExcelImportRequest } from './ExcelParser';
import { GeospatialService, CoordinateProcessingOptions } from './GeospatialService';
import { ZoneRepository } from '../repositories/ZoneRepository';
import { CoordinateRepository } from '../repositories/CoordinateRepository';

export interface ProcessingResult {
  importedData: ImportedData;
  zoneAssignments: { [coordinateId: string]: string };
  duplicates: Coordinate[][];
  cleaningReport: string;
  processingErrors: { coordinate: Coordinate; error: string }[];
}

export interface CoordinateTransformationPipeline {
  enableExcelParsing: boolean;
  enableZoneMapping: boolean;
  enableDuplicateDetection: boolean;
  enableDataCleaning: boolean;
  enableDatabaseStorage: boolean;
  duplicateThresholdMeters: number;
}

export class CoordinateProcessor {
  private excelParser: ExcelParser;
  private geospatialService: GeospatialService;
  private coordinateRepository: CoordinateRepository;

  constructor(
    zoneRepository: ZoneRepository,
    coordinateRepository: CoordinateRepository
  ) {
    this.excelParser = new ExcelParser();
    this.geospatialService = new GeospatialService(zoneRepository);
    this.coordinateRepository = coordinateRepository;
  }

  /**
   * Complete data transformation pipeline from Excel to database
   */
  async processExcelToDatabase(
    request: ExcelImportRequest,
    pipeline: CoordinateTransformationPipeline = {
      enableExcelParsing: true,
      enableZoneMapping: true,
      enableDuplicateDetection: true,
      enableDataCleaning: true,
      enableDatabaseStorage: true,
      duplicateThresholdMeters: 10
    }
  ): Promise<ProcessingResult> {
    let importedData: ImportedData;
    let zoneAssignments: { [coordinateId: string]: string } = {};
    let duplicates: Coordinate[][] = [];
    let cleaningReport = '';
    let processingErrors: { coordinate: Coordinate; error: string }[] = [];

    try {
      // Step 1: Parse Excel file
      if (pipeline.enableExcelParsing) {
        importedData = await this.excelParser.parseExcelFile(request);
      } else {
        throw new Error('Excel parsing is required for this pipeline');
      }

      // Step 2: Clean coordinate data
      if (pipeline.enableDataCleaning) {
        const cleaningResult = this.geospatialService.cleanCoordinateData(importedData.coordinates);
        importedData.coordinates = cleaningResult.cleanedCoordinates;
        cleaningReport = cleaningResult.cleaningReport;

        // Add validation errors for removed coordinates
        cleaningResult.removedCoordinates.forEach((coord, index) => {
          importedData.validationErrors.push({
            row: index + 2, // Approximate row number
            field: 'coordinate',
            message: 'Coordinate is outside Colombia bounds',
            value: `${coord.latitude}, ${coord.longitude}`
          });
        });
      }

      // Step 3: Generate IDs for coordinates that don't have them
      importedData.coordinates = importedData.coordinates.map((coord, index) => ({
        ...coord,
        id: coord.id || `temp_${Date.now()}_${index}`
      }));

      // Step 4: Process coordinates with zone mapping and duplicate detection
      const processingOptions: CoordinateProcessingOptions = {
        enableDuplicateDetection: pipeline.enableDuplicateDetection,
        duplicateThresholdMeters: pipeline.duplicateThresholdMeters,
        enableZoneValidation: pipeline.enableZoneMapping
      };

      const processingResult = await this.geospatialService.processCoordinatesWithZoneMapping(
        importedData.coordinates,
        processingOptions
      );

      importedData.coordinates = processingResult.processedCoordinates;
      zoneAssignments = processingResult.zoneAssignments;
      duplicates = processingResult.duplicates;
      processingErrors = processingResult.processingErrors;

      // Step 5: Update summary with zone information
      const detectedZones = new Set(Object.values(zoneAssignments));
      importedData.summary.zonesDetected = Array.from(detectedZones);

      // Step 6: Add duplicate validation errors
      duplicates.forEach((duplicateGroup, groupIndex) => {
        duplicateGroup.forEach((coord, coordIndex) => {
          if (coordIndex > 0) { // Skip the first coordinate in each group
            importedData.validationErrors.push({
              row: 0, // Row number not available at this point
              field: 'coordinate',
              message: `Duplicate coordinate detected (group ${groupIndex + 1})`,
              value: `${coord.latitude}, ${coord.longitude}`
            });
          }
        });
      });

      // Step 7: Store in database if enabled
      if (pipeline.enableDatabaseStorage) {
        await this.storeCoordinatesInDatabase(importedData.coordinates);
      }

      // Step 8: Update final summary
      importedData.summary.invalidRows = importedData.validationErrors.length;
      importedData.summary.validRows = importedData.coordinates.length;

      return {
        importedData,
        zoneAssignments,
        duplicates,
        cleaningReport,
        processingErrors
      };

    } catch (error) {
      throw new Error(`Coordinate processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process coordinates for zone assignment only (without Excel parsing)
   */
  async processCoordinatesForZoneAssignment(
    coordinates: Coordinate[],
    options: CoordinateProcessingOptions = {
      enableDuplicateDetection: true,
      duplicateThresholdMeters: 10,
      enableZoneValidation: true
    }
  ): Promise<{
    processedCoordinates: Coordinate[];
    zoneAssignments: { [coordinateId: string]: string };
    duplicates: Coordinate[][];
    processingErrors: { coordinate: Coordinate; error: string }[];
  }> {
    return await this.geospatialService.processCoordinatesWithZoneMapping(coordinates, options);
  }

  /**
   * Detect and resolve duplicate coordinates
   */
  async detectAndResolveDuplicates(
    coordinates: Coordinate[],
    thresholdMeters: number = 10,
    resolutionStrategy: 'keep_first' | 'keep_last' | 'merge' = 'keep_first'
  ): Promise<{
    resolvedCoordinates: Coordinate[];
    duplicateGroups: Coordinate[][];
    resolutionReport: string;
  }> {
    const duplicateGroups = this.geospatialService.detectDuplicateCoordinates(coordinates, thresholdMeters);
    const resolvedCoordinates: Coordinate[] = [];
    const processedIds = new Set<string>();

    // Process non-duplicate coordinates
    for (const coordinate of coordinates) {
      const isDuplicate = duplicateGroups.some(group => 
        group.some(coord => coord.id === coordinate.id)
      );

      if (!isDuplicate) {
        resolvedCoordinates.push(coordinate);
      }
    }

    // Process duplicate groups according to strategy
    for (const duplicateGroup of duplicateGroups) {
      let resolvedCoordinate: Coordinate;

      switch (resolutionStrategy) {
        case 'keep_first':
          resolvedCoordinate = duplicateGroup[0]!;
          break;
        case 'keep_last':
          resolvedCoordinate = duplicateGroup[duplicateGroup.length - 1]!;
          break;
        case 'merge':
          resolvedCoordinate = this.mergeCoordinates(duplicateGroup);
          break;
        default:
          resolvedCoordinate = duplicateGroup[0]!;
      }

      resolvedCoordinates.push(resolvedCoordinate);
    }

    const resolutionReport = `
Duplicate Resolution Report:
- Total coordinates processed: ${coordinates.length}
- Duplicate groups found: ${duplicateGroups.length}
- Total duplicates removed: ${coordinates.length - resolvedCoordinates.length}
- Resolution strategy: ${resolutionStrategy}
- Final coordinate count: ${resolvedCoordinates.length}
    `.trim();

    return {
      resolvedCoordinates,
      duplicateGroups,
      resolutionReport
    };
  }

  /**
   * Merge multiple coordinates into a single coordinate
   */
  private mergeCoordinates(coordinates: Coordinate[]): Coordinate {
    if (coordinates.length === 0) {
      throw new Error('Cannot merge empty coordinate array');
    }

    if (coordinates.length === 1) {
      return coordinates[0]!;
    }

    // Calculate average position
    const avgLat = coordinates.reduce((sum, coord) => sum + coord.latitude, 0) / coordinates.length;
    const avgLng = coordinates.reduce((sum, coord) => sum + coord.longitude, 0) / coordinates.length;

    // Merge addresses (take the longest non-empty one)
    const addresses = coordinates
      .map(coord => coord.address)
      .filter(addr => addr && addr.trim().length > 0)
      .sort((a, b) => (b?.length || 0) - (a?.length || 0));

    // Use the first coordinate as base and update with merged data
    const baseCoordinate = coordinates[0]!;
    
    const mergedCoordinate: Coordinate = {
      ...baseCoordinate,
      latitude: Math.round(avgLat * 1000000) / 1000000, // 6 decimal places
      longitude: Math.round(avgLng * 1000000) / 1000000,
      importedFrom: `merged_from_${coordinates.length}_coordinates`
    };

    if (addresses[0]) {
      mergedCoordinate.address = addresses[0];
    }

    return mergedCoordinate;
  }

  /**
   * Store coordinates in database
   */
  private async storeCoordinatesInDatabase(coordinates: Coordinate[]): Promise<void> {
    try {
      for (const coordinate of coordinates) {
        // Remove temporary ID if it exists
        if (coordinate.id.startsWith('temp_')) {
          coordinate.id = '';
        }
        
        await this.coordinateRepository.create(coordinate);
      }
    } catch (error) {
      throw new Error(`Failed to store coordinates in database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate coordinates against zone boundaries
   */
  async validateCoordinatesAgainstZones(coordinates: Coordinate[]): Promise<{
    validCoordinates: Coordinate[];
    invalidCoordinates: { coordinate: Coordinate; reason: string }[];
    validationReport: string;
  }> {
    const validCoordinates: Coordinate[] = [];
    const invalidCoordinates: { coordinate: Coordinate; reason: string }[] = [];

    for (const coordinate of coordinates) {
      // Check if coordinate is within Colombia bounds
      if (!this.geospatialService.validateCoordinateForColombia(coordinate)) {
        invalidCoordinates.push({
          coordinate,
          reason: 'Coordinate is outside Colombia bounds'
        });
        continue;
      }

      // Try to detect zone for coordinate
      const zoneResult = await this.geospatialService.detectZoneForCoordinate(coordinate);
      
      if (zoneResult.confidence > 0.5) {
        validCoordinates.push(coordinate);
      } else {
        invalidCoordinates.push({
          coordinate,
          reason: 'No suitable zone found for coordinate'
        });
      }
    }

    const validationReport = `
Zone Validation Report:
- Total coordinates validated: ${coordinates.length}
- Valid coordinates: ${validCoordinates.length}
- Invalid coordinates: ${invalidCoordinates.length}
- Validation success rate: ${coordinates.length > 0 ? ((validCoordinates.length / coordinates.length) * 100).toFixed(1) : 0}%
    `.trim();

    return {
      validCoordinates,
      invalidCoordinates,
      validationReport
    };
  }

  /**
   * Get processing statistics
   */
  getProcessingStatistics(result: ProcessingResult): {
    totalCoordinates: number;
    coordinatesWithZones: number;
    duplicateGroups: number;
    totalDuplicates: number;
    processingErrors: number;
    zoneDistribution: { [zoneName: string]: number };
  } {
    const totalDuplicates = result.duplicates.reduce((sum, group) => sum + group.length - 1, 0);
    const coordinatesWithZones = Object.keys(result.zoneAssignments).length;

    // Calculate zone distribution
    const zoneDistribution: { [zoneName: string]: number } = {};
    Object.values(result.zoneAssignments).forEach(zoneId => {
      if (!zoneDistribution[zoneId]) {
        zoneDistribution[zoneId] = 0;
      }
      zoneDistribution[zoneId]!++;
    });

    return {
      totalCoordinates: result.importedData.coordinates.length,
      coordinatesWithZones,
      duplicateGroups: result.duplicates.length,
      totalDuplicates,
      processingErrors: result.processingErrors.length,
      zoneDistribution
    };
  }
}