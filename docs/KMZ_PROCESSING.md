# KMZ File Processing for Zone Boundaries

This document describes how to use the KMZ file processor to set up zone boundaries for the Route Assignment System.

## Overview

The KMZ processor extracts zone boundary information from KMZ files (Google Earth format) and converts them to PostGIS-compatible format for database storage. This is a one-time setup process that defines the 11 predefined zones for the ISES route assignment system.

## Features

- **KMZ File Parsing**: Extracts zone polygons from KMZ archives
- **Color Mapping**: Preserves zone colors for frontend visualization
- **Data Validation**: Ensures zone completeness and boundary accuracy
- **PostGIS Conversion**: Converts geometry to database-compatible format
- **Zone Detection**: Automatically maps coordinates to zones using precise boundaries

## Expected Zones

The system expects the following 11 zones:

### Metropolitan Zones
1. Zona I - Metropolitana Suroriente
2. Zona II - Metropolitana Suroccidente
3. Zona III - Metropolitana Centro Oriente
4. Zona IV - Metropolitana Centro Occidente
5. Zona V - Metropolitana Noroccidente
6. Zona VI - Metropolitana Nororiente

### Rural Zones
7. Zona VII - Rural Oriental Norte
8. Zona VIII - Rural Occidental Norte
9. Zona IX - Rural Occidental Sur
10. Zona X - Rural Oriental Sur
11. Zona XI - Rural Occidental Centro

## API Endpoints

### Upload and Process KMZ File

```http
POST /api/v1/admin/zones/upload-kmz
Content-Type: multipart/form-data

Parameters:
- kmzFile: KMZ file (required)
- overwriteExisting: boolean (optional, default: false)
- validateOnly: boolean (optional, default: false)
- backupExisting: boolean (optional, default: false)
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "zonesCreated": 11,
    "zonesUpdated": 0,
    "errors": [],
    "warnings": [],
    "colorMapping": {
      "Zona I - Metropolitana Suroriente": "#FF0000",
      "Zona II - Metropolitana Suroccidente": "#00FF00"
    },
    "processingTimeMs": 150
  },
  "message": "Zone boundaries setup completed. Created: 11, Updated: 0",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Validate Zone Boundaries

```http
GET /api/v1/admin/zones/validate-boundaries
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "completeness": {
      "expectedZones": 11,
      "foundZones": 11,
      "missingZones": []
    },
    "accuracy": {
      "validBoundaries": 11,
      "invalidBoundaries": 0,
      "boundaryErrors": []
    },
    "coverage": {
      "totalArea": 25000.5,
      "averageArea": 2272.8,
      "smallestZone": "Zona I - Metropolitana Suroriente",
      "largestZone": "Zona VII - Rural Oriental Norte"
    },
    "recommendations": []
  }
}
```

### Get Zone Color Mapping

```http
GET /api/v1/admin/zones/color-mapping
```

### Test Zone Boundaries

```http
POST /api/v1/admin/zones/test-boundaries
Content-Type: application/json

{
  "testCoordinates": [
    {
      "latitude": 4.65,
      "longitude": -74.05,
      "expectedZone": "Zona I - Metropolitana Suroriente"
    }
  ]
}
```

### Get Setup Status

```http
GET /api/v1/admin/zones/setup-status
```

## Usage Examples

### 1. Upload KMZ File (Validation Only)

```bash
curl -X POST http://localhost:3000/api/v1/admin/zones/upload-kmz \
  -F "kmzFile=@ZONAS_12042024_.kmz" \
  -F "validateOnly=true"
```

### 2. Upload and Import KMZ File

```bash
curl -X POST http://localhost:3000/api/v1/admin/zones/upload-kmz \
  -F "kmzFile=@ZONAS_12042024_.kmz" \
  -F "overwriteExisting=true" \
  -F "backupExisting=true"
```

### 3. Validate Current Zone Setup

```bash
curl http://localhost:3000/api/v1/admin/zones/validate-boundaries
```

### 4. Test Zone Detection

```bash
curl -X POST http://localhost:3000/api/v1/admin/zones/test-boundaries \
  -H "Content-Type: application/json" \
  -d '{
    "testCoordinates": [
      {"latitude": 4.65, "longitude": -74.05, "expectedZone": "Zona I - Metropolitana Suroriente"},
      {"latitude": 5.05, "longitude": -73.45, "expectedZone": "Zona VII - Rural Oriental Norte"}
    ]
  }'
```

## KMZ File Requirements

### File Structure
- Must be a valid KMZ (zipped KML) file
- Must contain at least one KML file
- KML must have valid XML structure

### Zone Naming
Zone names in the KML file should match (case-insensitive):
- "Zona I - Metropolitana Suroriente" (or variations)
- "Zona II - Metropolitana Suroccidente"
- etc.

### Geometry Requirements
- Zones must be defined as Polygon or MultiPolygon geometries
- Polygons must be closed (first and last coordinates should match)
- Coordinates must be within Colombia bounds:
  - Latitude: -4.2° to 13.5°
  - Longitude: -81.8° to -66.8°

### Example KML Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>ISES Zone Boundaries</name>
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
</kml>
```

## Error Handling

### Common Errors

1. **Invalid KMZ File**
   - Error: "No KML file found in KMZ archive"
   - Solution: Ensure the file is a valid KMZ containing KML data

2. **Missing Zones**
   - Error: "Missing zones: Zona III, Zona IV..."
   - Solution: Ensure all 11 zones are present in the KML file

3. **Invalid Boundaries**
   - Error: "Zone has invalid boundaries"
   - Solution: Check that polygons are properly closed and have valid coordinates

4. **Coordinates Out of Bounds**
   - Warning: "Zone has coordinates outside Colombia bounds"
   - Solution: Verify coordinate accuracy and projection

### Validation Warnings

- **Zone Overlaps**: Detected when zone boundaries intersect
- **Small Areas**: Zones with very small areas may indicate errors
- **Unclosed Polygons**: Polygons where first/last coordinates don't match

## Integration with Daily Processing

Once zone boundaries are set up:

1. **Daily Excel Import**: Coordinates from daily Excel files are automatically assigned to zones
2. **Route Creation**: Routes are assigned to zones based on coordinate locations
3. **Inspector Assignment**: Inspectors are assigned routes within their preferred zones
4. **Visualization**: Frontend displays zones with their assigned colors

## Testing

Run the KMZ processing test:

```bash
npm run build
node scripts/test-kmz-processing.js
```

Run unit tests:

```bash
npm test -- --testPathPattern="KMZProcessing"
```

## Troubleshooting

### Performance Issues
- Large KMZ files may take longer to process
- Consider splitting very large files into smaller chunks

### Memory Usage
- KMZ processing loads entire file into memory
- Monitor memory usage for very large files

### Database Issues
- Ensure PostGIS extension is installed and enabled
- Verify database connection before importing zones

### Coordinate System
- KMZ files should use WGS84 (EPSG:4326) coordinate system
- System automatically handles coordinate conversion

## Security Considerations

- File upload size is limited to 50MB
- Only KMZ files are accepted
- File content is validated before processing
- Admin endpoints should be protected with authentication

## Maintenance

### Regular Tasks
1. Validate zone boundaries monthly
2. Test zone detection accuracy with sample coordinates
3. Monitor zone coverage statistics
4. Update color mappings if needed

### Updates
- Zone boundaries should only be updated when official boundary changes occur
- Always backup existing zones before updates
- Test zone detection after boundary updates