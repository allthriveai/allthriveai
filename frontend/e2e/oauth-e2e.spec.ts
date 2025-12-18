import { test, expect, Page } from '@playwright/test';

/**
 * OAuth E2E Tests
 *
 * These tests verify the full OAuth login flow against production.
 * They require test account credentials to be set as environment variables.
 *
 * Required environment variables:
 * - TEST_GITHUB_EMAIL / TEST_GITHUB_PASSWORD
 * - TEST_GOOGLE_EMAIL / TEST_GOOGLE_PASSWORD
 * - TEST_LINKEDIN_EMAIL / TEST_LINKEDIN_PASSWORD
 *
 * Tests will be SKIPPED (not failed) if credentials are not provided.
 */

const PROD_URL = process.env.PROD_URL || 'https://allthrive.ai';
const API_URL = process.env.API_URL || 'https://api.allthrive.ai';

// Helper to check if OAuth credentials are available
const hasGitHubCredentials = () =>
  !!(process.env.TEST_GITHUB_EMAIL && process.env.TEST_GITHUB_PASSWORD);

const hasLinkedInCredentials = () =>
  !!(process.env.TEST_LINKEDIN_EMAIL && process.env.TEST_LINKEDIN_PASSWORD);

// Helper to verify successful login
async function verifyLoggedIn(page: Page) {
  // After OAuth, user should be redirected to the app
  // Wait for either dashboard, explore, or profile page
  await page.waitForURL(
    (url) =>
      url.pathname.includes('/explore') ||
      url.pathname.includes('/dashboard') ||
      url.pathname.includes('/profile') ||
      url.pathname === '/',
    { timeout: 30000 }
  );

  // Verify user menu is visible (indicates authenticated state)
  const userMenuButton = page.locator('button[aria-label="User menu"]');
  await expect(userMenuButton).toBeVisible({ timeout: 15000 });
}

test.describe('OAuth E2E Tests (Production)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for OAuth flows
    test.setTimeout(120000);

    // Clear cookies before each test
    await page.context().clearCookies();
  });

  test('GitHub OAuth login', async ({ page }) => {
    test.skip(!hasGitHubCredentials(), 'GitHub test credentials not configured - skipping');

    const email = process.env.TEST_GITHUB_EMAIL!;
    const password = process.env.TEST_GITHUB_PASSWORD!;

    // Go to login page
    await page.goto(`${PROD_URL}/auth`);
    await page.waitForLoadState('domcontentloaded');

    // Click GitHub login button
    const githubButton = page.locator('button:has-text("GitHub"), a:has-text("GitHub")');
    await expect(githubButton).toBeVisible();
    await githubButton.click();

    // Wait for GitHub login page
    await page.waitForURL(/github\.com\/login/, { timeout: 15000 });

    // Fill in GitHub credentials
    await page.fill('input[name="login"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('input[type="submit"]');

    // Handle potential authorization page (first-time OAuth apps)
    try {
      const authorizeButton = page.locator('button:has-text("Authorize")');
      if (await authorizeButton.isVisible({ timeout: 5000 })) {
        await authorizeButton.click();
      }
    } catch {
      // No authorization needed, continue
    }

    // Verify successful login
    await verifyLoggedIn(page);
    console.log('GitHub OAuth login successful');
  });

  // Google OAuth is skipped for automated testing - Google aggressively blocks bot logins
  // The smoke test (below) verifies the endpoint is configured correctly
  // Full Google login flow should be tested manually after deploys
  test.skip('Google OAuth login', async ({ page: _page }) => {
    // This test is intentionally skipped - see comment above
  });

  test('LinkedIn OAuth login', async ({ page }) => {
    test.skip(!hasLinkedInCredentials(), 'LinkedIn test credentials not configured - skipping');

    const email = process.env.TEST_LINKEDIN_EMAIL!;
    const password = process.env.TEST_LINKEDIN_PASSWORD!;

    // Go to login page
    await page.goto(`${PROD_URL}/auth`);
    await page.waitForLoadState('domcontentloaded');

    // Click LinkedIn login button
    const linkedinButton = page.locator('button:has-text("LinkedIn"), a:has-text("LinkedIn")');
    await expect(linkedinButton).toBeVisible();
    await linkedinButton.click();

    // Wait for LinkedIn login page
    await page.waitForURL(/linkedin\.com/, { timeout: 15000 });

    // Fill in LinkedIn credentials
    await page.fill('input[name="session_key"], #username', email);
    await page.fill('input[name="session_password"], #password', password);
    await page.click('button[type="submit"]');

    // Handle potential authorization page
    try {
      const allowButton = page.locator('button:has-text("Allow")');
      if (await allowButton.isVisible({ timeout: 5000 })) {
        await allowButton.click();
      }
    } catch {
      // No authorization needed, continue
    }

    // Verify successful login
    await verifyLoggedIn(page);
    console.log('LinkedIn OAuth login successful');
  });
});

test.describe('OAuth Endpoint Smoke Tests (No credentials required)', () => {
  // These tests verify OAuth endpoints are configured correctly
  // They don't require test credentials and won't complete the full login flow

  test('GitHub OAuth endpoint redirects correctly', async ({ page }) => {
    await page.goto(`${API_URL}/accounts/github/login/`, {
      waitUntil: 'commit',
    });

    // Should redirect to GitHub
    expect(page.url()).toContain('github.com/login/oauth/authorize');

    // Verify callback URL is in the redirect
    expect(page.url()).toContain(encodeURIComponent('api.allthrive.ai/accounts/github/login/callback'));
  });

  test('Google OAuth endpoint redirects correctly', async ({ page }) => {
    await page.goto(`${API_URL}/accounts/google/login/`, {
      waitUntil: 'commit',
    });

    // Should redirect to Google
    expect(page.url()).toContain('accounts.google.com');

    // Verify callback URL is in the redirect
    expect(page.url()).toContain(encodeURIComponent('api.allthrive.ai/accounts/google/login/callback'));
  });

  test('LinkedIn OAuth endpoint redirects correctly', async ({ page }) => {
    await page.goto(`${API_URL}/accounts/linkedin_oauth2/login/`, {
      waitUntil: 'commit',
    });

    // Should redirect to LinkedIn
    expect(page.url()).toContain('linkedin.com');
  });
});
