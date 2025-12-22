/**
 * Context Window Learning Flow E2E Tests
 *
 * Tests the full learning experience when asking "what is a context window":
 * 1. Ember explains context windows (text response)
 * 2. Project cards display related projects
 * 3. Context Snake game renders inline
 * 4. Learning path offer appears at the end
 *
 * RUN: npx playwright test e2e/context-window-learning.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI } from './helpers';

// Timeouts
const WS_CONNECT_TIMEOUT = 15000;
const AI_RESPONSE_TIMEOUT = 60000;

/**
 * Helper: Send a chat message
 */
async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.locator('input[placeholder="Message Ember..."]');
  await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

  await chatInput.fill(message);
  const sendButton = page
    .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
    .first();
  await sendButton.click();
}

/**
 * Helper: Wait for AI response to complete
 */
async function waitForResponseComplete(page: Page, timeout = AI_RESPONSE_TIMEOUT) {
  // Wait for the thinking indicator to disappear
  const thinkingIndicator = page.locator('text="Thinking..."');
  const cancelButton = page.locator('button:has-text("Cancel")');

  // First wait for thinking to appear (confirms message was sent)
  try {
    await thinkingIndicator.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Thinking indicator appeared');
  } catch {
    // May have already completed
  }

  // Then wait for thinking to disappear
  try {
    await thinkingIndicator.waitFor({ state: 'hidden', timeout: timeout });
    console.log('✓ Thinking indicator hidden');
  } catch {
    console.log('⚠ Thinking indicator did not hide within timeout');
  }

  // Also wait for cancel button to disappear
  try {
    await cancelButton.waitFor({ state: 'hidden', timeout: 10000 });
  } catch {
    // May not exist
  }

  // Extra wait for final render and any animations
  await page.waitForTimeout(3000);
}

test.describe('Context Window Learning Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000); // 2 min for full flow

    // Capture browser console logs for debugging
    page.on('console', msg => {
      if (msg.text().includes('[DEBUG')) {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });

    await loginViaAPI(page);

    // Navigate to home page with Ember chat
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
  });

  test('full learning flow: explanation + projects + game + learning path offer', async ({ page }) => {
    // GIVEN: I am on the home page with Ember chat ready
    await page.waitForTimeout(1000);

    // WHEN: I ask "what is a context window"
    await sendChatMessage(page, 'what is a context window');
    await waitForResponseComplete(page);

    // THEN: Should have a text explanation about context windows
    // Look for the prose content inside the message (not buttons/controls)
    const proseContent = page.locator('[class*="glass-message"] .prose, [class*="glass-message"] p').first();
    await expect(proseContent).toBeVisible({ timeout: 10000 });

    // Get the message text from prose content only
    const messageText = await proseContent.textContent();
    console.log('Response text (first 300 chars):', messageText?.substring(0, 300));

    // Should mention context window concepts
    expect(
      messageText?.toLowerCase().includes('context') ||
      messageText?.toLowerCase().includes('token') ||
      messageText?.toLowerCase().includes('memory')
    ).toBe(true);
    console.log('✓ Response mentions context window concepts');

    // AND: Should have project cards displayed in a grid
    const gridContainer = page.locator('.grid[class*="cols"]');
    await expect(gridContainer.first()).toBeVisible({ timeout: 10000 });

    const cards = gridContainer.first().locator('a[href], [class*="rounded-lg"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
    console.log(`✓ Found ${cardCount} project cards in grid`);

    // AND: Should have Context Snake game displayed
    const snakeGame = page.locator('[data-testid="context-snake"], [class*="snake"], canvas');
    const gameCard = page.locator('text=Context Snake, text=Play Context Snake');
    const hasGame = await snakeGame.first().isVisible().catch(() => false) ||
                    await gameCard.first().isVisible().catch(() => false);
    expect(hasGame).toBe(true);
    console.log('✓ Context Snake game is visible');

    // AND: Should offer to create a learning path
    const learningPathOffer = page.locator('text=/learning path/i');
    await expect(learningPathOffer.first()).toBeVisible({ timeout: 5000 });
    console.log('✓ Learning path offer is visible');
  });

  test('Context Snake game renders with correct elements', async ({ page }) => {
    // Ask about context windows to trigger the game
    await sendChatMessage(page, 'what is a context window');
    await waitForResponseComplete(page);

    // Find the game container
    const gameContainer = page.locator('[data-testid="chat-game-card"], [class*="ChatGameCard"]');

    if (await gameContainer.isVisible()) {
      // Should have a play button or canvas
      const playButton = gameContainer.locator('button:has-text("Play"), button:has-text("Start")');
      const canvas = gameContainer.locator('canvas');

      const hasPlayButton = await playButton.isVisible().catch(() => false);
      const hasCanvas = await canvas.isVisible().catch(() => false);

      expect(hasPlayButton || hasCanvas).toBe(true);
      console.log(`✓ Game has ${hasPlayButton ? 'play button' : 'canvas'}`);
    } else {
      // Alternative: Game might render as a card with title
      const gameTitle = page.locator('text=Context Snake');
      expect(await gameTitle.isVisible()).toBe(true);
      console.log('✓ Context Snake game card is visible');
    }
  });

  test('project cards are clickable and link to projects', async ({ page }) => {
    await sendChatMessage(page, 'what is a context window');
    await waitForResponseComplete(page);

    // Find project cards in the grid
    const gridContainer = page.locator('.grid[class*="cols"]').first();
    await expect(gridContainer).toBeVisible({ timeout: 10000 });

    const projectLinks = gridContainer.locator('a[href*="/projects/"], a[href*="/project/"]');
    const linkCount = await projectLinks.count();

    if (linkCount > 0) {
      const firstLink = projectLinks.first();
      const href = await firstLink.getAttribute('href');

      expect(href).toMatch(/\/project/);
      console.log(`✓ Found ${linkCount} project links, first: ${href}`);
    } else {
      // Cards might use onClick navigation instead
      const cards = gridContainer.locator('[class*="rounded-lg"][class*="cursor-pointer"]');
      expect(await cards.count()).toBeGreaterThan(0);
      console.log('✓ Project cards are clickable (onClick navigation)');
    }
  });

  test('response does NOT mention game by name (AI should not reveal implementation)', async ({ page }) => {
    await sendChatMessage(page, 'what is a context window');
    await waitForResponseComplete(page);

    // Get the AI's text response (not the game widget itself)
    const assistantMessage = page.locator('[class*="glass-message"] .prose, [class*="bg-slate-100"] .prose');
    const responseText = await assistantMessage.first().textContent();

    // AI should NOT mention "Context Snake" in its text
    // (The game widget appears, but AI shouldn't reference it)
    const mentionsSnake = responseText?.toLowerCase().includes('context snake') ||
                          responseText?.toLowerCase().includes('snake game');

    if (mentionsSnake) {
      console.log('⚠ AI incorrectly mentioned the game in response text');
    }
    expect(mentionsSnake).toBe(false);
    console.log('✓ AI did not reveal game implementation details');
  });

  test('learning path offer appears after content cards and game', async ({ page }) => {
    await sendChatMessage(page, 'what is a context window');
    await waitForResponseComplete(page);

    // The learning path offer should appear after cards/game
    const learningPathOffer = page.locator('text=/Would you like me to.*learning path/i');
    await expect(learningPathOffer.first()).toBeVisible({ timeout: 10000 });

    // Verify it's positioned after the cards (below them in DOM)
    const offerBoundingBox = await learningPathOffer.first().boundingBox();
    const gridBoundingBox = await page.locator('.grid[class*="cols"]').first().boundingBox();

    if (offerBoundingBox && gridBoundingBox) {
      // Learning path offer should be below the grid
      expect(offerBoundingBox.y).toBeGreaterThan(gridBoundingBox.y);
      console.log('✓ Learning path offer is positioned after content cards');
    }
  });
});

test.describe('Context Snake Game Rendering', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
  });

  test('game widget renders within assistant message', async ({ page }) => {
    await sendChatMessage(page, 'what is a context window');
    await waitForResponseComplete(page);

    // The game should be inside the assistant message container
    const assistantContainer = page.locator('[class*="justify-start"]').last();

    // Look for game inside the message
    const gameInMessage = assistantContainer.locator(
      '[data-testid="chat-game-card"], [class*="ChatGameCard"], canvas, text=Context Snake'
    );

    const hasGameInMessage = await gameInMessage.first().isVisible().catch(() => false);
    expect(hasGameInMessage).toBe(true);
    console.log('✓ Game widget is rendered inside assistant message');
  });

  test('game does NOT appear as separate message', async ({ page }) => {
    await sendChatMessage(page, 'what is a context window');
    await waitForResponseComplete(page);

    // Count assistant messages
    const assistantMessages = page.locator('[class*="justify-start"]');
    const messageCount = await assistantMessages.count();

    // Should be 1 assistant message (containing text + cards + game)
    // Not 2+ messages (one for text, one for game)
    console.log(`Found ${messageCount} assistant-side messages`);

    // The game should be consolidated into one message, not split
    // This allows for some variation but catches obvious splits
    expect(messageCount).toBeLessThanOrEqual(3); // Allow for previous messages
  });
});
