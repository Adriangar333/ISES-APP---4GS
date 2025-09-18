import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  database: parseInt(process.env.REDIS_DB || '0'),
};

export class RedisConnection {
  private static instance: RedisClientType;

  private constructor() {}

  public static getInstance(): RedisClientType {
    if (!RedisConnection.instance) {
      RedisConnection.instance = createClient(redisConfig);
      
      // Redis error handling
      RedisConnection.instance.on('error', (error) => {
        console.error('❌ Redis error:', error);
      });

      RedisConnection.instance.on('connect', () => {
        console.log('🔄 Redis connecting...');
      });

      RedisConnection.instance.on('ready', () => {
        console.log('✅ Redis ready');
      });

      RedisConnection.instance.on('end', () => {
        console.log('🔚 Redis connection ended');
      });
    }

    return RedisConnection.instance;
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const client = RedisConnection.getInstance();
      if (!client.isOpen) {
        await client.connect();
      }
      await client.ping();
      console.log('✅ Redis connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Redis connection test failed:', error);
      return false;
    }
  }

  public static async closeConnection(): Promise<void> {
    try {
      if (RedisConnection.instance && RedisConnection.instance.isOpen) {
        await RedisConnection.instance.quit();
        console.log('✅ Redis connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
    }
  }
}

export const redisClient: RedisClientType = RedisConnection.getInstance();

export const connectRedis = async (): Promise<void> => {
  return RedisConnection.testConnection();
};

export const disconnectRedis = async (): Promise<void> => {
  return RedisConnection.closeConnection();
};

// Redis error handling
redisClient.on('error', (error) => {
  console.error('❌ Redis error:', error);
});

redisClient.on('connect', () => {
  console.log('🔄 Redis connecting...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis ready');
});

redisClient.on('end', () => {
  console.log('🔚 Redis connection ended');
});