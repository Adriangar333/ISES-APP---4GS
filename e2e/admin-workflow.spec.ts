import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { ApiHelper } from './utils/api-helper';
import { testZones, testInspectors } from './fixtures/test-data';
import path from 'path';

test.describe('Admin Workflow', () => {
  let authHelper: AuthHelper;
  let apiHelper: ApiHelper;

  test.beforeEach(async ({ page, request }) => {
    authHelper = new AuthHelper(page);
    apiHelper = new ApiHelper(request);
    await authHelper.login('admin');
  });

  test('should navigate to zone management', async ({ page }) => {
    await page.click('[data-testid="zones-menu"]');
    
    await expect(page).toHaveURL(/\/zones/);
    await expect(page.locator('[data-testid="zones-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-zone-button"]')).toBeVisible();
  });

  test('should create a new zone', async ({ page }) => {
    await page.click('[data-testid="zones-menu"]');
    await page.click('[data-testid="create-zone-button"]');
    
    // Fill zone form
    await page.fill('[data-testid="zone-name-input"]', testZones[0].name);
    await page.selectOption('[data-testid="zone-type-select"]', testZones[0].type);
    
    // Submit form
    await page.click('[data-testid="save-zone-button"]');
    
    // Verify zone was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Zone created successfully');
    await expect(page.locator(`[data-testid="zone-${testZones[0].name}"]`)).toBeVisible();
  });

  test('should upload and process KMZ file', async ({ page }) => {
    await page.click('[data-testid="admin-menu"]');
    await page.click('[data-testid="kmz-upload-menu"]');
    
    await expect(page).toHaveURL(/\/admin\/kmz/);
    
    // Upload KMZ file (mock file upload)
    const fileInput = page.locator('[data-testid="kmz-file-input"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-zones.kmz'));
    
    await page.click('[data-testid="upload-kmz-button"]');
    
    // Wait for processing
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing KMZ file...');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('KMZ processed successfully', { timeout: 30000 });
    
    // Verify zones were created
    await expect(page.locator('[data-testid="zones-created-count"]')).toContainText(/\d+ zones created/);
  });

  test('should manage inspectors', async ({ page }) => {
    await page.click('[data-testid="inspectors-menu"]');
    
    await expect(page).toHaveURL(/\/inspectors/);
    await expect(page.locator('[data-testid="inspectors-page"]')).toBeVisible();
    
    // Create new inspector
    await page.click('[data-testid="create-inspector-button"]');
    
    const inspector = testInspectors[0];
    await page.fill('[data-testid="inspector-name-input"]', inspector.name);
    await page.fill('[data-testid="inspector-id-input"]', inspector.identification);
    await page.fill('[data-testid="inspector-email-input"]', inspector.email);
    await page.fill('[data-testid="inspector-phone-input"]', inspector.phone);
    await page.fill('[data-testid="inspector-max-routes-input"]', inspector.maxDailyRoutes.toString());
    
    await page.click('[data-testid="save-inspector-button"]');
    
    // Verify inspector was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Inspector created successfully');
    await expect(page.locator(`[data-testid="inspector-${inspector.identification}"]`)).toBeVisible();
  });

  test('should upload and process Excel file', async ({ page }) => {
    await page.click('[data-testid="import-menu"]');
    
    await expect(page).toHaveURL(/\/import/);
    
    // Upload Excel file
    const fileInput = page.locator('[data-testid="excel-file-input"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-coordinates.xlsx'));
    
    await page.click('[data-testid="upload-excel-button"]');
    
    // Wait for processing
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing Excel file...');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Excel processed successfully', { timeout: 30000 });
    
    // Verify import results
    await expect(page.locator('[data-testid="coordinates-imported-count"]')).toContainText(/\d+ coordinates imported/);
    await expect(page.locator('[data-testid="validation-errors-count"]')).toContainText(/\d+ validation errors/);
  });

  test('should create and assign routes', async ({ page }) => {
    await page.click('[data-testid="routes-menu"]');
    
    await expect(page).toHaveURL(/\/routes/);
    
    // Create new route
    await page.click('[data-testid="create-route-button"]');
    
    await page.fill('[data-testid="route-name-input"]', 'Test Route');
    await page.selectOption('[data-testid="route-priority-select"]', 'high');
    await page.fill('[data-testid="route-duration-input"]', '240');
    
    // Select coordinates for route
    await page.click('[data-testid="add-coordinates-button"]');
    await page.click('[data-testid="coordinate-checkbox-0"]');
    await page.click('[data-testid="coordinate-checkbox-1"]');
    await page.click('[data-testid="confirm-coordinates-button"]');
    
    await page.click('[data-testid="save-route-button"]');
    
    // Verify route was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Route created successfully');
    
    // Assign route to inspector
    await page.click('[data-testid="assign-route-button"]');
    await page.selectOption('[data-testid="inspector-select"]', testInspectors[0].identification);
    await page.click('[data-testid="confirm-assignment-button"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Route assigned successfully');
  });

  test('should export data', async ({ page }) => {
    await page.click('[data-testid="export-menu"]');
    
    await expect(page).toHaveURL(/\/export/);
    
    // Configure export
    await page.selectOption('[data-testid="export-format-select"]', 'excel');
    await page.selectOption('[data-testid="export-type-select"]', 'routes');
    await page.click('[data-testid="include-assignments-checkbox"]');
    
    // Start export
    const downloadPromise = page.waitForDownload();
    await page.click('[data-testid="export-button"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/routes.*\.xlsx$/);
    
    // Verify export success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Export completed successfully');
  });

  test('should view system analytics', async ({ page }) => {
    await page.click('[data-testid="analytics-menu"]');
    
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.locator('[data-testid="analytics-page"]')).toBeVisible();
    
    // Verify analytics components are loaded
    await expect(page.locator('[data-testid="system-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="zone-coverage-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="inspector-workload-chart"]')).toBeVisible();
  });
});