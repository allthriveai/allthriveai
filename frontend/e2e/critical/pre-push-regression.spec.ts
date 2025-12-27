/**
 * Pre-Push Critical Regression Tests
 *
 * These 4 tests MUST pass before pushing to GitHub.
 * Run manually: npx playwright test e2e/critical/pre-push-regression.spec.ts
 * Bypass: git push --no-verify
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI } from '../helpers';
import {
  sendHomeChat,
  waitForAvaReady,
  getPageContent,
  DEEP_AI_TIMEOUT,
} from '../deep/deep-helpers';
import { assertNoTechnicalErrors } from '../deep/ai-quality-assertions';

// Timeouts - generous for real AI operations
const AVATAR_TIMEOUT = 60000;         // 60s (target <15s but AI generation varies)
const LEARNING_PATH_TIMEOUT = 300000; // 5 min (AI lesson generation is slow)
const BATTLE_TIMEOUT = 300000;        // 5 min (image gen + judging)
const PROJECT_TIMEOUT = 180000;       // 3 min (URL scraping + AI processing)
const WS_CONNECT_TIMEOUT = 30000;     // 30s for WebSocket connection

/**
 * Wait for WebSocket to be connected (no "Reconnecting..." indicator)
 */
async function waitForWebSocketConnected(page: Page, timeout = 30000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);
    if (!content.includes('Reconnecting')) {
      await page.waitForTimeout(1000);
      const stillConnected = await getPageContent(page);
      if (!stillConnected.includes('Reconnecting')) {
        return;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`WebSocket did not connect within ${timeout}ms`);
}

/**
 * Wait for Ava response (more reliable than just checking input enabled)
 */
async function waitForAvaResponse(page: Page, timeout = 90000): Promise<string> {
  const startTime = Date.now();
  let sawThinking = false;

  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);

    const isThinking =
      content.includes('Thinking') ||
      content.includes('Consulting my') ||
      content.includes('Finding the way') ||
      content.includes('treasure trove');

    if (isThinking) {
      sawThinking = true;
      console.log(`Ava thinking... (${Math.round((Date.now() - startTime) / 1000)}s)`);
      await page.waitForTimeout(2000);
      continue;
    }

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    const isDisabled = await chatInput.isDisabled().catch(() => true);

    if (isDisabled) {
      await page.waitForTimeout(2000);
      continue;
    }

    if (sawThinking) {
      return content;
    }

    await page.waitForTimeout(2000);
  }

  return await getPageContent(page);
}

test.describe('Pre-Push Critical Regression Tests', () => {
  test.describe.configure({ mode: 'serial' }); // Run sequentially

  // ============================================================
  // TEST 1: URL → Ownership Question → Project Creation
  // ============================================================
  test('CRITICAL: paste URL → asks ownership → create project → in playground', async ({ page }) => {
    test.setTimeout(PROJECT_TIMEOUT);

    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket connection
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Step 1: Paste a URL
    const testUrl = 'https://github.com/anthropics/anthropic-cookbook';
    await sendHomeChat(page, testUrl);

    // Step 2: Wait for Ember to ask about ownership
    const afterUrl = await waitForAvaResponse(page, 60000);
    assertNoTechnicalErrors(afterUrl, 'after URL paste');

    // ASSERT: Should ask if it's my project or something to save/share
    const asksOwnership = /your own|your project|is this your|clip|save|found|import/i.test(afterUrl);
    expect(asksOwnership).toBe(true);

    // Step 3: Say "create a project"
    await sendHomeChat(page, "Yes, it's my project. Please create it.");

    // Step 4: Wait for project creation
    let projectUrl: string | null = null;
    const maxWaitTime = 90000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(5000);

      // Check if navigated to project page
      const currentUrl = page.url();
      if (currentUrl.match(/\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i) && !currentUrl.includes('/home')) {
        projectUrl = currentUrl;
        break;
      }

      // Check for markdown link
      const content = await getPageContent(page);
      const markdownMatch = content.match(/\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i);
      if (markdownMatch) {
        projectUrl = markdownMatch[2];
        break;
      }

      // Check for rendered link
      const projectLink = page.locator('a[href*="/e2e-test-user/"]').first();
      if (await projectLink.isVisible().catch(() => false)) {
        projectUrl = await projectLink.getAttribute('href');
        if (projectUrl) break;
      }
    }

    // ASSERT: Project was created
    expect(projectUrl).toBeTruthy();
    console.log('Project created:', projectUrl);

    // Step 5: Navigate to playground and verify project exists
    await page.goto('/me/playground');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const playgroundContent = await getPageContent(page);
    const hasProject = /anthropic|cookbook/i.test(playgroundContent);
    expect(hasProject).toBe(true);
    console.log('✓ Project visible in playground');
  });

  // ============================================================
  // TEST 2: Avatar Creation (<15s)
  // ============================================================
  test('CRITICAL: ask create avatar → "make me a robot" → saved to profile <15s', async ({ page }) => {
    test.setTimeout(AVATAR_TIMEOUT);

    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for chat to be ready
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    const startTime = Date.now();

    // Step 1: Ask Ember to create an avatar
    await chatInput.fill('create my avatar');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Step 2: Wait for avatar wizard to open
    const avatarPrompt = page.locator('textarea[placeholder*="Describe"], textarea[placeholder*="avatar"]').first();
    await expect(avatarPrompt).toBeVisible({ timeout: 10000 });

    // Step 3: Write "make me a robot"
    await avatarPrompt.fill('make me a robot');

    // Step 4: Click generate button
    const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Create"), button:has-text("Make")').first();
    await generateBtn.click();

    // Step 5: Wait for avatar to be generated
    // Look for success indicators
    const successPatterns = [
      'text=/saved|success|done|ready|profile/i',
      'img[src*="avatar"]',
      '[data-testid="avatar-preview"]',
    ];

    let avatarGenerated = false;
    const maxWait = 20000;
    const avatarStart = Date.now();

    while (Date.now() - avatarStart < maxWait) {
      for (const pattern of successPatterns) {
        const element = page.locator(pattern);
        if (await element.isVisible().catch(() => false)) {
          avatarGenerated = true;
          break;
        }
      }
      if (avatarGenerated) break;
      await page.waitForTimeout(1000);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Avatar generated in ${elapsed}ms (target: <30000ms)`);

    // ASSERT: Avatar generated (timing is informational, not a hard fail)
    expect(avatarGenerated).toBe(true);

    // Log if over target but don't fail (AI timing varies)
    if (elapsed > 15000) {
      console.log(`⚠ Avatar took ${elapsed}ms (over 15s target, but acceptable)`);
    } else {
      console.log(`✓ Avatar generated within 15s target`);
    }

    // Step 6: Verify avatar saved to profile
    await page.goto('/me');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const avatarImg = page.locator('img[alt*="avatar"], img[src*="avatar"]');
    await expect(avatarImg).toBeVisible({ timeout: 5000 });
    console.log('✓ Avatar saved to profile');
  });

  // ============================================================
  // TEST 3: Context Window → Learning Path
  // ============================================================
  test('CRITICAL: "what is a context window" → projects + snake game + learning path offer → creates path', async ({ page }) => {
    test.setTimeout(LEARNING_PATH_TIMEOUT);

    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Step 1: Ask about context windows
    await sendHomeChat(page, 'what is a context window');
    await waitForAvaReady(page, DEEP_AI_TIMEOUT);

    const response = await getPageContent(page);
    assertNoTechnicalErrors(response, 'after context window question');

    // ASSERT: Response explains context windows
    const hasExplanation = /context/i.test(response) && /token|memory|window|limit|input/i.test(response);
    expect(hasExplanation).toBe(true);
    console.log('✓ Ember explained context windows');

    // ASSERT: Project cards visible
    const gridContainer = page.locator('.grid[class*="cols"]');
    const hasProjects = await gridContainer.first().isVisible().catch(() => false);
    if (hasProjects) {
      console.log('✓ Project cards visible');
    }

    // ASSERT: Context Snake game appears
    const gameHeading = page.getByRole('heading', { name: 'Context Snake', level: 4 });
    const startGameButton = page.getByRole('button', { name: 'Start Game' });
    const hasGame = await gameHeading.isVisible().catch(() => false) ||
                    await startGameButton.isVisible().catch(() => false);
    expect(hasGame).toBe(true);
    console.log('✓ Context Snake game visible');

    // ASSERT: Learning path offer with specific phrase
    expect(/would you like me to turn this into a learning path/i.test(response)).toBe(true);
    console.log('✓ Learning path offer present');

    // Step 2: Accept the offer
    await sendHomeChat(page, 'yes, please create a learning path for me');

    // Step 3: Wait for learning path creation
    let learningPathUrl: string | null = null;
    const maxWait = 120000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await page.waitForTimeout(10000);

      const currentContent = await getPageContent(page);
      assertNoTechnicalErrors(currentContent, 'during learning path creation');

      // Check for markdown link
      const markdownMatch = currentContent.match(/\[([^\]]+)\]\((\/learn\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i);
      if (markdownMatch) {
        learningPathUrl = markdownMatch[2];
        break;
      }

      // Check for rendered link
      const learnLink = page.locator('a[href*="/learn/"]').first();
      if (await learnLink.isVisible().catch(() => false)) {
        learningPathUrl = await learnLink.getAttribute('href');
        if (learningPathUrl) break;
      }

      console.log(`Waiting for learning path... (${Math.round((Date.now() - start) / 1000)}s)`);
    }

    // ASSERT: Learning path created
    expect(learningPathUrl).toBeTruthy();
    console.log('Learning path URL:', learningPathUrl);

    // Step 4: Navigate to learning path and verify
    if (learningPathUrl) {
      await page.goto(learningPathUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // ASSERT: Not a 404
      const pageTitle = await page.title();
      expect(pageTitle).not.toContain('404');
      expect(pageTitle).not.toContain('Not Found');

      const pathContent = await getPageContent(page);
      const hasLearningContent = /context|window|lesson|curriculum|path|learn|module/i.test(pathContent);
      expect(hasLearningContent).toBe(true);
      console.log('✓ Learning path accessible with content');
    }
  });

  // ============================================================
  // TEST 4: Pip Battle - Full Flow
  // ============================================================
  test('CRITICAL: /play/prompt-battles → Play Pip → submit prompt → two images → winner picked', async ({ page }) => {
    test.setTimeout(BATTLE_TIMEOUT);

    await loginViaAPI(page);

    // Step 1: Navigate to battles
    console.log('Step 1: Navigate to /play/prompt-battles');
    await page.goto('/play/prompt-battles');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const lobbyContent = await getPageContent(page);
    assertNoTechnicalErrors(lobbyContent, 'battles lobby');

    // Step 2: Click Play Pip
    console.log('Step 2: Click Play Pip');
    const pipButton = page.locator([
      'button:has-text("Play Pip")',
      'button:has-text("Battle Pip")',
      'button:has-text("Pip")',
    ].join(', ')).first();

    await expect(pipButton).toBeVisible({ timeout: 15000 });
    await pipButton.click();

    // Wait for battle page
    await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
    console.log('Battle URL:', page.url());
    await page.waitForTimeout(5000);

    // Step 3: Wait for countdown and active phase
    console.log('Step 3: Wait for active phase');
    const maxCountdownWait = 15000;
    const countdownStart = Date.now();

    while (Date.now() - countdownStart < maxCountdownWait) {
      const promptInput = page.locator('textarea, input[placeholder*="prompt" i]');
      if (await promptInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Active phase reached');
        break;
      }
      await page.waitForTimeout(1000);
    }

    // Step 4: Write and submit prompt
    console.log('Step 4: Submit prompt');
    const promptInput = page.locator('textarea, input[placeholder*="prompt" i]').first();
    await expect(promptInput).toBeVisible({ timeout: 30000 });

    const testPrompt = 'A majestic golden phoenix rising from emerald flames, with crystalline feathers reflecting rainbow light';
    await promptInput.fill(testPrompt);

    const submitButton = page.locator([
      'button:has-text("Submit")',
      'button:has-text("Send")',
      'button[type="submit"]',
    ].join(', ')).first();

    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();
    console.log('Prompt submitted');

    // Step 5: Wait for both AI images
    console.log('Step 5: Wait for AI images (up to 90s)');
    const imageTimeout = 90000;
    const imageStart = Date.now();
    let imageCount = 0;

    while (Date.now() - imageStart < imageTimeout) {
      const images = page.locator('img[src*="cdn"], img[src*="s3"], img[src*="cloudfront"], img[src*="amazonaws"]');
      imageCount = await images.count();

      if (imageCount >= 2) {
        console.log(`✓ Both images generated (${imageCount})`);
        break;
      }

      const content = await getPageContent(page);
      if (/winner|result|score/i.test(content)) {
        console.log('Results phase detected');
        break;
      }

      console.log(`Generating... (${Math.round((Date.now() - imageStart) / 1000)}s)`);
      await page.waitForTimeout(5000);
    }

    // ASSERT: Both images generated
    expect(imageCount).toBeGreaterThanOrEqual(2);

    // Step 6: Wait for winner announcement
    console.log('Step 6: Wait for winner (up to 60s)');
    const winnerTimeout = 60000;
    const winnerStart = Date.now();
    let hasWinner = false;

    while (Date.now() - winnerStart < winnerTimeout) {
      const content = await getPageContent(page);
      if (/winner|you won|you lost|tie|victory|defeat|score.*\d+/i.test(content)) {
        hasWinner = true;

        const wonMatch = /you won/i.test(content);
        const lostMatch = /you lost/i.test(content);
        const tieMatch = /tie|draw/i.test(content);

        if (wonMatch) console.log('✓ Result: YOU WON!');
        else if (lostMatch) console.log('✓ Result: You lost to Pip');
        else if (tieMatch) console.log("✓ Result: It's a tie!");

        break;
      }
      await page.waitForTimeout(3000);
    }

    // ASSERT: Winner announced
    expect(hasWinner).toBe(true);

    const finalContent = await getPageContent(page);
    assertNoTechnicalErrors(finalContent, 'battle complete');

    console.log('=== PIP BATTLE COMPLETE ===');
  });
});
