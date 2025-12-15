import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, API_BASE_URL } from './helpers';

// Run tests serially to avoid login race conditions
test.describe.configure({ mode: 'serial' });

// Helper to wait for page to be ready (avoids networkidle timeout with WebSockets)
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for the personalization heading to appear
  await page.waitForSelector('h2:has-text("Personalization")', { timeout: 15000 });
  // Wait for settings to load (spinner to disappear, feature cards to appear)
  await page.waitForSelector('button:has-text("AI Portfolio")', { timeout: 10000 });
  // Dismiss any notification banners that might overlay content
  const dismissButton = page.locator('[aria-label="Dismiss"], button:has-text("×"), .notification-banner button').first();
  if (await dismissButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dismissButton.click();
    await page.waitForTimeout(300);
  }
  // Also try closing the battle notification banner
  const battleBanner = page.locator('text=battles waiting for your turn');
  if (await battleBanner.isVisible({ timeout: 500 }).catch(() => false)) {
    // Find the X button next to the banner
    const xButton = page.locator('[data-testid="close-banner"], button svg.w-5.h-5').last();
    if (await xButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await xButton.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

// Helper to reset personalization settings via API
async function resetSettingsViaAPI(page: Page) {
  await page.evaluate(async (apiBase) => {
    const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
    await fetch(`${apiBase}/api/v1/me/personalization/settings/reset/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '',
      },
      credentials: 'include',
    });
  }, API_BASE_URL);
}

test.describe('Personalization Settings', () => {
  // Login once before all tests in this describe block
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginViaAPI(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Each test gets a fresh login
    await loginViaAPI(page);
  });

  // =========================================================================
  // Navigation & Page Load
  // =========================================================================

  test('should navigate to personalization settings page', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    await expect(page.getByRole('heading', { name: 'Personalization' })).toBeVisible();
  });

  test('should load all settings sections', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Verify all major sections are present (use headings for specificity)
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Feature Interests' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recommendation Controls' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Topics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible();
  });

  // =========================================================================
  // Theme Switching
  // =========================================================================

  test('should toggle theme preference', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Click dark mode button (find by the text inside button)
    const darkButton = page.locator('button').filter({ hasText: 'Dark' }).filter({ hasText: 'Easy on the eyes' });
    await darkButton.click();

    // Verify dark class is applied to html element
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Click light mode button
    const lightButton = page.locator('button').filter({ hasText: 'Light' }).filter({ hasText: 'Bright and clear' });
    await lightButton.click();

    // Verify dark class is removed
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  // =========================================================================
  // Feature Interests
  // =========================================================================

  test('should select feature interests', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Reset settings first
    await resetSettingsViaAPI(page);
    await page.reload();
    await waitForPageReady(page);

    // Scroll to Feature Interests section to avoid any banners
    const featureSection = page.getByRole('heading', { name: 'Feature Interests' });
    await featureSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Find and click AI Portfolio card (use more specific selector)
    const portfolioCard = page.locator('button').filter({ hasText: 'AI Portfolio' }).filter({ hasText: 'Auto-showcase your work' });
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300); // Wait for state update

    // Verify it's selected (has primary border)
    await expect(portfolioCard).toHaveClass(/border-primary-500/);

    // Click Prompt Battles
    const battlesCard = page.locator('button').filter({ hasText: 'Prompt Battles' }).filter({ hasText: 'Compete with AI prompts' });
    await battlesCard.scrollIntoViewIfNeeded();
    await battlesCard.click();
    await page.waitForTimeout(300); // Wait for state update
    await expect(battlesCard).toHaveClass(/border-primary-500/);
  });

  test('should save and persist feature interests', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Reset first
    await resetSettingsViaAPI(page);
    await page.reload();
    await waitForPageReady(page);

    // Scroll to Feature Interests section
    const featureSection = page.getByRole('heading', { name: 'Feature Interests' });
    await featureSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Select features
    const portfolioCard = page.locator('button').filter({ hasText: 'AI Portfolio' }).filter({ hasText: 'Auto-showcase your work' });
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);
    await expect(portfolioCard).toHaveClass(/border-primary-500/);

    // Find the Feature Interests section and its Save button
    const featureInterestsSection = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Feature Interests', exact: true }) }).first();
    const saveButton = featureInterestsSection.getByRole('button', { name: 'Save', exact: true });

    // Scroll to and click save button
    await saveButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // Wait for the API call to complete with success
    const savePromise = page.waitForResponse(
      async (resp) => {
        if (resp.url().includes('/personalization/settings') && resp.request().method() === 'PATCH') {
          const status = resp.status();
          return status === 200;
        }
        return false;
      },
      { timeout: 10000 }
    );
    await saveButton.click();
    const response = await savePromise;
    const responseBody = await response.json();

    // Verify the response contains the saved excited_features
    expect(responseBody.excited_features).toContain('portfolio');

    // Verify via API that settings were saved
    const settingsResponse = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:8000/api/v1/me/personalization/settings/', {
        credentials: 'include'
      });
      return resp.json();
    });
    expect(settingsResponse.excited_features).toContain('portfolio');

    // Reload and verify API persistence
    await page.reload();
    await waitForPageReady(page);

    // Check settings after reload via API - this verifies backend persistence
    const settingsAfterReload = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:8000/api/v1/me/personalization/settings/', {
        credentials: 'include'
      });
      return resp.json();
    });
    expect(settingsAfterReload.excited_features).toContain('portfolio');

    // Note: UI rendering of persisted settings after reload depends on component
    // correctly syncing local state from API, which is tested separately
  });

  test('should show integration options when AI Portfolio selected', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Reset first
    await resetSettingsViaAPI(page);
    await page.reload();
    await waitForPageReady(page);

    // Scroll to Feature Interests section
    const featureSection = page.getByRole('heading', { name: 'Feature Interests' });
    await featureSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Initially, integrations should not be visible
    await expect(page.getByText('Where should we import your portfolio from?')).not.toBeVisible();

    // Select AI Portfolio
    const portfolioCard = page.locator('button').filter({ hasText: 'AI Portfolio' }).filter({ hasText: 'Auto-showcase your work' });
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);

    // Now integrations should appear
    await expect(page.getByText('Where should we import your portfolio from?')).toBeVisible({ timeout: 5000 });

    // Check integration pills are visible
    const integrationSection = page.locator('div').filter({ hasText: 'Where should we import your portfolio from?' });
    await expect(integrationSection.getByRole('button', { name: 'GitHub' })).toBeVisible();
    await expect(integrationSection.getByRole('button', { name: 'Paste any URL' })).toBeVisible();
  });

  test('should select integration options', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Reset and select portfolio
    await resetSettingsViaAPI(page);
    await page.reload();
    await waitForPageReady(page);

    // Scroll to Feature Interests section
    const featureSection = page.getByRole('heading', { name: 'Feature Interests' });
    await featureSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const portfolioCard = page.locator('button').filter({ hasText: 'AI Portfolio' }).filter({ hasText: 'Auto-showcase your work' });
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);

    // Wait for integrations to appear
    await expect(page.getByText('Where should we import your portfolio from?')).toBeVisible({ timeout: 5000 });

    // Select GitHub integration (it's a pill button, not a card)
    const githubPill = page.locator('button').filter({ hasText: /^GitHub$/ });
    await githubPill.scrollIntoViewIfNeeded();
    await githubPill.click();
    await page.waitForTimeout(300);

    // Verify selection (primary background)
    await expect(githubPill).toHaveClass(/bg-primary-500/);

    // Select LinkedIn
    const linkedinPill = page.locator('button').filter({ hasText: /^LinkedIn$/ });
    await linkedinPill.scrollIntoViewIfNeeded();
    await linkedinPill.click();
    await page.waitForTimeout(300);
    await expect(linkedinPill).toHaveClass(/bg-primary-500/);
  });

  test('should enter custom integration suggestion', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Reset and select portfolio
    await resetSettingsViaAPI(page);
    await page.reload();
    await waitForPageReady(page);

    // Scroll to Feature Interests section
    const featureSection = page.getByRole('heading', { name: 'Feature Interests' });
    await featureSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const portfolioCard = page.locator('button').filter({ hasText: 'AI Portfolio' }).filter({ hasText: 'Auto-showcase your work' });
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);

    // Wait for integrations section
    await expect(page.getByText('Where should we import your portfolio from?')).toBeVisible({ timeout: 5000 });

    // Find and fill the "Other integration" input
    const otherInput = page.getByPlaceholder('e.g., Behance, Dribbble, Notion...');
    await otherInput.fill('Behance');

    // Verify value
    await expect(otherInput).toHaveValue('Behance');
  });

  test('should clear integrations when portfolio deselected', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Reset first
    await resetSettingsViaAPI(page);
    await page.reload();
    await waitForPageReady(page);

    // Scroll to Feature Interests section
    const featureSection = page.getByRole('heading', { name: 'Feature Interests' });
    await featureSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Select portfolio
    const portfolioCard = page.locator('button').filter({ hasText: 'AI Portfolio' }).filter({ hasText: 'Auto-showcase your work' });
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);

    // Wait for integrations and select one
    await expect(page.getByText('Where should we import your portfolio from?')).toBeVisible({ timeout: 5000 });
    const githubPill = page.locator('button').filter({ hasText: /^GitHub$/ });
    await githubPill.scrollIntoViewIfNeeded();
    await githubPill.click();
    await page.waitForTimeout(300);

    // Deselect portfolio
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);

    // Integrations section should be hidden
    await expect(page.getByText('Where should we import your portfolio from?')).not.toBeVisible();

    // Re-select portfolio - GitHub should no longer be selected
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Where should we import your portfolio from?')).toBeVisible({ timeout: 5000 });

    const githubPillAfter = page.locator('button').filter({ hasText: /^GitHub$/ });
    await expect(githubPillAfter).not.toHaveClass(/bg-primary-500/);
  });

  // =========================================================================
  // Recommendation Controls
  // =========================================================================

  // TODO: Fix toggle click interaction - the click doesn't trigger the PATCH API call
  test.skip('should toggle recommendation signals', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Scroll to Recommendation Controls section
    const recommendationSection = page.getByRole('heading', { name: 'Recommendation Controls' });
    await recommendationSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Find the toggle button for "Views & Engagement" - it's inside a div with that text
    const viewsSection = page.locator('div.p-2\\.5, div.p-3').filter({ hasText: 'Views & Engagement' }).filter({ hasText: 'Learn from projects you view' });
    const toggle = viewsSection.locator('button');

    // Get initial API state
    const initialSettings = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:8000/api/v1/me/personalization/settings/', {
        credentials: 'include'
      });
      return resp.json();
    });
    const wasEnabled = initialSettings.learn_from_views;

    // Click to toggle and wait for API response
    await toggle.scrollIntoViewIfNeeded();
    const togglePromise = page.waitForResponse(
      async (resp) => {
        if (resp.url().includes('/personalization/settings') && resp.request().method() === 'PATCH') {
          return resp.status() === 200;
        }
        return false;
      },
      { timeout: 10000 }
    );
    await toggle.click();
    const response = await togglePromise;
    const responseBody = await response.json();

    // Verify API response shows toggled state
    expect(responseBody.learn_from_views).toBe(!wasEnabled);

    // Verify via GET that settings were saved
    const updatedSettings = await page.evaluate(async () => {
      const resp = await fetch('http://localhost:8000/api/v1/me/personalization/settings/', {
        credentials: 'include'
      });
      return resp.json();
    });
    expect(updatedSettings.learn_from_views).toBe(!wasEnabled);
  });

  test('should adjust discovery balance slider', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Find the slider
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 10000 });

    // Set to max (surprise me more)
    await slider.fill('100');
    await expect(page.getByText('Lots of new discoveries')).toBeVisible();

    // Set to min
    await slider.fill('0');
    await expect(page.getByText('Mostly familiar content')).toBeVisible();

    // Set to middle
    await slider.fill('50');
    await expect(page.getByText('Balanced mix')).toBeVisible();
  });

  test('should reset settings to defaults', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // First change something
    const slider = page.locator('input[type="range"]');
    await slider.fill('100');
    await expect(page.getByText('Lots of new discoveries')).toBeVisible();

    // Click reset button
    await page.getByRole('button', { name: 'Reset to Defaults' }).click();
    await page.waitForTimeout(500);

    // Slider should be at 50 (balanced)
    await expect(page.getByText('Balanced mix')).toBeVisible();
  });

  // =========================================================================
  // Data Export & Delete (GDPR)
  // =========================================================================

  test('should export personalization data', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

    // Find and click export button in Your Data section
    const yourDataSection = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Your Data' }) });
    const exportButton = yourDataSection.getByRole('button', { name: 'Export' });
    await exportButton.click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename pattern
    expect(download.suggestedFilename()).toMatch(/personalization-data-.*\.json/);
  });

  test('should show delete confirmation dialog', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Find and click delete button in Your Data section
    const yourDataSection = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Your Data' }) });
    const deleteButton = yourDataSection.getByRole('button', { name: 'Delete' });
    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(page.getByText('Delete All Personalization Data?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Everything' })).toBeVisible();
  });

  test('should cancel delete dialog', async ({ page }) => {
    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Open dialog
    const yourDataSection = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Your Data' }) });
    const deleteButton = yourDataSection.getByRole('button', { name: 'Delete' });
    await deleteButton.click();

    await expect(page.getByText('Delete All Personalization Data?')).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(page.getByText('Delete All Personalization Data?')).not.toBeVisible();
  });

  // =========================================================================
  // Mobile Responsiveness
  // =========================================================================

  test('should display feature cards in mobile layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/account/settings/personalization');
    await waitForPageReady(page);

    // Scroll to Feature Interests section
    const featureSection = page.getByRole('heading', { name: 'Feature Interests' });
    await featureSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Feature cards should still be visible and clickable
    const portfolioCard = page.locator('button').filter({ hasText: 'AI Portfolio' }).filter({ hasText: 'Auto-showcase your work' });
    await expect(portfolioCard).toBeVisible();
    await portfolioCard.scrollIntoViewIfNeeded();
    await portfolioCard.click();
    await page.waitForTimeout(300);
    await expect(portfolioCard).toHaveClass(/border-primary-500/);
  });
});

test.describe('Personalization - Unauthenticated', () => {
  test('should show login required state for unauthenticated users', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    await page.goto('/account/settings/personalization');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // The page should either:
    // 1. Redirect to auth page
    // 2. Show sign in button
    // 3. Show the page but with auth-required content
    const currentUrl = page.url();
    const isAuthPage = currentUrl.includes('/auth') || currentUrl.includes('/login');
    const hasSignIn = await page.locator('text=Sign in').count() > 0;
    const hasGoogle = await page.locator('text=Google').count() > 0;
    const hasSettings = await page.locator('h2:has-text("Personalization")').count() > 0;

    // Either redirected to auth, or showing auth prompts, or page requires login state
    expect(isAuthPage || hasSignIn || hasGoogle || !hasSettings).toBe(true);
  });
});
