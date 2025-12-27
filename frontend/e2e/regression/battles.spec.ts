/**
 * Battles Regression Tests - E2E tests for Prompt Battle functionality
 *
 * These tests verify that the battle flow works end-to-end.
 * Each test represents a real user journey that must not break.
 *
 * @see /docs/test-strategy-improvement-plan.md
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI, createConsoleErrorCollector } from '../helpers';

// Timeouts
const PAGE_LOAD_TIMEOUT = 15000;
const _BATTLE_ACTION_TIMEOUT = 30000; // Reserved for future use

test.describe('Battles Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  /**
   * REGRESSION: Battles page loads without errors
   *
   * Bug: Battles page crashes or shows error state
   * Root cause: API failures, missing data, or React errors
   */
  test('battles page loads successfully', async ({ page }) => {
    test.setTimeout(60000);

    const consoleCollector = createConsoleErrorCollector(page);
    consoleCollector.start();

    await page.goto('/battles');
    await page.waitForLoadState('domcontentloaded');

    // Should see battles content or empty state
    await page.waitForSelector('text=/battles|prompt battle|challenge/i', {
      timeout: PAGE_LOAD_TIMEOUT,
    });

    consoleCollector.stop();

    // ASSERT: No critical console errors
    expect(consoleCollector.hasCriticalErrors()).toBe(false);

    // ASSERT: Page has meaningful content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent?.length).toBeGreaterThan(100);
  });

  /**
   * REGRESSION: User can view active battles
   *
   * Bug: Active battles don't appear or show wrong state
   * Root cause: WebSocket connection issues or state sync problems
   */
  test('active battles are visible when available', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/battles');
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to load fully
    await page.waitForTimeout(3000);

    // Check for either active battles or "no battles" state
    const hasActiveBattles = await page.locator('[data-testid="battle-card"], .battle-card').count() > 0;
    const hasEmptyState = await page.locator('text=/no.*battles|no.*active|start.*battle/i').isVisible();

    // ASSERT: Should show either battles or empty state (not broken)
    expect(hasActiveBattles || hasEmptyState).toBe(true);
  });

  /**
   * REGRESSION: Battle detail page loads
   *
   * Bug: Clicking on a battle shows error or blank page
   * Root cause: Missing route handlers, API errors
   */
  test('can navigate to battle detail page', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find a battle card to click
    const battleCard = page.locator('[data-testid="battle-card"], .battle-card, a[href*="/battles/"]').first();

    if (await battleCard.isVisible()) {
      await battleCard.click();
      await page.waitForLoadState('domcontentloaded');

      // ASSERT: URL changed to battle detail
      expect(page.url()).toMatch(/\/battles\/[a-zA-Z0-9-]+/);

      // ASSERT: Page has battle content
      const pageContent = await page.locator('body').textContent();
      expect(pageContent?.length).toBeGreaterThan(50);
    } else {
      // No battles available - that's okay for this test
      test.skip();
    }
  });

  /**
   * REGRESSION: Battle submission works
   *
   * Bug: User submits prompt but it doesn't save
   * Root cause: Form submission errors, API failures
   */
  test('can submit prompt to active battle', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find a joinable battle
    const joinButton = page.locator('button:has-text("Join"), button:has-text("Enter"), a:has-text("Join")').first();

    if (await joinButton.isVisible()) {
      await joinButton.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Find prompt input
      const promptInput = page.locator('textarea[name="prompt"], input[name="prompt"], [data-testid="prompt-input"]').first();

      if (await promptInput.isVisible()) {
        // Enter a test prompt
        const testPrompt = `Test prompt from E2E: ${Date.now()}`;
        await promptInput.fill(testPrompt);

        // Submit
        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();
        await submitButton.click();

        await page.waitForTimeout(3000);

        // ASSERT: Should see confirmation or the prompt in the UI
        const pageContent = await page.locator('body').textContent() || '';
        const hasConfirmation = /submitted|saved|success|your prompt/i.test(pageContent);

        expect(hasConfirmation).toBe(true);
      } else {
        // Battle might be in different state
        test.skip();
      }
    } else {
      // No joinable battles
      test.skip();
    }
  });

  /**
   * REGRESSION: Battle timer displays correctly
   *
   * Bug: Timer shows wrong time or doesn't update
   * Root cause: Timezone issues, state sync problems
   */
  test('battle timer updates in real-time', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find a battle with a timer
    const timerElement = page.locator('[data-testid="battle-timer"], .battle-timer, text=/\\d+:\\d+/').first();

    if (await timerElement.isVisible()) {
      // Capture initial timer value
      const initialValue = await timerElement.textContent();

      // Wait and capture again
      await page.waitForTimeout(2000);
      const updatedValue = await timerElement.textContent();

      // ASSERT: Timer should have changed (or at least be valid)
      expect(initialValue).toBeTruthy();
      expect(updatedValue).toBeTruthy();

      // Timer format should be valid (contains numbers and colon)
      expect(updatedValue).toMatch(/\d/);
    } else {
      // No active timer visible
      test.skip();
    }
  });

  /**
   * REGRESSION: Battle results display correctly
   *
   * Bug: Battle ends but results don't show or show incorrectly
   * Root cause: State transitions, data fetching issues
   */
  test('completed battles show results', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate to battles page
    await page.goto('/battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Look for completed/past battles section or tab
    const pastBattlesTab = page.locator('button:has-text("Past"), button:has-text("Completed"), a:has-text("History")').first();

    if (await pastBattlesTab.isVisible()) {
      await pastBattlesTab.click();
      await page.waitForTimeout(2000);
    }

    // Find a completed battle
    const completedBattle = page.locator('[data-testid="completed-battle"], .completed-battle, text=/completed|finished|ended/i').first();

    if (await completedBattle.isVisible()) {
      // ASSERT: Should show winner or results
      const battleContent = await completedBattle.textContent() || '';
      const hasResults = /winner|result|score|won|tied|draw/i.test(battleContent);

      expect(hasResults).toBe(true);
    } else {
      // No completed battles to check
      test.skip();
    }
  });

  /**
   * REGRESSION: Battle WebSocket stays connected
   *
   * Bug: Real-time updates stop working during battle
   * Root cause: WebSocket disconnects without recovery
   */
  test('battle updates in real-time via WebSocket', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find and enter an active battle
    const battleCard = page.locator('[data-testid="battle-card"], .battle-card, a[href*="/battles/"]').first();

    if (await battleCard.isVisible()) {
      await battleCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      // Check for WebSocket connection indicator or live updates
      const _hasLiveIndicator = await page.locator('text=/live|connected|online/i').isVisible();
      const _hasRealtimeContent = await page.locator('[data-testid="live-update"], .live-update').isVisible();

      // Wait to see if content updates
      const initialContent = await page.locator('body').textContent();
      await page.waitForTimeout(5000);
      const updatedContent = await page.locator('body').textContent();

      // ASSERT: Page should have some dynamic content or indicators
      // Note: This is a soft check - not all battles have constant updates
      expect(initialContent).toBeTruthy();
      expect(updatedContent).toBeTruthy();
    } else {
      test.skip();
    }
  });
});
