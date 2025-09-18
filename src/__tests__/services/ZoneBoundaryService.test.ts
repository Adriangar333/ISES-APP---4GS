import { ZoneBoundaryService } from '../../services/ZoneBoundaryService';
import { ZoneRepository } from '../../repositories/ZoneRepository';
import { Zone } from '../../types';
import JSZip from 'jszip';

// Mock the ZoneRepository
jest.mock('../../repositories/ZoneRepository');

describe('ZoneBoundaryService', () => {
  let zoneBoundaryService: ZoneBoundaryService;
  let mockZoneRepository: jest.Mocked<ZoneRepository>;

  beforeEach(() => {
    mockZoneRepository = new ZoneRepository() as jest.Mocked<ZoneRepository>;
    zoneBoundaryService = new ZoneBoundaryService(mockZoneRepository);
  });

  describe('setupZoneBoundariesFromKMZ', () => {
    it('should successfully set up zone boundaries from valid KMZ', async () => {
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

      // Mock repository methods
      mockZoneRepository.findAllActive.mockResolvedValue([]);
      mockZoneRepository.create.mockResolvedValue({
        id: '1',
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        boundaries: {
          type: 'Polygon',
          coordinates: [
            { longitude: -74.1, latitude: 4.6 },
            { longitude: -74.0, latitude: 4.6 },
            { longitude: -74.0, latitude: 4.7 },
            { longitude: -74.1, latitude: 4.7 },
            { longitude: -74.1, latitude: 4.6 }
          ]
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await zoneBoundaryService.setupZoneBoundariesFromKMZ(kmzBuffer);

      expect(result.success).toBe(true);
      expect(result.zonesCreated).toBe(1);
      expect(result.zonesUpdated).toBe(0);
      expect(mockZoneRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should handle validation-only mode', async () => {
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

      const result = await zoneBoundaryService.setupZoneBoundariesFromKMZ(kmzBuffer, {
        validateOnly: true
      });

      expect(result.zonesCreated).toBe(0);
      expect(result.zonesUpdated).toBe(0);
      expect(mockZoneRepository.create).not.toHaveBeenCalled();
      expect(mockZoneRepository.update).not.toHaveBeenCalled();
    });

    it('should update existing zones when overwriteExisting is true', async () => {
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

      const existingZone: Zone = {
        id: '1',
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        boundaries: {
          type: 'Polygon',
          coordinates: [
            { longitude: -74.2, latitude: 4.5 },
            { longitude: -74.1, latitude: 4.5 },
            { longitude: -74.1, latitude: 4.6 },
            { longitude: -74.2, latitude: 4.6 },
            { longitude: -74.2, latitude: 4.5 }
          ]
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockZoneRepository.findAllActive.mockResolvedValue([existingZone]);
      mockZoneRepository.update.mockResolvedValue({
        ...existingZone,
        boundaries: {
          type: 'Polygon',
          coordinates: [
            { longitude: -74.1, latitude: 4.6 },
            { longitude: -74.0, latitude: 4.6 },
            { longitude: -74.0, latitude: 4.7 },
            { longitude: -74.1, latitude: 4.7 },
            { longitude: -74.1, latitude: 4.6 }
          ]
        }
      });

      const result = await zoneBoundaryService.setupZoneBoundariesFromKMZ(kmzBuffer, {
        overwriteExisting: true
      });

      expect(result.success).toBe(true);
      expect(result.zonesCreated).toBe(0);
      expect(result.zonesUpdated).toBe(1);
      expect(mockZoneRepository.update).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid KMZ file', async () => {
      const invalidBuffer = Buffer.from('invalid kmz content');

      const result = await zoneBoundaryService.setupZoneBoundariesFromKMZ(invalidBuffer);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.zonesCreated).toBe(0);
    });

    it('should skip existing zones when overwriteExisting is false', async () => {
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

      const existingZone: Zone = {
        id: '1',
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        boundaries: {
          type: 'Polygon',
          coordinates: []
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockZoneRepository.findAllActive.mockResolvedValue([existingZone]);

      const result = await zoneBoundaryService.setupZoneBoundariesFromKMZ(kmzBuffer, {
        overwriteExisting: false
      });

      expect(result.warnings).toContain('Zone "Zona I - Metropolitana Suroriente" already exists, skipping (use overwriteExisting option to update)');
      expect(result.zonesCreated).toBe(0);
      expect(result.zonesUpdated).toBe(0);
    });
  });

  describe('validateZoneBoundaryAccuracy', () => {
    it('should validate complete zone setup', async () => {
      const mockZones: Zone[] = [
        {
          id: '1',
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana',
          boundaries: {
            type: 'Polygon',
            coordinates: [
              { longitude: -74.1, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.7 },
              { longitude: -74.1, latitude: 4.7 },
              { longitude: -74.1, latitude: 4.6 }
            ]
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockZoneRepository.findAllActive.mockResolvedValue(mockZones);

      const result = await zoneBoundaryService.validateZoneBoundaryAccuracy();

      expect(result.completeness.foundZones).toBe(1);
      expect(result.completeness.expectedZones).toBe(11);
      expect(result.completeness.missingZones.length).toBe(10);
      expect(result.accuracy.validBoundaries).toBe(1);
      expect(result.accuracy.invalidBoundaries).toBe(0);
    });

    it('should detect invalid boundaries', async () => {
      const mockZones: Zone[] = [
        {
          id: '1',
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana',
          boundaries: {
            type: 'Polygon',
            coordinates: [] // Invalid - empty coordinates
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockZoneRepository.findAllActive.mockResolvedValue(mockZones);

      const result = await zoneBoundaryService.validateZoneBoundaryAccuracy();

      expect(result.accuracy.validBoundaries).toBe(0);
      expect(result.accuracy.invalidBoundaries).toBe(1);
      expect(result.accuracy.boundaryErrors).toContain('Zone "Zona I - Metropolitana Suroriente" has invalid boundaries');
    });

    it('should handle no zones in database', async () => {
      mockZoneRepository.findAllActive.mockResolvedValue([]);

      const result = await zoneBoundaryService.validateZoneBoundaryAccuracy();

      expect(result.isValid).toBe(false);
      expect(result.completeness.foundZones).toBe(0);
      expect(result.accuracy.boundaryErrors).toContain('No zones found in database');
      expect(result.recommendations).toContain('Import zone boundaries from KMZ file');
    });
  });

  describe('testZoneBoundarySetup', () => {
    it('should test zone detection with sample coordinates', async () => {
      const testCoordinates = [
        { latitude: 4.65, longitude: -74.05, expectedZone: 'Zona I - Metropolitana Suroriente' },
        { latitude: 5.05, longitude: -73.45 } // No expected zone
      ];

      const mockZone: Zone = {
        id: '1',
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        boundaries: {
          type: 'Polygon',
          coordinates: []
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockZoneRepository.findZoneContainingPoint
        .mockResolvedValueOnce(mockZone) // First coordinate matches
        .mockResolvedValueOnce(null); // Second coordinate doesn't match

      const result = await zoneBoundaryService.testZoneBoundarySetup(testCoordinates);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.isCorrect).toBe(true);
      expect(result.results[1]?.isCorrect).toBe(true); // No expected zone, so null detection is correct
      expect(result.accuracy).toBe(1.0);
    });

    it('should handle zone detection errors', async () => {
      const testCoordinates = [
        { latitude: 4.65, longitude: -74.05, expectedZone: 'Zona I - Metropolitana Suroriente' }
      ];

      mockZoneRepository.findZoneContainingPoint.mockRejectedValue(new Error('Database error'));

      const result = await zoneBoundaryService.testZoneBoundarySetup(testCoordinates);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Error testing coordinate (4.65, -74.05): Database error');
      expect(result.accuracy).toBe(0);
    });

    it('should calculate accuracy correctly', async () => {
      const testCoordinates = [
        { latitude: 4.65, longitude: -74.05, expectedZone: 'Zona I - Metropolitana Suroriente' },
        { latitude: 4.75, longitude: -74.15, expectedZone: 'Zona II - Metropolitana Suroccidente' },
        { latitude: 5.05, longitude: -73.45, expectedZone: 'Zona VII - Rural Oriental Norte' }
      ];

      const mockZone1: Zone = {
        id: '1',
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        boundaries: { type: 'Polygon', coordinates: [] },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockZoneRepository.findZoneContainingPoint
        .mockResolvedValueOnce(mockZone1) // Correct detection
        .mockResolvedValueOnce(null) // Wrong detection (should be Zona II)
        .mockResolvedValueOnce(null); // Wrong detection (should be Zona VII)

      const result = await zoneBoundaryService.testZoneBoundarySetup(testCoordinates);

      expect(result.accuracy).toBeCloseTo(0.33, 2); // 1 out of 3 correct
      expect(result.results[0]?.isCorrect).toBe(true);
      expect(result.results[1]?.isCorrect).toBe(false);
      expect(result.results[2]?.isCorrect).toBe(false);
    });
  });

  describe('getZoneColorMapping', () => {
    it('should generate color mapping for existing zones', async () => {
      const mockZones: Zone[] = [
        {
          id: '1',
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana',
          boundaries: { type: 'Polygon', coordinates: [] },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          name: 'Zona VII - Rural Oriental Norte',
          type: 'rural',
          boundaries: { type: 'Polygon', coordinates: [] },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockZoneRepository.findAllActive.mockResolvedValue(mockZones);

      const result = await zoneBoundaryService.getZoneColorMapping();

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['Zona I - Metropolitana Suroriente']).toMatch(/^#[0-9A-F]{6}$/i);
      expect(result['Zona VII - Rural Oriental Norte']).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should handle empty zone list', async () => {
      mockZoneRepository.findAllActive.mockResolvedValue([]);

      const result = await zoneBoundaryService.getZoneColorMapping();

      expect(result).toEqual({});
    });

    it('should handle repository errors', async () => {
      mockZoneRepository.findAllActive.mockRejectedValue(new Error('Database error'));

      const result = await zoneBoundaryService.getZoneColorMapping();

      expect(result).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
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

      mockZoneRepository.findAllActive.mockResolvedValue([]);
      mockZoneRepository.create.mockRejectedValue(new Error('Database connection failed'));

      const result = await zoneBoundaryService.setupZoneBoundariesFromKMZ(kmzBuffer);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to process zone "Zona I - Metropolitana Suroriente": Database connection failed');
    });

    it('should handle validation errors gracefully', async () => {
      mockZoneRepository.findAllActive.mockRejectedValue(new Error('Database error'));

      const result = await zoneBoundaryService.validateZoneBoundaryAccuracy();

      expect(result.isValid).toBe(false);
      expect(result.accuracy.boundaryErrors).toContain('Database error');
    });
  });
});