// Test configuration imports
import { config } from '../config';

describe('Configuration', () => {
  it('should load configuration successfully', () => {
    expect(config).toBeDefined();
    expect(config.NODE_ENV).toBeDefined();
    expect(config.PORT).toBeDefined();
    expect(config.API_PREFIX).toBeDefined();
  });

  it('should have database configuration', () => {
    expect(config.database).toBeDefined();
    expect(config.database.host).toBeDefined();
    expect(config.database.port).toBeDefined();
    expect(config.database.name).toBeDefined();
  });

  it('should have redis configuration', () => {
    expect(config.redis).toBeDefined();
    expect(config.redis.host).toBeDefined();
    expect(config.redis.port).toBeDefined();
  });
});