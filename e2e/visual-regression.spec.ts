import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';

test.describe('Visual Regression Tests', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test('should match login page screenshot', async ({ page }) => {
    await page.goto('/login');
    
    // Wait for page to fully load
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Take screenshot and compare
    await expect(page).toHaveScreenshot('login-page.png');
  });

  test('should match admin dashboard screenshot', async ({ page }) => {
    await authHelper.login('admin');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await page.waitForTimeout(2000); // Allow for any animations
    
    // Take screenshot
    await expect(page).toHaveScreenshot('admin-dashboard.png');
  });

  test('should match supervisor monitoring interface', async ({ page }) => {
    await authHelper.login('supervisor');
    await page.click('[data-testid="monitoring-menu"]');
    
    // Wait for map and components to load
    await expect(page.locator('[data-testid="monitoring-map"]')).toBeVisible();
    await page.waitForSelector('[data-testid="map-loaded"]', { timeout: 10000 });
    await page.waitForTimeout(3000); // Allow map tiles to load
    
    // Take screenshot
    await expect(page).toHaveScreenshot('supervisor-monitoring.png');
  });

  test('should match inspector route navigation interface', async ({ page }) => {
    await authHelper.login('inspector');
    await page.goto('/routes/test-route-1/navigate');
    
    // Wait for route map to load
    await expect(page.locator('[data-testid="route-map"]')).toBeVisible();
    await page.waitForSelector('[data-testid="route-map-loaded"]', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('inspector-navigation.png');
  });

  test('should match zone management interface', async ({ page }) => {
    await authHelper.login('admin');
    await page.click('[data-testid="zones-menu"]');
    
    // Wait for zone list and map to load
    await expect(page.locator('[data-testid="zones-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="zone-map"]')).toBeVisible();
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('zone-management.png');
  });

  test('should match mobile responsive layout - inspector dashboard', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await authHelper.login('inspector');
    
    // Wait for mobile layout to adjust
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    await page.waitForTimeout(1000);
    
    // Take mobile screenshot
    await expect(page).toHaveScreenshot('mobile-inspector-dashboard.png');
  });

  test('should match tablet responsive layout - supervisor monitoring', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await authHelper.login('supervisor');
    await page.click('[data-testid="monitoring-menu"]');
    
    // Wait for tablet layout
    await expect(page.locator('[data-testid="monitoring-map"]')).toBeVisible();
    await page.waitForTimeout(3000);
    
    // Take tablet screenshot
    await expect(page).toHaveScreenshot('tablet-supervisor-monitoring.png');
  });

  test('should match component states - form validation errors', async ({ page }) => {
    await page.goto('/login');
    
    // Trigger validation errors
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    
    // Take screenshot of error state
    await expect(page).toHaveScreenshot('form-validation-errors.png');
  });

  test('should match loading states', async ({ page }) => {
    await authHelper.login('admin');
    await page.click('[data-testid="import-menu"]');
    
    // Simulate file upload to show loading state
    await page.evaluate(() => {
      // Mock loading state
      const progressBar = document.querySelector('[data-testid="import-progress"]');
      if (progressBar) {
        progressBar.style.display = 'block';
        progressBar.setAttribute('data-progress', '45');
      }
    });
    
    await page.waitForTimeout(500);
    
    // Take screenshot of loading state
    await expect(page).toHaveScreenshot('import-loading-state.png');
  });

  test('should match dark mode interface', async ({ page }) => {
    await authHelper.login('admin');
    
    // Enable dark mode
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="dark-mode-toggle"]');
    
    // Wait for theme to apply
    await expect(page.locator('body')).toHaveClass(/dark-theme/);
    await page.waitForTimeout(1000);
    
    // Take dark mode screenshot
    await expect(page).toHaveScreenshot('admin-dashboard-dark.png');
  });

  test('should match notification components', async ({ page }) => {
    await authHelper.login('supervisor');
    
    // Simulate notifications
    await page.evaluate(() => {
      // Mock notification display
      window.dispatchEvent(new CustomEvent('test-notification', {
        detail: {
          type: 'success',
          title: 'Route Assigned',
          message: 'Route has been successfully assigned to inspector'
        }
      }));
    });
    
    // Wait for notification to appear
    await expect(page.locator('[data-testid="notification-toast"]')).toBeVisible();
    
    // Take screenshot
    await expect(page).toHaveScreenshot('notification-toast.png');
  });

  test('should match modal dialogs', async ({ page }) => {
    await authHelper.login('admin');
    await page.click('[data-testid="inspectors-menu"]');
    
    // Open create inspector modal
    await page.click('[data-testid="create-inspector-button"]');
    await expect(page.locator('[data-testid="inspector-form-modal"]')).toBeVisible();
    
    // Take screenshot of modal
    await expect(page).toHaveScreenshot('create-inspector-modal.png');
  });

  test('should match data visualization components', async ({ page }) => {
    await authHelper.login('supervisor');
    await page.click('[data-testid="analytics-menu"]');
    
    // Wait for charts to load
    await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="zone-coverage-chart"]')).toBeVisible();
    await page.waitForTimeout(3000); // Allow charts to render
    
    // Take screenshot
    await expect(page).toHaveScreenshot('analytics-dashboard.png');
  });
});