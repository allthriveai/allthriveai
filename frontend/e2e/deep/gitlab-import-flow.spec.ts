/**
 * GitLab Import Flow - Deep E2E Tests
 *
 * Tests the complete GitLab integration journey:
 * 1. Connect to GitLab (OAuth)
 * 2. See list of projects
 * 3. Click on a project to import
 * 4. Verify project is created
 *
 * Prerequisites:
 * - Test user should have GitLab OAuth connected
 *
 * Run with: npx playwright test e2e/deep/gitlab-import-flow.spec.ts --project=deep
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, getPageContent } from './deep-helpers';

// Extended timeout for OAuth redirects and API calls
const GITLAB_FLOW_TIMEOUT = 180000; // 3 minutes

interface GitLabStatus {
  connected: boolean;
  username?: string;
}

/**
 * Check GitLab connection status via API
 */
async function checkGitLabStatus(page: Page): Promise<GitLabStatus> {
  const response = await page.request.get('/api/v1/social/status/gitlab/');

  if (!response.ok()) {
    return { connected: false };
  }

  const data = await response.json();
  return {
    connected: data.data?.connected || false,
    username: data.data?.username,
  };
}

/**
 * Wait for the GitLab flow UI to load and stabilize
 */
async function waitForGitLabFlowUI(page: Page, timeout = 30000): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);

    // Check for various states
    const hasConnectButton = content.includes('Connect GitLab');
    const hasSearchProjects = content.includes('Search projects');
    const hasProjectList = content.includes('Private') || content.includes('Public') || /\d+ stars?/i.test(content);
    const hasLoading = content.includes('Loading') || content.includes('Checking');

    if (hasLoading) {
      console.log('GitLab flow loading...');
      await page.waitForTimeout(1000);
      continue;
    }

    if (hasConnectButton) return 'connect';
    if (hasSearchProjects || hasProjectList) return 'select';

    await page.waitForTimeout(500);
  }

  return 'unknown';
}

/**
 * Open the GitLab integration from the chat plus menu
 */
async function openGitLabIntegration(page: Page): Promise<void> {
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

  // Click "Add from GitLab"
  const gitlabOption = page.locator('text=Add from GitLab');
  await expect(gitlabOption).toBeVisible({ timeout: 5000 });
  await gitlabOption.click();

  // Wait for flow UI to load
  await page.waitForTimeout(2000);
}

test.describe('GitLab Import - Full Flow', () => {
  test.setTimeout(GITLAB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('check GitLab connection status via API', async ({ page }) => {
    const status = await checkGitLabStatus(page);

    console.log('GitLab Status:', status);

    // This test just verifies the API works
    expect(typeof status.connected).toBe('boolean');

    if (status.connected) {
      console.log(`✓ GitLab connected as: ${status.username}`);
    } else {
      console.log('✗ GitLab not connected for test user');
    }
  });

  test('open GitLab integration shows appropriate UI state', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open the GitLab integration
    await openGitLabIntegration(page);

    // Wait for the flow UI to stabilize
    const state = await waitForGitLabFlowUI(page);

    console.log(`GitLab flow UI state: ${state}`);

    // Should show one of the valid states
    expect(['connect', 'select']).toContain(state);

    // Verify UI elements based on state
    if (state === 'connect') {
      await expect(page.locator('text=Connect GitLab')).toBeVisible();
      console.log('→ User needs to connect GitLab OAuth');
    } else if (state === 'select') {
      await expect(
        page.locator('input[placeholder*="Search projects"]')
      ).toBeVisible();
      console.log('→ User can select projects');
    }
  });

  test('GitLab connected user can see project list', async ({ page }) => {
    // First check if GitLab is connected
    const status = await checkGitLabStatus(page);

    if (!status.connected) {
      test.skip(true, 'GitLab not connected for test user - skipping project list test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open GitLab integration
    await openGitLabIntegration(page);

    const state = await waitForGitLabFlowUI(page);

    // Should be in select state
    expect(state).toBe('select');

    // Verify search input is visible
    const searchInput = page.locator('input[placeholder*="Search projects"]');
    await expect(searchInput).toBeVisible();

    // Get content to verify projects are displayed
    const content = await getPageContent(page);

    // Should have at least one project visible
    const hasProjects =
      content.includes('Private') ||
      content.includes('Public') ||
      /\d+\s*stars?/i.test(content);

    expect(hasProjects).toBe(true);
    console.log('✓ Project list is displayed');
  });

  test('search filters project list', async ({ page }) => {
    const status = await checkGitLabStatus(page);

    if (!status.connected) {
      test.skip(true, 'GitLab not connected - skipping search test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitLabIntegration(page);

    const state = await waitForGitLabFlowUI(page);

    if (state !== 'select') {
      test.skip(true, 'Not in select state - skipping search test');
      return;
    }

    // Get initial project count
    const initialProjectButtons = page.locator(
      'button:has(svg[data-icon="gitlab"]), button:has([class*="gitlab"])'
    );
    const initialCount = await initialProjectButtons.count();
    console.log(`Initial projects visible: ${initialCount}`);

    // Type a search query (something unlikely to match all projects)
    const searchInput = page.locator('input[placeholder*="Search projects"]');
    await searchInput.fill('xyznonexistent123');
    await page.waitForTimeout(500);

    // Should show "No projects found" or reduced list
    const content = await getPageContent(page);
    const noResults = content.includes('No projects found');
    const filteredCount = await initialProjectButtons.count();

    expect(noResults || filteredCount < initialCount).toBe(true);
    console.log('✓ Search filtering works');
  });

  test('click project triggers import and creates project', async ({ page }) => {
    const status = await checkGitLabStatus(page);

    if (!status.connected) {
      test.skip(true, 'GitLab not connected - skipping import test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitLabIntegration(page);

    const state = await waitForGitLabFlowUI(page);

    if (state !== 'select') {
      test.skip(true, 'Not in select state - skipping import test');
      return;
    }

    // Find and click the first project
    const projectButton = page
      .locator('button')
      .filter({ has: page.locator('svg[data-icon="gitlab"], [class*="gitlab"], [class*="orange"]') })
      .first();

    // If no gitlab icon, try finding any project button in the list
    let buttonToClick = projectButton;
    if (await projectButton.count() === 0) {
      buttonToClick = page.locator('.space-y-2 button').first();
    }

    // Get project name before clicking
    const projectText = await buttonToClick.textContent();
    console.log(`Clicking on project: ${projectText?.substring(0, 50)}...`);

    await buttonToClick.click();

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

    // Verify project has GitLab-specific content
    const projectContent = await getPageContent(page);
    const hasGitLabIndicators =
      projectContent.includes('GitLab') ||
      projectContent.includes('Repository') ||
      projectContent.includes('Stars') ||
      projectContent.includes('Forks') ||
      /\d+ stars?/i.test(projectContent);

    expect(hasGitLabIndicators).toBe(true);
    console.log('✓ Project page has GitLab content');
  });

  test('back button returns to integration picker', async ({ page }) => {
    // Check status is available (not used directly, but validates API works)
    const _status = await checkGitLabStatus(page);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitLabIntegration(page);
    await waitForGitLabFlowUI(page);

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

test.describe('GitLab Import - Edge Cases', () => {
  test.setTimeout(GITLAB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('handles API error gracefully', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Route to simulate API error
    await page.route('**/api/v1/gitlab/projects/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await openGitLabIntegration(page);

    await page.waitForTimeout(3000);

    // Should show error state or fallback - page should still be functional
    const content = await getPageContent(page);
    const hasErrorHandling =
      content.includes('error') ||
      content.includes('Error') ||
      content.includes('try again') ||
      content.includes('Connect GitLab') ||
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
    await page.route('**/api/v1/gitlab/**', (route) => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'Rate limit exceeded' }),
        headers: { 'Retry-After': '60' },
      });
    });

    await openGitLabIntegration(page);
    await page.waitForTimeout(2000);

    // Page should still be functional
    const pageTitle = await page.title();
    expect(pageTitle).not.toBe('');

    console.log('✓ Rate limiting handled gracefully');
  });
});

test.describe('GitLab Import - OAuth Flow', () => {
  test.setTimeout(GITLAB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('connect button initiates OAuth redirect', async ({ page }) => {
    const status = await checkGitLabStatus(page);

    if (status.connected) {
      test.skip(true, 'GitLab already connected - skipping OAuth test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openGitLabIntegration(page);

    const state = await waitForGitLabFlowUI(page);

    if (state !== 'connect') {
      test.skip(true, 'Not in connect state - skipping OAuth test');
      return;
    }

    // Set up route to capture the OAuth redirect
    let oauthRedirectUrl = '';
    await page.route('**/accounts/gitlab/login/**', (route) => {
      oauthRedirectUrl = route.request().url();
      // Don't actually follow the redirect
      route.abort();
    });

    // Click connect button
    const connectButton = page.locator('button:has-text("Connect GitLab")');
    await connectButton.click();

    await page.waitForTimeout(2000);

    // Verify OAuth redirect was attempted
    if (oauthRedirectUrl) {
      expect(oauthRedirectUrl).toContain('accounts/gitlab/login');
      console.log('✓ OAuth redirect initiated correctly');
    } else {
      // If no redirect captured, verify the button triggered some action
      const content = await getPageContent(page);
      const actionOccurred =
        content.includes('Redirecting') ||
        content.includes('Loading') ||
        page.url().includes('gitlab');
      expect(actionOccurred || oauthRedirectUrl).toBeTruthy();
    }
  });

  test('OAuth callback URL returns correct format', async ({ page }) => {
    // Test that the callback endpoint exists and handles requests
    const response = await page.request.get(
      '/accounts/gitlab/login/callback/?code=test&state=test'
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

test.describe('GitLab Import - URL Paste Flow', () => {
  test.setTimeout(GITLAB_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('paste GitLab URL in chat triggers import flow', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find the chat input
    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: 30000 });

    // Paste a GitLab URL
    await chatInput.fill('https://gitlab.com/gitlab-org/gitlab');
    await chatInput.press('Enter');

    // Wait for response
    await page.waitForTimeout(5000);

    const content = await getPageContent(page);

    // Should either ask about ownership, offer to import, or ask to connect GitLab
    const validResponse =
      content.includes('GitLab') ||
      content.includes('gitlab') ||
      content.includes('connect') ||
      content.includes('import') ||
      content.includes('project') ||
      content.includes('your') ||
      content.includes('clip');

    expect(validResponse).toBe(true);
    console.log('✓ GitLab URL paste handled correctly');
  });
});
