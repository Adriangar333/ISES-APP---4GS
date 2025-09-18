import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Route Assignment System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API básica
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Route Assignment System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Servir archivos estáticos del frontend (si existen)
const frontendPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendPath));

// Catch-all handler para React Router
app.get('*', (req, res) => {
  // Si es una ruta de API que no existe, devolver 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Para todas las demás rutas, servir el index.html de React
  const indexPath = path.join(frontendPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(500).json({ 
        error: 'Frontend not available',
        message: 'Please build the frontend first'
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API: http://localhost:${PORT}/api/v1/health`);
});