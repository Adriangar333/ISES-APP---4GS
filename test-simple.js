const https = require('https');

// Tu webhook de n8n
const webhookUrl = 'https://n8n-n8n.zvkdyr.easypanel.host/webhook-test/process-coordinates';

// Datos de prueba simples
const testData = {
  coordinates: [
    {
      id: "test-1",
      latitude: 4.6097,
      longitude: -74.0817,
      address: "Bogotá Centro"
    }
  ]
};

console.log('🚀 Probando webhook de n8n...');

const postData = JSON.stringify(testData);
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(webhookUrl, options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Respuesta:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(postData);
req.end();