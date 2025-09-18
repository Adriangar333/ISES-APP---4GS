import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import path from 'path';

test.describe('File Import Workflows', () => {
    let authHelper: AuthHelper;

    test.beforeEach(async ({ page }) => {
        authHelper = new AuthHelper(page);
        await authHelper.login('admin');
    });

    test('should upload and process valid Excel file', async ({ page }) => {
        await page.goto('/import');

        // Upload Excel file
        const fileInput = page.locator('[data-testid="excel-file-input"]');
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'valid-coordinates.xlsx'));

        // Configure import options
        await page.check('[data-testid="validate-coordinates-checkbox"]');
        await page.check('[data-testid="auto-assign-zones-checkbox"]');
        await page.uncheck('[data-testid="overwrite-existing-checkbox"]');

        // Start import
        await page.click('[data-testid="start-import-button"]');

        // Wait for processing
        await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();
        await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing...');

        // Wait for completion
        await expect(page.locator('[data-testid="import-complete"]')).toBeVisible({ timeout: 30000 });

        // Verify results
        await expect(page.locator('[data-testid="success-count"]')).toContainText(/\d+ records imported/);
        await expect(page.locator('[data-testid="error-count"]')).toContainText(/\d+ errors/);

        // View import summary
        await expect(page.locator('[data-testid="import-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="zones-detected"]')).toContainText(/\d+ zones/);
        await expect(page.locator('[data-testid="coordinates-validated"]')).toContainText(/\d+ coordinates/);
    });

    test('should handle Excel file with validation errors', async ({ page }) => {
        await page.goto('/import');

        // Upload file with errors
        const fileInput = page.locator('[data-testid="excel-file-input"]');
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'invalid-coordinates.xlsx'));

        await page.click('[data-testid="start-import-button"]');

        // Wait for processing
        await expect(page.locator('[data-testid="import-complete"]')).toBeVisible({ timeout: 30000 });

        // Verify error handling
        await expect(page.locator('[data-testid="error-count"]')).toContainText(/[1-9]\d* errors/);

        // View validation errors
        await page.click('[data-testid="view-errors-button"]');
        await expect(page.locator('[data-testid="validation-errors-modal"]')).toBeVisible();

        // Verify error details
        await expect(page.locator('[data-testid="error-row"]')).toHaveCount(3, { timeout: 5000 });
        await expect(page.locator('[data-testid="error-message"]').first()).toContainText('Invalid latitude');

        // Download error report
        const downloadPromise = page.waitForEvent('download');
        await page.click('[data-testid="download-errors-button"]');
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/validation-errors.*\.xlsx$/);
    });

    test('should upload and process KMZ file for zone boundaries', async ({ page }) => {
        await page.goto('/admin/zones/kmz');

        // Upload KMZ file
        const fileInput = page.locator('[data-testid="kmz-file-input"]');
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-zones.kmz'));

        // Configure KMZ processing options
        await page.check('[data-testid="overwrite-existing-zones-checkbox"]');
        await page.check('[data-testid="backup-existing-zones-checkbox"]');
        await page.check('[data-testid="validate-boundaries-checkbox"]');

        // Start processing
        await page.click('[data-testid="process-kmz-button"]');

        // Wait for processing
        await expect(page.locator('[data-testid="kmz-processing-progress"]')).toBeVisible();
        await expect(page.locator('[data-testid="processing-status"]')).toContainText('Extracting KMZ...');

        // Wait for completion
        await expect(page.locator('[data-testid="kmz-processing-complete"]')).toBeVisible({ timeout: 60000 });

        // Verify results
        await expect(page.locator('[data-testid="zones-created-count"]')).toContainText(/\d+ zones created/);
        await expect(page.locator('[data-testid="boundaries-validated-count"]')).toContainText(/\d+ boundaries validated/);

        // View zone preview
        await expect(page.locator('[data-testid="zone-preview-map"]')).toBeVisible();
        await expect(page.locator('[data-testid="zone-boundary"]')).toHaveCount(11, { timeout: 10000 });

        // Verify color mapping
        await expect(page.locator('[data-testid="color-legend"]')).toBeVisible();
        await expect(page.locator('[data-testid="zone-color"]')).toHaveCount(11);
    });

    test('should handle large Excel file import with progress tracking', async ({ page }) => {
        await page.goto('/import');

        // Upload large file
        const fileInput = page.locator('[data-testid="excel-file-input"]');
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'large-coordinates.xlsx'));

        await page.click('[data-testid="start-import-button"]');

        // Verify progress tracking
        await expect(page.locator('[data-testid="import-progress-bar"]')).toBeVisible();
        await expect(page.locator('[data-testid="progress-percentage"]')).toContainText('0%');

        // Wait for progress updates
        await expect(page.locator('[data-testid="progress-percentage"]')).toContainText(/[1-9]\d*%/, { timeout: 10000 });
        await expect(page.locator('[data-testid="records-processed"]')).toContainText(/\d+ of \d+/);

        // Verify batch processing status
        await expect(page.locator('[data-testid="batch-status"]')).toContainText(/Processing batch \d+ of \d+/);

        // Wait for completion
        await expect(page.locator('[data-testid="import-complete"]')).toBeVisible({ timeout: 120000 });
        await expect(page.locator('[data-testid="progress-percentage"]')).toContainText('100%');
    });

    test('should validate file format and show appropriate errors', async ({ page }) => {
        await page.goto('/import');

        // Try to upload invalid file type
        const fileInput = page.locator('[data-testid="excel-file-input"]');
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'invalid-file.txt'));

        // Verify file type validation
        await expect(page.locator('[data-testid="file-error"]')).toContainText('Invalid file type');
        await expect(page.locator('[data-testid="start-import-button"]')).toBeDisabled();

        // Upload file with wrong structure
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'wrong-structure.xlsx'));

        await page.click('[data-testid="start-import-button"]');

        // Verify structure validation
        await expect(page.locator('[data-testid="structure-error"]')).toContainText('Invalid file structure');
        await expect(page.locator('[data-testid="required-columns"]')).toContainText('latitude, longitude, address');
    });

    test('should show import history and allow re-processing', async ({ page }) => {
        await page.goto('/import/history');

        // Verify import history
        await expect(page.locator('[data-testid="import-history-table"]')).toBeVisible();
        await expect(page.locator('[data-testid="import-record"]')).toHaveCount(3, { timeout: 5000 });

        // View import details
        await page.click('[data-testid="view-details-button"]:first-child');
        await expect(page.locator('[data-testid="import-details-modal"]')).toBeVisible();

        // Verify import details
        await expect(page.locator('[data-testid="import-filename"]')).toContainText(/.*\.xlsx$/);
        await expect(page.locator('[data-testid="import-date"]')).toContainText(/\d{4}-\d{2}-\d{2}/);
        await expect(page.locator('[data-testid="records-imported"]')).toContainText(/\d+/);
        await expect(page.locator('[data-testid="validation-errors"]')).toContainText(/\d+/);

        // Re-process failed import
        await page.click('[data-testid="reprocess-button"]');
        await expect(page.locator('[data-testid="reprocess-confirmation"]')).toBeVisible();
        await page.click('[data-testid="confirm-reprocess-button"]');

        // Verify reprocessing started
        await expect(page.locator('[data-testid="reprocessing-status"]')).toContainText('Reprocessing...');
    });

    test('should export processed data in multiple formats', async ({ page }) => {
        await page.goto('/export');

        // Configure export
        await page.selectOption('[data-testid="export-data-type"]', 'coordinates');
        await page.selectOption('[data-testid="export-format"]', 'excel');

        // Set filters
        await page.click('[data-testid="date-range-picker"]');
        await page.click('[data-testid="last-30-days"]');
        await page.selectOption('[data-testid="zone-filter"]', 'all');

        // Include additional data
        await page.check('[data-testid="include-zone-info-checkbox"]');
        await page.check('[data-testid="include-validation-status-checkbox"]');

        // Start export
        const downloadPromise = page.waitForEvent('download');
        await page.click('[data-testid="export-button"]');

        // Verify export progress
        await expect(page.locator('[data-testid="export-progress"]')).toBeVisible();

        // Verify download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/coordinates-export.*\.xlsx$/);

        // Verify export success
        await expect(page.locator('[data-testid="export-success"]')).toContainText('Export completed successfully');
    });

    test('should handle concurrent file uploads', async ({ page }) => {
        await page.goto('/import');

        // Start first upload
        const fileInput1 = page.locator('[data-testid="excel-file-input"]');
        await fileInput1.setInputFiles(path.join(__dirname, 'fixtures', 'coordinates-1.xlsx'));
        await page.click('[data-testid="start-import-button"]');

        // Verify first import started
        await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();

        // Try to start second upload
        await page.click('[data-testid="add-another-file-button"]');
        const fileInput2 = page.locator('[data-testid="excel-file-input-2"]');
        await fileInput2.setInputFiles(path.join(__dirname, 'fixtures', 'coordinates-2.xlsx'));
        await page.click('[data-testid="start-import-button-2"]');

        // Verify queue management
        await expect(page.locator('[data-testid="import-queue"]')).toContainText('2 files in queue');
        await expect(page.locator('[data-testid="queue-status"]')).toContainText('Processing file 1 of 2');

        // Wait for both imports to complete
        await expect(page.locator('[data-testid="all-imports-complete"]')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('[data-testid="queue-status"]')).toContainText('All imports completed');
    });
});