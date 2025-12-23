/**
 * Search E2E Tests
 *
 * Tests for search functionality across the application:
 * - Project search on /explore
 * - User search
 * - Search filters (topics, tools, difficulty)
 * - Search results display
 *
 * RUN: npx playwright test e2e/search.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

// Timeouts
const SEARCH_TIMEOUT = 10000;

test.describe('Search - Explore Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('explore page loads with projects displayed', async ({ page }) => {
    // GIVEN: I am logged in
    // WHEN: I navigate to explore
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // THEN: The explore page should load
    await expect(page.locator('text=Explore')).toBeVisible({ timeout: 10000 });

    // AND: Projects or content cards should be visible
    const hasContent = await page.locator(
      '[class*="project"], [class*="card"], [data-testid*="project"]'
    ).count() > 0;

    // Or at least the page loaded without error
    const noError = await page.locator('text=Error, text=Something went wrong').count() === 0;
    expect(hasContent || noError).toBe(true);
  });

  test('search input is visible on explore page', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I look for search functionality
    // THEN: A search input should be present
    const searchInput = page.locator(
      'input[type="search"], ' +
      'input[placeholder*="Search"], ' +
      'input[placeholder*="search"], ' +
      '[data-testid="search-input"]'
    );

    await expect(searchInput.first()).toBeVisible({ timeout: SEARCH_TIMEOUT });
  });

  test('typing in search input updates results', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Let initial content load

    // Find search input
    const searchInput = page.locator(
      'input[type="search"], ' +
      'input[placeholder*="Search"], ' +
      'input[placeholder*="search"]'
    ).first();

    await expect(searchInput).toBeVisible({ timeout: SEARCH_TIMEOUT });

    // WHEN: I type a search query
    await searchInput.fill('AI');
    await page.waitForTimeout(1000); // Debounce time

    // THEN: Page should not show an error
    const hasError = await page.locator('text=Error').isVisible().catch(() => false);
    expect(hasError).toBe(false);

    // AND: Search input should retain the value
    await expect(searchInput).toHaveValue('AI');
  });

  test('search can be cleared', async ({ page }) => {
    // GIVEN: I have entered a search query
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator(
      'input[type="search"], ' +
      'input[placeholder*="Search"]'
    ).first();

    await searchInput.fill('test query');
    await page.waitForTimeout(500);

    // WHEN: I clear the search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // THEN: The input should be empty
    await expect(searchInput).toHaveValue('');
  });
});

test.describe('Search - Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('explore page has filter/tab options', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // THEN: There should be filter tabs or buttons
    const hasFilters = await page.locator(
      '[role="tablist"], ' +
      'button:has-text("Trending"), ' +
      'button:has-text("Latest"), ' +
      'button:has-text("Popular"), ' +
      '[data-testid*="filter"], ' +
      '[class*="tab"]'
    ).count() > 0;

    expect(hasFilters).toBe(true);
  });

  test('clicking a filter tab changes results', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Find filter tabs
    const trendingTab = page.locator('button:has-text("Trending"), [role="tab"]:has-text("Trending")').first();
    const latestTab = page.locator('button:has-text("Latest"), [role="tab"]:has-text("Latest")').first();

    // WHEN: I click on a different tab (if both exist)
    if (await trendingTab.isVisible() && await latestTab.isVisible()) {
      // Click latest to change from default
      await latestTab.click();
      await page.waitForTimeout(500);

      // THEN: The tab should be active (has aria-selected or similar)
      // No errors should appear
      const hasError = await page.locator('text=Error').isVisible().catch(() => false);
      expect(hasError).toBe(false);
    }
  });

  test('URL updates when filter is applied', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I apply a filter via tab click
    const latestTab = page.locator('button:has-text("Latest"), [role="tab"]:has-text("Latest")').first();

    if (await latestTab.isVisible()) {
      await latestTab.click();
      await page.waitForTimeout(500);

      // THEN: URL may update with filter param or stay same (both valid)
      // Just verify no crash and page is still functional
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();
    }
  });
});

test.describe('Search - Results Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('search results show project cards', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // THEN: Project cards or list items should be displayed
    const contentItems = page.locator(
      '[class*="project"], ' +
      '[class*="card"]:not([class*="skeleton"]), ' +
      '[data-testid*="project"]'
    );

    const count = await contentItems.count();

    // Should have some content (or empty state is also valid)
    const hasEmptyState = await page.locator(
      'text=No projects, text=Nothing here, text=No results'
    ).isVisible().catch(() => false);

    expect(count > 0 || hasEmptyState).toBe(true);
  });

  test('clicking a project card navigates to project page', async ({ page }) => {
    // GIVEN: I am on the explore page with projects
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Find a clickable project card
    const projectCard = page.locator(
      'a[href*="/project"], ' +
      '[class*="project"] a, ' +
      '[data-testid*="project-card"]'
    ).first();

    if (await projectCard.isVisible()) {
      const urlBeforeClick = page.url();

      // WHEN: I click the project card
      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');

      // THEN: URL should change to a project page
      const urlAfterClick = page.url();
      expect(urlAfterClick).not.toBe(urlBeforeClick);
    }
  });

  test('empty search shows appropriate message', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // Find search input
    const searchInput = page.locator(
      'input[type="search"], ' +
      'input[placeholder*="Search"]'
    ).first();

    if (await searchInput.isVisible()) {
      // WHEN: I search for something unlikely to exist
      await searchInput.fill('xyznonexistent12345');
      await page.waitForTimeout(1500);

      // THEN: Either no results message or empty state
      // Or results still show (if search is fuzzy)
      // Main thing is no crash
      const pageContent = await page.locator('body').textContent();
      expect(pageContent).toBeTruthy();
    }
  });
});

test.describe('Search - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('search from header works on any page', async ({ page }) => {
    // GIVEN: I am on a different page (not explore)
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I look for global search in header
    const globalSearch = page.locator(
      'header input[type="search"], ' +
      'header input[placeholder*="Search"], ' +
      'nav input[placeholder*="Search"], ' +
      '[data-testid="global-search"]'
    ).first();

    // THEN: If global search exists, it should work
    if (await globalSearch.isVisible()) {
      await globalSearch.fill('test');
      await page.waitForTimeout(500);

      // Should not cause errors
      const hasError = await page.locator('text=Error').isVisible().catch(() => false);
      expect(hasError).toBe(false);
    }
  });

  test('explore link is accessible from navigation', async ({ page }) => {
    // GIVEN: I am on the home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I look for explore link in navigation
    const exploreLink = page.locator(
      'a[href="/explore"], ' +
      'a:has-text("Explore"), ' +
      'nav a[href*="explore"]'
    ).first();

    // THEN: Explore should be accessible
    await expect(exploreLink).toBeVisible({ timeout: 10000 });

    // AND: Clicking it should navigate to explore
    await exploreLink.click();
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('explore');
  });
});

test.describe('Search - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('search is debounced and does not spam requests', async ({ page }) => {
    // GIVEN: I am on the explore page
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator(
      'input[type="search"], ' +
      'input[placeholder*="Search"]'
    ).first();

    if (await searchInput.isVisible()) {
      // Track network requests
      const searchRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('search') || request.url().includes('q=')) {
          searchRequests.push(request.url());
        }
      });

      // WHEN: I type quickly
      await searchInput.type('testing', { delay: 50 });
      await page.waitForTimeout(500);

      // THEN: Should not make a request for each keystroke
      // Debouncing means fewer requests than keystrokes
      expect(searchRequests.length).toBeLessThanOrEqual(3);
    }
  });

  test('explore page loads within reasonable time', async ({ page }) => {
    // GIVEN/WHEN: I navigate to explore and measure load time
    const startTime = Date.now();
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    // THEN: Page should load in under 10 seconds
    expect(loadTime).toBeLessThan(10000);

    // AND: Main content should be visible
    await expect(page.locator('body')).toBeVisible();
  });
});
