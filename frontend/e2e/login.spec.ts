import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

test.describe('Authentication', () => {
  test('should login via test API and verify authentication', async ({ page }) => {
    // Use the API-based login helper (for OAuth-only apps)
    await loginViaAPI(page);

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
        return { success: false, error: 'Auth check failed' };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    });

    expect(authCheck.success).toBe(true);
    expect(authCheck.username).toBe(TEST_USER.username);
  });

  test('should show user menu when authenticated', async ({ page }) => {
    await loginViaAPI(page);

    // Navigate to explore page
    await page.goto('/explore');
    await page.waitForLoadState('networkidle');

    // Look for user menu button (avatar button)
    const userMenuButton = page.locator('button[aria-label="User menu"]');
    await expect(userMenuButton).toBeVisible({ timeout: 10000 });

    // Click to open dropdown
    await userMenuButton.click();

    // Verify dropdown is visible with user info - use role-based selector to avoid duplicate text
    await expect(page.getByRole('button', { name: TEST_USER.username }).or(page.locator('.text-sm.font-semibold').filter({ hasText: TEST_USER.username }).first())).toBeVisible();
    await expect(page.getByText('Sign Out')).toBeVisible();
  });

  test('should redirect unauthenticated users from protected pages', async ({ page }) => {
    // Try to access account settings without auth
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to auth page or show auth requirement
    // Wait for navigation to complete
    await page.waitForTimeout(2000);

    // Either redirected to auth or page shows unauthenticated state
    const currentUrl = page.url();
    const isAuthPage = currentUrl.includes('/auth') || currentUrl.includes('/login');
    const hasLoginButton = await page.locator('text=Sign in').or(page.locator('text=Google')).count() > 0;

    expect(isAuthPage || hasLoginButton).toBe(true);
  });
});
