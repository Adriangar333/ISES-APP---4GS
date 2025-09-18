import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';

test.describe('Supervisor Workflow', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.login('supervisor');
  });

  test('should access supervisor dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="supervisor-dashboard"]')).toBeVisible();
    
    // Verify supervisor-specific elements
    await expect(page.locator('[data-testid="monitoring-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="real-time-map"]')).toBeVisible();
    await expect(page.locator('[data-testid="inspector-status-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-panel"]')).toBeVisible();
  });

  test('should monitor real-time inspector locations', async ({ page }) => {
    await page.click('[data-testid="monitoring-menu"]');
    
    await expect(page).toHaveURL(/\/monitoring/);
    await expect(page.locator('[data-testid="monitoring-map"]')).toBeVisible();
    
    // Wait for map to load
    await page.waitForSelector('[data-testid="map-loaded"]', { timeout: 10000 });
    
    // Verify inspector markers are visible
    await expect(page.locator('[data-testid="inspector-marker"]')).toHaveCount(1, { timeout: 5000 });
    
    // Test map interactions
    await page.click('[data-testid="inspector-marker"]');
    await expect(page.locator('[data-testid="inspector-popup"]')).toBeVisible();
    await expect(page.locator('[data-testid="inspector-name"]')).toContainText(/\w+/);
    await expect(page.locator('[data-testid="current-route"]')).toContainText(/Route|No active route/);
  });

  test('should view zone status grid', async ({ page }) => {
    await page.click('[data-testid="zones-status-menu"]');
    
    await expect(page.locator('[data-testid="zone-status-grid"]')).toBeVisible();
    
    // Verify zone cards are displayed
    await expect(page.locator('[data-testid="zone-card"]')).toHaveCount(11, { timeout: 5000 });
    
    // Test zone filtering
    await page.selectOption('[data-testid="zone-type-filter"]', 'metropolitana');
    await expect(page.locator('[data-testid="zone-card"][data-type="metropolitana"]')).toHaveCount(6, { timeout: 3000 });
    
    await page.selectOption('[data-testid="zone-type-filter"]', 'rural');
    await expect(page.locator('[data-testid="zone-card"][data-type="rural"]')).toHaveCount(5, { timeout: 3000 });
  });

  test('should manage route assignments', async ({ page }) => {
    await page.click('[data-testid="assignments-menu"]');
    
    await expect(page).toHaveURL(/\/assignments/);
    await expect(page.locator('[data-testid="assignment-dashboard"]')).toBeVisible();
    
    // View pending assignments
    await expect(page.locator('[data-testid="pending-routes"]')).toBeVisible();
    await expect(page.locator('[data-testid="available-inspectors"]')).toBeVisible();
    
    // Test bulk assignment
    await page.click('[data-testid="select-all-pending"]');
    await page.click('[data-testid="auto-assign-button"]');
    
    await expect(page.locator('[data-testid="assignment-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Routes assigned successfully', { timeout: 10000 });
  });

  test('should handle inspector alerts and incidents', async ({ page }) => {
    await expect(page.locator('[data-testid="alert-panel"]')).toBeVisible();
    
    // Simulate receiving an alert (this would normally come via WebSocket)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('test-alert', {
        detail: {
          type: 'incident',
          inspectorId: 'test-inspector-1',
          message: 'Inspector reported an incident',
          priority: 'high'
        }
      }));
    });
    
    // Verify alert appears
    await expect(page.locator('[data-testid="alert-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-message"]')).toContainText('Inspector reported an incident');
    
    // Handle the alert
    await page.click('[data-testid="handle-alert-button"]');
    await page.fill('[data-testid="response-notes"]', 'Incident acknowledged, sending support');
    await page.click('[data-testid="send-response-button"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Response sent successfully');
  });

  test('should view performance metrics', async ({ page }) => {
    await page.click('[data-testid="metrics-menu"]');
    
    await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
    
    // Verify metrics components
    await expect(page.locator('[data-testid="completion-rate-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-time-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="zone-efficiency-chart"]')).toBeVisible();
    
    // Test date range filtering
    await page.click('[data-testid="date-range-picker"]');
    await page.click('[data-testid="last-7-days"]');
    
    // Wait for charts to update
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="metrics-updated"]')).toBeVisible();
  });

  test('should send notifications to inspectors', async ({ page }) => {
    await page.click('[data-testid="notifications-menu"]');
    
    await expect(page).toHaveURL(/\/notifications/);
    
    // Create new notification
    await page.click('[data-testid="create-notification-button"]');
    
    await page.selectOption('[data-testid="notification-type"]', 'announcement');
    await page.fill('[data-testid="notification-title"]', 'Important Update');
    await page.fill('[data-testid="notification-message"]', 'Please check your route assignments for today');
    
    // Select recipients
    await page.click('[data-testid="select-all-inspectors"]');
    
    // Send notification
    await page.click('[data-testid="send-notification-button"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Notification sent successfully');
    
    // Verify in notification history
    await expect(page.locator('[data-testid="notification-history"]')).toContainText('Important Update');
  });

  test('should export supervisor reports', async ({ page }) => {
    await page.click('[data-testid="reports-menu"]');
    
    await expect(page).toHaveURL(/\/reports/);
    
    // Generate daily report
    await page.selectOption('[data-testid="report-type"]', 'daily-summary');
    await page.click('[data-testid="date-picker"]');
    await page.click('[data-testid="today"]');
    
    const downloadPromise = page.waitForDownload();
    await page.click('[data-testid="generate-report-button"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/daily-summary.*\.pdf$/);
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Report generated successfully');
  });

  test('should handle real-time updates via WebSocket', async ({ page }) => {
    // Verify WebSocket connection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
    
    // Simulate real-time route completion update
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('test-websocket-message', {
        detail: {
          type: 'route_progress',
          inspectorId: 'test-inspector-1',
          routeId: 'test-route-1',
          completedPoints: 3,
          totalPoints: 5,
          status: 'in_progress'
        }
      }));
    });
    
    // Verify UI updates
    await expect(page.locator('[data-testid="route-progress-test-route-1"]')).toContainText('3/5');
    await expect(page.locator('[data-testid="route-status-test-route-1"]')).toContainText('In Progress');
  });
});