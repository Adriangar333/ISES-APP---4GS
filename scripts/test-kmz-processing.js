const fs = require('fs');
const path = require('path');

// Simple test script to demonstrate KMZ processing functionality
async function testKMZProcessing() {
  console.log('🚀 Testing KMZ Processing Functionality');
  console.log('=====================================\n');

  try {
    // Import the KMZ parser (using require for Node.js compatibility)
    const { KMZParser } = require('../dist/services/KMZParser');
    const JSZip = require('jszip');

    const kmzParser = new KMZParser();

    // Create a sample KMZ file for testing
    console.log('📦 Creating sample KMZ file...');
    
    const sampleKML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>ISES Zone Boundaries</name>
    <description>Zone boundaries for route assignment system</description>
    
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
    
    <Placemark>
      <name>Zona II - Metropolitana Suroccidente</name>
      <description>Metropolitan zone southwest</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -74.2,4.5,0 -74.1,4.5,0 -74.1,4.6,0 -74.2,4.6,0 -74.2,4.5,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    
    <Placemark>
      <name>Zona VII - Rural Oriental Norte</name>
      <description>Rural zone eastern north</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -73.5,5.0,0 -73.4,5.0,0 -73.4,5.1,0 -73.5,5.1,0 -73.5,5.0,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    
    <!-- This should be skipped as it's not a recognized zone -->
    <Placemark>
      <name>Some Random Location</name>
      <description>This should be ignored</description>
      <Point>
        <coordinates>-74.05,4.65,0</coordinates>
      </Point>
    </Placemark>
    
  </Document>
</kml>`;

    // Create KMZ file
    const zip = new JSZip();
    zip.file('zones.kml', sampleKML);
    const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    console.log('✅ Sample KMZ file created\n');

    // Parse the KMZ file
    console.log('🔍 Parsing KMZ file...');
    const parsingResult = await kmzParser.parseKMZFile(kmzBuffer);

    console.log('📊 Parsing Results:');
    console.log(`   • Total placemarks found: ${parsingResult.metadata.totalPlacemarks}`);
    console.log(`   • Zones processed: ${parsingResult.metadata.processedZones}`);
    console.log(`   • Placemarks skipped: ${parsingResult.metadata.skippedPlacemarks}`);
    console.log(`   • Processing time: ${parsingResult.metadata.parsingTimeMs}ms`);
    console.log(`   • Errors: ${parsingResult.errors.length}`);

    if (parsingResult.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      parsingResult.errors.forEach(error => console.log(`   • ${error}`));
    }

    console.log('\n🗺️  Processed Zones:');
    parsingResult.zones.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.name}`);
      console.log(`      • Type: ${zone.type}`);
      console.log(`      • Boundary points: ${zone.boundaries.coordinates.length}`);
      console.log(`      • Color: ${zone.color || 'default'}`);
    });

    // Validate the parsed data
    console.log('\n🔍 Validating zone data...');
    const validationResult = await kmzParser.validateKMZData(parsingResult.zones);

    console.log('📋 Validation Results:');
    console.log(`   • Is valid: ${validationResult.isValid ? '✅' : '❌'}`);
    console.log(`   • Expected zones: ${validationResult.zoneCompleteness.expectedZones}`);
    console.log(`   • Found zones: ${validationResult.zoneCompleteness.foundZones}`);
    console.log(`   • Missing zones: ${validationResult.zoneCompleteness.missingZones.length}`);

    if (validationResult.zoneCompleteness.missingZones.length > 0) {
      console.log('\n📝 Missing zones:');
      validationResult.zoneCompleteness.missingZones.forEach(zone => {
        console.log(`   • ${zone}`);
      });
    }

    if (validationResult.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validationResult.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (validationResult.errors.length > 0) {
      console.log('\n❌ Validation errors:');
      validationResult.errors.forEach(error => console.log(`   • ${error}`));
    }

    // Generate color mapping
    console.log('\n🎨 Generating color mapping...');
    const colorMapping = kmzParser.generateColorMapping(parsingResult.zones);
    
    console.log('Color assignments:');
    Object.entries(colorMapping).forEach(([zoneName, color]) => {
      console.log(`   • ${zoneName}: ${color}`);
    });

    // Convert to PostGIS format
    console.log('\n🗄️  Converting to database format...');
    const postgisFormat = kmzParser.convertToPostGISFormat(parsingResult.zones);
    
    console.log('Database-ready zones:');
    postgisFormat.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.name} (${zone.type}) - ${zone.isActive ? 'Active' : 'Inactive'}`);
    });

    console.log('\n✅ KMZ processing test completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   • Successfully parsed ${parsingResult.zones.length} zones from KMZ file`);
    console.log(`   • Generated color mapping for visualization`);
    console.log(`   • Converted to PostGIS-compatible format`);
    console.log(`   • Ready for database import`);

  } catch (error) {
    console.error('❌ Error during KMZ processing test:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testKMZProcessing().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testKMZProcessing };