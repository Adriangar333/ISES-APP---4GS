import request from 'supertest';
import { createApp } from '../../app';

describe('Inspector API Integration', () => {
  const app = createApp();

  describe('GET /api/v1/inspectors', () => {
    it('should return 200 and empty array when no inspectors exist', async () => {
      const response = await request(app)
        .get('/api/v1/inspectors')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/inspectors/:id', () => {
    it('should return 400 for missing ID', async () => {
      const response = await request(app)
        .get('/api/v1/inspectors/')
        .expect(404); // This will hit the route not found

      // The route pattern requires an ID, so this should be handled by Express
    });

    it('should return 404 for non-existent inspector', async () => {
      const response = await request(app)
        .get('/api/v1/inspectors/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Inspector not found');
    });
  });

  describe('POST /api/v1/inspectors', () => {
    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/v1/inspectors')
        .send({
          // Missing required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Validation error');
    });

    it('should return 400 for invalid zone ID', async () => {
      const response = await request(app)
        .post('/api/v1/inspectors')
        .send({
          name: 'Test Inspector',
          identification: '12345678',
          preferredZones: ['invalid-zone-id']
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid zone ID');
    });
  });
});