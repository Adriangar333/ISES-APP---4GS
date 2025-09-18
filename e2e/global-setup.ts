import { chromium, FullConfig } from '@playwright/test';
import { testUsers } from './fixtures/test-data';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be ready...');
    await page.goto(process.env.BASE_URL || 'http://localhost:3000');
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60000 });
    
    // Create test users if they don't exist
    console.log('👥 Setting up test users...');
    for (const [userType, userData] of Object.entries(testUsers)) {
      try {
        const response = await page.request.post('/api/v1/auth/register', {
          data: {
            ...userData,
            name: `Test ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
            confirmPassword: userData.password
          }
        });
        
        if (response.ok()) {
          console.log(`✅ Created test user: ${userData.email}`);
        } else {
          console.log(`ℹ️  Test user already exists: ${userData.email}`);
        }
      } catch (error) {
        console.log(`ℹ️  Test user setup skipped for ${userData.email}: ${error.message}`);
      }
    }
    
    // Set up test data
    console.log('📊 Setting up test data...');
    
    // Login as admin to create test data
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUsers.admin.email);
    await page.fill('[data-testid="password-input"]', testUsers.admin.password);
    await page.click('[data-testid="login-button"]');
    
    // Wait for login
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    
    // Get auth token from localStorage
    const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
    
    if (authToken) {
      // Create test zones
      console.log('🗺️  Creating test zones...');
      try {
        const zoneResponse = await page.request.post('/api/v1/zones', {
          data: {
            name: 'Test Zone Centro',
            type: 'metropolitana',
            boundaries: {
              type: 'Polygon',
              coordinates: [[
                [-74.0759, 4.5981],
                [-74.0659, 4.5981],
                [-74.0659, 4.6081],
                [-74.0759, 4.6081],
                [-74.0759, 4.5981]
              ]]
            }
          },
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (zoneResponse.ok()) {
          console.log('✅ Created test zone');
        }
      } catch (error) {
        console.log(`ℹ️  Test zone creation skipped: ${error.message}`);
      }
      
      // Create test inspector
      console.log('👨‍💼 Creating test inspector...');
      try {
        const inspectorResponse = await page.request.post('/api/v1/inspectors', {
          data: {
            name: 'Test Inspector',
            identification: 'TEST123456',
            email: 'test.inspector@example.com',
            phone: '+57 300 123 4567',
            preferredZones: [],
            maxDailyRoutes: 5
          },
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (inspectorResponse.ok()) {
          console.log('✅ Created test inspector');
        }
      } catch (error) {
        console.log(`ℹ️  Test inspector creation skipped: ${error.message}`);
      }
    }
    
    console.log('✅ E2E test setup completed successfully');
    
  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;