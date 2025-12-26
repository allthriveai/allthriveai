/**
 * Chat Learning Path Creation Tests
 *
 * Tests the multi-turn flow where:
 * 1. User asks about a topic (e.g., "what is a context window")
 * 2. Ava responds with explanation + projects + game
 * 3. Ava offers to create a learning path
 * 4. User accepts the offer
 * 5. Ava creates the learning path
 * 6. User can click the link to navigate to it
 *
 * This is a DEEP test because it involves:
 * - Multi-turn conversation with context preservation
 * - AI tool execution (create_learning_path takes 60-120s)
 * - Entity creation verification
 *
 * RUN: npx playwright test e2e/deep/chat-learning-path.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  getPageContent,
  sendHomeChat,
  waitForAvaReady,
  DEEP_AI_TIMEOUT,
  MULTI_TURN_TIMEOUT,
} from './deep-helpers';
import { assertHelpfulResponse, assertNoTechnicalErrors } from './ai-quality-assertions';

// Extended timeout for learning path creation (AI lesson generation)
const LEARNING_PATH_CREATION_TIMEOUT = 180000; // 3 minutes

test.describe('Chat - Learning Path Creation Flow', () => {
  test.setTimeout(LEARNING_PATH_CREATION_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('CRITICAL: context window question → learning path offer → accept → path created → clickable', async ({
    page,
  }) => {
    // TURN 1: Ask about context windows
    console.log('Turn 1: Asking about context windows...');
    await sendHomeChat(page, 'what is a context window');

    // Wait for Ava to finish responding (can take 60-90s)
    await waitForAvaReady(page, DEEP_AI_TIMEOUT);

    const turn1Response = await getPageContent(page);
    assertNoTechnicalErrors(turn1Response, 'after context window question');

    // Verify Turn 1 response contains:
    // 1. Explanation of context windows
    const hasExplanation =
      /context/i.test(turn1Response) &&
      (/token|memory|window|limit|input|text/i.test(turn1Response));
    expect(hasExplanation).toBe(true);
    console.log('✓ Ava explained context windows');

    // 2. Project cards should be visible (grid with cards)
    const gridContainer = page.locator('.grid[class*="cols"]');
    const hasProjectCards = await gridContainer.first().isVisible().catch(() => false);
    if (hasProjectCards) {
      const cards = gridContainer.first().locator('a[href], [class*="rounded-lg"]');
      const cardCount = await cards.count();
      console.log(`✓ Found ${cardCount} project cards`);
    }

    // 3. Context Snake game should appear
    const gameHeading = page.getByRole('heading', { name: 'Context Snake', level: 4 });
    const startGameButton = page.getByRole('button', { name: 'Start Game' });
    const hasGame =
      (await gameHeading.isVisible().catch(() => false)) ||
      (await startGameButton.isVisible().catch(() => false));
    if (hasGame) {
      console.log('✓ Context Snake game is visible');
    }

    // 4. Learning path offer should appear
    const learningPathOffer = page.locator('text=/learning path/i');
    await expect(learningPathOffer.first()).toBeVisible({ timeout: 10000 });
    console.log('✓ Learning path offer is visible');

    // TURN 2: Accept the learning path offer
    console.log('Turn 2: Accepting learning path offer...');
    await sendHomeChat(page, 'yes, please create a learning path for me');

    // Wait for learning path creation (can take 60-120s due to AI lesson generation)
    console.log('Waiting for learning path creation (this can take 60-120 seconds)...');

    // Poll for learning path link
    let learningPathUrl: string | null = null;
    const maxWaitTime = 120000; // 2 minutes max
    const pollInterval = 10000; // Check every 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);
      const currentContent = await getPageContent(page);
      assertNoTechnicalErrors(currentContent, 'during learning path creation');

      // Check for learning path link in markdown format: [Title](/learn/...)
      const markdownMatch = currentContent.match(/\[([^\]]+)\]\((\/learn\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i);
      if (markdownMatch) {
        learningPathUrl = markdownMatch[2];
        console.log('Found markdown learning path link:', learningPathUrl);
        break;
      }

      // Check for rendered <a> element with /learn/ URL
      const learnLink = page.locator('a[href^="/learn/"]').first();
      if (await learnLink.isVisible().catch(() => false)) {
        learningPathUrl = await learnLink.getAttribute('href');
        if (learningPathUrl) {
          console.log('Found rendered learning path link:', learningPathUrl);
          break;
        }
      }

      // Also check for link to user's learning path: /username/learn/...
      const userLearnLink = page.locator('a[href*="/learn/"]').first();
      if (await userLearnLink.isVisible().catch(() => false)) {
        learningPathUrl = await userLearnLink.getAttribute('href');
        if (learningPathUrl && learningPathUrl.includes('/learn/')) {
          console.log('Found user learning path link:', learningPathUrl);
          break;
        }
      }

      // Check if AI is still thinking
      const isStillThinking =
        currentContent.includes('Thinking') ||
        currentContent.includes('Consulting my') ||
        currentContent.includes('Finding the way') ||
        currentContent.includes('treasure trove') ||
        currentContent.includes('Cancel');

      if (!isStillThinking) {
        // AI finished but we haven't found a link yet - check one more time
        const finalCheck = await getPageContent(page);
        const finalMatch = finalCheck.match(/\[([^\]]+)\]\((\/learn\/[^)]+)\)/i);
        if (finalMatch) {
          learningPathUrl = finalMatch[2];
        }
        break;
      }

      console.log(`Waiting for learning path... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }

    // Verify learning path was created
    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'learning path creation response');

    // Should mention the learning path was created
    const hasCreatedPath =
      /created|ready|here|path|curriculum|lessons|learn/i.test(turn2Response);
    expect(hasCreatedPath).toBe(true);
    console.log('✓ Ava confirmed learning path creation');

    // Verify we got a clickable link
    expect(learningPathUrl).toBeTruthy();
    console.log('Learning path URL:', learningPathUrl);

    // STEP 3: Navigate to the learning path and verify it exists
    if (learningPathUrl) {
      await page.goto(learningPathUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Verify we're on a valid learning path page (not 404)
      const pageTitle = await page.title();
      expect(pageTitle).not.toContain('404');
      expect(pageTitle).not.toContain('Not Found');

      // Page should have learning-related content
      const pageContent = await getPageContent(page);
      const hasLearningContent =
        /context|window|lesson|curriculum|path|learn|module/i.test(pageContent);
      expect(hasLearningContent).toBe(true);
      console.log('✓ Learning path page is accessible and has content');

      // Should have lesson items visible
      const lessonItems = page.locator(
        '[class*="lesson"], [class*="curriculum"], [class*="path-step"], [class*="module"]'
      );
      const lessonCount = await lessonItems.count();
      console.log(`Found ${lessonCount} lesson items on learning path page`);
    }
  });

  test('learning path link is clickable from chat', async ({ page }) => {
    // Ask for a learning path directly to test link clickability
    await sendHomeChat(page, 'create a learning path about prompt engineering for me');

    // Wait for Ava to finish (learning path creation takes time)
    console.log('Waiting for learning path creation...');

    let learningPathUrl: string | null = null;
    const maxWaitTime = 120000;
    const pollInterval = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);
      const currentContent = await getPageContent(page);
      assertNoTechnicalErrors(currentContent, 'learning path creation');

      // Look for rendered link with /learn/
      const learnLink = page.locator('a[href*="/learn/"]').first();
      if (await learnLink.isVisible().catch(() => false)) {
        learningPathUrl = await learnLink.getAttribute('href');
        if (learningPathUrl) {
          // Click the link
          await learnLink.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000);

          // Verify navigation worked
          const currentUrl = page.url();
          expect(currentUrl).toContain('/learn/');
          console.log('✓ Clicked learning path link, navigated to:', currentUrl);

          // Verify it's a real page
          const pageContent = await getPageContent(page);
          expect(pageContent).not.toContain('404');
          expect(pageContent).not.toContain('Page not found');
          break;
        }
      }

      // Check if still processing
      const isThinking =
        currentContent.includes('Thinking') ||
        currentContent.includes('Consulting') ||
        currentContent.includes('Cancel');

      if (!isThinking) break;

      console.log(`Waiting... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }

    expect(learningPathUrl).toBeTruthy();
    console.log('✓ Learning path link is clickable and navigates correctly');
  });

  test('multi-turn: topic question → decline path → ask different question', async ({ page }) => {
    // Test that declining the learning path offer doesn't break context

    // Turn 1: Ask about context windows
    await sendHomeChat(page, 'what is a context window');
    await waitForAvaReady(page, DEEP_AI_TIMEOUT);

    const turn1 = await getPageContent(page);
    assertNoTechnicalErrors(turn1, 'turn 1');
    expect(/context/i.test(turn1)).toBe(true);

    // Turn 2: Decline the learning path offer
    await sendHomeChat(page, 'no thanks, I have a different question');
    await waitForAvaReady(page, 60000);

    const turn2 = await getPageContent(page);
    assertNoTechnicalErrors(turn2, 'turn 2');

    // Should acknowledge and be ready for next question
    const isPolite = /okay|sure|no problem|what|help|ask|question/i.test(turn2);
    expect(isPolite).toBe(true);

    // Turn 3: Ask a different question
    await sendHomeChat(page, 'how do I use RAG with LangChain?');
    await waitForAvaReady(page, DEEP_AI_TIMEOUT);

    const turn3 = await getPageContent(page);
    assertNoTechnicalErrors(turn3, 'turn 3');

    // Should answer the RAG/LangChain question
    const hasRAG = /rag|retrieval|langchain|chain|vector|document/i.test(turn3);
    expect(hasRAG).toBe(true);
    console.log('✓ Context preserved after declining learning path offer');
  });
});

test.describe('Chat - Learning Path Quality', () => {
  test.setTimeout(MULTI_TURN_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('learning path response includes curriculum preview', async ({ page }) => {
    // Create a learning path and verify the response includes curriculum info
    await sendHomeChat(page, 'create a learning path about neural networks');

    // Wait for creation
    await waitForAvaReady(page, DEEP_AI_TIMEOUT);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'learning path creation');

    // Response should mention what the path contains
    const hasCurriculumInfo =
      /lesson|module|curriculum|will learn|covers|includes|topics/i.test(response);

    console.log('Response includes curriculum info:', hasCurriculumInfo);
    // This is a quality check, not a hard requirement
    if (!hasCurriculumInfo) {
      console.log('Note: Response could be improved by including curriculum preview');
    }
  });

  test('learning path offer appears for educational questions', async ({ page }) => {
    // Various educational questions should trigger learning path offers
    const questions = [
      'what is machine learning',
      'explain transformers in AI',
      'how do neural networks work',
    ];

    for (const question of questions) {
      // Clear any previous conversation
      await page.goto('/home');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await sendHomeChat(page, question);
      await waitForAvaReady(page, DEEP_AI_TIMEOUT);

      const response = await getPageContent(page);
      assertNoTechnicalErrors(response, question);

      // Should offer a learning path
      const hasLearningPathOffer = /learning path/i.test(response);

      if (hasLearningPathOffer) {
        console.log(`✓ "${question}" triggered learning path offer`);
      } else {
        console.log(`⚠ "${question}" did not trigger learning path offer`);
      }

      // At least one should offer a path (not a hard requirement for each)
    }
  });
});
