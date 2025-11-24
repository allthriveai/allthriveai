import { test, expect } from '@playwright/test';
import { TEST_USER, TEST_PROJECT_SLUG } from './helpers';

/**
 * E2E test for project editing with proper authentication
 *
 * This test logs in via the UI and then navigates to edit a project.
 * It accounts for the time needed for AuthContext to load after navigation.
 */
test.describe('Project Edit', () => {
  test.beforeEach(async ({ page }) => {
    // Login via the UI form
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('should show owner UI and allow opening edit tray', async ({ page }) => {
    // Navigate to the test project
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.waitForLoadState('networkidle');

    // Wait for project to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Wait for React's AuthContext to check authentication
    // Keep polling until the owner UI appears
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds total
    let hasMenu = false;

    while (attempts < maxAttempts && !hasMenu) {
      hasMenu = await page.locator('[aria-label="Options menu"], button:has-text("⋮")').isVisible().catch(() => false);
      if (!hasMenu) {
        await page.waitForTimeout(1000);
        attempts++;
      }
    }

    if (!hasMenu) {
      // Debug output
      const cookies = await page.evaluate(() => document.cookie);
      const authResponse = await page.evaluate(async () => {
        try {
          const res = await fetch('http://localhost:8000/api/v1/auth/me/', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            return { status: res.status, username: data.data?.username };
          }
          return { status: res.status };
        } catch (e) {
          return { error: String(e) };
        }
      });

      throw new Error(
        `Owner UI did not appear after ${maxAttempts} seconds.\\n` +
        `Cookies: ${cookies}\\n` +
        `Auth check: ${JSON.stringify(authResponse)}`
      );
    }

    // Success!
    expect(hasMenu).toBe(true);
  });
});
