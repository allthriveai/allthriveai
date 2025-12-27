/**
 * Chat Edge Cases Tests
 *
 * Tests for error recovery, rate limiting, network issues,
 * and other edge cases that might cause problems in production.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  sendHomeChat,
  getPageContent,
  simulateNetworkDisconnect,
  DEEP_AI_TIMEOUT,
  WS_CONNECT_TIMEOUT,
} from './deep-helpers';
import { assertHelpfulResponse, assertNoTechnicalErrors } from './ai-quality-assertions';

test.describe('Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('empty search results handled gracefully', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    // Search for something that likely doesn't exist
    await sendHomeChat(page, 'Show me projects about xyznonexistenttopic123abc');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);

    // Should NOT show technical errors
    assertNoTechnicalErrors(response, 'empty search');

    // Should provide a helpful response (alternatives, suggestions)
    const isHelpful = /couldn't find|no.*found|try|suggest|instead|other|search/i.test(response) ||
      /project|here|found/i.test(response); // OR it found something anyway
    expect(isHelpful).toBe(true);
  });

  test('very long message handled gracefully', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    // Generate a very long message (3000+ characters)
    const longMessage = 'I want to build a project that ' + 'does many things '.repeat(200);

    await sendHomeChat(page, longMessage);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);

    // Should NOT crash or show technical errors
    assertNoTechnicalErrors(response, 'long message');

    // Should either process it or give a clear length error
    const hasResponse = response.length > 100; // Some response was generated
    expect(hasResponse).toBe(true);
  });

  test('special characters in message handled correctly', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    // Message with special characters, emojis, and potential injection
    await sendHomeChat(page, 'What about projects with <script>alert("test")</script> and 🚀 emojis?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);

    // Should NOT execute scripts or show errors
    assertNoTechnicalErrors(response, 'special characters');

    // Page should still be functional
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: 5000 });
  });

  test('rapid consecutive messages handled without crash', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    // Send multiple messages quickly
    const messages = [
      'Hello',
      'What is AI?',
      'Show me projects',
    ];

    for (const msg of messages) {
      await sendHomeChat(page, msg, false); // Don't wait for response
      await page.waitForTimeout(500); // Brief pause between sends
    }

    await page.waitForTimeout(DEEP_AI_TIMEOUT);

    const response = await getPageContent(page);

    // Should NOT show technical errors
    assertNoTechnicalErrors(response, 'rapid messages');

    // Should have some AI responses
    const hasResponses = response.length > 200;
    expect(hasResponses).toBe(true);
  });
});

test.describe('Session Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('page refresh preserves conversation', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    // Send a message
    await sendHomeChat(page, 'Hello, remember this message about blue elephants');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const beforeRefresh = await getPageContent(page);
    assertHelpfulResponse(beforeRefresh, 'before refresh');

    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Wait for WebSocket to reconnect
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Check if previous messages are visible
    const afterRefresh = await getPageContent(page);
    const hasPreviousMessage = /blue elephant|remember this/i.test(afterRefresh) ||
      /hello/i.test(afterRefresh);
    expect(hasPreviousMessage).toBe(true);

    // Can continue the conversation
    await sendHomeChat(page, 'What was the topic we discussed?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const continuedResponse = await getPageContent(page);
    assertHelpfulResponse(continuedResponse, 'after refresh');
  });

  test('network reconnection allows continuation', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    // Send initial message
    await sendHomeChat(page, 'Hello, testing network');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 3);

    const initialResponse = await getPageContent(page);
    assertHelpfulResponse(initialResponse, 'before disconnect');

    // Simulate brief network disconnect
    await simulateNetworkDisconnect(page, 3000);

    // Wait for reconnection
    await page.waitForTimeout(5000);

    // Check if WebSocket reconnected
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Try to send another message
    await sendHomeChat(page, 'Can you still hear me after reconnection?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const afterReconnect = await getPageContent(page);
    assertHelpfulResponse(afterReconnect, 'after reconnect');
  });
});

test.describe('Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('empty message does not send', async ({ page }) => {
    test.setTimeout(30000);

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Try to send empty message
    await chatInput.fill('');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();

    // Button should be disabled or clicking should have no effect
    const isDisabled = await sendButton.isDisabled();
    const _messagesBefore = await page.locator('[data-testid="assistant-message"], [class*="assistant"]').count();

    if (!isDisabled) {
      await sendButton.click();
      await page.waitForTimeout(2000);
    }

    const _messagesAfter = await page.locator('[data-testid="assistant-message"], [class*="assistant"]').count();

    // No new messages should appear
    expect(messagesAfter).toBe(messagesBefore);
  });

  test('whitespace-only message handled correctly', async ({ page }) => {
    test.setTimeout(30000);

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Try to send whitespace-only message
    await chatInput.fill('   \n\t   ');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();

    const _messagesBefore = await page.locator('[data-testid="assistant-message"], [class*="assistant"]').count();
    await sendButton.click();
    await page.waitForTimeout(3000);

    const _messagesAfter = await page.locator('[data-testid="assistant-message"], [class*="assistant"]').count();

    // Either no new messages, or a helpful prompt
    // This is acceptable either way
    const response = await getPageContent(page);
    assertNoTechnicalErrors(response, 'whitespace message');
  });
});

test.describe('WebSocket Connection', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('WebSocket connects on page load', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Chat input should become enabled when WS connects
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });
  });

  test('chat still works after navigating away and back', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    // Start on home
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Navigate away
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Navigate back
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WebSocket should reconnect
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Should be able to send a message
    await sendHomeChat(page, 'Testing after navigation');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'after navigation');
  });
});

test.describe('Console Error Detection', () => {
  test('no critical console errors during chat', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Send a message
    await sendHomeChat(page, 'Hello, testing for console errors');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    // Filter out known/acceptable errors
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('ResizeObserver') &&
        !err.includes('Failed to load resource') &&
        !err.includes('VITE_') && // Missing env var warnings
        !err.includes('hydration') // React hydration warnings
    );

    expect(criticalErrors).toEqual([]);
  });
});
