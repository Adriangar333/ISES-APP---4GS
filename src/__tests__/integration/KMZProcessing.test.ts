import { KMZParser } from '../../services/KMZParser';
import { ZoneBoundaryService } from '../../services/ZoneBoundaryService';
import JSZip from 'jszip';

describe('KMZ Processing Integration', () => {
  let kmzParser: KMZParser;
  let zoneBoundaryService: ZoneBoundaryService;

  beforeEach(() => {
    kmzParser = new KMZParser();
    // Don't inject repository for integration test - let it use defaults
    zoneBoundaryService = new ZoneBoundaryService();
  });

  describe('KMZ File Processing', () => {
    it('should parse a simple KMZ file successfully', async () => {
      // Create a valid KML content
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Zona I - Metropolitana Suroriente</name>
              <description>Test zone</description>
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
      expect(result.zones[0]?.name).toBe('Zona I - Metropolitana Suroriente');
      expect(result.zones[0]?.type).toBe('metropolitana');
      expect(result.zones[0]?.boundaries.coordinates).toHaveLength(5);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.processedZones).toBe(1);
    });

    it('should handle multiple zones in KMZ', async () => {
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
      expect(result.errors).toHaveLength(0);
    });

    it('should validate zone data correctly', async () => {
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

      const validationResult = await kmzParser.validateKMZData(mockZones);

      expect(validationResult.isValid).toBe(false); // Missing other zones
      expect(validationResult.zoneCompleteness.foundZones).toBe(1);
      expect(validationResult.zoneCompleteness.expectedZones).toBe(11);
      expect(validationResult.zoneCompleteness.missingZones).toHaveLength(10);
    });

    it('should generate color mapping', () => {
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

      const colorMapping = kmzParser.generateColorMapping(mockZones);

      expect(colorMapping).toHaveProperty('Zona I - Metropolitana Suroriente');
      expect(colorMapping['Zona I - Metropolitana Suroriente']).toBe('#FF0000');
    });

    it('should convert to PostGIS format', () => {
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

      const postgisFormat = kmzParser.convertToPostGISFormat(mockZones);

      expect(postgisFormat).toHaveLength(1);
      expect(postgisFormat[0]).toMatchObject({
        name: 'Zona I - Metropolitana Suroriente',
        type: 'metropolitana',
        isActive: true
      });
      expect(postgisFormat[0]?.boundaries.coordinates).toHaveLength(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid KMZ files gracefully', async () => {
      const invalidBuffer = Buffer.from('not a valid kmz file');

      const result = await kmzParser.parseKMZFile(invalidBuffer);

      expect(result.zones).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.metadata.processedZones).toBe(0);
    });

    it('should handle KMZ without KML files', async () => {
      const zip = new JSZip();
      zip.file('readme.txt', 'This is not a KML file');
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(0);
      expect(result.errors).toContain('KMZ parsing failed: No KML file found in KMZ archive');
    });

    it('should handle empty KML files', async () => {
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
      expect(result.errors).toContain('KMZ parsing failed: No features found in KML file');
    });

    it('should skip non-zone placemarks', async () => {
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Some Random Place</name>
              <Polygon>
                <outerBoundaryIs>
                  <LinearRing>
                    <coordinates>-74.1,4.6,0 -74.0,4.6,0 -74.0,4.7,0 -74.1,4.7,0 -74.1,4.6,0</coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
            </Placemark>
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

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(1); // Only the valid zone
      expect(result.zones[0]?.name).toBe('Zona I - Metropolitana Suroriente');
      expect(result.metadata.skippedPlacemarks).toBe(1);
    });
  });

  describe('Zone Name Normalization', () => {
    it('should normalize zone names with different cases', async () => {
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
      const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      const result = await kmzParser.parseKMZFile(kmzBuffer);

      expect(result.zones).toHaveLength(1);
      expect(result.zones[0]?.name).toBe('Zona I - Metropolitana Suroriente');
    });

    it('should handle zone names with accents and special characters', async () => {
      const mockKML = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Zona VII - Rural Oriéntal Norte</name>
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

      expect(result.zones).toHaveLength(1);
      expect(result.zones[0]?.name).toBe('Zona VII - Rural Oriental Norte');
      expect(result.zones[0]?.type).toBe('rural');
    });
  });
});