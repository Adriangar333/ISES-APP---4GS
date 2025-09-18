#!/usr/bin/env node

const https = require('https');

// Configuración
const N8N_WEBHOOK_URL = 'https://n8n-n8n.zvkdyr.easypanel.host/webhook-test/process-coordinates';

// Datos de prueba con coordenadas de Bogotá
const testData = {
  coordinates: [
    {
      id: "coord-1",
      latitude: 4.6097,
      longitude: -74.0817,
      address: "Centro de Bogotá"
    },
    {
      id: "coord-2", 
      latitude: 4.7110,
      longitude: -74.0721,
      address: "Zona Norte - Chapinero"
    },
    {
      id: "coord-3",
      latitude: 4.5981,
      longitude: -74.0758,
      address: "Zona Sur"
    },
    {
      id: "coord-4",
      latitude: 4.6351,
      longitude: -74.0703,
      address: "Zona Centro-Norte"
    },
    {
      id: "coord-5",
      latitude: 4.5500,
      longitude: -74.1000,
      address: "Zona Suroccidental"
    }
  ]
};

console.log('🚀 Enviando coordenadas a n8n...');
console.log('📍 Coordenadas a procesar:', testData.coordinates.length);

// Convertir datos a JSON
const postData = JSON.stringify(testData);

// Configurar la petición
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

// Realizar la petición
const req = https.request(N8N_WEBHOOK_URL, options, (res) => {
  console.log(`📡 Status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);

  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\n✅ Respuesta de n8n:');
      console.log('📊 Resumen:', response.summary);
      
      if (response.zoneAssignments && response.zoneAssignments.length > 0) {
        console.log('\n🗺️  Asignaciones por zona:');
        response.zoneAssignments.forEach(zone => {
          console.log(`  - ${zone.zoneName} (${zone.zoneType}): ${zone.coordinates.length} coordenadas`);
        });
      }
      
      if (response.unassignedCoordinates && response.unassignedCoordinates.length > 0) {
        console.log('\n❌ Coordenadas sin asignar:');
        response.unassignedCoordinates.forEach(coord => {
          console.log(`  - ${coord.address} (${coord.latitude}, ${coord.longitude})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error en la petición:', error);
});

// Enviar los datos
req.write(postData);
req.end();

console.log('⏳ Esperando respuesta...');