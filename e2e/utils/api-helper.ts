import { APIRequestContext, expect } from '@playwright/test';

export class ApiHelper {
  constructor(private request: APIRequestContext) {}

  async createTestUser(userData: any) {
    const response = await this.request.post('/api/v1/auth/register', {
      data: userData
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async createTestZone(zoneData: any, token: string) {
    const response = await this.request.post('/api/v1/zones', {
      data: zoneData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async createTestInspector(inspectorData: any, token: string) {
    const response = await this.request.post('/api/v1/inspectors', {
      data: inspectorData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async createTestRoute(routeData: any, token: string) {
    const response = await this.request.post('/api/v1/routes', {
      data: routeData,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async uploadTestFile(filePath: string, token: string) {
    const response = await this.request.post('/api/v1/admin/import/excel', {
      multipart: {
        file: filePath
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async cleanupTestData(token: string) {
    // Clean up test data in reverse order of dependencies
    await this.request.delete('/api/v1/routes/test-cleanup', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await this.request.delete('/api/v1/inspectors/test-cleanup', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await this.request.delete('/api/v1/zones/test-cleanup', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
}