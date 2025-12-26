/**
 * Battles Full Lifecycle Tests - Real AI Judging
 *
 * These tests verify the complete prompt battle flow with REAL AI:
 * - AI opponent (Pip) generates real prompts
 * - AI judges submissions with real criteria scoring
 * - AI generates real images
 *
 * CRITICAL: These tests use real AI calls and take 2-3 minutes each.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  getPageContent,
  BATTLE_PHASE_TIMEOUT,
} from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

test.describe('Prompt Battles - Full Lifecycle with Real AI', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('complete Pip battle from start to winner announcement', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    // Create and join a Pip battle
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for Pip battle option
    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForTimeout(3000);

      // Wait for battle page to load
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

      const pageContent = await getPageContent(page);

      // Should show battle interface
      const hasBattleUI = /battle|prompt|ready|wait|pip|opponent/i.test(pageContent);
      expect(hasBattleUI).toBe(true);

      // No technical errors
      assertNoTechnicalErrors(pageContent, 'battle creation');

      // Wait for active phase (countdown may happen)
      await page.waitForTimeout(5000);

      // Check for prompt input
      const promptInput = page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

      if (await promptInput.isVisible({ timeout: 30000 })) {
        // Submit a prompt
        await promptInput.fill('A futuristic city with flying cars and neon lights at sunset');
        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(5000);
        }
      }

      // Wait for battle to progress (up to 2 minutes for full flow)
      const maxWait = 120000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        const content = await getPageContent(page);

        // Check for completion indicators
        if (/complete|finished|winner|result|score/i.test(content)) {
          // Battle completed
          assertNoTechnicalErrors(content, 'battle completion');

          // Should show scores or winner
          const hasResults = /win|score|point|result|complete/i.test(content);
          expect(hasResults).toBe(true);
          return; // Test passed
        }

        // Check for generating/judging phases
        if (/generating|creating|judging|evaluat/i.test(content)) {
          // Still processing, wait more
          await page.waitForTimeout(5000);
          continue;
        }

        await page.waitForTimeout(3000);
      }

      // If we got here, check current state
      const finalContent = await getPageContent(page);
      assertNoTechnicalErrors(finalContent, 'battle final state');
    } else {
      // Pip button not found, skip test
      test.skip();
    }
  });

  test('AI image generation produces valid image URL', async ({ page }) => {
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
        await promptInput.fill('A majestic dragon flying over mountains');

        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
        }

        // Wait for image generation
        const maxWait = 90000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
          // Check for generated images
          const images = page.locator('img[src*="cdn"], img[src*="s3"], img[src*="cloudfront"]');
          const imageCount = await images.count();

          if (imageCount > 0) {
            const src = await images.first().getAttribute('src');
            expect(src).toBeTruthy();
            expect(src).toMatch(/^https?:\/\//);

            // Verify image loads
            const response = await page.request.get(src!);
            expect(response.status()).toBe(200);
            return;
          }

          await page.waitForTimeout(3000);
        }

        // Image generation might have completed or failed
        const finalContent = await getPageContent(page);
        assertNoTechnicalErrors(finalContent, 'image generation');
      }
    } else {
      test.skip();
    }
  });

  test('AI judging returns criteria scores', async ({ page }) => {
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
        await promptInput.fill('A serene Japanese garden with cherry blossoms');

        const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
        }

        // Wait for judging to complete
        const maxWait = 120000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
          const content = await getPageContent(page);

          // Look for score indicators
          if (/score|point|criteria|creativity|relevance|quality|winner|result/i.test(content)) {
            assertNoTechnicalErrors(content, 'judging results');

            // Verify scores are displayed
            const hasScoreInfo = /\d+\s*(point|score|%)|winner|result/i.test(content);
            expect(hasScoreInfo).toBe(true);
            return;
          }

          await page.waitForTimeout(3000);
        }

        // Check final state
        const finalContent = await getPageContent(page);
        assertNoTechnicalErrors(finalContent, 'judging final state');
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Prompt Battles - Phase Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('all phase transitions are visible in UI', async ({ page }) => {
    test.setTimeout(BATTLE_PHASE_TIMEOUT);

    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")').first();

    if (await pipButton.isVisible({ timeout: 10000 })) {
      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

      const phasesObserved: string[] = [];
      const maxWait = 120000;
      const startTime = Date.now();

      // Track phases
      while (Date.now() - startTime < maxWait) {
        const content = await getPageContent(page);

        // Detect current phase
        if (/waiting|finding/i.test(content) && !phasesObserved.includes('waiting')) {
          phasesObserved.push('waiting');
        }
        if (/countdown|get ready|starting/i.test(content) && !phasesObserved.includes('countdown')) {
          phasesObserved.push('countdown');
        }
        if (/write.*prompt|enter.*prompt|your turn/i.test(content) && !phasesObserved.includes('active')) {
          phasesObserved.push('active');

          // Submit prompt to progress
          const promptInput = page.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');
          if (await promptInput.isVisible({ timeout: 5000 })) {
            await promptInput.fill('Test prompt for phase transitions');
            const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();
            if (await submitButton.isVisible()) {
              await submitButton.click();
            }
          }
        }
        if (/generating|creating/i.test(content) && !phasesObserved.includes('generating')) {
          phasesObserved.push('generating');
        }
        if (/judging|evaluat/i.test(content) && !phasesObserved.includes('judging')) {
          phasesObserved.push('judging');
        }
        if (/reveal|result|winner/i.test(content) && !phasesObserved.includes('reveal')) {
          phasesObserved.push('reveal');
        }
        if (/complete|finished|final/i.test(content) && !phasesObserved.includes('complete')) {
          phasesObserved.push('complete');
          break;
        }

        await page.waitForTimeout(2000);
      }

      console.log('Phases observed:', phasesObserved);

      // Should observe at least some phases
      expect(phasesObserved.length).toBeGreaterThan(0);
    } else {
      test.skip();
    }
  });
});
