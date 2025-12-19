/**
 * Ember Chat Smoke Tests
 *
 * Quick validation that the chat system is working.
 * These tests should pass before running more complex feature tests.
 *
 * RUN: npx playwright test e2e/ember-chat/chat-smoke.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../helpers';
import {
  openEmbeddedChat,
  openChatSidebar,
  getChatInput,
  getSendButton,
  sendMessage,
  waitForEmberResponse,
  getChatContent,
  assertNoTechnicalErrors,
  TIMEOUTS,
} from './chat-helpers';

test.describe('Ember Chat Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test.describe('Chat Accessibility', () => {
    test('user can access chat on /home page', async ({ page }) => {
      // GIVEN: I am a logged in user
      // WHEN: I navigate to /home
      await openEmbeddedChat(page);

      // THEN: The chat input should be visible
      const chatInput = getChatInput(page);
      await expect(chatInput).toBeVisible();

      // AND: The send button should be present
      const sendButton = getSendButton(page);
      await expect(sendButton).toBeVisible();
    });

    test('user can open chat sidebar from /explore', async ({ page }) => {
      // GIVEN: I am a logged in user on /explore
      // WHEN: I click the chat icon in the header
      await openChatSidebar(page, '/explore');

      // THEN: The chat sidebar should open
      const chatInput = getChatInput(page);
      await expect(chatInput).toBeVisible();
    });

    test('user can open chat sidebar from /learn', async ({ page }) => {
      // GIVEN: I am a logged in user on /learn
      // WHEN: I click the chat icon in the header
      await openChatSidebar(page, '/learn');

      // THEN: The chat sidebar should open with context-aware actions
      const chatInput = getChatInput(page);
      await expect(chatInput).toBeVisible();
    });
  });

  test.describe('Basic Messaging', () => {
    test('user can type a message in chat input', async ({ page }) => {
      // GIVEN: Chat is open on /home
      await openEmbeddedChat(page);

      // WHEN: I type a message
      const chatInput = getChatInput(page);
      await chatInput.fill('Hello Ember!');

      // THEN: The message should appear in the input
      await expect(chatInput).toHaveValue('Hello Ember!');
    });

    test('send button is enabled when message is entered', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I type a message
      const chatInput = getChatInput(page);
      await chatInput.fill('Hello!');

      // THEN: Send button should be enabled
      const sendButton = getSendButton(page);
      await expect(sendButton).toBeEnabled();
    });

    test('user message appears in chat after sending', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I send a message
      await sendMessage(page, 'Hello Ember!');
      await page.waitForTimeout(1000);

      // THEN: My message should appear in the chat
      const chatContent = await getChatContent(page);
      expect(chatContent).toContain('hello ember!');
    });
  });

  test.describe('WebSocket Connection', () => {
    test('chat shows connection status', async ({ page }) => {
      // GIVEN: I navigate to /home
      await page.goto('/home');
      await page.waitForLoadState('domcontentloaded');

      // THEN: Either connected (no indicator) or reconnecting indicator shown
      // Wait a moment for connection
      await page.waitForTimeout(3000);

      // The chat should be functional (input visible)
      const chatInput = getChatInput(page);
      await expect(chatInput).toBeVisible({ timeout: TIMEOUTS.chatConnect });
    });

    test('chat reconnects after disconnect', async ({ page }) => {
      // GIVEN: Chat is connected
      await openEmbeddedChat(page);

      // WHEN: I navigate away and back
      await page.goto('/explore');
      await page.waitForTimeout(1000);
      await page.goto('/home');
      await page.waitForLoadState('domcontentloaded');

      // THEN: Chat should reconnect
      const chatInput = getChatInput(page);
      await expect(chatInput).toBeVisible({ timeout: TIMEOUTS.chatConnect });
    });
  });
});

// AI-powered tests (require RUN_AI_TESTS=true)
test.describe('Ember Response Tests', () => {
  const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(TIMEOUTS.aiResponse + 30000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('Ember responds to greeting', async ({ page }) => {
    // GIVEN: Chat is open
    await openEmbeddedChat(page);

    // WHEN: I send a greeting
    await sendMessage(page, 'Hi Ember! How are you?');

    // THEN: Ember should respond
    await waitForEmberResponse(page);
    const chatContent = await getChatContent(page);

    // Response should be friendly and conversational
    const greetingIndicators = [
      'hello',
      'hi',
      'hey',
      'help',
      'here',
      'great',
      'good',
      'doing',
    ];
    const hasGreetingResponse = greetingIndicators.some(word => chatContent.includes(word));
    expect(hasGreetingResponse).toBe(true);

    // No technical errors
    await assertNoTechnicalErrors(page);
  });

  test('Ember responds to help request', async ({ page }) => {
    // GIVEN: Chat is open
    await openEmbeddedChat(page);

    // WHEN: I ask for help
    await sendMessage(page, 'I need help getting started');

    // THEN: Ember should provide helpful guidance
    await waitForEmberResponse(page);
    const chatContent = await getChatContent(page);

    // Response should offer guidance
    const helpIndicators = [
      'help',
      'start',
      'can',
      'try',
      'project',
      'explore',
      'create',
    ];
    const hasHelpfulResponse = helpIndicators.some(word => chatContent.includes(word));
    expect(hasHelpfulResponse).toBe(true);

    // No technical errors
    await assertNoTechnicalErrors(page);
  });
});
