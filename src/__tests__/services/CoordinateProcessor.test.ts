import { CoordinateProcessor } from '../../services/CoordinateProcessor';
import { ZoneRepository } from '../../repositories/ZoneRepository';
import { CoordinateRepository } from '../../repositories/CoordinateRepository';
import { ExcelImportRequest } from '../../services/ExcelParser';
import { Coordinate, Zone } from '../../types';
import * as XLSX from 'xlsx';

// Mock dependencies
jest.mock('../../repositories/ZoneRepository');
jest.mock('../../repositories/CoordinateRepository');

describe('CoordinateProcessor', () => {
  let coordinateProcessor: CoordinateProcessor;
  let mockZoneRepository: jest.Mocked<ZoneRepository>;
  let mockCoordinateRepository: jest.Mocked<CoordinateRepository>;

  const mockZones: Zone[] = [
    {
      id: 'zone-1',
      name: 'Zona I - Metropolitana Suroriente',
      type: 'metropolitana',
      boundaries: {
        type: 'Polygon',
        coordinates: [
          { latitude: 4.5, longitude: -74.2 },
          { latitude: 4.7, longitude: -74.2 },
          { latitude: 4.7, longitude: -74.0 },
          { latitude: 4.5, longitude: -74.0 },
          { latitude: 4.5, longitude: -74.2 }
        ]
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    mockZoneRepository = new ZoneRepository() as jest.Mocked<ZoneRepository>;
    mockCoordinateRepository = new CoordinateRepository() as jest.Mocked<CoordinateRepository>;
    
    mockZoneRepository.findAll.mockResolvedValue(mockZones);
    mockCoordinateRepository.create.mockResolvedValue({
      id: 'created-id',
      latitude: 4.6,
      longitude: -74.1,
      createdAt: new Date()
    });

    coordinateProcessor = new CoordinateProcessor(mockZoneRepository, mockCoordinateRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processExcelToDatabase', () => {
    it('should process Excel file through complete pipeline', async () => {
      // Create test Excel data
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6, -74.1, 'Test Location 1'],
        [4.6, -74.1, 'Test Location 2 (duplicate)'],
        [4.65, -74.05, 'Test Location 3']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'test.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const pipeline = {
        enableExcelParsing: true,
        enableZoneMapping: true,
        enableDuplicateDetection: true,
        enableDataCleaning: true,
        enableDatabaseStorage: true,
        duplicateThresholdMeters: 10
      };

      const result = await coordinateProcessor.processExcelToDatabase(request, pipeline);

      expect(result.importedData.coordinates.length).toBeGreaterThan(0);
      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.cleaningReport).toContain('Total coordinates processed');
      expect(mockCoordinateRepository.create).toHaveBeenCalled();
    });

    it('should handle pipeline with database storage disabled', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6, -74.1, 'Test Location']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'test.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const pipeline = {
        enableExcelParsing: true,
        enableZoneMapping: true,
        enableDuplicateDetection: true,
        enableDataCleaning: true,
        enableDatabaseStorage: false,
        duplicateThresholdMeters: 10
      };

      const result = await coordinateProcessor.processExcelToDatabase(request, pipeline);

      expect(result.importedData.coordinates.length).toBeGreaterThan(0);
      expect(mockCoordinateRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when Excel parsing is disabled', async () => {
      const request: ExcelImportRequest = {
        file: Buffer.from('test'),
        fileName: 'test.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const pipeline = {
        enableExcelParsing: false,
        enableZoneMapping: true,
        enableDuplicateDetection: true,
        enableDataCleaning: true,
        enableDatabaseStorage: true,
        duplicateThresholdMeters: 10
      };

      await expect(coordinateProcessor.processExcelToDatabase(request, pipeline))
        .rejects.toThrow('Excel parsing is required for this pipeline');
    });
  });

  describe('processCoordinatesForZoneAssignment', () => {
    it('should process coordinates for zone assignment', async () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Test Location',
          createdAt: new Date()
        }
      ];

      const options = {
        enableDuplicateDetection: true,
        duplicateThresholdMeters: 10,
        enableZoneValidation: true
      };

      const result = await coordinateProcessor.processCoordinatesForZoneAssignment(coordinates, options);

      expect(result.processedCoordinates).toHaveLength(1);
      expect(result.zoneAssignments).toBeDefined();
      expect(result.duplicates).toBeDefined();
      expect(result.processingErrors).toBeDefined();
    });
  });

  describe('detectAndResolveDuplicates', () => {
    it('should detect and resolve duplicates with keep_first strategy', async () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Original Location',
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Duplicate Location',
          createdAt: new Date()
        },
        {
          id: '3',
          latitude: 4.65,
          longitude: -74.05,
          address: 'Different Location',
          createdAt: new Date()
        }
      ];

      const result = await coordinateProcessor.detectAndResolveDuplicates(
        coordinates,
        10,
        'keep_first'
      );

      expect(result.resolvedCoordinates).toHaveLength(2);
      expect(result.duplicateGroups).toHaveLength(1);
      expect(result.duplicateGroups[0]).toHaveLength(2);
      expect(result.resolvedCoordinates.find(c => c.id === '1')).toBeDefined();
      expect(result.resolvedCoordinates.find(c => c.id === '2')).toBeUndefined();
      expect(result.resolutionReport).toContain('keep_first');
    });

    it('should detect and resolve duplicates with keep_last strategy', async () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Original Location',
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Duplicate Location',
          createdAt: new Date()
        }
      ];

      const result = await coordinateProcessor.detectAndResolveDuplicates(
        coordinates,
        10,
        'keep_last'
      );

      expect(result.resolvedCoordinates).toHaveLength(1);
      expect(result.resolvedCoordinates[0]?.id).toBe('2');
    });

    it('should detect and resolve duplicates with merge strategy', async () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Short',
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 4.600001,
          longitude: -74.100001,
          address: 'Much longer address that should be kept',
          createdAt: new Date()
        }
      ];

      const result = await coordinateProcessor.detectAndResolveDuplicates(
        coordinates,
        10,
        'merge'
      );

      expect(result.resolvedCoordinates).toHaveLength(1);
      const merged = result.resolvedCoordinates[0]!;
      expect(merged.address).toBe('Much longer address that should be kept');
      expect(merged.latitude).toBeCloseTo(4.6, 5);
      expect(merged.longitude).toBeCloseTo(-74.1, 5);
      expect(merged.importedFrom).toContain('merged_from_2_coordinates');
    });

    it('should handle coordinates with no duplicates', async () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 4.65,
          longitude: -74.05,
          createdAt: new Date()
        }
      ];

      const result = await coordinateProcessor.detectAndResolveDuplicates(coordinates, 10);

      expect(result.resolvedCoordinates).toHaveLength(2);
      expect(result.duplicateGroups).toHaveLength(0);
    });
  });

  describe('validateCoordinatesAgainstZones', () => {
    it('should validate coordinates against zones', async () => {
      const coordinates: Coordinate[] = [
        {
          id: '1',
          latitude: 4.6,
          longitude: -74.1,
          address: 'Valid coordinate',
          createdAt: new Date()
        },
        {
          id: '2',
          latitude: 40.7128, // Outside Colombia
          longitude: -74.0060,
          address: 'Invalid coordinate',
          createdAt: new Date()
        }
      ];

      const result = await coordinateProcessor.validateCoordinatesAgainstZones(coordinates);

      expect(result.validCoordinates.length).toBeGreaterThan(0);
      expect(result.invalidCoordinates.length).toBeGreaterThan(0);
      expect(result.validationReport).toContain('Total coordinates validated: 2');
      expect(result.invalidCoordinates[0]?.reason).toContain('outside Colombia bounds');
    });
  });

  describe('getProcessingStatistics', () => {
    it('should calculate processing statistics correctly', () => {
      const mockResult = {
        importedData: {
          coordinates: [
            { id: '1', latitude: 4.6, longitude: -74.1, createdAt: new Date() },
            { id: '2', latitude: 4.65, longitude: -74.05, createdAt: new Date() }
          ],
          validationErrors: [],
          summary: {
            totalRows: 2,
            validRows: 2,
            invalidRows: 0,
            zonesDetected: ['zone-1']
          }
        },
        zoneAssignments: {
          '1': 'zone-1',
          '2': 'zone-1'
        },
        duplicates: [
          [
            { id: '3', latitude: 4.6, longitude: -74.1, createdAt: new Date() },
            { id: '4', latitude: 4.6, longitude: -74.1, createdAt: new Date() }
          ]
        ],
        cleaningReport: 'Test report',
        processingErrors: []
      };

      const stats = coordinateProcessor.getProcessingStatistics(mockResult);

      expect(stats.totalCoordinates).toBe(2);
      expect(stats.coordinatesWithZones).toBe(2);
      expect(stats.duplicateGroups).toBe(1);
      expect(stats.totalDuplicates).toBe(1); // 2 coordinates in group - 1
      expect(stats.processingErrors).toBe(0);
      expect(stats.zoneDistribution['zone-1']).toBe(2);
    });
  });
});