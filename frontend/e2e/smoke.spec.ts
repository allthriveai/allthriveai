/**
 * Smoke Tests - Run in CI
 *
 * These are fast, essential tests that verify the app doesn't have obvious breaks.
 * Full e2e test suite should be run locally before merging.
 *
 * Run locally: npx playwright test e2e/smoke.spec.ts
 * Run all tests: npx playwright test
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

test.describe('Smoke Tests', () => {
  test('app loads and user can authenticate', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded - look for main navigation
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test('explore page loads', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // Should see explore heading
    const exploreHeading = page.getByRole('heading', { name: /explore/i }).first();
    await expect(exploreHeading).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated user sees public pages', async ({ browser }) => {
    // Use fresh context without auth
    const context = await browser.newContext();
    const page = await context.newPage();

    // Explore should be accessible without auth
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // Should see navigation (page loaded successfully)
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});
