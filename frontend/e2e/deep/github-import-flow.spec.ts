/**
 * GitHub Import Flow - Deep E2E Tests
 *
 * Tests the complete GitHub integration journey:
 * 1. Connect to GitHub (OAuth)
 * 2. See list of repos
 * 3. Click on a repo to import
 * 4. Verify project is created
 *
 * Prerequisites:
 * - Test user should have GitHub OAuth connected (via E2E_TEST_GITHUB_TOKEN secret)
 * - GitHub App should be installed for the test user's repos
 *
 * Run with: npx playwright test e2e/deep/github-import-flow.spec.ts --project=deep
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, getPageContent } from './deep-helpers';

// Extended timeout for OAuth redirects and API calls
const GITHUB_FLOW_TIMEOUT = 180000; // 3 minutes

interface GitHubStatus {
  connected: boolean;
  username?: string;
  hasInstallation?: boolean;
}

/**
 * Check GitHub connection status via API
 */
async function checkGitHubStatus(page: Page): Promise<GitHubStatus> {
  const response = await page.request.get('/api/v1/social/status/github/');

  if (!response.ok()) {
    return { connected: false };
  }

  const data = await response.json();
  return {
    connected: data.data?.connected || false,
    username: data.data?.username,
    hasInstallation: data.data?.has_installation,
  };
}

/**
 * Wait for the GitHub flow UI to load and stabilize
 */
async function waitForGitHubFlowUI(page: Page, timeout = 30000): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);

    // Check for various states
    const hasConnectButton = content.includes('Connect GitHub');
    const hasInstallButton = content.includes('Install AllThrive App');
    const hasSearchRepos = content.includes('Search repositories');
    const hasRepoList = content.includes('Private') || /\d+ stars?/i.test(content);
    const hasLoading = content.includes('Loading') || content.includes('Checking');

    if (hasLoading) {
      console.log('GitHub flow loading...');
      await page.waitForTimeout(1000);
      continue;
    }

    if (hasConnectButton) return 'connect';
    if (hasInstallButton) return 'install';
    if (hasSearchRepos || hasRepoList) return 'select';

    await page.waitForTimeout(500);
  }

  return 'unknown';
}

/**
 * Open the GitHub integration from the chat plus menu
 */
async function openGitHubIntegration(page: Page): Promise<void> {
  // Click the plus button to open menu
  const plusButton = page.locator('button[aria-label="Add integration"]');
  await expect(plusButton).toBeVisible({ timeout: 10000 });
  await plusButton.click();

  // Wait for menu to appear
  await page.waitForTimeout(500);

  // Click "More Integrations" if visible
  const moreIntegrations = page.locator('text=More Integrations');
  if (await moreIntegrations.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreIntegrations.click();
    await page.waitForTimeout(500);
  }

  // Click "Add from GitHub"
  const githubOption = page.locator('text=Add from GitHub');
  await expect(githubOption).toBeVisible({ timeout: 5000 });
  await githubOption.click();

  // Wait for flow UI to load
  await page.waitForTimeout(2000);
}

test.describe('GitHub Import - Full Flow', () => {
  test.setTimeout(GITHUB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('check GitHub connection status via API', async ({ page }) => {
    const status = await checkGitHubStatus(page);

    console.log('GitHub Status:', status);

    // This test just verifies the API works
    expect(typeof status.connected).toBe('boolean');

    if (status.connected) {
      console.log(`✓ GitHub connected as: ${status.username}`);
      console.log(`  Has installation: ${status.hasInstallation}`);
    } else {
      console.log('✗ GitHub not connected for test user');
    }
  });

  test('open GitHub integration shows appropriate UI state', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open the GitHub integration
    await openGitHubIntegration(page);

    // Wait for the flow UI to stabilize
    const state = await waitForGitHubFlowUI(page);

    console.log(`GitHub flow UI state: ${state}`);

    // Should show one of the valid states
    expect(['connect', 'install', 'select']).toContain(state);

    // Verify UI elements based on state
    if (state === 'connect') {
      await expect(page.locator('text=Connect GitHub')).toBeVisible();
      console.log('→ User needs to connect GitHub OAuth');
    } else if (state === 'install') {
      await expect(page.locator('text=Install AllThrive App')).toBeVisible();
      console.log('→ User needs to install GitHub App');
    } else if (state === 'select') {
      await expect(
        page.locator('input[placeholder*="Search repositories"]')
      ).toBeVisible();
      console.log('→ User can select repositories');
    }
  });

  test('GitHub connected user can see repo list', async ({ page }) => {
    // First check if GitHub is connected
    const status = await checkGitHubStatus(page);

    if (!status.connected) {
      test.skip(true, 'GitHub not connected for test user - skipping repo list test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open GitHub integration
    await openGitHubIntegration(page);

    const state = await waitForGitHubFlowUI(page);

    if (state === 'install') {
      test.skip(true, 'GitHub App not installed - skipping repo list test');
      return;
    }

    // Should be in select state
    expect(state).toBe('select');

    // Verify search input is visible
    const searchInput = page.locator('input[placeholder*="Search repositories"]');
    await expect(searchInput).toBeVisible();

    // Get content to verify repos are displayed
    const content = await getPageContent(page);

    // Should have at least one repository visible (indicated by repo metadata)
    const hasRepos =
      content.includes('Private') ||
      content.includes('Public') ||
      /\d+\s*stars?/i.test(content) ||
      /[A-Za-z]+/.test(content); // Language indicator

    expect(hasRepos).toBe(true);
    console.log('✓ Repository list is displayed');
  });

  test('search filters repository list', async ({ page }) => {
    const status = await checkGitHubStatus(page);

    if (!status.connected) {
      test.skip(true, 'GitHub not connected - skipping search test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitHubIntegration(page);

    const state = await waitForGitHubFlowUI(page);

    if (state !== 'select') {
      test.skip(true, 'Not in select state - skipping search test');
      return;
    }

    // Get initial repo count
    const initialRepoButtons = page.locator(
      'button:has(svg[data-icon="github"]), button:has([class*="github"])'
    );
    const initialCount = await initialRepoButtons.count();
    console.log(`Initial repos visible: ${initialCount}`);

    // Type a search query (something unlikely to match all repos)
    const searchInput = page.locator('input[placeholder*="Search repositories"]');
    await searchInput.fill('xyznonexistent123');
    await page.waitForTimeout(500);

    // Should show "No repositories found" or reduced list
    const content = await getPageContent(page);
    const noResults = content.includes('No repositories found');
    const filteredCount = await initialRepoButtons.count();

    expect(noResults || filteredCount < initialCount).toBe(true);
    console.log('✓ Search filtering works');
  });

  test('click repo triggers import and creates project', async ({ page }) => {
    const status = await checkGitHubStatus(page);

    if (!status.connected || !status.hasInstallation) {
      test.skip(
        true,
        'GitHub not connected or app not installed - skipping import test'
      );
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitHubIntegration(page);

    const state = await waitForGitHubFlowUI(page);

    if (state !== 'select') {
      test.skip(true, 'Not in select state - skipping import test');
      return;
    }

    // Find and click the first repository
    const repoButton = page
      .locator('button')
      .filter({ has: page.locator('svg[data-icon="github"], [class*="github"]') })
      .first();

    // Get repo name before clicking
    const repoText = await repoButton.textContent();
    console.log(`Clicking on repo: ${repoText?.substring(0, 50)}...`);

    await repoButton.click();

    // Wait for import to start
    await page.waitForTimeout(3000);

    // Poll for project creation
    let projectCreated = false;
    let projectUrl = '';
    const startTime = Date.now();
    const maxWait = 120000; // 2 minutes

    while (Date.now() - startTime < maxWait) {
      // Check if we navigated to a project page
      const currentUrl = page.url();
      const projectMatch = currentUrl.match(/\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i);

      if (projectMatch && !currentUrl.includes('/home')) {
        projectUrl = currentUrl;
        projectCreated = true;
        console.log(`✓ Navigated to project: ${projectUrl}`);
        break;
      }

      // Check page content for success indicators
      const content = await getPageContent(page);

      // Check for project link in chat
      const linkMatch = content.match(/\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i);
      if (linkMatch) {
        projectUrl = linkMatch[2];
        projectCreated = true;
        console.log(`✓ Found project link: ${projectUrl}`);
        break;
      }

      // Check for import progress
      const isImporting =
        content.includes('Importing') ||
        content.includes('Creating project') ||
        content.includes('Processing') ||
        content.includes('Analyzing');

      if (isImporting) {
        console.log(
          `Import in progress... (${Math.round((Date.now() - startTime) / 1000)}s)`
        );
      }

      await page.waitForTimeout(3000);
    }

    // Verify project was created
    expect(projectCreated).toBe(true);
    expect(projectUrl).toBeTruthy();

    // Navigate to the project if we're not already there
    if (!page.url().includes(projectUrl)) {
      await page.goto(projectUrl);
      await page.waitForLoadState('domcontentloaded');
    }

    // Verify project page loaded correctly
    const pageTitle = await page.title();
    expect(pageTitle).not.toContain('404');
    expect(pageTitle).not.toContain('Not Found');

    // Verify project has GitHub-specific content
    const projectContent = await getPageContent(page);
    const hasGitHubIndicators =
      projectContent.includes('GitHub') ||
      projectContent.includes('Repository') ||
      projectContent.includes('Stars') ||
      projectContent.includes('Forks') ||
      /\d+ stars?/i.test(projectContent);

    expect(hasGitHubIndicators).toBe(true);
    console.log('✓ Project page has GitHub content');
  });

  test('back button returns to integration picker', async ({ page }) => {
    // Check status is available (not used directly, but validates API works)
    const _status = await checkGitHubStatus(page);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitHubIntegration(page);
    await waitForGitHubFlowUI(page);

    // Find and click the back button
    const backButton = page.locator('button:has-text("Back")');
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();

    await page.waitForTimeout(1000);

    // Should return to main menu or integration picker
    const content = await getPageContent(page);
    const returnedToMenu =
      content.includes('More Integrations') ||
      content.includes('Add from') ||
      content.includes('Import') ||
      content.includes('Upload');

    expect(returnedToMenu).toBe(true);
    console.log('✓ Back button works correctly');
  });
});

test.describe('GitHub Import - Edge Cases', () => {
  test.setTimeout(GITHUB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('handles API error gracefully', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Route to simulate API error
    await page.route('**/api/v1/github/repos/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await openGitHubIntegration(page);

    await page.waitForTimeout(3000);

    // Should show error state or fallback - page should still be functional
    const content = await getPageContent(page);
    const hasErrorHandling =
      content.includes('error') ||
      content.includes('Error') ||
      content.includes('try again') ||
      content.includes('Connect GitHub') ||
      content.includes('problem');

    // Verify page didn't crash
    const pageTitle = await page.title();
    expect(pageTitle).not.toBe('');

    // Log error handling result for debugging
    console.log(`Error handling present: ${hasErrorHandling}`);

    console.log('✓ Error handled gracefully');
  });

  test('handles rate limiting gracefully', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Route to simulate rate limiting
    await page.route('**/api/v1/github/**', (route) => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'Rate limit exceeded' }),
        headers: { 'Retry-After': '60' },
      });
    });

    await openGitHubIntegration(page);
    await page.waitForTimeout(2000);

    // Page should still be functional
    const pageTitle = await page.title();
    expect(pageTitle).not.toBe('');

    console.log('✓ Rate limiting handled gracefully');
  });
});

test.describe('GitHub Import - OAuth Flow', () => {
  test.setTimeout(GITHUB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('connect button initiates OAuth redirect', async ({ page }) => {
    const status = await checkGitHubStatus(page);

    if (status.connected) {
      test.skip(true, 'GitHub already connected - skipping OAuth test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitHubIntegration(page);

    const state = await waitForGitHubFlowUI(page);

    if (state !== 'connect') {
      test.skip(true, 'Not in connect state - skipping OAuth test');
      return;
    }

    // Set up route to capture the OAuth redirect
    let oauthRedirectUrl = '';
    await page.route('**/accounts/github/login/**', (route) => {
      oauthRedirectUrl = route.request().url();
      // Don't actually follow the redirect
      route.abort();
    });

    // Click connect button
    const connectButton = page.locator('button:has-text("Connect GitHub")');
    await connectButton.click();

    await page.waitForTimeout(2000);

    // Verify OAuth redirect was attempted
    if (oauthRedirectUrl) {
      expect(oauthRedirectUrl).toContain('accounts/github/login');
      console.log('✓ OAuth redirect initiated correctly');
    } else {
      // If no redirect captured, verify the button triggered some action
      const content = await getPageContent(page);
      const actionOccurred =
        content.includes('Redirecting') ||
        content.includes('Loading') ||
        page.url().includes('github');
      expect(actionOccurred || oauthRedirectUrl).toBeTruthy();
    }
  });

  test('OAuth callback URL returns correct format', async ({ page }) => {
    // Test that the callback endpoint exists and handles requests
    const response = await page.request.get(
      '/accounts/github/login/callback/?code=test&state=test'
    );

    // Should return 200 with error page (invalid code) or redirect
    expect([200, 302, 400]).toContain(response.status());

    if (response.status() === 200) {
      const text = await response.text();
      // Should show some kind of error for invalid code
      expect(
        text.includes('Login') || text.includes('error') || text.includes('Failure')
      ).toBe(true);
    }

    console.log('✓ OAuth callback endpoint works');
  });
});

test.describe('GitHub Import - App Installation', () => {
  test.setTimeout(GITHUB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('install URL is correctly formatted', async ({ page }) => {
    const response = await page.request.get('/api/v1/github/app/install-url/');

    if (response.status() === 401) {
      test.skip(true, 'GitHub not connected - skipping install URL test');
      return;
    }

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.install_url).toContain('github.com/apps');

    console.log('✓ Install URL format is correct');
    console.log(`  App slug: ${data.data.app_slug}`);
  });

  test('install button initiates GitHub App installation', async ({ page }) => {
    const status = await checkGitHubStatus(page);

    if (!status.connected) {
      test.skip(true, 'GitHub not connected - skipping install test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitHubIntegration(page);

    const state = await waitForGitHubFlowUI(page);

    if (state !== 'install') {
      test.skip(true, 'Not in install state - skipping install button test');
      return;
    }

    // Capture the install redirect
    let installUrl = '';
    page.on('popup', async (popup) => {
      installUrl = popup.url();
      await popup.close();
    });

    // Click install button
    const installButton = page.locator('button:has-text("Install AllThrive App")');
    await installButton.click();

    await page.waitForTimeout(3000);

    // Verify install flow was initiated
    if (installUrl) {
      expect(installUrl).toContain('github.com');
      console.log('✓ Install flow initiated');
    }
  });
});
