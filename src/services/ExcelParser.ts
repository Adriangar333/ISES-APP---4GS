import * as XLSX from 'xlsx';
import { Coordinate, ValidationError, ImportedData } from '../types';
import { validateCoordinate } from '../schemas/validation';

export interface ExcelImportRequest {
  file: Buffer;
  fileName: string;
  userId: string;
  importType: 'full' | 'incremental';
}

export interface ExcelRow {
  [key: string]: any;
}

export class ExcelParser {
  private readonly REQUIRED_COLUMNS = ['latitude', 'longitude'];
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly SUPPORTED_EXTENSIONS = ['.xlsx', '.xls'];

  /**
   * Parse Excel file and extract coordinate data
   */
  async parseExcelFile(request: ExcelImportRequest): Promise<ImportedData> {
    try {
      // Validate file
      this.validateFile(request.file, request.fileName);

      // Parse workbook
      const workbook = XLSX.read(request.file, { type: 'buffer' });
      
      // Validate Excel structure
      this.validateExcelStructure(workbook);
      
      // Get first worksheet
      const worksheetName = workbook.SheetNames[0];
      if (!worksheetName) {
        throw new Error('No worksheets found in Excel file');
      }
      const worksheet = workbook.Sheets[worksheetName];
      if (!worksheet) {
        throw new Error('Worksheet not found');
      }
      
      // Convert to JSON with proper data type handling
      const rawData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false,
        raw: false // This ensures dates and numbers are properly formatted
      });

      if (rawData.length === 0) {
        throw new Error('Excel file is empty');
      }

      // Process data with enhanced validation
      const result = this.processExcelData(rawData, request.fileName);
      
      // Add consistency validation
      const consistencyErrors = this.validateDataConsistency(result.coordinates);
      result.validationErrors.push(...consistencyErrors);
      
      // Update summary with consistency errors
      result.summary.invalidRows += consistencyErrors.length;
      
      return result;

    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Excel file format and size
   */
  private validateFile(fileBuffer: Buffer, fileName: string): void {
    // Check file size
    if (fileBuffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file extension
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!this.SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new Error(`Unsupported file format. Supported formats: ${this.SUPPORTED_EXTENSIONS.join(', ')}`);
    }

    // Check if file is actually an Excel file by trying to read it
    try {
      XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (error) {
      throw new Error('Invalid Excel file format');
    }
  }

  /**
   * Process raw Excel data into structured format
   */
  private processExcelData(rawData: ExcelRow[], fileName: string): ImportedData {
    const coordinates: Coordinate[] = [];
    const validationErrors: ValidationError[] = [];

    // Skip empty rows and get headers
    const nonEmptyRows = rawData.filter(row => row && Array.isArray(row) && row.length > 0);
    
    if (nonEmptyRows.length < 2) {
      throw new Error('Excel file must contain at least a header row and one data row');
    }

    // Get headers from first row
    const headers = this.normalizeHeaders(nonEmptyRows[0] as string[]);
    
    // Validate required columns exist
    this.validateHeaders(headers);

    // Process data rows (skip header)
    for (let i = 1; i < nonEmptyRows.length; i++) {
      const rowData = nonEmptyRows[i];
      if (!rowData || !Array.isArray(rowData)) continue;
      
      const rowNumber = i + 1; // Excel row number (1-based)

      try {
        const coordinate = this.parseRowToCoordinate(rowData, headers, fileName);
        
        // Validate coordinate
        const { error } = validateCoordinate(coordinate);
        if (error) {
          validationErrors.push({
            row: rowNumber,
            field: 'coordinate',
            message: error.details[0]?.message || 'Validation error',
            value: coordinate
          });
          continue;
        }

        coordinates.push(coordinate);

      } catch (error) {
        validationErrors.push({
          row: rowNumber,
          field: 'general',
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          value: rowData
        });
      }
    }

    return {
      coordinates,
      validationErrors,
      summary: {
        totalRows: nonEmptyRows.length - 1, // Exclude header
        validRows: coordinates.length,
        invalidRows: validationErrors.length,
        zonesDetected: [] // Will be populated in zone mapping task
      }
    };
  }

  /**
   * Normalize column headers to standard format
   */
  private normalizeHeaders(headers: string[]): { [key: string]: number } {
    const normalizedHeaders: { [key: string]: number } = {};
    
    headers.forEach((header, index) => {
      if (!header || typeof header !== 'string') return;
      
      const normalized = header.toLowerCase().trim();
      
      // Map common variations to standard names
      if (normalized.includes('lat') || normalized === 'latitude') {
        normalizedHeaders['latitude'] = index;
      } else if (normalized.includes('lng') || normalized.includes('lon') || normalized === 'longitude') {
        normalizedHeaders['longitude'] = index;
      } else if (normalized.includes('address') || normalized.includes('direccion') || normalized.includes('dirección')) {
        normalizedHeaders['address'] = index;
      } else if (normalized.includes('zone') || normalized.includes('zona')) {
        normalizedHeaders['zone'] = index;
      }
    });

    return normalizedHeaders;
  }

  /**
   * Validate that required headers are present
   */
  private validateHeaders(headers: { [key: string]: number }): void {
    const missingColumns: string[] = [];

    this.REQUIRED_COLUMNS.forEach(column => {
      if (!(column in headers)) {
        missingColumns.push(column);
      }
    });

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }
  }

  /**
   * Parse a single row to Coordinate object
   */
  private parseRowToCoordinate(rowData: any[], headers: { [key: string]: number }, fileName: string): Coordinate {
    // Extract latitude and longitude
    const latIndex = headers['latitude'];
    const lngIndex = headers['longitude'];
    
    if (latIndex === undefined || lngIndex === undefined) {
      throw new Error('Missing latitude or longitude column');
    }
    
    const latitude = this.parseNumericValue(rowData[latIndex], 'latitude');
    const longitude = this.parseNumericValue(rowData[lngIndex], 'longitude');

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90`);
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180`);
    }

    // Extract optional fields
    const address = headers['address'] !== undefined ? 
      this.parseStringValue(rowData[headers['address']]) : undefined;

    const coordinate: Coordinate = {
      id: '', // Will be generated by database, leave empty for validation
      latitude,
      longitude,
      importedFrom: fileName,
      createdAt: new Date()
    };

    if (address) {
      coordinate.address = address;
    }

    return coordinate;
  }

  /**
   * Parse numeric value from Excel cell
   */
  private parseNumericValue(value: any, fieldName: string): number {
    if (value === null || value === undefined || value === '') {
      throw new Error(`${fieldName} is required`);
    }

    const numValue = typeof value === 'string' ? parseFloat(value.trim()) : Number(value);
    
    if (isNaN(numValue)) {
      throw new Error(`Invalid ${fieldName}: ${value}. Must be a valid number`);
    }

    return numValue;
  }

  /**
   * Parse string value from Excel cell
   */
  private parseStringValue(value: any): string | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    return String(value).trim();
  }



  /**
   * Validate Excel file structure and content
   */
  private validateExcelStructure(workbook: XLSX.WorkBook): void {
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no worksheets');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('No worksheets found');
    }
    const firstSheet = workbook.Sheets[firstSheetName];
    if (!firstSheet) {
      throw new Error('First worksheet is empty or corrupted');
    }

    // Check if sheet has any data
    const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1:A1');
    if (range.e.r < 1) { // Less than 2 rows (header + at least one data row)
      throw new Error('Excel file must contain at least a header row and one data row');
    }
  }



  /**
   * Validate data consistency across rows
   */
  private validateDataConsistency(coordinates: Coordinate[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const duplicates = new Map<string, number[]>();
    
    // Check for duplicate coordinates
    coordinates.forEach((coord, index) => {
      const key = `${coord.latitude.toFixed(6)},${coord.longitude.toFixed(6)}`;
      if (!duplicates.has(key)) {
        duplicates.set(key, []);
      }
      duplicates.get(key)!.push(index + 2); // +2 because index is 0-based and we skip header
    });
    
    // Report duplicates
    duplicates.forEach((rows, coordKey) => {
      if (rows.length > 1) {
        const firstRow = rows[0];
        if (firstRow !== undefined) {
          errors.push({
            row: firstRow,
            field: 'coordinate',
            message: `Duplicate coordinate found at rows: ${rows.join(', ')}`,
            value: coordKey
          });
        }
      }
    });
    
    return errors;
  }



  /**
   * Get detailed validation report
   */
  getValidationReport(importedData: ImportedData): string {
    const { summary, validationErrors } = importedData;
    
    let report = `Excel Import Summary:\n`;
    report += `- Total rows processed: ${summary.totalRows}\n`;
    report += `- Valid coordinates: ${summary.validRows}\n`;
    report += `- Invalid rows: ${summary.invalidRows}\n`;
    report += `- Success rate: ${summary.totalRows > 0 ? ((summary.validRows / summary.totalRows) * 100).toFixed(1) : 0}%\n`;
    report += `- Zones detected: ${summary.zonesDetected.length > 0 ? summary.zonesDetected.join(', ') : 'None'}\n\n`;

    if (validationErrors.length > 0) {
      report += `Validation Errors (${validationErrors.length}):\n`;
      
      // Group errors by type
      const errorsByType = validationErrors.reduce((acc, error) => {
        if (!acc[error.field]) {
          acc[error.field] = [];
        }
        acc[error.field]!.push(error);
        return acc;
      }, {} as { [key: string]: ValidationError[] });
      
      Object.entries(errorsByType).forEach(([field, errors]) => {
        report += `\n${field.toUpperCase()} Errors (${errors.length}):\n`;
        errors.slice(0, 10).forEach(error => { // Limit to first 10 errors per type
          report += `- Row ${error.row}: ${error.message}\n`;
        });
        if (errors.length > 10) {
          report += `- ... and ${errors.length - 10} more ${field} errors\n`;
        }
      });
    } else {
      report += `✅ No validation errors found!\n`;
    }

    return report;
  }

  /**
   * Get import statistics
   */
  getImportStatistics(importedData: ImportedData): {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    successRate: number;
    errorsByType: { [key: string]: number };
    coordinateRanges: {
      latMin: number;
      latMax: number;
      lngMin: number;
      lngMax: number;
    } | null;
  } {
    const { coordinates, validationErrors, summary } = importedData;
    
    // Calculate error distribution
    const errorsByType = validationErrors.reduce((acc, error) => {
      if (!acc[error.field]) {
        acc[error.field] = 0;
      }
      acc[error.field]!++;
      return acc;
    }, {} as { [key: string]: number });
    
    // Calculate coordinate ranges
    let coordinateRanges = null;
    if (coordinates.length > 0) {
      const latitudes = coordinates.map(c => c.latitude);
      const longitudes = coordinates.map(c => c.longitude);
      
      coordinateRanges = {
        latMin: Math.min(...latitudes),
        latMax: Math.max(...latitudes),
        lngMin: Math.min(...longitudes),
        lngMax: Math.max(...longitudes)
      };
    }
    
    return {
      totalRows: summary.totalRows,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      successRate: summary.totalRows > 0 ? (summary.validRows / summary.totalRows) * 100 : 0,
      errorsByType,
      coordinateRanges
    };
  }
}