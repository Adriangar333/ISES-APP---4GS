#!/usr/bin/env node

const http = require('http');

// Configuración de tu API local
const API_BASE_URL = 'http://localhost:3000/api/v1';

// Zonas de prueba para Bogotá
const testZones = [
  {
    name: "Zona I - Metropolitana Suroriente",
    type: "metropolitana",
    boundaries: {
      type: "Polygon",
      coordinates: [
        { latitude: 4.5500, longitude: -74.1200 },
        { latitude: 4.5500, longitude: -74.0500 },
        { latitude: 4.6200, longitude: -74.0500 },
        { latitude: 4.6200, longitude: -74.1200 },
        { latitude: 4.5500, longitude: -74.1200 }
      ]
    },
    isActive: true
  },
  {
    name: "Zona II - Metropolitana Centro",
    type: "metropolitana", 
    boundaries: {
      type: "Polygon",
      coordinates: [
        { latitude: 4.5800, longitude: -74.0900 },
        { latitude: 4.5800, longitude: -74.0600 },
        { latitude: 4.6400, longitude: -74.0600 },
        { latitude: 4.6400, longitude: -74.0900 },
        { latitude: 4.5800, longitude: -74.0900 }
      ]
    },
    isActive: true
  },
  {
    name: "Zona III - Metropolitana Norte",
    type: "metropolitana",
    boundaries: {
      type: "Polygon", 
      coordinates: [
        { latitude: 4.6400, longitude: -74.0900 },
        { latitude: 4.6400, longitude: -74.0600 },
        { latitude: 4.7200, longitude: -74.0600 },
        { latitude: 4.7200, longitude: -74.0900 },
        { latitude: 4.6400, longitude: -74.0900 }
      ]
    },
    isActive: true
  }
];

async function createZone(zoneData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(zoneData);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/zones',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201) {
          const response = JSON.parse(data);
          resolve(response.data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function createTestZones() {
  console.log('🚀 Creando zonas de prueba...');
  
  for (let i = 0; i < testZones.length; i++) {
    const zone = testZones[i];
    try {
      console.log(`📍 Creando: ${zone.name}`);
      const createdZone = await createZone(zone);
      console.log(`✅ Zona creada: ${createdZone.name} (ID: ${createdZone.id})`);
    } catch (error) {
      console.error(`❌ Error creando ${zone.name}:`, error.message);
    }
  }
  
  console.log('🎉 Proceso completado!');
}

// Verificar que el servidor esté corriendo
const healthCheck = http.get(`${API_BASE_URL}/health`, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Servidor API está corriendo');
    createTestZones();
  } else {
    console.error('❌ Servidor API no responde correctamente');
  }
}).on('error', (error) => {
  console.error('❌ No se puede conectar al servidor API:', error.message);
  console.log('💡 Asegúrate de que el servidor esté corriendo en http://localhost:3000');
});