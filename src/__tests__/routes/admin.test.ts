import request from 'supertest';
import express from 'express';
import adminRoutes from '../../routes/admin';
import { ZoneBoundaryService } from '../../services/ZoneBoundaryService';
import JSZip from 'jszip';

// Mock the ZoneBoundaryService
jest.mock('../../services/ZoneBoundaryService');

describe('Admin Routes', () => {
  let app: express.Application;
  let mockZoneBoundaryService: jest.Mocked<ZoneBoundaryService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the service instance
    mockZoneBoundaryService = {
      setupZoneBoundariesFromKMZ: jest.fn(),
      validateZoneBoundaryAccuracy: jest.fn(),
      getZoneColorMapping: jest.fn(),
      testZoneBoundarySetup: jest.fn()
    } as any;

    // Mock the constructor to return our mock
    (ZoneBoundaryService as jest.MockedClass<typeof ZoneBoundaryService>).mockImplementation(() => mockZoneBoundaryService);
  });

  describe('POST /api/admin/zones/upload-kmz', () => {
    it('should successfully upload and process KMZ file', async () => {
      // Create a mock KMZ file
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Zona I - Metropolitana Suroriente</name>
              <Polygon>
                <outerBoundaryIs>
                  <LinearRing>
                    <coordinates>-74.1,4.6,0 -74.0,4.6,0 -74.0,4.7,0 -74.1,4.7,0 -74.1,4.6,0</coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
            </Placemark>
          </Document>
        </kml>`;

      const zip = new JSZip();
      zip.file('zones.kml', mockKML);
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      mockZoneBoundaryService.setupZoneBoundariesFromKMZ.mockResolvedValue({
        success: true,
        zonesCreated: 1,
        zonesUpdated: 0,
        errors: [],
        warnings: [],
        colorMapping: { 'Zona I - Metropolitana Suroriente': '#FF0000' },
        processingTimeMs: 100
      });

      const response = await request(app)
        .post('/api/admin/zones/upload-kmz')
        .attach('kmzFile', kmzBuffer, 'zones.kmz')
        .field('overwriteExisting', 'false')
        .field('validateOnly', 'false')
        .field('backupExisting', 'false');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.zonesCreated).toBe(1);
      expect(response.body.data.zonesUpdated).toBe(0);
      expect(mockZoneBoundaryService.setupZoneBoundariesFromKMZ).toHaveBeenCalledWith(
        expect.any(Buffer),
        {
          overwriteExisting: false,
          validateOnly: false,
          backupExisting: false
        }
      );
    });

    it('should handle missing file', async () => {
      const response = await request(app)
        .post('/api/admin/zones/upload-kmz')
        .field('overwriteExisting', 'false');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No KMZ file provided');
    });

    it('should handle processing errors', async () => {
      const zip = new JSZip();
      zip.file('zones.kml', 'invalid kml');
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      mockZoneBoundaryService.setupZoneBoundariesFromKMZ.mockResolvedValue({
        success: false,
        zonesCreated: 0,
        zonesUpdated: 0,
        errors: ['Invalid KML format'],
        warnings: [],
        colorMapping: {},
        processingTimeMs: 50
      });

      const response = await request(app)
        .post('/api/admin/zones/upload-kmz')
        .attach('kmzFile', kmzBuffer, 'zones.kmz');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.data.errors).toContain('Invalid KML format');
    });

    it('should handle service exceptions', async () => {
      const zip = new JSZip();
      zip.file('zones.kml', 'test');
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      mockZoneBoundaryService.setupZoneBoundariesFromKMZ.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/admin/zones/upload-kmz')
        .attach('kmzFile', kmzBuffer, 'zones.kmz');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Service error');
    });

    it('should handle validation-only mode', async () => {
      const zip = new JSZip();
      zip.file('zones.kml', 'test');
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      mockZoneBoundaryService.setupZoneBoundariesFromKMZ.mockResolvedValue({
        success: true,
        zonesCreated: 0,
        zonesUpdated: 0,
        errors: [],
        warnings: ['Missing 10 zones'],
        colorMapping: { 'Zona I - Metropolitana Suroriente': '#FF0000' },
        processingTimeMs: 75
      });

      const response = await request(app)
        .post('/api/admin/zones/upload-kmz')
        .attach('kmzFile', kmzBuffer, 'zones.kmz')
        .field('validateOnly', 'true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.zonesCreated).toBe(0);
      expect(response.body.data.zonesUpdated).toBe(0);
      expect(mockZoneBoundaryService.setupZoneBoundariesFromKMZ).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ validateOnly: true })
      );
    });
  });

  describe('GET /api/admin/zones/validate-boundaries', () => {
    it('should return validation report for valid boundaries', async () => {
      const mockValidationReport = {
        isValid: true,
        completeness: {
          expectedZones: 11,
          foundZones: 11,
          missingZones: []
        },
        accuracy: {
          validBoundaries: 11,
          invalidBoundaries: 0,
          boundaryErrors: []
        },
        coverage: {
          totalArea: 1000,
          averageArea: 90.9,
          smallestZone: 'Zona I',
          largestZone: 'Zona VII'
        },
        recommendations: []
      };

      mockZoneBoundaryService.validateZoneBoundaryAccuracy.mockResolvedValue(mockValidationReport);

      const response = await request(app)
        .get('/api/admin/zones/validate-boundaries');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockValidationReport);
      expect(response.body.message).toBe('Zone boundaries are valid and complete');
    });

    it('should return validation report for invalid boundaries', async () => {
      const mockValidationReport = {
        isValid: false,
        completeness: {
          expectedZones: 11,
          foundZones: 5,
          missingZones: ['Zona VI', 'Zona VII', 'Zona VIII', 'Zona IX', 'Zona X', 'Zona XI']
        },
        accuracy: {
          validBoundaries: 4,
          invalidBoundaries: 1,
          boundaryErrors: ['Zone "Zona I" has invalid boundaries']
        },
        coverage: {
          totalArea: 500,
          averageArea: 100,
          smallestZone: 'Zona II',
          largestZone: 'Zona V'
        },
        recommendations: ['Import missing zones', 'Fix invalid boundaries']
      };

      mockZoneBoundaryService.validateZoneBoundaryAccuracy.mockResolvedValue(mockValidationReport);

      const response = await request(app)
        .get('/api/admin/zones/validate-boundaries');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toEqual(mockValidationReport);
      expect(response.body.message).toBe('Zone boundaries have issues that need attention');
    });

    it('should handle service errors', async () => {
      mockZoneBoundaryService.validateZoneBoundaryAccuracy.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin/zones/validate-boundaries');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database error');
    });
  });

  describe('GET /api/admin/zones/color-mapping', () => {
    it('should return zone color mapping', async () => {
      const mockColorMapping = {
        'Zona I - Metropolitana Suroriente': '#FF0000',
        'Zona II - Metropolitana Suroccidente': '#00FF00',
        'Zona VII - Rural Oriental Norte': '#0000FF'
      };

      mockZoneBoundaryService.getZoneColorMapping.mockResolvedValue(mockColorMapping);

      const response = await request(app)
        .get('/api/admin/zones/color-mapping');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.colorMapping).toEqual(mockColorMapping);
      expect(response.body.message).toBe('Zone color mapping retrieved successfully');
    });

    it('should handle empty color mapping', async () => {
      mockZoneBoundaryService.getZoneColorMapping.mockResolvedValue({});

      const response = await request(app)
        .get('/api/admin/zones/color-mapping');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.colorMapping).toEqual({});
    });

    it('should handle service errors', async () => {
      mockZoneBoundaryService.getZoneColorMapping.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/admin/zones/color-mapping');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Service error');
    });
  });

  describe('POST /api/admin/zones/test-boundaries', () => {
    it('should test zone boundaries with valid coordinates', async () => {
      const testCoordinates = [
        { latitude: 4.65, longitude: -74.05, expectedZone: 'Zona I - Metropolitana Suroriente' },
        { latitude: 5.05, longitude: -73.45 }
      ];

      const mockTestResult = {
        success: true,
        results: [
          {
            coordinate: { latitude: 4.65, longitude: -74.05 },
            detectedZone: 'Zona I - Metropolitana Suroriente',
            expectedZone: 'Zona I - Metropolitana Suroriente',
            isCorrect: true
          },
          {
            coordinate: { latitude: 5.05, longitude: -73.45 },
            detectedZone: 'Zona VII - Rural Oriental Norte',
            expectedZone: undefined,
            isCorrect: true
          }
        ],
        accuracy: 1.0,
        errors: []
      };

      mockZoneBoundaryService.testZoneBoundarySetup.mockResolvedValue(mockTestResult);

      const response = await request(app)
        .post('/api/admin/zones/test-boundaries')
        .send({ testCoordinates });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accuracy).toBe(1.0);
      expect(response.body.data.summary.accuracyPercentage).toBe(100);
      expect(response.body.data.summary.totalTested).toBe(2);
      expect(response.body.data.summary.correctDetections).toBe(2);
    });

    it('should handle missing test coordinates', async () => {
      const response = await request(app)
        .post('/api/admin/zones/test-boundaries')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Test coordinates array is required');
    });

    it('should handle invalid coordinate format', async () => {
      const testCoordinates = [
        { latitude: 'invalid', longitude: -74.05 }
      ];

      const response = await request(app)
        .post('/api/admin/zones/test-boundaries')
        .send({ testCoordinates });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid coordinate format. Each coordinate must have latitude and longitude numbers');
    });

    it('should handle testing errors', async () => {
      const testCoordinates = [
        { latitude: 4.65, longitude: -74.05 }
      ];

      const mockTestResult = {
        success: false,
        results: [],
        accuracy: 0,
        errors: ['Database connection failed']
      };

      mockZoneBoundaryService.testZoneBoundarySetup.mockResolvedValue(mockTestResult);

      const response = await request(app)
        .post('/api/admin/zones/test-boundaries')
        .send({ testCoordinates });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.data.errors).toContain('Database connection failed');
    });

    it('should handle service exceptions', async () => {
      const testCoordinates = [
        { latitude: 4.65, longitude: -74.05 }
      ];

      mockZoneBoundaryService.testZoneBoundarySetup.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/admin/zones/test-boundaries')
        .send({ testCoordinates });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Service error');
    });
  });

  describe('GET /api/admin/zones/setup-status', () => {
    it('should return complete setup status', async () => {
      const mockValidationReport = {
        isValid: true,
        completeness: {
          expectedZones: 11,
          foundZones: 11,
          missingZones: []
        },
        accuracy: {
          validBoundaries: 11,
          invalidBoundaries: 0,
          boundaryErrors: []
        },
        coverage: {
          totalArea: 1000,
          averageArea: 90.9,
          smallestZone: 'Zona I',
          largestZone: 'Zona VII'
        },
        recommendations: []
      };

      const mockColorMapping = {
        'Zona I - Metropolitana Suroriente': '#FF0000',
        'Zona II - Metropolitana Suroccidente': '#00FF00'
      };

      mockZoneBoundaryService.validateZoneBoundaryAccuracy.mockResolvedValue(mockValidationReport);
      mockZoneBoundaryService.getZoneColorMapping.mockResolvedValue(mockColorMapping);

      const response = await request(app)
        .get('/api/admin/zones/setup-status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isSetupComplete).toBe(true);
      expect(response.body.data.completeness).toEqual(mockValidationReport.completeness);
      expect(response.body.data.colorMapping).toEqual(mockColorMapping);
      expect(response.body.message).toBe('Zone boundaries are properly set up');
    });

    it('should return incomplete setup status', async () => {
      const mockValidationReport = {
        isValid: false,
        completeness: {
          expectedZones: 11,
          foundZones: 5,
          missingZones: ['Zona VI', 'Zona VII', 'Zona VIII', 'Zona IX', 'Zona X', 'Zona XI']
        },
        accuracy: {
          validBoundaries: 5,
          invalidBoundaries: 0,
          boundaryErrors: []
        },
        coverage: {
          totalArea: 500,
          averageArea: 100,
          smallestZone: 'Zona I',
          largestZone: 'Zona V'
        },
        recommendations: ['Import missing zones']
      };

      mockZoneBoundaryService.validateZoneBoundaryAccuracy.mockResolvedValue(mockValidationReport);
      mockZoneBoundaryService.getZoneColorMapping.mockResolvedValue({});

      const response = await request(app)
        .get('/api/admin/zones/setup-status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isSetupComplete).toBe(false);
      expect(response.body.data.recommendations).toContain('Import missing zones');
      expect(response.body.message).toBe('Zone boundaries setup needs attention');
    });

    it('should handle service errors', async () => {
      mockZoneBoundaryService.validateZoneBoundaryAccuracy.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin/zones/setup-status');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Database error');
    });
  });
});