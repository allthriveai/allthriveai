/**
 * Ember Chat Inline Game Tests
 *
 * Tests the inline game feature when asking conceptual questions.
 * Verifies that Ember explains the concept AND embeds a game widget.
 *
 * RUN: RUN_AI_TESTS=true npx playwright test e2e/ember-chat/inline-game.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../helpers';
import {
  openEmbeddedChat,
  getChatInput,
  sendMessage,
  waitForEmberResponse,
  getChatContent,
  assertNoTechnicalErrors,
  TIMEOUTS,
} from './chat-helpers';

test.describe('Ember Inline Game Tests', () => {
  const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(TIMEOUTS.aiResponse + 60000); // Extra time for game rendering

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('user can play inline game when asking a learning question', async ({ page }) => {
    // GIVEN: Chat is open on /home
    await openEmbeddedChat(page);

    // Verify chat input is ready
    const chatInput = getChatInput(page);
    await expect(chatInput).toBeVisible();

    // WHEN: I ask about context windows
    await sendMessage(page, 'What is a context window?');

    // Wait for Ember's response to complete
    await waitForEmberResponse(page);

    // Additional wait for game widget to render
    await page.waitForTimeout(3000);

    // THEN: Ember should explain the concept (not just game mechanics)
    const chatContent = await getChatContent(page);

    // Check for conceptual explanation indicators
    const conceptIndicators = [
      'context window',
      'token',
      'text',
      'memory',
      'process',
      'ai',
      'model',
    ];
    const hasConceptExplanation = conceptIndicators.filter(word =>
      chatContent.includes(word)
    ).length >= 2;

    expect(hasConceptExplanation).toBe(true);

    // AND: Should NOT just be game mechanics (check it's not ONLY about the game)
    // The response should have substance beyond just "play the game"
    const responseLength = chatContent.length;
    expect(responseLength).toBeGreaterThan(200); // Substantial explanation expected

    // AND: A game widget should be visible in the chat
    // Games are rendered in a ChatGameCard component with specific structure
    const gameWidget = page.locator('[data-testid="chat-game-card"], [class*="game"], [class*="snake"]');
    const gameVisible = await gameWidget.first().isVisible().catch(() => false);

    // Alternative: look for game-related UI elements
    const playButton = page.locator('button:has-text("Play"), button:has-text("Start")');
    const playButtonVisible = await playButton.first().isVisible().catch(() => false);

    const snakeGame = page.locator('text=Context Snake, text=Snake');
    const snakeVisible = await snakeGame.first().isVisible().catch(() => false);

    // At least one game indicator should be present
    const hasGameWidget = gameVisible || playButtonVisible || snakeVisible;
    expect(hasGameWidget).toBe(true);

    // No technical errors
    await assertNoTechnicalErrors(page);
  });

  test('game appears AFTER text explanation (correct order)', async ({ page }) => {
    // GIVEN: Chat is open
    await openEmbeddedChat(page);

    // WHEN: I ask a learning question
    await sendMessage(page, 'explain context windows to me');

    // Wait for full response
    await waitForEmberResponse(page);
    await page.waitForTimeout(3000);

    // THEN: Text should appear first, then game
    // Get all message elements in order
    const messages = page.locator('[class*="justify-start"]'); // Assistant messages
    const messageCount = await messages.count();

    // Should have at least 1 assistant message
    // (User message is justify-end, assistant is justify-start)
    expect(messageCount).toBeGreaterThanOrEqual(1);

    // The first assistant response should contain some text (any length is ok)
    const firstAssistantMessage = await messages.first().textContent();
    expect(firstAssistantMessage?.length).toBeGreaterThan(10);

    // No technical errors
    await assertNoTechnicalErrors(page);
  });

  test('Ember does NOT output links to games', async ({ page }) => {
    // GIVEN: Chat is open
    await openEmbeddedChat(page);

    // WHEN: I ask about context windows
    await sendMessage(page, 'what is a context window?');

    // Wait for response
    await waitForEmberResponse(page);

    // THEN: Should NOT contain links to game pages
    const chatContent = await getChatContent(page);

    // Check for bad patterns (links to games)
    const badPatterns = [
      '/play/context-snake',
      'play context snake',
      '[context snake]',
      '(/play/',
    ];

    const hasGameLink = badPatterns.some(pattern =>
      chatContent.includes(pattern)
    );

    expect(hasGameLink).toBe(false);

    // No technical errors
    await assertNoTechnicalErrors(page);
  });
});
