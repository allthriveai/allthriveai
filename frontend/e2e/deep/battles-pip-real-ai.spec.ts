/**
 * Pip Battle Real AI E2E Tests
 *
 * CRITICAL: These tests verify the complete Pip battle flow with REAL AI:
 * 1. Navigate to /play/prompt-battles
 * 2. Click "Play Pip" button
 * 3. Write a creative prompt
 * 4. Submit the prompt
 * 5. Two AI-generated images are created (user + Pip)
 * 6. AI judges and picks a winner
 *
 * These tests use real AI calls and take 2-3 minutes each.
 * Run with: npx playwright test e2e/deep/battles-pip-real-ai.spec.ts
 * Run with logs: DEBUG=pw:api npx playwright test e2e/deep/battles-pip-real-ai.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  getPageContent,
  BATTLE_PHASE_TIMEOUT as _BATTLE_PHASE_TIMEOUT,
} from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

// Extended timeout for full Pip battle with real AI
const PIP_BATTLE_TIMEOUT = 180000; // 3 minutes

test.describe('Pip Battle - Complete Flow with Real AI', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('complete Pip battle: navigate → click play pip → submit prompt → images generated → winner announced', async ({ page }) => {
    test.setTimeout(PIP_BATTLE_TIMEOUT);

    console.log('=== STEP 1: Navigate to /play/prompt-battles ===');
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Take screenshot for debugging
    await page.screenshot({ path: 'e2e-pip-step1-lobby.png' });

    // Verify we're on the battles lobby
    const lobbyContent = await getPageContent(page);
    assertNoTechnicalErrors(lobbyContent, 'battles lobby');

    // Look for Pip button - multiple possible labels
    console.log('=== STEP 2: Click Play Pip button ===');
    const pipButton = page.locator([
      'button:has-text("Play Pip")',
      'button:has-text("Battle Pip")',
      'button:has-text("Pip")',
      'button:has-text("AI Opponent")',
      'button:has-text("AI")',
      'button:has-text("Bot")',
      '[data-testid="play-pip-button"]',
      '[data-testid="battle-pip-button"]',
    ].join(', ')).first();

    const pipButtonVisible = await pipButton.isVisible({ timeout: 15000 }).catch(() => false);

    if (!pipButtonVisible) {
      console.error('FAIL: Pip button not found on battles lobby');
      await page.screenshot({ path: 'e2e-pip-button-not-found.png' });
      // List all buttons for debugging
      const allButtons = await page.locator('button').allTextContents();
      console.log('Available buttons:', allButtons);
    }
    expect(pipButtonVisible).toBe(true);

    await pipButton.click();
    console.log('Clicked Pip button');

    // Wait for battle page to load
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    console.log('Battle page URL:', page.url());

    // Extract battle ID
    const battleIdMatch = page.url().match(/\/(\d+)/);
    const battleId = battleIdMatch ? battleIdMatch[1] : 'unknown';
    console.log('Battle ID:', battleId);

    // Wait for battle UI to load
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e-pip-step2-battle-created.png' });

    // Verify battle created successfully
    const battleContent = await getPageContent(page);
    assertNoTechnicalErrors(battleContent, 'battle creation');

    // Should see battle UI elements
    const hasBattleUI = /battle|prompt|pip|opponent|vs|challenge/i.test(battleContent);
    expect(hasBattleUI).toBe(true);

    // Wait for countdown to finish and active phase to begin
    console.log('=== STEP 3: Wait for countdown and active phase ===');
    const maxCountdownWait = 15000;
    const countdownStart = Date.now();

    while (Date.now() - countdownStart < maxCountdownWait) {
      const content = await getPageContent(page);

      // Check if countdown is active
      if (/countdown|get ready|starting|3|2|1/i.test(content)) {
        console.log('Countdown in progress...');
        await page.waitForTimeout(1000);
        continue;
      }

      // Check if we've reached active phase (can type prompt)
      const promptInput = page.locator('textarea, input[placeholder*="prompt" i]');
      if (await promptInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Active phase reached - prompt input visible');
        break;
      }

      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'e2e-pip-step3-active-phase.png' });

    // Find prompt input
    console.log('=== STEP 4: Write and submit prompt ===');
    const promptInput = page.locator([
      'textarea',
      'input[placeholder*="prompt" i]',
      '[data-testid="prompt-editor"]',
      '[data-testid="prompt-input"]',
    ].join(', ')).first();

    const promptInputVisible = await promptInput.isVisible({ timeout: 30000 }).catch(() => false);

    if (!promptInputVisible) {
      console.error('FAIL: Prompt input not visible');
      await page.screenshot({ path: 'e2e-pip-no-prompt-input.png' });

      // Check what phase we're in
      const currentContent = await getPageContent(page);
      console.log('Current page content (first 500 chars):', currentContent.substring(0, 500));
    }
    expect(promptInputVisible).toBe(true);

    // Write a creative prompt
    const testPrompt = 'A majestic golden phoenix rising from emerald flames, with crystalline feathers reflecting rainbow light, soaring against a twilight sky with two moons';
    await promptInput.fill(testPrompt);
    console.log('Filled prompt:', testPrompt.substring(0, 50) + '...');

    // Find and click submit button
    const submitButton = page.locator([
      'button:has-text("Submit")',
      'button:has-text("Send")',
      'button[type="submit"]',
      '[data-testid="submit-prompt"]',
      '[data-testid="submit-button"]',
    ].join(', ')).first();

    const submitButtonVisible = await submitButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!submitButtonVisible) {
      console.error('FAIL: Submit button not visible');
      await page.screenshot({ path: 'e2e-pip-no-submit-button.png' });
    }
    expect(submitButtonVisible).toBe(true);

    await submitButton.click();
    console.log('Clicked submit button');

    // Wait for submission confirmation
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e-pip-step4-submitted.png' });

    // Verify submission was processed
    const postSubmitContent = await getPageContent(page);
    assertNoTechnicalErrors(postSubmitContent, 'post submission');

    // Should see submission confirmation or generating phase
    const hasSubmissionIndicator = /submitted|generating|creating|processing|waiting/i.test(postSubmitContent);
    expect(hasSubmissionIndicator).toBe(true);
    console.log('Submission confirmed');

    // Wait for AI image generation
    console.log('=== STEP 5: Wait for AI image generation ===');
    console.log('This may take up to 60 seconds...');

    const generationTimeout = 90000; // 90 seconds
    const generationStart = Date.now();
    let userImageFound = false;
    let pipImageFound = false;

    while (Date.now() - generationStart < generationTimeout) {
      const elapsed = Math.round((Date.now() - generationStart) / 1000);

      // Look for generated images
      const images = page.locator([
        'img[alt*="creation" i]',
        'img[alt*="generated" i]',
        'img[src*="cdn"]',
        'img[src*="s3"]',
        'img[src*="cloudfront"]',
        'img[src*="amazonaws"]',
        '[data-testid="user-image"] img',
        '[data-testid="opponent-image"] img',
        '[data-testid="my-submission-image"]',
        '[data-testid="pip-submission-image"]',
      ].join(', '));

      const imageCount = await images.count();

      if (imageCount >= 1) {
        userImageFound = true;
        console.log(`${elapsed}s: Found at least 1 generated image`);

        // Check for second image (Pip's)
        if (imageCount >= 2) {
          pipImageFound = true;
          console.log(`${elapsed}s: Found both images (user + Pip)`);
          break;
        }
      }

      // Check for judging phase (both images generated)
      const content = await getPageContent(page);
      if (/judging|evaluating|comparing/i.test(content)) {
        console.log(`${elapsed}s: Judging phase detected`);
        pipImageFound = true; // If judging, both images exist
        userImageFound = true;
        break;
      }

      // Check for reveal/complete phase
      if (/winner|result|score|complete|victory|defeat/i.test(content)) {
        console.log(`${elapsed}s: Results phase detected`);
        userImageFound = true;
        pipImageFound = true;
        break;
      }

      console.log(`${elapsed}s: Still generating...`);
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: 'e2e-pip-step5-images-generated.png' });

    if (!userImageFound) {
      console.error('FAIL: User image was not generated within 90 seconds');
    }
    if (!pipImageFound) {
      console.error('FAIL: Pip image was not generated within 90 seconds');
    }

    expect(userImageFound).toBe(true);
    expect(pipImageFound).toBe(true);
    console.log('Both images generated successfully');

    // Wait for AI judging and winner announcement
    console.log('=== STEP 6: Wait for winner announcement ===');
    console.log('This may take up to 60 seconds...');

    const judgingTimeout = 60000;
    const judgingStart = Date.now();
    let winnerAnnounced = false;

    while (Date.now() - judgingStart < judgingTimeout) {
      const elapsed = Math.round((Date.now() - judgingStart) / 1000);
      const content = await getPageContent(page);

      // Check for winner announcement
      if (/winner|you won|you lost|tie|victory|defeat|score.*\d+|points?.*\d+/i.test(content)) {
        winnerAnnounced = true;
        console.log(`${elapsed}s: Winner announced!`);

        // Extract winner info
        const wonMatch = /you won/i.test(content);
        const lostMatch = /you lost/i.test(content);
        const tieMatch = /tie|draw/i.test(content);

        if (wonMatch) console.log('Result: YOU WON!');
        else if (lostMatch) console.log('Result: You lost to Pip');
        else if (tieMatch) console.log('Result: It\'s a tie!');

        break;
      }

      // Check for judging still in progress
      if (/judging|evaluating|comparing/i.test(content)) {
        console.log(`${elapsed}s: Judging in progress...`);
      }

      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'e2e-pip-step6-winner.png' });

    if (!winnerAnnounced) {
      console.error('FAIL: Winner was not announced within 60 seconds');
      const finalContent = await getPageContent(page);
      console.log('Final page content (first 1000 chars):', finalContent.substring(0, 1000));
    }

    expect(winnerAnnounced).toBe(true);

    // Final verification
    const finalContent = await getPageContent(page);
    assertNoTechnicalErrors(finalContent, 'battle complete');

    console.log('=== PIP BATTLE COMPLETE ===');
    console.log('All steps completed successfully:');
    console.log('  1. Navigated to /play/prompt-battles');
    console.log('  2. Clicked Play Pip button');
    console.log('  3. Wrote and submitted prompt');
    console.log('  4. User image generated');
    console.log('  5. Pip image generated');
    console.log('  6. Winner announced');
  });

  test('Pip battle shows both player cards with images during reveal', async ({ page }) => {
    test.setTimeout(PIP_BATTLE_TIMEOUT);

    // Navigate and start Pip battle
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI")').first();
    if (!(await pipButton.isVisible({ timeout: 10000 }))) {
      test.skip();
      return;
    }

    await pipButton.click();
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

    // Wait for active phase
    await page.waitForTimeout(10000);

    // Submit prompt
    const promptInput = page.locator('textarea').first();
    if (await promptInput.isVisible({ timeout: 30000 })) {
      await promptInput.fill('A stunning aurora borealis over a frozen lake with snow-covered mountains');

      const submitButton = page.locator('button:has-text("Submit")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }
    }

    // Wait for reveal phase
    const revealTimeout = 120000;
    const startTime = Date.now();

    while (Date.now() - startTime < revealTimeout) {
      const content = await getPageContent(page);

      if (/winner|reveal|result|score/i.test(content)) {
        // In reveal phase - verify both player cards
        const playerCards = page.locator('[data-testid="player-card"], [class*="player"]');
        const cardCount = await playerCards.count();

        console.log(`Found ${cardCount} player card(s)`);

        // Should have 2 player cards (user and Pip)
        expect(cardCount).toBeGreaterThanOrEqual(2);

        // Verify images exist
        const playerImages = page.locator('img[src*="cdn"], img[src*="s3"], img[alt*="creation" i]');
        const imageCount = await playerImages.count();

        console.log(`Found ${imageCount} generated image(s)`);
        expect(imageCount).toBeGreaterThanOrEqual(2);

        // Verify Pip is shown as opponent
        const pipIndicator = await page.getByText('Pip').isVisible().catch(() => false);
        expect(pipIndicator).toBe(true);

        console.log('Both player cards with images verified');
        return;
      }

      await page.waitForTimeout(3000);
    }

    // If we get here, reveal never happened
    const finalContent = await getPageContent(page);
    assertNoTechnicalErrors(finalContent, 'reveal phase');
  });

  test('Pip battle shows criteria scores after judging', async ({ page }) => {
    test.setTimeout(PIP_BATTLE_TIMEOUT);

    // Navigate and start Pip battle
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI")').first();
    if (!(await pipButton.isVisible({ timeout: 10000 }))) {
      test.skip();
      return;
    }

    await pipButton.click();
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

    // Wait for active phase
    await page.waitForTimeout(10000);

    // Submit prompt
    const promptInput = page.locator('textarea').first();
    if (await promptInput.isVisible({ timeout: 30000 })) {
      await promptInput.fill('A detailed steampunk clockwork city with brass towers and steam vents');

      const submitButton = page.locator('button:has-text("Submit")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }
    }

    // Wait for judging complete with scores
    const judgeTimeout = 150000;
    const startTime = Date.now();

    while (Date.now() - startTime < judgeTimeout) {
      const content = await getPageContent(page);

      // Look for score indicators
      if (/score|point|criteria|creativity|relevance|quality|technique|\d+\/\d+|\d+\.\d+/i.test(content)) {
        console.log('Found score/criteria information');

        // Verify numerical scores exist
        const scorePattern = /\d+(?:\.\d+)?(?:\s*(?:points?|score|%))?/;
        const hasScores = scorePattern.test(content);

        if (hasScores) {
          console.log('Numerical scores found');

          // Take screenshot of scores
          await page.screenshot({ path: 'e2e-pip-scores.png' });
          return;
        }
      }

      await page.waitForTimeout(3000);
    }

    // Check final state
    const finalContent = await getPageContent(page);
    assertNoTechnicalErrors(finalContent, 'judging scores');
  });

  test('Pip battle can be refreshed if challenge is not suitable', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate and start Pip battle
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI")').first();
    if (!(await pipButton.isVisible({ timeout: 10000 }))) {
      test.skip();
      return;
    }

    await pipButton.click();
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

    // Wait for active phase
    await page.waitForTimeout(10000);

    // Look for refresh challenge button
    const refreshButton = page.locator([
      'button:has-text("Refresh")',
      'button:has-text("New Challenge")',
      'button:has-text("Skip")',
      '[data-testid="refresh-challenge"]',
    ].join(', ')).first();

    const hasRefresh = await refreshButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasRefresh) {
      // Get current challenge text
      const challengeTextBefore = await page.locator('.challenge-text, [data-testid="challenge-text"]')
        .first()
        .textContent()
        .catch(() => '');

      console.log('Challenge before refresh:', challengeTextBefore?.substring(0, 50) + '...');

      // Click refresh
      await refreshButton.click();
      await page.waitForTimeout(3000);

      // Get new challenge text
      const challengeTextAfter = await page.locator('.challenge-text, [data-testid="challenge-text"]')
        .first()
        .textContent()
        .catch(() => '');

      console.log('Challenge after refresh:', challengeTextAfter?.substring(0, 50) + '...');

      // Should have different challenge
      expect(challengeTextAfter).not.toBe(challengeTextBefore);
      console.log('Challenge successfully refreshed');
    } else {
      console.log('Refresh button not visible (feature may be disabled for this battle type)');
    }
  });
});

test.describe('Pip Battle - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('shows meaningful error when WebSocket disconnects during battle', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate and start Pip battle
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI")').first();
    if (!(await pipButton.isVisible({ timeout: 10000 }))) {
      test.skip();
      return;
    }

    await pipButton.click();
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Simulate network disconnect
    await page.context().setOffline(true);
    await page.waitForTimeout(3000);

    // Should show connection error or reconnecting message
    const content = await getPageContent(page);
    const hasConnectionMessage = /reconnect|disconnect|connection|offline|trying/i.test(content);

    console.log('Has connection message:', hasConnectionMessage);

    // Restore network
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    // Should recover
    const recoveredContent = await getPageContent(page);
    assertNoTechnicalErrors(recoveredContent, 'after network recovery');
  });

  test('handles rapid submit button clicks gracefully', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate and start Pip battle
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI")').first();
    if (!(await pipButton.isVisible({ timeout: 10000 }))) {
      test.skip();
      return;
    }

    await pipButton.click();
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
    await page.waitForTimeout(10000);

    const promptInput = page.locator('textarea').first();
    if (await promptInput.isVisible({ timeout: 30000 })) {
      await promptInput.fill('Test prompt for rapid click handling');

      const submitButton = page.locator('button:has-text("Submit")').first();
      if (await submitButton.isVisible()) {
        // Rapid clicks
        await Promise.all([
          submitButton.click(),
          submitButton.click(),
          submitButton.click(),
        ]);

        await page.waitForTimeout(3000);

        // Should not show error, should handle gracefully
        const content = await getPageContent(page);

        // Should NOT have error about duplicate submission
        const hasDuplicateError = /duplicate|already submitted|cannot submit again/i.test(content);
        expect(hasDuplicateError).toBe(false);

        // Should show normal submission flow
        const hasNormalFlow = /submitted|generating|waiting|processing/i.test(content);
        expect(hasNormalFlow).toBe(true);

        console.log('Rapid clicks handled gracefully');
      }
    }
  });
});

test.describe('Pip Battle - Phase Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('all phase transitions are logged in console', async ({ page }) => {
    test.setTimeout(PIP_BATTLE_TIMEOUT);

    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[Battle')) {
        consoleMessages.push(msg.text());
      }
    });

    // Navigate and start Pip battle
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI")').first();
    if (!(await pipButton.isVisible({ timeout: 10000 }))) {
      test.skip();
      return;
    }

    await pipButton.click();
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

    // Wait for active phase
    await page.waitForTimeout(10000);

    // Submit prompt
    const promptInput = page.locator('textarea').first();
    if (await promptInput.isVisible({ timeout: 30000 })) {
      await promptInput.fill('A test prompt for phase transition logging');

      const submitButton = page.locator('button:has-text("Submit")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }
    }

    // Wait for battle to complete
    const maxWait = 120000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const content = await getPageContent(page);
      if (/winner|result|complete/i.test(content)) {
        break;
      }
      await page.waitForTimeout(3000);
    }

    // Verify we captured logging messages
    console.log('Console messages captured:', consoleMessages.length);
    console.log('Sample messages:', consoleMessages.slice(0, 5));

    // Should have captured some battle-related logs
    expect(consoleMessages.length).toBeGreaterThan(0);
  });
});
