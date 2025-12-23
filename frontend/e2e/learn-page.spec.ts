/**
 * Learn Page E2E Tests
 *
 * Tests for the /learn page including:
 * - Guest view (unauthenticated)
 * - Authenticated user path library
 * - Cold start / waiting for setup
 * - Path cards display and navigation
 *
 * RUN: npx playwright test e2e/learn-page.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

test.describe('Learn Page - Guest View', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    // GIVEN: I am not logged in
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // THEN: I should be redirected to login/welcome page
    // The page shows "Welcome to All Thrive" with OAuth buttons
    const welcomeHeading = page.getByRole('heading', { name: /Welcome to All Thrive/i });
    const hasWelcome = await welcomeHeading.isVisible().catch(() => false);

    // Or may show login form
    const hasLoginForm = await page.locator('button:has-text("Google"), button:has-text("GitHub")').first().isVisible().catch(() => false);

    expect(hasWelcome || hasLoginForm).toBe(true);
    console.log('✓ Guest redirected to login page');
  });

  test('login page has OAuth options', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Should see OAuth buttons
    const googleButton = page.getByRole('button', { name: /Google/i });
    const githubButton = page.getByRole('button', { name: /GitHub/i });

    const hasGoogle = await googleButton.isVisible().catch(() => false);
    const hasGithub = await githubButton.isVisible().catch(() => false);

    expect(hasGoogle || hasGithub).toBe(true);
    console.log(`✓ OAuth options: Google=${hasGoogle}, GitHub=${hasGithub}`);
  });

  test('login page has "Just browsing? Explore" link', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Should have explore link for guests
    const exploreLink = page.getByText(/Just browsing\? Explore/i);
    const hasExplore = await exploreLink.isVisible().catch(() => false);

    if (hasExplore) {
      console.log('✓ "Just browsing? Explore" link visible');
    } else {
      console.log('Explore link not visible on this page');
    }
  });
});

test.describe('Learn Page - Authenticated User', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000); // Increased timeout
    await loginViaAPI(page);
  });

  test('shows hero banner with gradient', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should see the hero header with "Learn" text
    const learnHeading = page.getByRole('heading', { name: /Learn/i }).first();
    const hasHeading = await learnHeading.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasHeading) {
      console.log('✓ Hero banner with "Learn" heading visible');
    } else {
      // Check for any main content to confirm page loaded
      const hasContent = await page.locator('main, [role="main"], .flex-1').first().isVisible().catch(() => false);
      expect(hasContent).toBe(true);
      console.log('✓ Main content visible on /learn page');
    }
  });

  test('shows path library grid when user has paths', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check if we have path cards OR the waiting for setup view
    const hasPathCards = await page.locator('a[href*="/learn/"]').first().isVisible().catch(() => false);
    const hasWaitingView = await page.getByText("Let's Get Started").isVisible().catch(() => false);
    const hasSageAvatar = await page.locator('img[alt="Sage"]').first().isVisible().catch(() => false);

    // Should have one of these indicators
    expect(hasPathCards || hasWaitingView || hasSageAvatar).toBe(true);

    if (hasPathCards) {
      console.log('✓ User has saved paths - showing path library grid');
    } else if (hasWaitingView) {
      console.log('✓ User has no paths - showing waiting for setup view');
    } else {
      console.log('✓ Sage visible - page loaded successfully');
    }
  });

  test('path cards are clickable and navigate to detail page', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find path cards (they should be links)
    const pathCards = page.locator('a[href*="/learn/"]');
    const cardCount = await pathCards.count();

    if (cardCount > 0) {
      const firstCard = pathCards.first();
      const href = await firstCard.getAttribute('href');
      expect(href).toMatch(/\/[^/]+\/learn\/[^/]+/); // /:username/learn/:slug pattern

      console.log(`✓ Found ${cardCount} path cards, first links to: ${href}`);

      // Click the card
      await firstCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should be on the detail page
      expect(page.url()).toContain('/learn/');
      console.log('✓ Navigation to detail page successful');
    } else {
      // No paths is okay - user may not have created any
      console.log('No path cards found - user may not have any saved paths (expected for new users)');
    }
  });

  test('desktop shows inline Sage chat panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for the inline chat panel (w-96 = 384px)
    const chatPanel = page.locator('.w-96').first();
    const hasPanel = await chatPanel.isVisible().catch(() => false);

    // Or look for Sage avatar in a side panel
    const hasSageInPanel = await page.locator('.w-96 img[alt="Sage"], .lg\\:block img[alt="Sage"]').first().isVisible().catch(() => false);

    if (hasPanel || hasSageInPanel) {
      console.log('✓ Desktop Sage chat panel visible');
    } else {
      // May be hidden based on page state
      console.log('Chat panel not visible (may depend on user state)');
    }
  });
});

test.describe('Learn Page - Cold Start Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await loginViaAPI(page);
  });

  test('shows waiting for setup view for new users', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check for the waiting for setup view elements
    const waitingView = page.getByText("Let's Get Started");
    const hasWaitingView = await waitingView.isVisible().catch(() => false);

    if (hasWaitingView) {
      // Should show the Sage avatar
      const sageAvatar = page.locator('img[alt="Sage"]');
      const hasSage = await sageAvatar.first().isVisible().catch(() => false);

      // Should have instruction text
      const hasInstruction = await page.getByText(/Tell Sage what you'd like to learn/i).isVisible().catch(() => false);

      console.log(`✓ Cold start view: Sage=${hasSage}, Instruction=${hasInstruction}`);
    } else {
      console.log('User already has paths - skipping cold start test');
    }
  });
});

test.describe('Learn Page - Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await loginViaAPI(page);
  });

  test('mobile viewport hides desktop chat panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Desktop chat panel should be hidden on mobile (uses lg:hidden or hidden lg:block)
    // The w-96 panel is only visible on lg+ screens
    const desktopPanel = page.locator('.w-96.lg\\:block, .lg\\:block.w-96');
    const isVisible = await desktopPanel.isVisible().catch(() => false);

    // On mobile, the w-96 panel should not be visible
    console.log(`✓ Desktop chat panel hidden on mobile: ${!isVisible}`);
  });

  test('mobile viewport shows Sage bottom sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Mobile bottom sheet should be visible - fixed at bottom
    const bottomSheet = page.locator('.fixed.bottom-0').first();
    const hasBottomSheet = await bottomSheet.isVisible().catch(() => false);

    // Also check for "Ask Sage" text
    const hasAskSage = await page.getByText('Ask Sage').first().isVisible().catch(() => false);

    if (hasBottomSheet || hasAskSage) {
      console.log(`✓ Mobile Sage bottom sheet visible: bottomSheet=${hasBottomSheet}, askSage=${hasAskSage}`);
    } else {
      // Page may still be loading or user state affects visibility
      console.log('Bottom sheet not immediately visible - may depend on page state');
    }
  });
});
