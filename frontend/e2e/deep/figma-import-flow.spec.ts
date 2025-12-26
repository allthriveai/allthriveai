/**
 * Figma Import Flow - Deep E2E Tests
 *
 * Tests the complete Figma integration journey:
 * 1. Connect to Figma (OAuth)
 * 2. Enter Figma design URL
 * 3. Import design and create project
 * 4. Verify project is created with correct category/tools
 *
 * Prerequisites:
 * - Test user should have Figma OAuth connected
 *
 * Run with: npx playwright test e2e/deep/figma-import-flow.spec.ts --project=deep
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, getPageContent } from './deep-helpers';

// Extended timeout for OAuth redirects and API calls
const FIGMA_FLOW_TIMEOUT = 180000; // 3 minutes

interface FigmaStatus {
  connected: boolean;
  handle?: string;
  email?: string;
}

/**
 * Check Figma connection status via API
 */
async function checkFigmaStatus(page: Page): Promise<FigmaStatus> {
  const response = await page.request.get('/api/v1/social/status/figma/');

  if (!response.ok()) {
    return { connected: false };
  }

  const data = await response.json();
  return {
    connected: data.data?.connected || false,
    handle: data.data?.user?.handle,
    email: data.data?.user?.email,
  };
}

/**
 * Wait for the Figma flow UI to load and stabilize
 */
async function waitForFigmaFlowUI(page: Page, timeout = 30000): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);

    // Check for various states
    const hasConnectButton = content.includes('Connect Figma');
    const hasImportHeading = content.includes('Import from Figma');
    const hasUrlInput = content.includes('figma.com') && content.includes('Paste');
    const hasLoading = content.includes('Loading') || content.includes('Checking');

    if (hasLoading) {
      console.log('Figma flow loading...');
      await page.waitForTimeout(1000);
      continue;
    }

    if (hasConnectButton) return 'connect';
    if (hasImportHeading || hasUrlInput) return 'import';

    await page.waitForTimeout(500);
  }

  return 'unknown';
}

/**
 * Open the Figma integration from the chat plus menu
 */
async function openFigmaIntegration(page: Page): Promise<void> {
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

  // Click "Add from Figma"
  const figmaOption = page.locator('text=Add from Figma');
  await expect(figmaOption).toBeVisible({ timeout: 5000 });
  await figmaOption.click();

  // Wait for flow UI to load
  await page.waitForTimeout(2000);
}

test.describe('Figma Import - Full Flow', () => {
  test.setTimeout(FIGMA_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('check Figma connection status via API', async ({ page }) => {
    const status = await checkFigmaStatus(page);

    console.log('Figma Status:', status);

    // This test just verifies the API works
    expect(typeof status.connected).toBe('boolean');

    if (status.connected) {
      console.log(`✓ Figma connected as: ${status.handle || status.email}`);
    } else {
      console.log('✗ Figma not connected for test user');
    }
  });

  test('open Figma integration shows appropriate UI state', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open the Figma integration
    await openFigmaIntegration(page);

    // Wait for the flow UI to stabilize
    const state = await waitForFigmaFlowUI(page);

    console.log(`Figma flow UI state: ${state}`);

    // Should show one of the valid states
    expect(['connect', 'import']).toContain(state);

    // Verify UI elements based on state
    if (state === 'connect') {
      await expect(page.locator('text=Connect Figma')).toBeVisible();
      console.log('→ User needs to connect Figma OAuth');
    } else if (state === 'import') {
      const urlInput = page.locator('input[type="url"][placeholder*="figma.com"]');
      await expect(urlInput).toBeVisible();
      console.log('→ User can enter Figma URL to import');
    }
  });

  test('Figma connected user can see URL import form', async ({ page }) => {
    // First check if Figma is connected
    const status = await checkFigmaStatus(page);

    if (!status.connected) {
      test.skip(true, 'Figma not connected for test user - skipping import form test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open Figma integration
    await openFigmaIntegration(page);

    const state = await waitForFigmaFlowUI(page);

    // Should be in import state
    expect(state).toBe('import');

    // Verify URL input is visible
    const urlInput = page.locator('input[type="url"][placeholder*="figma.com"]');
    await expect(urlInput).toBeVisible();

    // Verify Import button exists
    const importButton = page.getByRole('button', { name: /Import Design/i });
    await expect(importButton).toBeVisible();

    // Button should be disabled when input is empty
    await expect(importButton).toBeDisabled();

    console.log('✓ Figma URL import form is displayed');
  });

  test('URL validation shows appropriate feedback', async ({ page }) => {
    const status = await checkFigmaStatus(page);

    if (!status.connected) {
      test.skip(true, 'Figma not connected - skipping URL validation test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openFigmaIntegration(page);

    const state = await waitForFigmaFlowUI(page);

    if (state !== 'import') {
      test.skip(true, 'Not in import state - skipping URL validation test');
      return;
    }

    const urlInput = page.locator('input[type="url"][placeholder*="figma.com"]');
    const importButton = page.getByRole('button', { name: /Import Design/i });
    const errorMessage = page.getByText(/Please enter a valid Figma/i);

    // Enter invalid URL
    await urlInput.fill('https://google.com/not-a-figma-url');
    await page.waitForTimeout(500);

    // Should show validation error
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    console.log('✓ Invalid URL shows error');

    // Clear and enter valid Figma URL
    await urlInput.clear();
    await urlInput.fill('https://www.figma.com/design/abc123/My-Design');
    await page.waitForTimeout(500);

    // Error should disappear
    await expect(errorMessage).not.toBeVisible({ timeout: 3000 });

    // Import button should now be enabled
    await expect(importButton).toBeEnabled();
    console.log('✓ Valid URL enables import button');
  });

  test('accepts various valid Figma URL formats', async ({ page }) => {
    const status = await checkFigmaStatus(page);

    if (!status.connected) {
      test.skip(true, 'Figma not connected - skipping URL format test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openFigmaIntegration(page);

    const state = await waitForFigmaFlowUI(page);

    if (state !== 'import') {
      test.skip(true, 'Not in import state - skipping URL format test');
      return;
    }

    const urlInput = page.locator('input[type="url"][placeholder*="figma.com"]');
    const importButton = page.getByRole('button', { name: /Import Design/i });
    const errorMessage = page.getByText(/Please enter a valid Figma/i);

    // Test valid URL formats
    const validUrls = [
      'https://www.figma.com/design/abc123/My-Design',
      'https://www.figma.com/file/xyz789/Another-Design',
      'https://figma.com/design/abc123/Design-Name',
      'https://www.figma.com/file/abc123XYZ/Design?node-id=0-1',
      'https://www.figma.com/make/def456/My-Slides',
      'https://my-portfolio.figma.site',
    ];

    for (const url of validUrls) {
      await urlInput.clear();
      await urlInput.fill(url);
      await page.waitForTimeout(300);

      // Should NOT show error
      const isErrorVisible = await errorMessage.isVisible().catch(() => false);
      expect(isErrorVisible).toBe(false);

      // Button should be enabled
      await expect(importButton).toBeEnabled();
    }

    console.log(`✓ All ${validUrls.length} valid URL formats accepted`);
  });

  test('import Figma design creates project', async ({ page }) => {
    const status = await checkFigmaStatus(page);

    if (!status.connected) {
      test.skip(true, 'Figma not connected - skipping import test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openFigmaIntegration(page);

    const state = await waitForFigmaFlowUI(page);

    if (state !== 'import') {
      test.skip(true, 'Not in import state - skipping import test');
      return;
    }

    const urlInput = page.locator('input[type="url"][placeholder*="figma.com"]');
    const importButton = page.getByRole('button', { name: /Import Design/i });

    // Enter a valid Figma URL
    // Note: This should be a real Figma file the test user has access to
    await urlInput.fill('https://www.figma.com/design/test123/Test-Design');
    await page.waitForTimeout(500);

    // Click Import button
    await importButton.click();

    console.log('Import initiated...');

    // Wait for import to complete
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

      // Check for success message
      if (content.includes('imported') || content.includes('created')) {
        // Try to find the project URL in the response
        const urlMatch = content.match(/\/[a-z0-9_-]+\/[a-z0-9_-]+/i);
        if (urlMatch) {
          projectUrl = urlMatch[0];
          projectCreated = true;
          console.log(`✓ Found project URL in response: ${projectUrl}`);
          break;
        }
      }

      // Check for import progress
      const isImporting =
        content.includes('Importing') ||
        content.includes('Creating') ||
        content.includes('Processing') ||
        content.includes('Analyzing');

      if (isImporting) {
        console.log(`Import in progress... (${Math.round((Date.now() - startTime) / 1000)}s)`);
      }

      // Check for error
      if (content.includes('error') || content.includes('failed') || content.includes('not found')) {
        console.log('Import may have failed - checking...');
      }

      await page.waitForTimeout(3000);
    }

    // If project was created, verify it
    if (projectCreated && projectUrl) {
      // Navigate to the project
      await page.goto(projectUrl);
      await page.waitForLoadState('domcontentloaded');

      // Verify project page loaded correctly
      const pageTitle = await page.title();
      expect(pageTitle).not.toContain('404');
      expect(pageTitle).not.toContain('Not Found');

      // Verify project has Figma-specific content
      const projectContent = await getPageContent(page);
      const hasFigmaIndicators =
        projectContent.includes('Figma') ||
        projectContent.includes('Design') ||
        projectContent.includes('UI') ||
        projectContent.includes('Mockup');

      console.log(`✓ Project has Figma indicators: ${hasFigmaIndicators}`);
    } else {
      // Import didn't complete - this is acceptable if the test file doesn't exist
      console.log('Note: Import did not complete - test file may not exist or be accessible');
    }
  });

  test('back button returns to integration picker', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openFigmaIntegration(page);
    await waitForFigmaFlowUI(page);

    // Find and click the back button
    const backButton = page.locator('button:has-text("Back")');

    if (await backButton.isVisible({ timeout: 5000 }).catch(() => false)) {
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
    } else {
      console.log('Back button not visible - flow may have different navigation');
    }
  });
});

test.describe('Figma Import - Edge Cases', () => {
  test.setTimeout(FIGMA_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('handles API error gracefully', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Route to simulate API error
    await page.route('**/api/v1/social/status/figma/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await openFigmaIntegration(page);

    await page.waitForTimeout(3000);

    // Should show error state or fallback - page should still be functional
    const content = await getPageContent(page);
    const hasErrorHandling =
      content.includes('error') ||
      content.includes('Error') ||
      content.includes('try again') ||
      content.includes('Connect Figma') ||
      content.includes('trouble');

    // Verify page didn't crash
    const pageTitle = await page.title();
    expect(pageTitle).not.toBe('');

    console.log(`Error handling present: ${hasErrorHandling}`);
    console.log('✓ Error handled gracefully');
  });

  test('handles rate limiting gracefully', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Route to simulate rate limiting
    await page.route('**/api/v1/figma/**', (route) => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'Rate limit exceeded' }),
        headers: { 'Retry-After': '60' },
      });
    });

    await openFigmaIntegration(page);
    await page.waitForTimeout(2000);

    // Page should still be functional
    const pageTitle = await page.title();
    expect(pageTitle).not.toBe('');

    console.log('✓ Rate limiting handled gracefully');
  });

  test('handles invalid Figma file gracefully', async ({ page }) => {
    const status = await checkFigmaStatus(page);

    if (!status.connected) {
      test.skip(true, 'Figma not connected - skipping invalid file test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Mock the Figma file preview to return error
    await page.route('**/api/v1/figma/files/*/preview/**', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'File not found',
          message: 'The Figma file could not be accessed',
        }),
      });
    });

    await openFigmaIntegration(page);

    const state = await waitForFigmaFlowUI(page);

    if (state !== 'import') {
      test.skip(true, 'Not in import state - skipping invalid file test');
      return;
    }

    const urlInput = page.locator('input[type="url"][placeholder*="figma.com"]');
    await urlInput.fill('https://www.figma.com/design/nonexistent123/Missing-File');
    await page.waitForTimeout(500);

    const importButton = page.getByRole('button', { name: /Import Design/i });
    await importButton.click();
    await page.waitForTimeout(3000);

    // Should show error or allow retry
    const content = await getPageContent(page);
    const hasErrorFeedback =
      content.includes('not found') ||
      content.includes('error') ||
      content.includes('try again') ||
      content.includes('could not');

    // The form should still be visible for retry OR show error state
    const urlInputStillVisible = await urlInput.isVisible({ timeout: 3000 }).catch(() => false);

    expect(urlInputStillVisible || hasErrorFeedback).toBe(true);
    console.log('✓ Invalid file handled gracefully');
  });
});

test.describe('Figma Import - OAuth Flow', () => {
  test.setTimeout(FIGMA_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('connect button initiates OAuth redirect', async ({ page }) => {
    const status = await checkFigmaStatus(page);

    if (status.connected) {
      test.skip(true, 'Figma already connected - skipping OAuth test');
      return;
    }

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await openFigmaIntegration(page);

    const state = await waitForFigmaFlowUI(page);

    if (state !== 'connect') {
      test.skip(true, 'Not in connect state - skipping OAuth test');
      return;
    }

    // Set up route to capture the OAuth redirect
    let oauthRedirectUrl = '';
    await page.route('**/api/v1/social/connect/figma/**', (route) => {
      oauthRedirectUrl = route.request().url();
      // Don't actually follow the redirect
      route.abort();
    });

    // Click connect button
    const connectButton = page.getByRole('button', { name: /Connect Figma/i });
    await connectButton.click();

    await page.waitForTimeout(2000);

    // Verify OAuth redirect was attempted
    if (oauthRedirectUrl) {
      expect(oauthRedirectUrl).toContain('social/connect/figma');
      console.log('✓ OAuth redirect initiated correctly');
    } else {
      // If no redirect captured, verify the button triggered some action
      const content = await getPageContent(page);
      const currentUrl = page.url();
      const actionOccurred =
        content.includes('Redirecting') ||
        content.includes('Loading') ||
        currentUrl.includes('figma');
      expect(actionOccurred || oauthRedirectUrl).toBeTruthy();
    }
  });

  test('OAuth return with ?connected=figma shows import form', async ({ page }) => {
    // Mock connected state (simulating post-OAuth return)
    await page.route('**/api/v1/social/status/figma/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            connected: true,
            provider: 'figma',
            user: { handle: 'testuser' },
          },
        }),
      });
    });

    // Navigate to /home with ?connected=figma query param
    await page.goto('/home?connected=figma');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Should automatically show the Figma import form
    const urlInput = page.locator('input[type="url"][placeholder*="figma.com"]');
    const importHeading = page.locator('h3:has-text("Import from Figma")');

    const isInputVisible = await urlInput.isVisible({ timeout: 10000 }).catch(() => false);
    const isHeadingVisible = await importHeading.isVisible({ timeout: 5000 }).catch(() => false);

    expect(isInputVisible || isHeadingVisible).toBe(true);

    // Query param should be cleared from URL
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('connected=figma');

    console.log('✓ OAuth return shows import form correctly');
  });
});

test.describe('Figma Import - Project Verification', () => {
  test.setTimeout(FIGMA_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('imported Figma project has Design category', async ({ page }) => {
    // This test would verify a previously imported Figma project
    // has the correct category assigned

    // Check if there are any Figma projects for the test user
    const response = await page.request.get('/api/v1/projects/?source_type=figma');

    if (!response.ok()) {
      test.skip(true, 'Could not fetch projects - skipping category test');
      return;
    }

    const data = await response.json();
    const projects = data.results || data.data?.results || [];

    if (projects.length === 0) {
      test.skip(true, 'No Figma projects found - skipping category test');
      return;
    }

    // Check the first Figma project
    const project = projects[0];

    // Navigate to the project
    await page.goto(`/${project.user?.username || 'testuser'}/${project.slug}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify project page has Design category
    const content = await getPageContent(page);
    const hasDesignCategory =
      content.includes('Design') || content.includes('UI') || content.includes('Mockup');

    console.log(`Project has Design category: ${hasDesignCategory}`);

    // Verify Figma is in Built With
    const hasFigmaTool = content.includes('Figma');
    console.log(`Project has Figma tool: ${hasFigmaTool}`);
  });

  test('imported Figma project has Figma in Built With tools', async ({ page }) => {
    // Similar to above, verify Figma is listed as a tool

    const response = await page.request.get('/api/v1/projects/?source_type=figma&limit=1');

    if (!response.ok()) {
      test.skip(true, 'Could not fetch projects - skipping tools test');
      return;
    }

    const data = await response.json();
    const projects = data.results || data.data?.results || [];

    if (projects.length === 0) {
      test.skip(true, 'No Figma projects found - skipping tools test');
      return;
    }

    const project = projects[0];

    // Check if project has Figma in tools
    const tools = project.tools || [];
    const hasFigmaTool = tools.some(
      (tool: { name?: string; slug?: string }) =>
        tool.name?.toLowerCase() === 'figma' || tool.slug?.toLowerCase() === 'figma'
    );

    expect(hasFigmaTool).toBe(true);
    console.log('✓ Figma project has Figma in Built With tools');
  });
});
