import { chromium, FullConfig } from '@playwright/test';
import { testUsers } from './fixtures/test-data';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test cleanup...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Login as admin to clean up test data
    await page.goto(process.env.BASE_URL || 'http://localhost:3000');
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUsers.admin.email);
    await page.fill('[data-testid="password-input"]', testUsers.admin.password);
    await page.click('[data-testid="login-button"]');
    
    // Wait for login
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    
    // Get auth token
    const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
    
    if (authToken) {
      console.log('🗑️  Cleaning up test data...');
      
      // Clean up test routes
      try {
        await page.request.delete('/api/v1/routes/test-cleanup', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log('✅ Cleaned up test routes');
      } catch (error) {
        console.log(`ℹ️  Route cleanup skipped: ${error.message}`);
      }
      
      // Clean up test inspectors
      try {
        await page.request.delete('/api/v1/inspectors/test-cleanup', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log('✅ Cleaned up test inspectors');
      } catch (error) {
        console.log(`ℹ️  Inspector cleanup skipped: ${error.message}`);
      }
      
      // Clean up test zones
      try {
        await page.request.delete('/api/v1/zones/test-cleanup', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log('✅ Cleaned up test zones');
      } catch (error) {
        console.log(`ℹ️  Zone cleanup skipped: ${error.message}`);
      }
      
      // Clean up test coordinates
      try {
        await page.request.delete('/api/v1/coordinates/test-cleanup', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log('✅ Cleaned up test coordinates');
      } catch (error) {
        console.log(`ℹ️  Coordinate cleanup skipped: ${error.message}`);
      }
    }
    
    console.log('✅ E2E test cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ E2E test cleanup failed:', error);
    // Don't throw error to avoid failing the test run
  } finally {
    await browser.close();
  }
}

export default globalTeardown;