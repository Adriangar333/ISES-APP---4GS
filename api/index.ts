import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;

  // Health check endpoint
  if (url === '/api/health' || url === '/api/v1/health') {
    return res.json({
      status: 'ok',
      message: 'Route Assignment System API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: 'vercel'
    });
  }

  // Basic API endpoints
  if (url?.startsWith('/api/v1/')) {
    const path = url.replace('/api/v1/', '');
    
    switch (path) {
      case 'zones':
        if (method === 'GET') {
          return res.json({
            zones: [],
            message: 'Zones endpoint - connect database for full functionality'
          });
        }
        break;
        
      case 'inspectors':
        if (method === 'GET') {
          return res.json({
            inspectors: [],
            message: 'Inspectors endpoint - connect database for full functionality'
          });
        }
        break;
        
      case 'routes':
        if (method === 'GET') {
          return res.json({
            routes: [],
            message: 'Routes endpoint - connect database for full functionality'
          });
        }
        break;
        
      default:
        return res.status(404).json({
          error: 'API endpoint not found',
          path: path,
          availableEndpoints: ['/health', '/zones', '/inspectors', '/routes']
        });
    }
  }

  // Default response
  return res.status(404).json({
    error: 'API endpoint not found',
    url: url,
    method: method
  });
}