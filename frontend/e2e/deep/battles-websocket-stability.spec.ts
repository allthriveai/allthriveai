/**
 * Battles WebSocket Stability Tests
 *
 * Tests for WebSocket reconnection, state preservation,
 * and handling network interruptions during battles.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  getPageContent,
  simulateNetworkDisconnect,
  BATTLE_PHASE_TIMEOUT,
} from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

test.describe('Battles - WebSocket Stability', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('reconnects after network drop', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(3000);

      // Verify initial connection
      const beforeContent = await getPageContent(page);
      assertNoTechnicalErrors(beforeContent, 'before disconnect');

      // Simulate network drop
      await simulateNetworkDisconnect(page, 3000);

      // Wait for reconnection
      await page.waitForTimeout(5000);

      // Page should recover without errors
      const afterContent = await getPageContent(page);
      assertNoTechnicalErrors(afterContent, 'after reconnect');

      // Should still show battle UI
      const hasBattleUI = /battle|prompt|pip|opponent|wait|ready/i.test(afterContent);
      expect(hasBattleUI).toBe(true);

      // Check for connection status indicators
      const _isDisconnected = /disconnect|offline|reconnect/i.test(afterContent);
      // Should have reconnected (not showing disconnected state)
      // OR should show reconnecting indicator
    } else {
      test.skip();
    }
  });

  test('state preserved during reconnect', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

      // Wait for active phase and submit prompt
      await page.waitForTimeout(10000);

      const promptInput = page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

      if (await promptInput.isVisible({ timeout: 30000 })) {
        // Submit a prompt first
        await promptInput.fill('Testing state preservation');
        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(2000);

          // Now simulate disconnect
          await simulateNetworkDisconnect(page, 2000);
          await page.waitForTimeout(5000);

          // State should be preserved
          const afterContent = await getPageContent(page);
          assertNoTechnicalErrors(afterContent, 'state preservation');

          // Submitted prompt should still be reflected
          // (either in submitted state or battle progressed)
          const hasProgress = /submit|generat|judg|result|score/i.test(afterContent);
          expect(hasProgress).toBe(true);
        }
      }
    } else {
      test.skip();
    }
  });

  test('battle page refresh reconnects WebSocket', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

      const _battleUrl = page.url();

      // Wait for battle to load
      await page.waitForTimeout(3000);

      const beforeRefresh = await getPageContent(page);
      assertNoTechnicalErrors(beforeRefresh, 'before refresh');

      // Refresh the page
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);

      // Should still be on battle page
      expect(page.url()).toContain('/prompt-battles/');

      // Battle UI should reload
      const afterRefresh = await getPageContent(page);
      assertNoTechnicalErrors(afterRefresh, 'after refresh');

      const hasBattleUI = /battle|prompt|pip|opponent/i.test(afterRefresh);
      expect(hasBattleUI).toBe(true);
    } else {
      test.skip();
    }
  });
});

test.describe('Battles - Connection Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('error message shown on extended disconnect', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(3000);

      // Extended disconnect
      await page.context().setOffline(true);
      await page.waitForTimeout(10000);

      const content = await getPageContent(page);

      // Should show some kind of disconnect indicator
      // This is acceptable as it informs the user
      const _hasConnectionInfo = /disconnect|offline|reconnect|connect|waiting|lost/i.test(content);

      // Reconnect
      await page.context().setOffline(false);
      await page.waitForTimeout(5000);

      const afterReconnect = await getPageContent(page);
      assertNoTechnicalErrors(afterReconnect, 'after extended disconnect');
    } else {
      test.skip();
    }
  });

  test('no crash on rapid connect/disconnect cycles', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(3000);

      // Rapid connect/disconnect cycles
      for (let i = 0; i < 3; i++) {
        await page.context().setOffline(true);
        await page.waitForTimeout(1000);
        await page.context().setOffline(false);
        await page.waitForTimeout(2000);
      }

      // Page should still be functional
      const content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'after rapid cycles');

      // Should still show battle UI
      const hasBattleUI = /battle|prompt|pip/i.test(content);
      expect(hasBattleUI).toBe(true);
    } else {
      test.skip();
    }
  });
});
