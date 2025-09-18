import express from 'express';
import { config } from './config';

const app = express();

// Basic middleware
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Route Assignment System is running'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Route Assignment System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Simple server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});