import { Page, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';

export class AuthHelper {
  constructor(private page: Page) {}

  async login(userType: 'admin' | 'supervisor' | 'inspector') {
    const user = testUsers[userType];
    
    await this.page.goto('/login');
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for successful login redirect
    await expect(this.page).toHaveURL(/\/dashboard/);
    
    // Verify user role is displayed
    await expect(this.page.locator('[data-testid="user-role"]')).toContainText(user.role);
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await expect(this.page).toHaveURL('/login');
  }

  async ensureLoggedIn(userType: 'admin' | 'supervisor' | 'inspector') {
    // Check if already logged in
    const currentUrl = this.page.url();
    if (currentUrl.includes('/login') || currentUrl === '/') {
      await this.login(userType);
    }
  }
}