import * as XLSX from 'xlsx';
import { ExcelParser, ExcelImportRequest } from '../../services/ExcelParser';

describe('ExcelParser', () => {
  let parser: ExcelParser;

  beforeEach(() => {
    parser = new ExcelParser();
  });

  describe('parseExcelFile', () => {
    it('should parse valid Excel file with coordinates', async () => {
      // Create test data
      const testData = [
        ['Latitude', 'Longitude', 'Address', 'Zone'],
        [4.6097, -74.0817, 'Bogotá Centro', 'Zona I'],
        [4.6351, -74.0703, 'Chapinero', 'Zona II']
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

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(2);
      expect(result.summary.totalRows).toBe(2);
      expect(result.summary.validRows).toBe(2);
      expect(result.summary.invalidRows).toBe(0);
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should handle missing required columns', async () => {
      const testData = [
        ['Address', 'Zone'],
        ['Bogotá Centro', 'Zona I']
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

      await expect(parser.parseExcelFile(request)).rejects.toThrow('Missing required columns');
    });

    it('should validate coordinate ranges', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [91, -74.0817, 'Invalid latitude'], // Invalid latitude > 90
        [4.6351, -181, 'Invalid longitude'] // Invalid longitude < -180
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

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(0);
      expect(result.validationErrors).toHaveLength(2);
      expect(result.validationErrors[0]?.message).toContain('Invalid latitude');
      expect(result.validationErrors[1]?.message).toContain('Invalid longitude');
    });

    it('should handle empty Excel file', async () => {
      const testData: any[][] = [];

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

      await expect(parser.parseExcelFile(request)).rejects.toThrow('Excel file must contain at least a header row and one data row');
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      const request: ExcelImportRequest = {
        file: largeBuffer,
        fileName: 'large.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      await expect(parser.parseExcelFile(request)).rejects.toThrow('File size exceeds maximum limit');
    });

    it('should reject unsupported file formats', async () => {
      const buffer = Buffer.from('not an excel file');

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'test.txt',
        userId: 'test-user',
        importType: 'full'
      };

      await expect(parser.parseExcelFile(request)).rejects.toThrow('Unsupported file format');
    });
  });

  describe('coordinate parsing', () => {
    it('should parse coordinates with addresses', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Bogotá Centro'],
        [4.6351, -74.0703, 'Chapinero'],
        [4.7110, -74.0721, 'Zona Rosa']
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

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(3);
      expect(result.coordinates[0]?.address).toBe('Bogotá Centro');
      expect(result.coordinates[1]?.address).toBe('Chapinero');
      expect(result.coordinates[2]?.address).toBe('Zona Rosa');
    });

    it('should handle coordinates without addresses', async () => {
      const testData = [
        ['Latitude', 'Longitude'],
        [4.6097, -74.0817]
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

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(1);
      expect(result.coordinates[0]?.address).toBeUndefined();
    });
  });

  describe('getValidationReport', () => {
    it('should generate detailed validation report', () => {
      const importedData = {
        coordinates: [
          {
            id: '1',
            latitude: 4.6097,
            longitude: -74.0817,
            address: 'Test Address',
            createdAt: new Date()
          }
        ],
        validationErrors: [
          {
            row: 2,
            field: 'latitude',
            message: 'Invalid latitude value',
            value: 'invalid'
          }
        ],
        summary: {
          totalRows: 2,
          validRows: 1,
          invalidRows: 1,
          zonesDetected: []
        }
      };

      const report = parser.getValidationReport(importedData);

      expect(report).toContain('Total rows processed: 2');
      expect(report).toContain('Valid coordinates: 1');
      expect(report).toContain('Invalid rows: 1');
      expect(report).toContain('Zones detected: None');
      expect(report).toContain('Row 2: Invalid latitude value');
    });
  });

  describe('edge cases and advanced validation', () => {
    it('should handle Excel files with mixed data types', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Valid coordinate'],
        ['invalid', -74.0703, 'Invalid latitude'],
        [4.7110, 'invalid', 'Invalid longitude'],
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

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(1); // Only one valid coordinate
      expect(result.validationErrors).toHaveLength(4); // Four invalid rows
      expect(result.summary.totalRows).toBe(5);
      expect(result.summary.validRows).toBe(1);
      expect(result.summary.invalidRows).toBe(4);
    });

    it('should handle Excel files with different column name variations', async () => {
      const testData = [
        ['lat', 'lng', 'direccion'], // Spanish variations
        [4.6097, -74.0817, 'Bogotá Centro']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'spanish-headers.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(1);
      expect(result.coordinates[0]?.latitude).toBe(4.6097);
      expect(result.coordinates[0]?.longitude).toBe(-74.0817);
      expect(result.coordinates[0]?.address).toBe('Bogotá Centro');
    });

    it('should handle Excel files with extra whitespace and formatting', async () => {
      const testData = [
        ['  Latitude  ', '  Longitude  ', '  Address  '],
        ['  4.6097  ', '  -74.0817  ', '  Bogotá Centro  ']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'whitespace.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(1);
      expect(result.coordinates[0]?.latitude).toBe(4.6097);
      expect(result.coordinates[0]?.longitude).toBe(-74.0817);
      expect(result.coordinates[0]?.address).toBe('Bogotá Centro');
    });

    it('should detect duplicate coordinates', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, 'Location 1'],
        [4.6097, -74.0817, 'Location 2'], // Duplicate
        [4.6351, -74.0703, 'Location 3']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'duplicates.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(3); // All coordinates are valid
      expect(result.validationErrors.some(error => 
        error.message.includes('Duplicate coordinate')
      )).toBe(true);
    });

    it('should handle very long addresses', async () => {
      const longAddress = 'A'.repeat(600); // Exceeds 500 character limit
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [4.6097, -74.0817, longAddress]
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'long-address.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(0); // Should be invalid due to long address
      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0]?.message).toContain('less than or equal to 500 characters');
    });

    it('should handle coordinates at boundary values', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address'],
        [90, 180, 'North Pole'], // Maximum valid values
        [-90, -180, 'South Pole'], // Minimum valid values
        [0, 0, 'Equator Prime Meridian'] // Zero values
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'boundary-values.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      const result = await parser.parseExcelFile(request);

      expect(result.coordinates).toHaveLength(3);
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should handle Excel files with only headers', async () => {
      const testData = [
        ['Latitude', 'Longitude', 'Address']
        // No data rows
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(testData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const request: ExcelImportRequest = {
        file: buffer,
        fileName: 'headers-only.xlsx',
        userId: 'test-user',
        importType: 'full'
      };

      await expect(parser.parseExcelFile(request)).rejects.toThrow(
        'Excel file must contain at least a header row and one data row'
      );
    });
  });

  describe('getImportStatistics', () => {
    it('should calculate import statistics correctly', () => {
      const importedData = {
        coordinates: [
          {
            id: '1',
            latitude: 4.6097,
            longitude: -74.0817,
            address: 'Test Address 1',
            createdAt: new Date()
          },
          {
            id: '2',
            latitude: 4.6351,
            longitude: -74.0703,
            address: 'Test Address 2',
            createdAt: new Date()
          }
        ],
        validationErrors: [
          {
            row: 3,
            field: 'latitude',
            message: 'Invalid latitude value',
            value: 'invalid'
          },
          {
            row: 4,
            field: 'longitude',
            message: 'Invalid longitude value',
            value: 'invalid'
          }
        ],
        summary: {
          totalRows: 4,
          validRows: 2,
          invalidRows: 2,
          zonesDetected: []
        }
      };

      const stats = parser.getImportStatistics(importedData);

      expect(stats.totalRows).toBe(4);
      expect(stats.validRows).toBe(2);
      expect(stats.invalidRows).toBe(2);
      expect(stats.successRate).toBe(50);
      expect(stats.errorsByType.latitude).toBe(1);
      expect(stats.errorsByType.longitude).toBe(1);
      expect(stats.coordinateRanges).toEqual({
        latMin: 4.6097,
        latMax: 4.6351,
        lngMin: -74.0817,
        lngMax: -74.0703
      });
    });

    it('should handle empty coordinates for statistics', () => {
      const importedData = {
        coordinates: [],
        validationErrors: [],
        summary: {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          zonesDetected: []
        }
      };

      const stats = parser.getImportStatistics(importedData);

      expect(stats.totalRows).toBe(0);
      expect(stats.validRows).toBe(0);
      expect(stats.invalidRows).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.coordinateRanges).toBeNull();
    });
  });
});