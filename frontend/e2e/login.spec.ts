import { test, expect } from '@playwright/test';
import { TEST_USER } from './helpers';

test.describe('Email/Password Login', () => {
  test('should login successfully with email and password', async ({ page }) => {
    // Go to login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify login form is visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Fill in credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Verify we're authenticated by checking the auth endpoint
    const authCheck = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/auth/me/', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          return { success: true, username: data.data?.username };
        }
        return { success: false };
      } catch {
        return { success: false };
      }
    });

    expect(authCheck.success).toBe(true);
    expect(authCheck.username).toBe(TEST_USER.username);
  });
});
