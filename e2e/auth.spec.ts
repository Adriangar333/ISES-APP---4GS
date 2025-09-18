import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helper';
import { testUsers } from './fixtures/test-data';

test.describe('Authentication', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password is required');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'invalid@test.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid credentials');
  });

  test('should login successfully as admin', async ({ page }) => {
    await authHelper.login('admin');
    
    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-role"]')).toContainText('admin');
    await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
  });

  test('should login successfully as supervisor', async ({ page }) => {
    await authHelper.login('supervisor');
    
    // Should redirect to supervisor dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-role"]')).toContainText('supervisor');
    await expect(page.locator('[data-testid="monitoring-menu"]')).toBeVisible();
  });

  test('should login successfully as inspector', async ({ page }) => {
    await authHelper.login('inspector');
    
    // Should redirect to inspector dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-role"]')).toContainText('inspector');
    await expect(page.locator('[data-testid="routes-menu"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await authHelper.login('admin');
    await authHelper.logout();
    
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should maintain session after page refresh', async ({ page }) => {
    await authHelper.login('admin');
    
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="user-role"]')).toContainText('admin');
  });
});