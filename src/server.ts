import { createApp } from './app';
import { DatabaseConnection } from './config/database';
import { RedisConnection } from './config/redis';
import { config } from './config';
import { createServer } from 'http';
import { initializeWebSocketService } from './services/WebSocketService';

const startServer = async (): Promise<void> => {
  try {
    console.log('🚀 Starting Route Assignment System...');

    // Connect to databases
    try {
      await DatabaseConnection.testConnection();
      console.log('✅ Database connection successful');
    } catch (error) {
      console.warn('⚠️ Database connection failed, continuing without database:', error instanceof Error ? error.message : String(error));
    }

    try {
      await RedisConnection.testConnection();
      console.log('✅ Redis connection successful');
    } catch (error) {
      console.warn('⚠️ Redis connection failed, continuing without Redis:', error instanceof Error ? error.message : String(error));
    }

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket service
    initializeWebSocketService(httpServer);

    // Start server
    const server = httpServer.listen(config.PORT, () => {
      console.log(`✅ Server running on port ${config.PORT}`);
      console.log(`🌐 Environment: ${config.NODE_ENV}`);
      console.log(`📡 API Base URL: http://localhost:${config.PORT}${config.API_PREFIX}`);
      console.log(`🏥 Health Check: http://localhost:${config.PORT}${config.API_PREFIX}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('🔒 HTTP server closed');

        try {
          await DatabaseConnection.closeConnection();
          await RedisConnection.closeConnection();
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});