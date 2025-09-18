import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';

test.describe('Inspector Workflow', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    await authHelper.login('inspector');
  });

  test('should access inspector dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="inspector-dashboard"]')).toBeVisible();
    
    // Verify inspector-specific elements
    await expect(page.locator('[data-testid="assigned-routes"]')).toBeVisible();
    await expect(page.locator('[data-testid="route-map"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-summary"]')).toBeVisible();
  });

  test('should view assigned routes', async ({ page }) => {
    await page.click('[data-testid="routes-menu"]');
    
    await expect(page).toHaveURL(/\/routes/);
    await expect(page.locator('[data-testid="route-list"]')).toBeVisible();
    
    // Verify route cards are displayed
    await expect(page.locator('[data-testid="route-card"]')).toHaveCount(2, { timeout: 5000 });
    
    // Test route filtering
    await page.selectOption('[data-testid="status-filter"]', 'pending');
    await expect(page.locator('[data-testid="route-card"][data-status="pending"]')).toHaveCount(1, { timeout: 3000 });
    
    await page.selectOption('[data-testid="status-filter"]', 'in_progress');
    await expect(page.locator('[data-testid="route-card"][data-status="in_progress"]')).toHaveCount(1, { timeout: 3000 });
  });

  test('should start a route and navigate', async ({ page }) => {
    await page.click('[data-testid="routes-menu"]');
    
    // Start the first pending route
    await page.click('[data-testid="route-card"]:first-child [data-testid="start-route-button"]');
    
    await expect(page).toHaveURL(/\/routes\/.*\/navigate/);
    await expect(page.locator('[data-testid="navigation-panel"]')).toBeVisible();
    
    // Verify route map is loaded
    await page.waitForSelector('[data-testid="route-map-loaded"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="route-points"]')).toBeVisible();
    
    // Verify navigation controls
    await expect(page.locator('[data-testid="current-point-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-point-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="complete-point-button"]')).toBeVisible();
  });

  test('should complete route points', async ({ page }) => {
    // Navigate to an active route
    await page.goto('/routes/test-route-1/navigate');
    
    // Complete first point
    await page.click('[data-testid="complete-point-button"]');
    
    // Fill completion form
    await page.fill('[data-testid="completion-notes"]', 'Point completed successfully');
    await page.click('[data-testid="take-photo-button"]');
    
    // Mock photo capture
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#fff';
      ctx.font = '20px Arial';
      ctx.fillText('Test Photo', 270, 240);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'test-photo.jpg', { type: 'image/jpeg' });
        const input = document.querySelector('[data-testid="photo-input"]');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    
    await page.click('[data-testid="confirm-completion-button"]');
    
    // Verify point completion
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Point completed successfully');
    await expect(page.locator('[data-testid="completed-points-count"]')).toContainText('1');
    
    // Verify navigation to next point
    await expect(page.locator('[data-testid="current-point-index"]')).toContainText('2');
  });

  test('should handle offline mode', async ({ page, context }) => {
    // Start a route
    await page.goto('/routes/test-route-1/navigate');
    
    // Verify online status
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Online');
    
    // Simulate going offline
    await context.setOffline(true);
    
    // Verify offline mode activated
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Offline');
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-banner"]')).toContainText('Working offline');
    
    // Complete a point while offline
    await page.click('[data-testid="complete-point-button"]');
    await page.fill('[data-testid="completion-notes"]', 'Completed offline');
    await page.click('[data-testid="confirm-completion-button"]');
    
    // Verify offline completion
    await expect(page.locator('[data-testid="offline-queue-count"]')).toContainText('1');
    
    // Go back online
    await context.setOffline(false);
    
    // Verify sync
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Online');
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Syncing...');
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Synced', { timeout: 10000 });
    await expect(page.locator('[data-testid="offline-queue-count"]')).toContainText('0');
  });

  test('should report incidents', async ({ page }) => {
    await page.goto('/routes/test-route-1/navigate');
    
    // Open incident report
    await page.click('[data-testid="report-incident-button"]');
    
    await expect(page.locator('[data-testid="incident-form"]')).toBeVisible();
    
    // Fill incident form
    await page.selectOption('[data-testid="incident-type"]', 'access_denied');
    await page.fill('[data-testid="incident-description"]', 'Unable to access building due to security restrictions');
    await page.selectOption('[data-testid="incident-priority"]', 'high');
    
    // Take incident photo
    await page.click('[data-testid="take-incident-photo-button"]');
    
    // Mock photo capture
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f44336';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#fff';
      ctx.font = '20px Arial';
      ctx.fillText('Incident Photo', 250, 240);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'incident-photo.jpg', { type: 'image/jpeg' });
        const input = document.querySelector('[data-testid="incident-photo-input"]');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    
    // Submit incident report
    await page.click('[data-testid="submit-incident-button"]');
    
    // Verify incident reported
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Incident reported successfully');
    await expect(page.locator('[data-testid="incident-status"]')).toContainText('Reported');
  });

  test('should request route reassignment', async ({ page }) => {
    await page.goto('/routes/test-route-1/navigate');
    
    // Request reassignment
    await page.click('[data-testid="request-reassignment-button"]');
    
    await expect(page.locator('[data-testid="reassignment-form"]')).toBeVisible();
    
    // Fill reassignment request
    await page.selectOption('[data-testid="reassignment-reason"]', 'emergency');
    await page.fill('[data-testid="reassignment-notes"]', 'Family emergency, need to leave immediately');
    
    await page.click('[data-testid="submit-reassignment-button"]');
    
    // Verify reassignment requested
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Reassignment requested successfully');
    await expect(page.locator('[data-testid="route-status"]')).toContainText('Reassignment Pending');
  });

  test('should view route history and statistics', async ({ page }) => {
    await page.click('[data-testid="history-menu"]');
    
    await expect(page).toHaveURL(/\/history/);
    await expect(page.locator('[data-testid="route-history"]')).toBeVisible();
    
    // Verify statistics
    await expect(page.locator('[data-testid="total-routes-completed"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="average-completion-time"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="completion-rate"]')).toContainText(/\d+%/);
    
    // Test date filtering
    await page.click('[data-testid="date-filter"]');
    await page.click('[data-testid="last-week"]');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="filtered-routes"]')).toBeVisible();
    
    // View route details
    await page.click('[data-testid="route-history-item"]:first-child');
    await expect(page.locator('[data-testid="route-details-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="route-points-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="completion-photos"]')).toBeVisible();
  });

  test('should receive and respond to notifications', async ({ page }) => {
    // Verify notification bell
    await expect(page.locator('[data-testid="notification-bell"]')).toBeVisible();
    
    // Simulate receiving a notification
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('test-notification', {
        detail: {
          type: 'route_update',
          title: 'Route Assignment Updated',
          message: 'Your route for tomorrow has been updated',
          priority: 'medium'
        }
      }));
    });
    
    // Verify notification appears
    await expect(page.locator('[data-testid="notification-badge"]')).toContainText('1');
    
    // Open notifications
    await page.click('[data-testid="notification-bell"]');
    await expect(page.locator('[data-testid="notification-dropdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-item"]')).toContainText('Route Assignment Updated');
    
    // Mark as read
    await page.click('[data-testid="mark-read-button"]');
    await expect(page.locator('[data-testid="notification-badge"]')).toContainText('0');
  });

  test('should update availability schedule', async ({ page }) => {
    await page.click('[data-testid="profile-menu"]');
    await page.click('[data-testid="availability-menu"]');
    
    await expect(page).toHaveURL(/\/availability/);
    await expect(page.locator('[data-testid="availability-calendar"]')).toBeVisible();
    
    // Update availability for tomorrow
    await page.click('[data-testid="tomorrow-slot"]');
    await page.selectOption('[data-testid="start-time"]', '08:00');
    await page.selectOption('[data-testid="end-time"]', '16:00');
    await page.click('[data-testid="save-availability-button"]');
    
    // Verify availability updated
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Availability updated successfully');
    await expect(page.locator('[data-testid="tomorrow-slot"]')).toContainText('08:00 - 16:00');
  });
});