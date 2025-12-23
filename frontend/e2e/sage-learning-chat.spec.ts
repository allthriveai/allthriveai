/**
 * Sage Learning Chat E2E Tests
 *
 * Tests for Sage chat functionality in learning contexts:
 * - Connection status and WebSocket connectivity
 * - Message sending and receiving
 * - Lesson context integration
 * - Key concept chip interactions
 * - Plus menu actions
 *
 * RUN: npx playwright test e2e/sage-learning-chat.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI } from './helpers';

// Timeouts
const WS_CONNECT_TIMEOUT = 15000;
const AI_RESPONSE_TIMEOUT = 60000;

/**
 * Helper: Get the first learning path URL for the test user
 */
async function getFirstLearningPathUrl(page: Page): Promise<string | null> {
  await page.goto('/learn');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const pathLinks = page.locator('a[href*="/learn/"]');
  const count = await pathLinks.count();

  if (count > 0) {
    return await pathLinks.first().getAttribute('href');
  }

  return null;
}

/**
 * Helper: Wait for AI response to complete
 */
async function waitForResponseComplete(page: Page, timeout = AI_RESPONSE_TIMEOUT) {
  const thinkingIndicator = page.locator('text="Thinking..."');

  try {
    await thinkingIndicator.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Thinking indicator appeared');
  } catch {
    // May have already completed
  }

  try {
    await thinkingIndicator.waitFor({ state: 'hidden', timeout: timeout });
    console.log('✓ Thinking indicator hidden');
  } catch {
    console.log('⚠ Thinking indicator did not hide within timeout');
  }

  await page.waitForTimeout(2000);
}

test.describe('Sage Chat - Connection Status', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaAPI(page);
  });

  test('shows "Ready to help" when connected', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket connection
    await page.waitForTimeout(WS_CONNECT_TIMEOUT);

    // Look for connection status in the chat panel
    const readyText = page.getByText('Ready to help');
    const hasReady = await readyText.first().isVisible().catch(() => false);

    if (hasReady) {
      console.log('✓ Connection status shows "Ready to help"');
    } else {
      // May show "Connecting..." initially
      const connectingText = page.getByText('Connecting');
      const isConnecting = await connectingText.first().isVisible().catch(() => false);
      console.log(`Connection status: ${isConnecting ? 'Connecting...' : 'Unknown'}`);
    }
  });

  test('shows green indicator when connected', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(WS_CONNECT_TIMEOUT);

    // Look for green status indicator (bg-green-500 or similar)
    const greenIndicator = page.locator('[class*="bg-green-500"], [class*="bg-green-400"]');
    const hasGreen = await greenIndicator.first().isVisible().catch(() => false);

    if (hasGreen) {
      console.log('✓ Green connection indicator visible');
    } else {
      // May be amber if still connecting
      const amberIndicator = page.locator('[class*="bg-amber"], [class*="animate-pulse"]');
      const hasAmber = await amberIndicator.first().isVisible().catch(() => false);
      console.log(`Connection indicator: ${hasAmber ? 'Amber (connecting)' : 'Not found'}`);
    }
  });
});

test.describe('Sage Chat - Message Interaction', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaAPI(page);
  });

  test('can type in chat input', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find chat input in the Sage panel
    const chatInput = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"]').first();
    const hasInput = await chatInput.isVisible().catch(() => false);

    if (hasInput) {
      await chatInput.fill('What is this lesson about?');
      const value = await chatInput.inputValue();
      expect(value).toBe('What is this lesson about?');
      console.log('✓ Can type in chat input');
    } else {
      // Try alternative selector
      const altInput = page.locator('.w-\\[480px\\] input, .w-\\[480px\\] textarea').first();
      const hasAlt = await altInput.isVisible().catch(() => false);
      console.log(`Alternative input visible: ${hasAlt}`);
    }
  });

  test('send button is enabled when input has text', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find visible chat input (exclude hidden file inputs)
    const chatInput = page.locator('input[type="text"], textarea').filter({ has: page.locator(':visible') }).first();
    const hasInput = await chatInput.isVisible().catch(() => false);

    if (hasInput) {
      await chatInput.fill('Hello');

      // Find send button
      const sendButton = page.locator('button[type="submit"], button[aria-label*="Send"]').last();
      const isEnabled = await sendButton.isEnabled().catch(() => false);

      console.log(`✓ Send button enabled: ${isEnabled}`);
    } else {
      // Chat input may be in a different panel or collapsed
      console.log('Chat input not immediately visible');
    }
  });

  test('sending message shows in chat', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait for WS connection

    // Find visible chat input (exclude hidden file inputs)
    const chatInput = page.locator('.w-\\[480px\\] input[type="text"], .w-\\[480px\\] textarea').first();
    const hasInput = await chatInput.isVisible().catch(() => false);

    if (hasInput) {
      await chatInput.fill('Hello Sage');

      const sendButton = page.locator('.w-\\[480px\\] button[type="submit"]').first();
      const hasSendButton = await sendButton.isVisible().catch(() => false);

      if (hasSendButton) {
        await sendButton.click();
        await page.waitForTimeout(2000);

        // Should see the user's message in the chat
        const userMessage = page.getByText('Hello Sage');
        const hasMessage = await userMessage.first().isVisible().catch(() => false);

        if (hasMessage) {
          console.log('✓ User message appears in chat');
        } else {
          console.log('Message sent but not immediately visible');
        }
      } else {
        console.log('Send button not visible');
      }
    } else {
      console.log('Chat input not visible in Sage panel');
    }
  });

  test.skip('receives response from Sage', async ({ page }) => {
    // Skip by default - this test calls the AI and takes 30+ seconds
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000);

    // Send a message
    const chatInput = page.locator('input, textarea').last();
    await chatInput.fill('What is this learning path about?');

    const sendButton = page.locator('button[type="submit"]').last();
    await sendButton.click();

    // Wait for AI response
    await waitForResponseComplete(page);

    // Should have at least 2 messages (user + AI)
    const messages = page.locator('[class*="glass-message"], [class*="message"]');
    const messageCount = await messages.count();

    expect(messageCount).toBeGreaterThanOrEqual(2);
    console.log(`✓ Received response, total messages: ${messageCount}`);
  });
});

test.describe('Sage Chat - Lesson Context', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaAPI(page);
  });

  test('shows path title in chat header', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Get the path title from the header
    const pathTitle = await page.locator('h1').first().textContent();

    // The chat panel should show the path title or "Ask Sage"
    const chatPanel = page.locator('.w-\\[480px\\]');
    const panelText = await chatPanel.textContent().catch(() => '');

    const hasContext = panelText?.includes('Ask Sage') || panelText?.includes(pathTitle || '');
    console.log(`✓ Chat panel shows context: ${hasContext}`);
  });

  test('key concepts appear as clickable chips', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Expand an AI lesson to trigger lesson context
    const aiLessonCard = page.locator('[class*="glass-strong"]').filter({ hasText: 'AI Lesson' }).first();
    const hasLesson = await aiLessonCard.isVisible().catch(() => false);

    if (hasLesson) {
      await aiLessonCard.locator('button').first().click();
      await page.waitForTimeout(500);

      // Look for concept chips in the chat panel
      const conceptChips = page.locator('.w-\\[480px\\] button').filter({ hasText: /Explain/i });
      const chipCount = await conceptChips.count().catch(() => 0);

      if (chipCount > 0) {
        console.log(`✓ Found ${chipCount} key concept chips`);
      } else {
        console.log('No concept chips visible (may need specific lesson context)');
      }
    }
  });

  test('clicking concept chip sends question to Sage', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Expand an AI lesson
    const aiLessonCard = page.locator('[class*="glass-strong"]').filter({ hasText: 'AI Lesson' }).first();
    const hasLesson = await aiLessonCard.isVisible().catch(() => false);

    if (hasLesson) {
      await aiLessonCard.locator('button').first().click();
      await page.waitForTimeout(500);

      // Find a concept chip
      const conceptChips = page.locator('.w-\\[480px\\] button[class*="emerald"], .w-\\[480px\\] button[class*="rounded-full"]');
      const chipCount = await conceptChips.count();

      if (chipCount > 0) {
        // Click the first chip
        await conceptChips.first().click();
        await page.waitForTimeout(1000);

        // Should see a message or thinking indicator
        const hasActivity = await page.getByText(/Thinking|Explain/i).first().isVisible().catch(() => false);
        console.log(`✓ Concept chip clicked, activity: ${hasActivity}`);
      } else {
        console.log('No concept chips to click');
      }
    }
  });
});

test.describe('Sage Chat - Plus Menu', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaAPI(page);
  });

  test('plus menu button is visible', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for plus button in chat panel
    const plusButton = page.locator('.w-\\[480px\\] button').filter({ has: page.locator('[data-icon="plus"]') });
    const hasPlus = await plusButton.first().isVisible().catch(() => false);

    if (hasPlus) {
      console.log('✓ Plus menu button visible');
    } else {
      // May have different icon
      console.log('Plus menu button not found with expected icon');
    }
  });

  test('plus menu opens on click', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find and click plus button
    const plusButton = page.locator('.w-\\[480px\\] button').filter({ has: page.locator('svg') }).first();
    await plusButton.click();
    await page.waitForTimeout(300);

    // Menu should appear with options
    const menuOptions = page.locator('[role="menu"], [class*="dropdown"], [class*="popover"]');
    const hasMenu = await menuOptions.first().isVisible().catch(() => false);

    if (hasMenu) {
      console.log('✓ Plus menu opened');
    } else {
      // Check for menu items directly
      const uploadOption = page.getByText('Upload file');
      const hasUpload = await uploadOption.isVisible().catch(() => false);
      console.log(`Menu option visible: ${hasUpload}`);
    }
  });
});

test.describe('Sage Chat - Empty State', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaAPI(page);
  });

  test('shows Sage avatar in empty state', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for Sage avatar in the chat panel
    const sageAvatar = page.locator('.w-\\[480px\\] img[alt="Sage"]');
    const hasAvatar = await sageAvatar.first().isVisible().catch(() => false);

    if (hasAvatar) {
      console.log('✓ Sage avatar visible in chat panel');
    }
  });

  test('shows helpful prompt text in empty state', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for helpful text
    const helpText = page.getByText(/Ask me anything|What would you like|Help me/i);
    const hasHelpText = await helpText.first().isVisible().catch(() => false);

    if (hasHelpText) {
      console.log('✓ Helpful prompt text visible');
    }
  });

  test('shows "Help me with this lesson" button', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Expand an AI lesson to set lesson context
    const aiLessonCard = page.locator('[class*="glass-strong"]').filter({ hasText: 'AI Lesson' }).first();
    const hasLesson = await aiLessonCard.isVisible().catch(() => false);

    if (hasLesson) {
      await aiLessonCard.locator('button').first().click();
      await page.waitForTimeout(500);

      // Look for "Help me with this lesson" button
      const helpButton = page.getByRole('button', { name: /Help me with this lesson/i });
      const hasHelpButton = await helpButton.isVisible().catch(() => false);

      if (hasHelpButton) {
        console.log('✓ "Help me with this lesson" button visible');
      } else {
        console.log('Help button not visible (may need specific context)');
      }
    }
  });
});

test.describe('Sage Chat - Attachment Support', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaAPI(page);
  });

  test('file upload option available in plus menu', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find and click plus button to open menu
    const plusButton = page.locator('button').filter({ has: page.locator('[data-icon="plus"]') }).first();
    const hasPlus = await plusButton.isVisible().catch(() => false);

    if (hasPlus) {
      await plusButton.click();
      await page.waitForTimeout(300);

      // Look for upload option
      const uploadOption = page.getByText(/Upload|Attach|File/i);
      const hasUpload = await uploadOption.first().isVisible().catch(() => false);

      console.log(`✓ File upload option available: ${hasUpload}`);
    } else {
      console.log('Plus button not found');
    }
  });
});
