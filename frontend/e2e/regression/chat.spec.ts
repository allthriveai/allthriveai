/**
 * Chat Regression Tests - E2E tests for Ava chat functionality
 *
 * These tests verify that known bugs stay fixed.
 * Each test represents a real user flow that has broken in production.
 *
 * IMPORTANT: These tests should run on every PR to catch regressions.
 *
 * @see /docs/test-strategy-improvement-plan.md
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI, createConsoleErrorCollector } from '../helpers';

// Timeouts for AI operations
const WS_CONNECT_TIMEOUT = 15000;
const AI_RESPONSE_TIMEOUT = 60000;
const STREAMING_TIMEOUT = 90000;

// Error patterns that indicate bugs
const AI_REJECTION_PATTERNS = [
  /I can't help/i,
  /I'm unable to/i,
  /I cannot assist/i,
  /sorry.*can't/i,
  /error occurred/i,
  /something went wrong/i,
];

const TECHNICAL_ERROR_PATTERNS = [
  /TypeError/,
  /Exception/,
  /Traceback/,
  /NoneType/,
  /undefined is not/,
  /null is not/,
  /Internal Server Error/,
];

test.describe('Chat Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  /**
   * REGRESSION: Chat input should stay enabled and connected
   *
   * Bug: User opens chat, input is disabled or shows "Offline"
   * Root cause: WebSocket connection fails silently or drops
   */
  test('chat input remains enabled after page load', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for chat input to be enabled (indicates WebSocket connected)
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Check there's no "Offline" indicator
    const offlineIndicator = page.locator('text=/offline/i');
    await expect(offlineIndicator).not.toBeVisible();

    // Input should be focusable and typeable
    await chatInput.click();
    await chatInput.fill('Test message');
    expect(await chatInput.inputValue()).toBe('Test message');
  });

  /**
   * REGRESSION: Ava responds to messages (not rejection or error)
   *
   * Bug: User sends message, gets "I can't help" or empty response
   * Root cause: AI tool failures, context issues, or streaming errors
   */
  test('Ava responds with helpful content to greeting', async ({ page }) => {
    test.setTimeout(STREAMING_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Send greeting
    await chatInput.fill('Hello! How are you today?');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForSelector('[data-testid="assistant-message"], .prose-invert', {
      timeout: AI_RESPONSE_TIMEOUT,
    });

    // Get response text
    const assistantMessages = page.locator('[data-testid="assistant-message"], .prose-invert');
    const lastMessage = assistantMessages.last();
    const responseText = await lastMessage.textContent() || '';

    // ASSERT: Response should be helpful, not a rejection
    for (const pattern of AI_REJECTION_PATTERNS) {
      expect(responseText).not.toMatch(pattern);
    }

    // ASSERT: Response should not contain technical errors
    for (const pattern of TECHNICAL_ERROR_PATTERNS) {
      expect(responseText).not.toMatch(pattern);
    }

    // ASSERT: Response should have meaningful content
    expect(responseText.length).toBeGreaterThan(20);
  });

  /**
   * REGRESSION: Chat doesn't show duplicate messages
   *
   * Bug: User sees the same message twice in chat
   * Root cause: Race condition during reconnection or streaming
   */
  test('no duplicate messages appear in chat', async ({ page }) => {
    test.setTimeout(STREAMING_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Send a unique message
    const uniqueMessage = `Test message ${Date.now()}`;
    await chatInput.fill(uniqueMessage);
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(5000);

    // Count how many times the user message appears
    const userMessages = page.locator(`text="${uniqueMessage}"`);
    const count = await userMessages.count();

    // ASSERT: Message should appear exactly once
    expect(count).toBe(1);
  });

  /**
   * REGRESSION: Streaming text doesn't jump or scramble
   *
   * Bug: Text content jumps around or gets scrambled during streaming
   * Root cause: Stale closure in chunk handler
   */
  test('streamed response builds correctly without jumps', async ({ page }) => {
    test.setTimeout(STREAMING_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Ask a question that will have a multi-sentence response
    await chatInput.fill('What is machine learning? Give me a brief explanation.');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for streaming to start
    await page.waitForSelector('[data-testid="assistant-message"], .prose-invert', {
      timeout: AI_RESPONSE_TIMEOUT,
    });

    // Capture snapshots during streaming
    const contentSnapshots: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const assistantMessages = page.locator('[data-testid="assistant-message"], .prose-invert');
      const lastMessage = assistantMessages.last();
      const content = await lastMessage.textContent() || '';
      contentSnapshots.push(content);
    }

    // ASSERT: Each snapshot should be a prefix of the next (content only grows)
    for (let i = 1; i < contentSnapshots.length; i++) {
      const prev = contentSnapshots[i - 1];
      const curr = contentSnapshots[i];

      // Current should start with or equal previous (no jumps/deletions)
      const isValidProgression = curr.startsWith(prev) || curr === prev;
      expect(isValidProgression).toBe(true);
    }

    // ASSERT: Final content should be coherent (not scrambled)
    const finalContent = contentSnapshots[contentSnapshots.length - 1];
    expect(finalContent.length).toBeGreaterThan(50);

    // Check for obvious scrambling patterns
    const scramblePatterns = [
      /(.)\1{10,}/, // Same character repeated 10+ times
      /\s{5,}/, // 5+ consecutive spaces
    ];
    for (const pattern of scramblePatterns) {
      expect(finalContent).not.toMatch(pattern);
    }
  });

  /**
   * REGRESSION: Chat reconnects after disconnect
   *
   * Bug: Chat goes offline and doesn't recover
   * Root cause: Reconnection logic fails or stalls
   */
  test('chat recovers after network interruption', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Send first message to establish connection
    await chatInput.fill('Hello');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    await page.waitForTimeout(3000);

    // Simulate network interruption by going offline
    await page.context().setOffline(true);
    await page.waitForTimeout(2000);

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    // ASSERT: Chat input should be enabled again (reconnected)
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // ASSERT: Should be able to send another message
    await chatInput.fill('Are you still there?');
    await sendButton.click();

    // Wait for response (proves connection recovered)
    await page.waitForSelector('[data-testid="assistant-message"], .prose-invert', {
      timeout: AI_RESPONSE_TIMEOUT,
    });
  });

  /**
   * REGRESSION: No console errors during chat
   *
   * Bug: JavaScript errors in console indicate silent failures
   * Root cause: Various - uncaught exceptions, failed state updates
   */
  test('no critical console errors during chat session', async ({ page }) => {
    test.setTimeout(90000);

    const consoleCollector = createConsoleErrorCollector(page);
    consoleCollector.start();

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Have a short conversation
    await chatInput.fill('Hello');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    await page.waitForTimeout(10000);

    await chatInput.fill('Tell me something interesting');
    await sendButton.click();

    await page.waitForTimeout(10000);

    consoleCollector.stop();

    // ASSERT: No critical console errors
    expect(consoleCollector.hasCriticalErrors()).toBe(false);

    if (consoleCollector.hasErrors()) {
      console.log('Console errors detected:', consoleCollector.getErrorsSummary());
    }
  });

  /**
   * REGRESSION: Chat persists across navigation
   *
   * Bug: User navigates away and back, loses chat history
   * Root cause: State not properly persisted/restored
   */
  test('chat history persists after navigation', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Send a unique message
    const uniqueMessage = `Remember this: ${Date.now()}`;
    await chatInput.fill(uniqueMessage);
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    await page.waitForTimeout(5000);

    // Navigate away
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Navigate back
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // ASSERT: Our message should still be visible
    const ourMessage = page.locator(`text="${uniqueMessage}"`);
    await expect(ourMessage).toBeVisible({ timeout: 10000 });
  });
});
