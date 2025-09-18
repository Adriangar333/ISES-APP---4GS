import * as XLSX from 'xlsx';
import { CoordinateProcessor } from '../../services/CoordinateProcessor';
import { ZoneRepository } from '../../repositories/ZoneRepository';
import { CoordinateRepository } from '../../repositories/CoordinateRepository';
import { ExcelImportRequest } from '../../services/ExcelParser';
import { Zone } from '../../types';

// Mock repositories for integration testing
jest.mock('../../repositories/ZoneRepository');
jest.mock('../../repositories/CoordinateRepository');

describe('Excel Processing Pipeline Integration', () => {
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
    },
    {
      id: 'zone-2',
      name: 'Zona II - Metropolitana Suroccidente',
      type: 'metropolitana',
      boundaries: {
        type: 'Polygon',
        coordinates: [
          { latitude: 4.3, longitude: -74.2 },
          { latitude: 4.5, longitude: -74.2 },
          { latitude: 4.5, longitude: -74.0 },
          { latitude: 4.3, longitude: -74.0 },
          { latitude: 4.3, longitude: -74.2 }
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
    mockCoordinateRepository.create.mockImplementation(async (coord) => ({
      ...coord,
      id: `created-${Date.now()}-${Math.random()}`,
      createdAt: new Date()
    }));

    coordinateProcessor = new CoordinateProcessor(mockZoneRepository, mockCoordinateRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Excel to Database Pipeline', () => {
    it('should process Impuaa.xlsx format with zone mapping and duplicate detection', async () => {
      // Create realistic test data simulating Impuaa.xlsx format
      const testData = [
        ['Latitud', 'Longitud', 'Dirección', 'Zona'],
        [4.6097, -74.0817, 'Calle 26 #13-09, Bogotá', 'Zona I'],
        [4.6351, -74.0703, 'Carrera 7 #32-16, Chapinero', 'Zona I'],
        [4.6097, -74.0817, 'Calle 26 #13-09, Bogotá (Duplicado)', 'Zona I'], // Duplicate
        [4.4389, -74.1469, 'Avenida Boyacá #72-81, Kennedy', 'Zona II'],
        [4.7110, -74.0721, 'Calle 85 #15-32, Zona Rosa', 'Zona I'],
        [40.7128, -74.0060, 'Invalid coordinate (New York)', 'Zona I'], // Outside Colombia
        ['invalid', -74.0817, 'Invalid latitude', 'Zona I'], // Invalid data
        [4.6200, -74.0650, 'Carrera 13 #45-67, Centro', ''] // No zone specified
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Impuaa');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'Impuaa.xlsx',
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

      // Verify Excel parsing worked
      expect(result.importedData.summary.totalRows).toBe(8); // Excluding header (8 data rows)
      expect(result.importedData.coordinates.length).toBeGreaterThan(0);
      expect(result.importedData.validationErrors.length).toBeGreaterThan(0);

      // Verify zone assignments
      expect(Object.keys(result.zoneAssignments).length).toBeGreaterThan(0);
      expect(result.importedData.summary.zonesDetected.length).toBeGreaterThan(0);

      // Verify duplicate detection
      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.duplicates[0]?.length).toBe(2); // The duplicate pair

      // Verify data cleaning
      expect(result.cleaningReport).toContain('Total coordinates processed');
      expect(result.cleaningReport).toContain('Coordinates removed (out of bounds)');

      // Verify database storage was called
      expect(mockCoordinateRepository.create).toHaveBeenCalled();

      // Verify processing statistics
      const stats = coordinateProcessor.getProcessingStatistics(result);
      expect(stats.totalCoordinates).toBeGreaterThan(0);
      expect(stats.duplicateGroups).toBeGreaterThan(0);
      expect(stats.zoneDistribution).toBeDefined();
    });

    it('should handle Excel file with only valid coordinates', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Bogotá Centro'],
        [4.6351, -74.0703, 'Chapinero'],
        [4.4389, -74.1469, 'Kennedy'],
        [4.7110, -74.0721, 'Zona Rosa']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'valid-coordinates.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const result = await coordinateProcessor.processExcelToDatabase(request);

      expect(result.importedData.coordinates).toHaveLength(4);
      expect(result.importedData.validationErrors).toHaveLength(0);
      expect(result.importedData.summary.validRows).toBe(4);
      expect(result.importedData.summary.invalidRows).toBe(0);
      expect(Object.keys(result.zoneAssignments).length).toBe(4);
    });

    it('should handle Excel file with mixed valid and invalid data', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Valid coordinate 1'],
        ['invalid', -74.0703, 'Invalid latitude'],
        [4.4389, 'invalid', 'Invalid longitude'],
        [91, -74.0721, 'Latitude out of range'],
        [4.6200, -181, 'Longitude out of range'],
        [4.6300, -74.0600, 'Valid coordinate 2'],
        ['', '', 'Empty coordinates'],
        [null, null, 'Null coordinates']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'mixed-data.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const result = await coordinateProcessor.processExcelToDatabase(request);

      expect(result.importedData.coordinates.length).toBe(2); // Only 2 valid coordinates
      expect(result.importedData.validationErrors.length).toBe(6); // 6 invalid rows
      expect(result.importedData.summary.validRows).toBe(2);
      expect(result.importedData.summary.invalidRows).toBe(6);

      const stats = coordinateProcessor.getProcessingStatistics(result);
      expect(stats.totalCoordinates).toBe(2);
      expect(stats.coordinatesWithZones).toBe(2);
    });

    it('should process coordinates without database storage', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Test Location']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'no-storage.xlsx',
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

      expect(result.importedData.coordinates).toHaveLength(1);
      expect(mockCoordinateRepository.create).not.toHaveBeenCalled();
    });

    it('should handle large Excel files with many coordinates', async () => {
      // Generate a large dataset
      const testData: any[][] = [['Latitude', 'Longitude', 'Address']];
      
      // Add 100 coordinates within Colombia bounds
      for (let i = 0; i < 100; i++) {
        const lat = 4.5 + (Math.random() * 0.3); // Between 4.5 and 4.8
        const lng = -74.2 + (Math.random() * 0.2); // Between -74.2 and -74.0
        testData.push([lat, lng, `Test Location ${i + 1}`]);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'large-dataset.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const startTime = Date.now();
      const result = await coordinateProcessor.processExcelToDatabase(request);
      const processingTime = Date.now() - startTime;

      expect(result.importedData.coordinates).toHaveLength(100);
      expect(result.importedData.validationErrors).toHaveLength(0);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds

      const stats = coordinateProcessor.getProcessingStatistics(result);
      expect(stats.totalCoordinates).toBe(100);
      expect(stats.coordinatesWithZones).toBe(100);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      mockCoordinateRepository.create.mockRejectedValue(new Error('Database connection failed'));

      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Test Location']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'db-error.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      await expect(coordinateProcessor.processExcelToDatabase(request))
        .rejects.toThrow('Coordinate processing failed');
    });

    it('should handle zone repository errors gracefully', async () => {
      mockZoneRepository.findAll.mockRejectedValue(new Error('Zone repository error'));

      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Test Location']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'zone-error.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      // Should still process coordinates even if zone detection fails
      const result = await coordinateProcessor.processExcelToDatabase(request);
      
      expect(result.importedData.coordinates).toHaveLength(1);
      expect(Object.keys(result.zoneAssignments)).toHaveLength(0);
    });
  });
});