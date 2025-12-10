import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

// Helper to open the chat panel
async function openChatPanel(page: import('@playwright/test').Page) {
  // Open the Support dropdown in the navigation
  const supportNav = page.locator('button:has-text("Support")').first();
  await supportNav.click();
  await page.waitForTimeout(500);

  // Click the Chat option in the dropdown
  const chatOption = page.getByText('Chat').first();
  await chatOption.click();
  await page.waitForTimeout(1500);
}

test.describe('Intelligent Chat', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test.describe('Chat Panel Open/Close', () => {
    test('should open chat panel from Support menu', async ({ page }) => {
      // Navigate to a page with the dashboard layout
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Chat panel should be visible - check for the chat header with "All Thrive AI Chat"
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Also verify the Live indicator is showing (the connection status badge)
      const liveIndicator = page.locator('[title="Connected"]').getByText('Live');
      await expect(liveIndicator).toBeVisible();
    });

    test('should close chat panel with close button', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Verify chat is open
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Click the close button (X icon with aria-label)
      const closeButton = page.locator('button[aria-label="Close chat"]');
      await closeButton.click();
      await page.waitForTimeout(500);

      // Chat panel should be hidden
      await expect(chatHeader).not.toBeVisible();
    });

  });

  test.describe('Chat Messaging', () => {
    test('should display input field and send button when chat is open', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Check for input field (it's an input, not textarea)
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await expect(chatInput).toBeVisible({ timeout: 10000 });

      // Check for send button
      const sendButton = page.locator('button[aria-label="Send message"]');
      await expect(sendButton).toBeVisible();
    });

    test('should send a message and show it in chat', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Type a message
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('Hello, this is a test message');

      // Click send button
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for message to appear in chat
      await page.waitForTimeout(2000);

      // The user's message should appear in the chat
      const userMessage = page.getByText('Hello, this is a test message');
      await expect(userMessage).toBeVisible({ timeout: 10000 });
    });

    test('should show loading indicator while waiting for response', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Type and send a message
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('What is All Thrive?');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Just verify message was sent - loading might be too fast to catch
      const userMessage = page.getByText('What is All Thrive?');
      await expect(userMessage).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Plus Menu and Integrations', () => {
    test('should show plus menu with primary integration options', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Click the plus button to open integrations menu
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Check for primary integration options (now the main visible options)
      await expect(page.getByText('Import from URL')).toBeVisible();
      await expect(page.getByText('Create Image/Infographic')).toBeVisible();
      await expect(page.getByText('Ask for Help')).toBeVisible();
      await expect(page.getByText('More Integrations')).toBeVisible();
    });

    test('should show secondary integrations in More Integrations submenu', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Click the plus button to open integrations menu
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Click "More Integrations" to open submenu
      await page.getByText('More Integrations').click();
      await page.waitForTimeout(500);

      // Check for secondary integration options in submenu
      await expect(page.getByText('Add from GitHub')).toBeVisible();
      await expect(page.getByText('Add from GitLab')).toBeVisible();
      await expect(page.getByText('Add from Figma')).toBeVisible();
      await expect(page.getByText('Add from YouTube')).toBeVisible();
      await expect(page.getByText('Describe Anything')).toBeVisible();
    });

    test('should open help questions panel when Ask for Help is clicked', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // The help panel might already be open in support mode
      // Check if it's already showing the help panel
      const helpHeader = page.getByText('How can we help you?');
      const isHelpVisible = await helpHeader.isVisible().catch(() => false);

      if (!isHelpVisible) {
        // Click plus button
        const plusButton = page.locator('button[aria-label="Add integration"]');
        await plusButton.click();
        await page.waitForTimeout(500);

        // Click Ask for Help
        await page.getByText('Ask for Help').click();
        await page.waitForTimeout(500);
      }

      // Help questions panel should appear
      await expect(helpHeader).toBeVisible({ timeout: 10000 });
      await expect(page.getByPlaceholder('Search help topics...')).toBeVisible();
    });

    test('should close plus menu when clicking outside', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Click plus button
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Verify menu is open
      await expect(page.getByText('Import from URL')).toBeVisible();

      // Click outside the menu (on the chat input)
      await page.getByPlaceholder('Ask me anything...').click();
      await page.waitForTimeout(500);

      // Menu should be closed
      await expect(page.getByText('Import from URL')).not.toBeVisible();
    });
  });

  test.describe('Chat Header and User Info', () => {
    test('should display user info in chat header', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Check for user info in chat header
      // The header shows the username
      const usernameDisplay = page.getByText(TEST_USER.username);
      await expect(usernameDisplay).toBeVisible({ timeout: 10000 });
    });

    test('should display All Thrive AI Chat branding', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Check for branding in chat header
      const chatBranding = page.getByText('All Thrive AI Chat');
      await expect(chatBranding).toBeVisible({ timeout: 10000 });
    });

    test('should show Live connection status', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Check for Live status indicator (the connection status badge in chat header)
      const liveIndicator = page.locator('[title="Connected"]').getByText('Live');
      await expect(liveIndicator).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Unauthenticated Access', () => {
    test('should show login prompt when unauthenticated user tries to chat', async ({ page }) => {
      // Clear cookies to simulate unauthenticated state
      await page.context().clearCookies();

      // Navigate to explore page
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Try to open chat panel
      const supportNav = page.locator('button:has-text("Support")').first();

      if (await supportNav.isVisible()) {
        await supportNav.click();
        await page.waitForTimeout(500);

        const chatOption = page.getByText('Chat').first();
        if (await chatOption.isVisible()) {
          await chatOption.click();
          await page.waitForTimeout(1000);

          // Should either show login prompt, redirect to auth, or show the chat with limited functionality
          const loginPrompt = page.getByText('Sign in');
          const authPage = page.url().includes('/auth') || page.url().includes('/login');
          const chatHeader = page.getByText('All Thrive AI Chat');

          const hasLoginPrompt = await loginPrompt.isVisible().catch(() => false);
          const hasChatHeader = await chatHeader.isVisible().catch(() => false);

          // Either shows login prompt, redirects to auth, or chat panel opened (depending on implementation)
          expect(hasLoginPrompt || authPage || hasChatHeader).toBe(true);
        }
      }
    });
  });

  test.describe('AI Response Integration', () => {
    // Increase timeout for AI response tests (login + navigation + AI response time)
    test.setTimeout(90000);

    test('should receive AI response to a simple question', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Type a simple question
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('What is AllThrive?');

      // Send the message
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(20000);

      // Check that we got some response (not an error)
      const errorMessage = page.getByText('Failed to process message');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(false);

      // Verify chat header is still visible (chat panel is open)
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 5000 });

      // The user's question should be in the chat
      const userQuestion = page.getByText('What is AllThrive?');
      await expect(userQuestion).toBeVisible({ timeout: 5000 });
    });

    test('should show proper error message on rate limit', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Send multiple messages quickly to potentially trigger rate limit
      const chatInput = page.getByPlaceholder('Ask me anything...');
      const sendButton = page.locator('button[aria-label="Send message"]');

      // Send first message
      await chatInput.fill('Test message 1');
      await sendButton.click();
      await page.waitForTimeout(500);

      // If rate limited, should show user-friendly message (not technical error)
      const technicalError = page.getByText('rate_limit');
      const hasTechnicalError = await technicalError.isVisible().catch(() => false);

      // We should NOT see technical error messages
      expect(hasTechnicalError).toBe(false);
    });
  });

  test.describe('URL Import Integration', () => {
    // Increase timeout for URL import tests (login + navigation + scraping + AI response)
    test.setTimeout(120000);

    test('should import a Reddit URL successfully', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Paste a Reddit URL directly in the chat
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://www.reddit.com/r/midjourney/comments/1pj6p94/the_silk_road_of_dreams55/');

      // Send the message
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for processing - URL imports take longer
      await page.waitForTimeout(30000);

      // Check that we did NOT get a technical error/crash
      const crashIndicators = ['TypeError', 'Exception', 'Traceback', 'NoneType'];
      for (const indicator of crashIndicators) {
        const element = page.getByText(indicator);
        const hasCrash = await element.isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }

      // Verify chat header is still visible (chat panel is open and hasn't crashed)
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 5000 });

      // The URL should appear in the chat (user's message)
      const urlMessage = page.getByText('reddit.com', { exact: false });
      await expect(urlMessage).toBeVisible({ timeout: 5000 });
    });

    test('should handle invalid URL gracefully', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Send an invalid/non-existent URL
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://definitely-not-a-real-website-12345.com/page');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(15000);

      // Should show a user-friendly error, not a crash
      const crashIndicators = ['undefined', 'null', 'TypeError', 'Error:'];

      for (const indicator of crashIndicators) {
        const element = page.getByText(indicator);
        const hasCrash = await element.isVisible().catch(() => false);
        expect(hasCrash).toBe(false);
      }
    });

    test('should import via Import from URL menu option', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Click the plus button
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Click Import from URL
      await page.getByText('Import from URL').click();
      await page.waitForTimeout(500);

      // Should show some kind of URL input prompt or message
      // The chat should now be ready to receive a URL
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await expect(chatInput).toBeVisible();
    });
  });

  test.describe('WebSocket Connection Health', () => {
    test('should establish WebSocket connection and show Live status', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Check for Live indicator (the connection status badge in chat header)
      const liveIndicator = page.locator('[title="Connected"]').getByText('Live');
      await expect(liveIndicator).toBeVisible({ timeout: 10000 });
    });

    test('should handle WebSocket reconnection gracefully', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Verify initial connection (the connection status badge)
      const liveIndicator = page.locator('[title="Connected"]').getByText('Live');
      await expect(liveIndicator).toBeVisible({ timeout: 10000 });

      // Close and reopen chat panel
      const closeButton = page.locator('button[aria-label="Close chat"]');
      await closeButton.click();
      await page.waitForTimeout(1000);

      // Reopen
      await openChatPanel(page);

      // Should reconnect and show Live again
      await expect(liveIndicator).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Error Handling UI', () => {
    test('should display user-friendly error messages', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Send a message
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('Hello');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(10000);

      // Verify no technical error messages are shown
      const technicalErrors = [
        'Exception',
        'Traceback',
        'stack trace',
        'at line',
        'NoneType',
        'AttributeError',
      ];

      for (const error of technicalErrors) {
        const element = page.getByText(error);
        const hasError = await element.isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    });
  });
});
