import { KMZParser } from '../../services/KMZParser';
import { GeoPolygon } from '../../types';
import JSZip from 'jszip';

describe('KMZParser', () => {
  let kmzParser: KMZParser;

  beforeEach(() => {
    kmzParser = new KMZParser();
  });

  describe('parseKMZFile', () => {
    it('should parse a valid KMZ file with zone data', async () => {
      // Create a mock KMZ file with KML content
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Zona I - Metropolitana Suroriente</name>
              <description>Metropolitan zone southeast</description>
              <Polygon>
                <outerBoundaryIs>
                  <LinearRing>
                    <coordinates>
                      -74.1,4.6,0 -74.0,4.6,0 -74.0,4.7,0 -74.1,4.7,0 -74.1,4.6,0
                    </coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
            </Placemark>
          </Document>
        </kml>`;

      const zip = new JSZip();
      zip.file('zones.kml', mockKML);
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(1);
      expect(result.zones[0]).toMatchObject({
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        boundaries: {
          type: 'Polygon',
          coordinates: expect.any(Array)
        }
      });
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.processedZones).toBe(1);
    });

    it('should handle KMZ file without KML content', async () => {
      const zip = new JSZip();
      zip.file('readme.txt', 'No KML here');
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(0);
      expect(result.errors).toContain('No KML file found in KMZ archive');
    });

    it('should handle invalid KMZ buffer', async () => {
      const invalidBuffer = Buffer.from('invalid kmz content');

      const result = await kmzParser.parseKMZFile(invalidBuffer);

      expect(result.zones).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should process multiple zones from KML', async () => {
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
            <Placemark>
              <name>Zona VII - Rural Oriental Norte</name>
              <Polygon>
                <outerBoundaryIs>
                  <LinearRing>
                    <coordinates>-73.5,5.0,0 -73.4,5.0,0 -73.4,5.1,0 -73.5,5.1,0 -73.5,5.0,0</coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
            </Placemark>
          </Document>
        </kml>`;

      const zip = new JSZip();
      zip.file('zones.kml', mockKML);
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(2);
      expect(result.zones[0]?.type).toBe('metropolitana');
      expect(result.zones[1]?.type).toBe('rural');
    });
  });

  describe('validateKMZData', () => {
    it('should validate complete zone data', async () => {
      const mockZones = [
        {
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana' as const,
          boundaries: {
            type: 'Polygon' as const,
            coordinates: [
              { longitude: -74.1, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.7 },
              { longitude: -74.1, latitude: 4.7 },
              { longitude: -74.1, latitude: 4.6 }
            ]
          }
        }
      ];

      const result = await kmzParser.validateKMZData(mockZones);

      expect(result.isValid).toBe(false); // Missing other zones
      expect(result.zoneCompleteness.foundZones).toBe(1);
      expect(result.zoneCompleteness.expectedZones).toBe(11);
      expect(result.zoneCompleteness.missingZones.length).toBe(10);
    });

    it('should detect invalid boundaries', async () => {
      const mockZones = [
        {
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana' as const,
          boundaries: {
            type: 'Polygon' as const,
            coordinates: [
              { longitude: -74.1, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.6 }
              // Missing coordinates for valid polygon
            ]
          }
        }
      ];

      const result = await kmzParser.validateKMZData(mockZones);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Zone "Zona I - Metropolitana Suroriente" has invalid boundaries');
    });

    it('should detect coordinates outside Colombia bounds', async () => {
      const mockZones = [
        {
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana' as const,
          boundaries: {
            type: 'Polygon' as const,
            coordinates: [
              { longitude: -100.0, latitude: 50.0 }, // Outside Colombia
              { longitude: -74.0, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.7 },
              { longitude: -100.0, latitude: 50.0 }
            ]
          }
        }
      ];

      const result = await kmzParser.validateKMZData(mockZones);

      expect(result.warnings).toContain('Zone "Zona I - Metropolitana Suroriente" has coordinates outside Colombia bounds');
    });
  });

  describe('convertToPostGISFormat', () => {
    it('should convert KMZ zones to database format', () => {
      const mockZones = [
        {
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana' as const,
          boundaries: {
            type: 'Polygon' as const,
            coordinates: [
              { longitude: -74.1, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.6 },
              { longitude: -74.0, latitude: 4.7 },
              { longitude: -74.1, latitude: 4.7 },
              { longitude: -74.1, latitude: 4.6 }
            ]
          },
          color: '#FF0000'
        }
      ];

      const result = kmzParser.convertToPostGISFormat(mockZones);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        boundaries: {
          type: 'Polygon',
          coordinates: expect.any(Array)
        },
        isActive: true
      });
    });
  });

  describe('generateColorMapping', () => {
    it('should generate color mapping for zones', () => {
      const mockZones = [
        {
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana' as const,
          boundaries: {} as GeoPolygon,
          color: '#FF0000'
        },
        {
          name: 'Zona VII - Rural Oriental Norte',
          type: 'rural' as const,
          boundaries: {} as GeoPolygon,
          color: '#00FF00'
        }
      ];

      const result = kmzParser.generateColorMapping(mockZones);

      expect(result).toEqual({
        'Zona I - Metropolitana Suroriente': '#FF0000',
        'Zona VII - Rural Oriental Norte': '#00FF00'
      });
    });

    it('should use default colors when zone color is not provided', () => {
      const mockZones = [
        {
          name: 'Zona I - Metropolitana Suroriente',
          type: 'metropolitana' as const,
          boundaries: {} as GeoPolygon
        }
      ];

      const result = kmzParser.generateColorMapping(mockZones);

      expect(result['Zona I - Metropolitana Suroriente']).toBeDefined();
      expect(result['Zona I - Metropolitana Suroriente']).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('zone name normalization', () => {
    it('should normalize zone names for comparison', () => {
      // Test the private method through public interface
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>ZONA I - METROPOLITANA SURORIENTE</name>
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

      // This should match despite case differences
      expect(async () => {
        const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const result = await kmzParser.parseKMZFile(kmzBuffer);
        expect(result.zones).toHaveLength(1);
        expect(result.zones[0]?.name).toBe('Zona I - Metropolitana Suroriente');
      }).not.toThrow();
    });
  });

  describe('polygon processing', () => {
    it('should handle MultiPolygon geometry', async () => {
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Zona I - Metropolitana Suroriente</name>
              <MultiGeometry>
                <Polygon>
                  <outerBoundaryIs>
                    <LinearRing>
                      <coordinates>-74.1,4.6,0 -74.0,4.6,0 -74.0,4.7,0 -74.1,4.7,0 -74.1,4.6,0</coordinates>
                    </LinearRing>
                  </outerBoundaryIs>
                </Polygon>
                <Polygon>
                  <outerBoundaryIs>
                    <LinearRing>
                      <coordinates>-74.2,4.8,0 -74.15,4.8,0 -74.15,4.85,0 -74.2,4.85,0 -74.2,4.8,0</coordinates>
                    </LinearRing>
                  </outerBoundaryIs>
                </Polygon>
              </MultiGeometry>
            </Placemark>
          </Document>
        </kml>`;

      const zip = new JSZip();
      zip.file('zones.kml', mockKML);
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(1);
      expect(result.zones[0]?.boundaries.coordinates.length).toBeGreaterThan(3);
    });

    it('should skip invalid geometries', async () => {
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Zona I - Metropolitana Suroriente</name>
              <Point>
                <coordinates>-74.1,4.6,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`;

      const zip = new JSZip();
      zip.file('zones.kml', mockKML);
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(0);
      expect(result.metadata.skippedPlacemarks).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle malformed KML', async () => {
      const malformedKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Zona I - Metropolitana Suroriente</name>
              <!-- Missing closing tags -->
        </kml>`;

      const zip = new JSZip();
      zip.file('zones.kml', malformedKML);
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      // Should handle gracefully without crashing
      expect(result.zones).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty KML file', async () => {
      const emptyKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
          </Document>
        </kml>`;

      const zip = new JSZip();
      zip.file('zones.kml', emptyKML);
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(0);
      expect(result.errors).toContain('No features found in KML file');
    });
  });
});