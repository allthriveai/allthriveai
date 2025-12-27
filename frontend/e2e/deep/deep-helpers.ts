/**
 * Deep E2E Test Helpers
 *
 * Utility functions for deep E2E tests with extended timeouts
 * and specialized functionality for AI, WebSocket, and multi-user testing.
 */

import { Page, Browser, BrowserContext, expect } from '@playwright/test';

// ============================================================================
// TIMEOUTS - Extended for AI operations
// ============================================================================

export const DEEP_AI_TIMEOUT = 120000; // 2 minutes for AI responses
export const MULTI_TURN_TIMEOUT = 300000; // 5 minutes for multi-turn conversations
export const WS_CONNECT_TIMEOUT = 15000; // 15 seconds for WebSocket connection
export const BATTLE_PHASE_TIMEOUT = 180000; // 3 minutes for battle phases
export const COMMUNITY_MSG_TIMEOUT = 10000; // 10 seconds for community messages

// ============================================================================
// SECOND TEST USER - For multi-user tests (community, battles)
// ============================================================================

export const TEST_USER_2 = {
  username: process.env.TEST_USER2_USERNAME || 'e2e-test-user-2',
  email: process.env.TEST_USER2_EMAIL || 'e2e-test2@example.com',
  password: process.env.TEST_USER2_PASSWORD || 'e2eTestPassword456',
};

// ============================================================================
// CHAT HELPERS
// ============================================================================

/**
 * Send a message in the home chat (/home)
 */
export async function sendHomeChat(
  page: Page,
  message: string,
  waitForResponse = true
): Promise<void> {
  const chatInput = page.locator('input[placeholder="Message Ava..."]');
  await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

  await chatInput.fill(message);
  const sendButton = page
    .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
    .first();
  await sendButton.click();

  if (waitForResponse) {
    // Wait for "Thinking..." to appear and disappear
    await page.waitForTimeout(2000); // Initial delay for message to be sent
  }
}

/**
 * Send a message via sidebar chat (on non-home pages)
 */
export async function sendSidebarChat(
  page: Page,
  message: string,
  waitForResponse = true
): Promise<void> {
  // Check if sidebar is already open by looking for the input
  const chatInput = page
    .locator('input[placeholder*="Message"], input[placeholder*="Ask"], input.input-glass')
    .first();

  // If input is not visible, we need to open the sidebar
  const inputVisible = await chatInput.isVisible().catch(() => false);

  if (!inputVisible) {
    // Click the chat button to open sidebar
    const chatButton = page.locator('button[aria-label="Open chat"]').first();

    if (await chatButton.isVisible()) {
      await chatButton.click();
      await page.waitForTimeout(1500); // Wait for sidebar animation
    }
  }

  // Wait for chat input to be ready
  await expect(chatInput).toBeVisible({ timeout: WS_CONNECT_TIMEOUT });
  await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

  // Focus and type message
  await chatInput.click();
  await chatInput.fill(message);

  // Press Enter to send (more reliable than clicking button through overlay)
  await chatInput.press('Enter');

  if (waitForResponse) {
    await page.waitForTimeout(2000);
  }
}

/**
 * Get the text of the last AI response only (excludes user messages)
 */
export async function getLastAIResponse(page: Page): Promise<string> {
  // AI messages typically have specific classes or data attributes
  const aiMessages = page.locator(
    '[data-testid="assistant-message"], [class*="assistant"], .prose-invert'
  );

  const count = await aiMessages.count();
  if (count === 0) {
    return '';
  }

  const lastMessage = aiMessages.nth(count - 1);
  return (await lastMessage.textContent()) || '';
}

/**
 * Wait for AI response to complete (streaming finished)
 */
export async function waitForAIResponse(
  page: Page,
  timeout = DEEP_AI_TIMEOUT
): Promise<string> {
  const startTime = Date.now();
  let lastContent = '';
  let stableCount = 0;

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(1000);

    const currentContent = await getLastAIResponse(page);

    // Content is stable if it hasn't changed in 3 checks
    if (currentContent === lastContent && currentContent.length > 20) {
      stableCount++;
      if (stableCount >= 3) {
        return currentContent;
      }
    } else {
      stableCount = 0;
      lastContent = currentContent;
    }

    // Check for thinking indicator gone
    const thinking = page.locator('text=/thinking|processing/i');
    if ((await thinking.count()) === 0 && currentContent.length > 20) {
      await page.waitForTimeout(1000); // Extra stability wait
      return await getLastAIResponse(page);
    }
  }

  throw new Error(`AI response timeout after ${timeout}ms`);
}

/**
 * Wait for Ava to finish responding (input becomes enabled again).
 * Use this between multi-turn messages to ensure Ava has finished processing.
 */
export async function waitForAvaReady(
  page: Page,
  timeout = DEEP_AI_TIMEOUT
): Promise<void> {
  const chatInput = page.locator('input[placeholder="Message Ava..."]');
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Check if input is enabled
    const isEnabled = await chatInput.isEnabled().catch(() => false);
    if (isEnabled) {
      // Double-check by waiting a bit and confirming still enabled
      await page.waitForTimeout(500);
      const stillEnabled = await chatInput.isEnabled().catch(() => false);
      if (stillEnabled) {
        return;
      }
    }

    // Log what we're waiting for
    const pageContent = await getPageContent(page);
    const isThinking =
      pageContent.includes('Thinking') ||
      pageContent.includes('Consulting my') ||
      pageContent.includes('Finding the way') ||
      pageContent.includes('treasure trove');

    if (isThinking) {
      console.log(`Waiting for Ava to finish... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Ava did not become ready within ${timeout}ms`);
}

/**
 * Get the full page content for broad assertions
 */
export async function getPageContent(page: Page): Promise<string> {
  return (await page.locator('body').textContent()) || '';
}

// ============================================================================
// BATTLE HELPERS
// ============================================================================

export type BattlePhase =
  | 'waiting'
  | 'countdown'
  | 'active'
  | 'generating'
  | 'judging'
  | 'reveal'
  | 'complete';

/**
 * Create a Pip battle and join
 */
export async function createPipBattleAndJoin(
  page: Page
): Promise<{ battleId: string }> {
  await page.goto('/play/prompt-battles');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click "Battle Pip" or similar button
  const pipButton = page.locator('button:has-text("Pip"), button:has-text("AI Opponent")').first();
  await expect(pipButton).toBeVisible({ timeout: 10000 });
  await pipButton.click();

  // Wait for battle to be created and navigated
  await page.waitForURL(/\/play\/prompt-battles\/\d+/, { timeout: 30000 });

  const url = page.url();
  const battleId = url.match(/\/prompt-battles\/(\d+)/)?.[1] || '';

  return { battleId };
}

/**
 * Wait for a specific battle phase
 */
export async function waitForBattlePhase(
  page: Page,
  phase: BattlePhase,
  timeout = BATTLE_PHASE_TIMEOUT
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const pageContent = await getPageContent(page);
    const _lowerContent = pageContent.toLowerCase();

    // Check for phase indicators in the UI
    const phaseIndicators: Record<BattlePhase, RegExp[]> = {
      waiting: [/waiting|finding opponent|matching/i],
      countdown: [/countdown|get ready|starting in/i],
      active: [/write your prompt|enter.*prompt|your turn/i],
      generating: [/generating|creating.*image|processing/i],
      judging: [/judging|evaluating|ai.*reviewing/i],
      reveal: [/reveal|winner|results|score/i],
      complete: [/complete|finished|battle.*over|final/i],
    };

    const patterns = phaseIndicators[phase];
    if (patterns.some((p) => p.test(pageContent))) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Battle phase "${phase}" not reached within ${timeout}ms`);
}

/**
 * Submit a prompt in an active battle
 */
export async function submitBattlePrompt(
  page: Page,
  promptText: string
): Promise<void> {
  const promptInput = page.locator(
    'textarea[placeholder*="prompt"], input[placeholder*="prompt"]'
  );
  await expect(promptInput).toBeVisible({ timeout: 10000 });

  await promptInput.fill(promptText);

  const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();
  await submitButton.click();
}

/**
 * Wait for AI image generation to complete
 */
export async function waitForAIImageGeneration(
  page: Page,
  timeout = 90000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Look for generated image
    const image = page.locator('img[src*="cdn"], img[src*="s3"], img[alt*="generated"]');
    if ((await image.count()) > 0) {
      const src = await image.first().getAttribute('src');
      if (src) return src;
    }

    await page.waitForTimeout(2000);
  }

  throw new Error(`AI image generation timeout after ${timeout}ms`);
}

// ============================================================================
// COMMUNITY HELPERS
// ============================================================================

/**
 * Join a community room by slug
 */
export async function joinCommunityRoom(
  page: Page,
  roomSlug: string
): Promise<void> {
  await page.goto(`/lounge/${roomSlug}`);
  await page.waitForLoadState('domcontentloaded');

  // Wait for room to load and WebSocket to connect
  const messageInput = page.locator(
    'input[placeholder*="message"], textarea[placeholder*="message"]'
  );
  await expect(messageInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });
}

/**
 * Send a message in a community room
 */
export async function sendCommunityMessage(
  page: Page,
  content: string
): Promise<void> {
  const messageInput = page.locator(
    'input[placeholder*="message"], textarea[placeholder*="message"]'
  );
  await messageInput.fill(content);

  const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]').first();
  await sendButton.click();
}

/**
 * Wait for a specific message to appear
 */
export async function waitForCommunityMessage(
  page: Page,
  content: string,
  timeout = COMMUNITY_MSG_TIMEOUT
): Promise<void> {
  await page.waitForSelector(`text="${content}"`, { timeout });
}

/**
 * Get list of online users in room
 */
export async function getOnlineUsers(page: Page): Promise<string[]> {
  const onlineList = page.locator('[data-testid="online-users"], [class*="online"]');

  if ((await onlineList.count()) === 0) {
    return [];
  }

  const text = await onlineList.textContent();
  // Parse usernames from the list (implementation depends on UI)
  return text?.split(',').map((u) => u.trim()) || [];
}

/**
 * Check if typing indicator is visible
 */
export async function isTypingIndicatorVisible(page: Page): Promise<boolean> {
  const typing = page.locator('[data-testid="typing-indicator"], text=/typing/i');
  return (await typing.count()) > 0;
}

// ============================================================================
// LEARNING PATH HELPERS
// ============================================================================

/**
 * Navigate to a learning path
 */
export async function goToLearningPath(
  page: Page,
  topic: string
): Promise<void> {
  await page.goto(`/learn`);
  await page.waitForLoadState('domcontentloaded');

  // Click on the topic
  const topicCard = page.locator(`[data-testid="topic-${topic}"], text="${topic}"`).first();
  if (await topicCard.isVisible()) {
    await topicCard.click();
    await page.waitForLoadState('domcontentloaded');
  }
}

/**
 * Get current skill level for a topic
 */
export async function getCurrentSkillLevel(page: Page): Promise<string> {
  const badge = page.locator(
    '[data-testid="skill-level-badge"], [class*="skill-level"], [class*="badge"]'
  );

  if ((await badge.count()) === 0) {
    return 'beginner';
  }

  const text = (await badge.first().textContent()) || '';
  return text.toLowerCase().trim();
}

/**
 * Get current points for a topic
 */
export async function getTopicPoints(page: Page): Promise<number> {
  const points = page.locator('[data-testid="topic-points"], [class*="points"]');

  if ((await points.count()) === 0) {
    return 0;
  }

  const text = (await points.first().textContent()) || '0';
  return parseInt(text.replace(/\D/g, ''), 10) || 0;
}

// ============================================================================
// NETWORK SIMULATION
// ============================================================================

/**
 * Simulate network disconnect for a duration
 */
export async function simulateNetworkDisconnect(
  page: Page,
  durationMs: number
): Promise<void> {
  await page.context().setOffline(true);
  await page.waitForTimeout(durationMs);
  await page.context().setOffline(false);
}

// ============================================================================
// MULTI-USER HELPERS
// ============================================================================

/**
 * Create a second browser context for multi-user tests
 */
export async function createSecondBrowserContext(
  browser: Browser
): Promise<BrowserContext> {
  return browser.newContext();
}

/**
 * Login as the second test user
 */
export async function loginAsSecondUser(page: Page): Promise<void> {
  // Go to any page to establish context
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Login using fetch from within the page context
  const loginResult = await page.evaluate(
    async ({ email, password }) => {
      try {
        const csrfToken = document.cookie
          .split('; ')
          .find((row) => row.startsWith('csrftoken='))
          ?.split('=')[1];

        const response = await fetch('/api/v1/auth/test-login/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken || '',
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });

        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `${response.status}: ${text}` };
        }

        const data = await response.json();
        return {
          success: true,
          username: data.data?.username,
          userId: data.data?.id,
        };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
    { email: TEST_USER_2.email, password: TEST_USER_2.password }
  );

  if (!loginResult.success) {
    throw new Error(`Second user login failed: ${loginResult.error}`);
  }

  console.log(`✓ Logged in as second user: ${loginResult.username}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

// ============================================================================
// WEBSOCKET MONITORING
// ============================================================================

interface WSEventCapture {
  events: Array<{ type: string; data: unknown; timestamp: number }>;
}

/**
 * Start capturing WebSocket events
 */
export async function startWSEventCapture(page: Page): Promise<WSEventCapture> {
  const capture: WSEventCapture = { events: [] };

  // Use CDP to monitor WebSocket frames
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');

  client.on('Network.webSocketFrameReceived', (params) => {
    try {
      const data = JSON.parse(params.response.payloadData);
      capture.events.push({
        type: data.type || data.event || 'unknown',
        data,
        timestamp: Date.now(),
      });
    } catch {
      // Ignore non-JSON frames
    }
  });

  return capture;
}

/**
 * Check if a specific event was received
 */
export function hasWSEvent(capture: WSEventCapture, eventType: string): boolean {
  return capture.events.some((e) => e.type === eventType);
}

/**
 * Wait for a specific WebSocket event
 */
export async function waitForWSEvent(
  capture: WSEventCapture,
  eventType: string,
  timeout = 10000
): Promise<unknown> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const event = capture.events.find((e) => e.type === eventType);
    if (event) {
      return event.data;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`WebSocket event "${eventType}" not received within ${timeout}ms`);
}

// Re-export from helpers for convenience
export { TEST_USER, ADMIN_USER, loginViaAPI } from '../helpers';
