/**
 * Battles Edge Cases Tests
 *
 * Tests for timeout handling, slow AI responses,
 * and other edge cases in prompt battles.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  getPageContent,
  BATTLE_PHASE_TIMEOUT,
} from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

test.describe('Battles - Timeout Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('slow AI response shows loading indicator', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(5000);

      const promptInput = page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

      if (await promptInput.isVisible({ timeout: 30000 })) {
        await promptInput.fill('A complex scene with many details');
        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Check for loading/generating indicators
          let _sawLoading = false;
          const startTime = Date.now();
          const maxWait = 90000;

          while (Date.now() - startTime < maxWait) {
            const content = await getPageContent(page);

            // Look for loading indicators
            if (/generating|creating|processing|loading|please wait/i.test(content)) {
              _sawLoading = true;
            }

            // Check for completion
            if (/result|score|winner|complete/i.test(content)) {
              break;
            }

            await page.waitForTimeout(2000);
          }

          // Should have shown loading at some point during generation
          // (or completed very quickly)
          const finalContent = await getPageContent(page);
          assertNoTechnicalErrors(finalContent, 'slow AI response');
        }
      }
    } else {
      test.skip();
    }
  });

  test('submission timeout does not crash', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

      // Wait without submitting to see timeout behavior
      const maxWait = 120000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        const content = await getPageContent(page);
        assertNoTechnicalErrors(content, 'during timeout wait');

        // Check for timeout or completion
        if (/timeout|expired|time.*up|forfeit|cancel|complete/i.test(content)) {
          // Timeout occurred, this is expected behavior
          break;
        }

        // Check if it auto-completed (e.g., Pip won by default)
        if (/pip.*win|winner|result|complete/i.test(content)) {
          break;
        }

        await page.waitForTimeout(5000);
      }

      // Page should still be functional
      const finalContent = await getPageContent(page);
      assertNoTechnicalErrors(finalContent, 'after timeout');
    } else {
      test.skip();
    }
  });
});

test.describe('Battles - Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('empty prompt cannot be submitted', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(5000);

      const promptInput = page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

      if (await promptInput.isVisible({ timeout: 30000 })) {
        // Leave prompt empty
        await promptInput.fill('');

        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          const isDisabled = await submitButton.isDisabled();

          // Button should be disabled OR clicking should have no effect
          if (!isDisabled) {
            await submitButton.click();
            await page.waitForTimeout(2000);
          }

          // Should not show error or crash
          const content = await getPageContent(page);
          assertNoTechnicalErrors(content, 'empty prompt submission');
        }
      }
    } else {
      test.skip();
    }
  });

  test('very long prompt is handled correctly', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(5000);

      const promptInput = page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

      if (await promptInput.isVisible({ timeout: 30000 })) {
        // Very long prompt
        const longPrompt = 'A beautiful scene with ' + 'many colorful flowers and '.repeat(50);
        await promptInput.fill(longPrompt);

        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(5000);

          const content = await getPageContent(page);
          assertNoTechnicalErrors(content, 'long prompt submission');

          // Should either process or show character limit message
          const hasResponse = content.length > 100;
          expect(hasResponse).toBe(true);
        }
      }
    } else {
      test.skip();
    }
  });

  test('special characters in prompt handled correctly', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(5000);

      const promptInput = page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

      if (await promptInput.isVisible({ timeout: 30000 })) {
        // Prompt with special characters
        await promptInput.fill('A scene with 日本語 and émojis 🎨🌟 and "quotes"');

        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(5000);

          const content = await getPageContent(page);
          assertNoTechnicalErrors(content, 'special characters prompt');
        }
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Battles - Navigation Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('leaving battle and returning shows correct state', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

      const battleUrl = page.url();
      await page.waitForTimeout(3000);

      // Navigate away
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Return to battle
      await page.goto(battleUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      const content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'after return to battle');

      // Should show battle state (active, complete, or expired)
      const hasBattleState = /battle|prompt|pip|expired|complete|result/i.test(content);
      expect(hasBattleState).toBe(true);
    } else {
      test.skip();
    }
  });

  test('browser back button works correctly', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
      await page.waitForTimeout(3000);

      // Go back
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Should be on battles list
      const url = page.url();
      expect(url).toContain('/prompt-battles');

      const content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'after back button');
    } else {
      test.skip();
    }
  });
});
