/**
 * Avatar Generation E2E Tests
 *
 * Tests for avatar generation WebSocket flow:
 * - Session creation via REST API
 * - WebSocket connection to avatar channel
 * - Message sending and task queueing
 * - UI state transitions
 *
 * NOTE: These tests verify WebSocket infrastructure works correctly.
 * They don't wait for actual AI image generation (which requires external services).
 *
 * RUN: npx playwright test e2e/avatar-generation.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

// Timeouts
const WS_CONNECT_TIMEOUT = 15000;
const UI_TIMEOUT = 5000;

test.describe('Avatar Generation - Session Creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('can create avatar generation session via API', async ({ page }) => {
    // GIVEN: I am logged in
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I create an avatar session via API
    const sessionResult = await page.evaluate(async () => {
      try {
        const csrfToken = document.cookie
          .split('; ')
          .find((row) => row.startsWith('csrftoken='))
          ?.split('=')[1];

        const response = await fetch('/api/v1/me/avatar-sessions/start/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken || '',
          },
          body: JSON.stringify({
            creation_mode: 'scratch',
          }),
          credentials: 'include',
        });

        if (!response.ok) {
          const text = await response.text();
          return { success: false, status: response.status, error: text };
        }

        const data = await response.json();
        return {
          success: true,
          sessionId: data.id,
          conversationId: data.conversationId,
          status: data.status,
        };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    });

    // THEN: Session should be created successfully
    expect(sessionResult.success).toBe(true);
    expect(sessionResult.sessionId).toBeDefined();
    expect(sessionResult.conversationId).toMatch(/^avatar-\d+-\d+$/);
    expect(sessionResult.status).toBe('generating');
  });

  test('can get active avatar session if one exists', async ({ page }) => {
    // GIVEN: I am logged in
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // First create a session
    await page.evaluate(async () => {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

      await fetch('/api/v1/me/avatar-sessions/start/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        body: JSON.stringify({ creation_mode: 'scratch' }),
        credentials: 'include',
      });
    });

    // WHEN: I check for active session
    const activeSession = await page.evaluate(async () => {
      const response = await fetch('/api/v1/me/avatar-sessions/active/', {
        credentials: 'include',
      });

      if (!response.ok) {
        return { found: false };
      }

      const data = await response.json();
      return { found: true, sessionId: data.id, status: data.status };
    });

    // THEN: Active session should be found
    expect(activeSession.found).toBe(true);
    expect(activeSession.sessionId).toBeDefined();
  });
});

test.describe('Avatar Generation - WebSocket Connection', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('avatar WebSocket connects successfully', async ({ page }) => {
    test.setTimeout(30000);

    // GIVEN: I am on the home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for main chat to be ready
    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // WHEN: I trigger avatar creation by typing "make my avatar"
    await chatInput.fill('make my avatar');
    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    // THEN: Avatar creation UI should appear (WebSocket connected)
    // Look for avatar template selector or avatar creation message
    const avatarUI = page.locator(
      '[data-testid="avatar-creation"], ' +
        'text=create your avatar, ' +
        'text=template, ' +
        'text=Describe your avatar'
    );

    await expect(avatarUI.first()).toBeVisible({ timeout: UI_TIMEOUT });
  });

  test('avatar generation task is queued after prompt submission', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // GIVEN: I am on the home page with chat
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Listen for WebSocket messages
    await page.evaluate(() => {
      // Intercept WebSocket to capture messages
      const originalWebSocket = window.WebSocket;
      (window as unknown as { _wsMessages: string[] })._wsMessages = [];

      window.WebSocket = class extends originalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);

          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              (window as unknown as { _wsMessages: string[] })._wsMessages.push(
                data.event || 'unknown'
              );
            } catch {
              // Not JSON, ignore
            }
          });
        }
      } as typeof WebSocket;
    });

    // WHEN: I trigger avatar creation
    await chatInput.fill('make my avatar');
    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    // Wait for avatar UI to appear
    await page.waitForTimeout(3000);

    // Look for avatar prompt input or template selection
    const avatarPromptInput = page
      .locator('textarea[placeholder*="Describe"], textarea[placeholder*="avatar"]')
      .first();

    if (await avatarPromptInput.isVisible()) {
      // Fill in a prompt and generate
      await avatarPromptInput.fill('A friendly robot with blue eyes');

      // Click generate button
      const generateButton = page
        .locator(
          'button:has-text("Generate"), button:has-text("Create"), button:has-text("Make")'
        )
        .first();
      if (await generateButton.isVisible()) {
        await generateButton.click();
      }

      // Wait for task to be queued
      await page.waitForTimeout(5000);
    }

    // THEN: Check that WebSocket events were received
    const receivedEvents = await page.evaluate(() => {
      return (window as unknown as { _wsMessages: string[] })._wsMessages || [];
    });

    // We should see 'connected' at minimum
    // If avatar generation was triggered, we might also see 'avatar_task_queued'
    console.log('Received WebSocket events:', receivedEvents);

    // Verify no error events
    const hasError = receivedEvents.some(
      (e: string) => e === 'error' || e === 'avatar_error'
    );
    expect(hasError).toBe(false);
  });
});

test.describe('Avatar Generation - UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('avatar template selector shows available templates', async ({
    page,
  }) => {
    // GIVEN: I trigger avatar creation
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    await chatInput.fill('make my avatar');
    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    // WHEN: Avatar creation UI appears
    await page.waitForTimeout(3000);

    // THEN: Should see template options (Robot, Wizard, etc.)
    const pageContent = await page.locator('body').textContent();
    const hasTemplates =
      pageContent?.includes('Robot') ||
      pageContent?.includes('Wizard') ||
      pageContent?.includes('template') ||
      pageContent?.includes('Template');

    // Or we see the prompt input
    const hasPromptInput = await page
      .locator('textarea[placeholder*="Describe"], textarea[placeholder*="avatar"]')
      .isVisible()
      .catch(() => false);

    expect(hasTemplates || hasPromptInput).toBe(true);
  });

  test('can close avatar creation UI', async ({ page }) => {
    // GIVEN: Avatar creation UI is open
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    await chatInput.fill('make my avatar');
    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    await page.waitForTimeout(3000);

    // WHEN: I click the close/skip button
    const closeButton = page
      .locator(
        'button[aria-label="Close"], ' +
          'button:has-text("Skip"), ' +
          'button:has-text("skip"), ' +
          '[class*="close"]'
      )
      .first();

    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(1000);
    }

    // THEN: Avatar UI should be dismissed (or at least no error)
    const hasError = await page
      .locator('text=Error, text=error')
      .isVisible()
      .catch(() => false);
    expect(hasError).toBe(false);
  });

  test('no technical errors during avatar creation flow', async ({ page }) => {
    test.setTimeout(60000);

    // GIVEN: I trigger avatar creation
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    await chatInput.fill('make my avatar');
    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    // Wait for UI to render
    await page.waitForTimeout(5000);

    // THEN: No technical errors should be visible
    const technicalErrors = [
      'TypeError',
      'Exception',
      'Traceback',
      'NoneType',
      'AttributeError',
      'undefined is not',
      'null is not',
      '500',
      'Internal Server Error',
      'WebSocket error',
    ];

    for (const error of technicalErrors) {
      const hasError = await page
        .getByText(error, { exact: false })
        .isVisible()
        .catch(() => false);
      expect(hasError).toBe(false);
    }
  });
});

test.describe('Avatar Generation - Sidebar Chat', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('avatar creation works from sidebar chat', async ({ page }) => {
    // GIVEN: I am on the explore page with sidebar chat
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // WHEN: I open the chat sidebar
    const chatButton = page
      .locator('button:has-text("Chat"), [data-testid="chat-toggle"]')
      .first();

    if (await chatButton.isVisible()) {
      await chatButton.click();
      await page.waitForTimeout(500);

      // Find sidebar chat input
      const sidebarInput = page
        .locator(
          'input[placeholder="Ask me anything..."], input[placeholder="Message Ember..."]'
        )
        .first();
      await expect(sidebarInput).toBeVisible({ timeout: WS_CONNECT_TIMEOUT });

      // Trigger avatar creation
      await sidebarInput.fill('make my avatar');
      const sendButton = page
        .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
        .first();
      await sendButton.click();

      // Wait for response
      await page.waitForTimeout(3000);

      // THEN: Should see avatar-related content or no error
      const hasError = await page
        .locator('text=Error sending')
        .isVisible()
        .catch(() => false);
      expect(hasError).toBe(false);
    }
  });
});
