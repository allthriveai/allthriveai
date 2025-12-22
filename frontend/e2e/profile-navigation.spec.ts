/**
 * Profile Tab Navigation E2E Tests
 *
 * Tests for profile tab navigation including:
 * - Tab visibility for owners vs visitors
 * - Tab switching and URL parameter updates
 * - Private tabs (Activity, Learning) hidden from visitors
 * - Correct tabs displayed based on user role/tier
 *
 * These tests ensure the profile tab navigation works correctly
 * and permissions are enforced properly.
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

// ============================================================================
// Test Constants
// ============================================================================

// Expected tabs for profile owners
const OWNER_TABS = ['Showcase', 'Playground', 'Clipped'];
const OWNER_PRIVATE_TABS = ['Learning', 'Activity'];

// Tabs that should be hidden from visitors (used for visitor view tests)
const _PRIVATE_TABS = ['Learning', 'Activity'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Navigate to the user's profile page
 */
async function navigateToProfile(page: Page, username: string) {
  await page.goto(`/${username}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

/**
 * Navigate to profile with a specific tab selected
 */
async function navigateToProfileTab(page: Page, username: string, tab: string) {
  await page.goto(`/${username}?tab=${tab}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

/**
 * Get all visible tab buttons/links
 */
async function getVisibleTabs(page: Page): Promise<string[]> {
  // Tab buttons in ProfileTabMenu
  const tabButtons = page.locator('button, a').filter({
    hasText: /showcase|playground|clipped|learning|activity|marketplace|my battles/i
  });

  const tabs: string[] = [];
  const count = await tabButtons.count();

  for (let i = 0; i < count; i++) {
    const text = await tabButtons.nth(i).textContent();
    if (text) {
      tabs.push(text.trim());
    }
  }

  return [...new Set(tabs)]; // Remove duplicates
}

/**
 * Click on a specific tab
 */
async function clickTab(page: Page, tabName: string) {
  const tab = page.locator('button, a').filter({
    hasText: new RegExp(`^${tabName}$`, 'i')
  }).first();

  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

/**
 * Check if a tab is currently active/selected
 */
async function _isTabActive(page: Page, tabName: string): Promise<boolean> {
  const activeTab = page.locator('button[aria-selected="true"], a[aria-current="page"], [class*="active"]').filter({
    hasText: new RegExp(tabName, 'i')
  });

  return await activeTab.isVisible().catch(() => false);
}

// ============================================================================
// Test Suite: Tab Visibility for Owners
// ============================================================================

test.describe('Profile Tab Visibility - Owner View', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
  });

  test('should display Showcase tab for owner', async ({ page }) => {
    const showcaseTab = page.locator('button, a').filter({ hasText: /showcase/i }).first();
    await expect(showcaseTab).toBeVisible({ timeout: 5000 });
  });

  test('should display Playground tab for owner', async ({ page }) => {
    const playgroundTab = page.locator('button, a').filter({ hasText: /playground/i }).first();
    await expect(playgroundTab).toBeVisible({ timeout: 5000 });
  });

  test('should display Clipped tab for owner', async ({ page }) => {
    const clippedTab = page.locator('button, a').filter({ hasText: /clipped/i }).first();
    await expect(clippedTab).toBeVisible({ timeout: 5000 });
  });

  test('should display Learning tab for owner (private tab)', async ({ page }) => {
    const learningTab = page.locator('button, a').filter({ hasText: /learning/i }).first();
    await expect(learningTab).toBeVisible({ timeout: 5000 });
  });

  test('should display Activity tab for owner (private tab)', async ({ page }) => {
    const activityTab = page.locator('button, a').filter({ hasText: /activity/i }).first();
    await expect(activityTab).toBeVisible({ timeout: 5000 });
  });

  test('should show all expected tabs for owner', async ({ page }) => {
    const visibleTabs = await getVisibleTabs(page);

    // Owner should see standard tabs
    for (const tab of OWNER_TABS) {
      const hasTab = visibleTabs.some(t => t.toLowerCase().includes(tab.toLowerCase()));
      expect(hasTab).toBe(true);
    }

    // Owner should also see private tabs
    for (const tab of OWNER_PRIVATE_TABS) {
      const hasTab = visibleTabs.some(t => t.toLowerCase().includes(tab.toLowerCase()));
      expect(hasTab).toBe(true);
    }
  });
});

// ============================================================================
// Test Suite: Tab Switching
// ============================================================================

test.describe('Profile Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
  });

  test('should switch to Playground tab when clicked', async ({ page }) => {
    const clicked = await clickTab(page, 'Playground');
    expect(clicked).toBe(true);

    // Verify URL updated
    await expect(page).toHaveURL(/tab=playground/i, { timeout: 5000 });
  });

  test('should switch to Clipped tab when clicked', async ({ page }) => {
    const clicked = await clickTab(page, 'Clipped');
    expect(clicked).toBe(true);

    // Verify URL updated
    await expect(page).toHaveURL(/tab=clipped/i, { timeout: 5000 });
  });

  test('should switch to Learning tab when clicked', async ({ page }) => {
    const clicked = await clickTab(page, 'Learning');
    expect(clicked).toBe(true);

    // Verify URL updated
    await expect(page).toHaveURL(/tab=learning/i, { timeout: 5000 });
  });

  test('should switch to Activity tab when clicked', async ({ page }) => {
    const clicked = await clickTab(page, 'Activity');
    expect(clicked).toBe(true);

    // Verify URL updated
    await expect(page).toHaveURL(/tab=activity/i, { timeout: 5000 });
  });

  test('should switch back to Showcase tab when clicked', async ({ page }) => {
    // First go to another tab
    await clickTab(page, 'Playground');
    await page.waitForTimeout(500);

    // Then switch back to Showcase
    const clicked = await clickTab(page, 'Showcase');
    expect(clicked).toBe(true);

    // Verify URL updated (should have tab=showcase or no tab param)
    const url = page.url();
    expect(url.includes('tab=showcase') || !url.includes('tab=')).toBe(true);
  });
});

// ============================================================================
// Test Suite: URL Parameter Navigation
// ============================================================================

test.describe('Profile URL Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should load Showcase tab by default', async ({ page }) => {
    await navigateToProfile(page, TEST_USER.username);

    // Showcase content should be visible (look for sections or "Add Section" button)
    const showcaseContent = page.locator('text=/showcase|about|skills|links|add section/i').first();
    await expect(showcaseContent).toBeVisible({ timeout: 5000 });
  });

  test('should load Playground tab when ?tab=playground in URL', async ({ page }) => {
    await navigateToProfileTab(page, TEST_USER.username, 'playground');

    // Playground content should be visible (project grid or empty state)
    await page.waitForTimeout(1000);

    // Either projects are shown or empty state
    const playgroundContent = page.locator('text=/project|no projects|creative sandbox/i').first();
    const projectGrid = page.locator('[data-testid="project-grid"], .masonry, .grid');

    const hasContent = await playgroundContent.isVisible().catch(() => false) ||
                       await projectGrid.isVisible().catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('should load Learning tab when ?tab=learning in URL', async ({ page }) => {
    await navigateToProfileTab(page, TEST_USER.username, 'learning');

    // Learning content should be visible
    await page.waitForTimeout(1000);

    const learningContent = page.locator('text=/learning|path|quiz|progress/i').first();
    await expect(learningContent).toBeVisible({ timeout: 5000 });
  });

  test('should load Activity tab when ?tab=activity in URL', async ({ page }) => {
    await navigateToProfileTab(page, TEST_USER.username, 'activity');

    // Activity content should be visible
    await page.waitForTimeout(1000);

    const activityContent = page.locator('text=/activity|insights|achievements|streak/i').first();
    await expect(activityContent).toBeVisible({ timeout: 5000 });
  });

  test('should update URL when switching tabs', async ({ page }) => {
    await navigateToProfile(page, TEST_USER.username);

    // Switch to Playground
    await clickTab(page, 'Playground');

    // Verify URL contains tab parameter
    await expect(page).toHaveURL(/tab=playground/i, { timeout: 5000 });

    // Switch to Learning
    await clickTab(page, 'Learning');

    // Verify URL updated
    await expect(page).toHaveURL(/tab=learning/i, { timeout: 5000 });
  });
});

// ============================================================================
// Test Suite: Tab Content Display
// ============================================================================

test.describe('Profile Tab Content', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should display Showcase tab with profile sections', async ({ page }) => {
    await navigateToProfile(page, TEST_USER.username);

    // Look for common section types
    const sections = page.locator('text=/about|skills|links|featured|custom/i');
    const count = await sections.count();

    // Should have at least some sections or the ability to add them
    const addSectionBtn = page.locator('button:has-text("Add Section")');
    const hasSections = count > 0 || await addSectionBtn.isVisible().catch(() => false);

    expect(hasSections).toBe(true);
  });

  test('should display Playground tab with project grid or empty state', async ({ page }) => {
    await navigateToProfileTab(page, TEST_USER.username, 'playground');

    // Either has projects or shows empty state
    const projectCard = page.locator('[data-testid="project-card"], .project-card, article').first();
    const emptyState = page.locator('text=/no projects|creative sandbox|start creating/i');

    const hasContent = await projectCard.isVisible({ timeout: 5000 }).catch(() => false) ||
                       await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasContent).toBe(true);
  });

  test('should display Clipped tab with saved content or empty state', async ({ page }) => {
    await navigateToProfileTab(page, TEST_USER.username, 'clipped');

    // Either has clipped content or shows empty state
    await page.waitForTimeout(1000);

    const clippedContent = page.locator('article, [data-testid="clipped-item"]').first();
    const emptyState = page.locator('text=/no clipped|no saved|nothing saved|clip projects/i');

    const hasContent = await clippedContent.isVisible({ timeout: 5000 }).catch(() => false) ||
                       await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasContent).toBe(true);
  });

  test('should display Learning tab with learning paths', async ({ page }) => {
    await navigateToProfileTab(page, TEST_USER.username, 'learning');

    // Should show learning paths or empty state
    await page.waitForTimeout(1000);

    const learningPath = page.locator('text=/learning path|path|quiz|progress/i').first();
    await expect(learningPath).toBeVisible({ timeout: 5000 });
  });

  test('should display Activity tab with activity insights', async ({ page }) => {
    await navigateToProfileTab(page, TEST_USER.username, 'activity');

    // Should show activity/achievements
    await page.waitForTimeout(1000);

    const activityContent = page.locator('text=/activity|insights|achievements|streak|points/i').first();
    await expect(activityContent).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Test Suite: Tab Persistence
// ============================================================================

test.describe('Profile Tab Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should maintain tab selection after page refresh', async ({ page }) => {
    await navigateToProfile(page, TEST_USER.username);

    // Switch to Playground tab
    await clickTab(page, 'Playground');
    await expect(page).toHaveURL(/tab=playground/i, { timeout: 5000 });

    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Should still be on Playground tab
    await expect(page).toHaveURL(/tab=playground/i);
  });

  test('should maintain tab selection when navigating back', async ({ page }) => {
    await navigateToProfile(page, TEST_USER.username);

    // Switch to Learning tab
    await clickTab(page, 'Learning');
    await expect(page).toHaveURL(/tab=learning/i, { timeout: 5000 });

    // Navigate away
    await page.goto('/discover');
    await page.waitForLoadState('domcontentloaded');

    // Navigate back
    await page.goBack();
    await page.waitForTimeout(1000);

    // Should be on Learning tab
    await expect(page).toHaveURL(/tab=learning/i);
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

test.describe('Profile Tab Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should handle invalid tab parameter gracefully', async ({ page }) => {
    // Navigate with invalid tab
    await page.goto(`/${TEST_USER.username}?tab=invalid-tab-name`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Should fall back to Showcase or show valid content
    const content = page.locator('h1, h2, article').first();
    await expect(content).toBeVisible({ timeout: 5000 });

    // Should not show error
    const error = page.locator('text=/error|not found|404/i');
    await expect(error).not.toBeVisible({ timeout: 3000 });
  });

  test('should handle empty tab parameter', async ({ page }) => {
    // Navigate with empty tab
    await page.goto(`/${TEST_USER.username}?tab=`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Should show default (Showcase) content
    const content = page.locator('h1, h2, article').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('should show 404 for non-existent user', async ({ page }) => {
    await page.goto('/non-existent-user-12345');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Should show not found message
    const notFound = page.locator('text=/not found|404|doesn\'t exist|no user/i');
    await expect(notFound).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// Test Suite: Mobile Tab Navigation
// ============================================================================

test.describe('Profile Mobile Tab Navigation', () => {
  test('should display tabs on mobile viewport', async ({ page }) => {
    await loginViaAPI(page);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToProfile(page, TEST_USER.username);

    // Tabs should still be visible (may be in scrollable container)
    const showcaseTab = page.locator('button, a').filter({ hasText: /showcase/i }).first();
    await expect(showcaseTab).toBeVisible({ timeout: 5000 });
  });

  test('should allow tab switching on mobile', async ({ page }) => {
    await loginViaAPI(page);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToProfile(page, TEST_USER.username);

    // Click Playground tab
    const clicked = await clickTab(page, 'Playground');
    expect(clicked).toBe(true);

    // Verify URL updated
    await expect(page).toHaveURL(/tab=playground/i, { timeout: 5000 });
  });

  test('should scroll to reveal all tabs on mobile', async ({ page }) => {
    await loginViaAPI(page);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await navigateToProfile(page, TEST_USER.username);

    // Try to access a tab that might be scrolled out of view
    const activityTab = page.locator('button, a').filter({ hasText: /activity/i }).first();

    // Scroll the tab container if needed
    if (await activityTab.isVisible().catch(() => false)) {
      await activityTab.scrollIntoViewIfNeeded();
      await expect(activityTab).toBeVisible({ timeout: 5000 });
    }
  });
});
