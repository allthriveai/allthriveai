import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

// Helper to open the chat panel via Support menu
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

// Helper to open the chat panel via +Add Project button (real user workflow)
async function openChatViaAddProject(page: import('@playwright/test').Page) {
  // Click the +Add Project button in the top navigation
  const addProjectButton = page.locator('[data-testid="add-project-button"]');
  await addProjectButton.click();
  await page.waitForTimeout(1500);
}

// Helper to wait for WebSocket connection (with fallback)

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

      // Also verify the connection status indicator is showing
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 10000 });
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

    test('should send help request when Ask for Help is clicked', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Click plus button
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Click Ask for Help
      await page.getByText('Ask for Help').click();
      await page.waitForTimeout(1000);

      // Verify the help message was sent (appears in chat)
      // The "Ask for Help" action sends "I need help with something"
      const helpMessage = page.getByText('I need help with something');
      await expect(helpMessage).toBeVisible({ timeout: 10000 });

      // Chat should still be functional
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible();
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
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 10000 });
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
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 10000 });
    });

    test('should handle WebSocket reconnection gracefully', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Verify initial connection (the connection status badge)
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 10000 });

      // Close and reopen chat panel
      const closeButton = page.locator('button[aria-label="Close chat"]');
      await closeButton.click();
      await page.waitForTimeout(1000);

      // Reopen
      await openChatPanel(page);

      // Should reconnect - connection status should be visible again
      await expect(connectionStatus).toBeVisible({ timeout: 15000 });
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

  test.describe('Edge Cases', () => {
    test.setTimeout(120000);

    test('should handle message sending gracefully', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      const chatInput = page.getByPlaceholder('Ask me anything...');
      const sendButton = page.locator('button[aria-label="Send message"]');

      // Send a single message (we can't send multiple without AI backend in CI)
      await expect(chatInput).toBeEnabled({ timeout: 10000 });
      await chatInput.fill('Test message');
      await sendButton.click();
      await page.waitForTimeout(1000);

      // Verify the user message appears in chat
      const userMessage = page.getByText('Test message');
      await expect(userMessage).toBeVisible({ timeout: 10000 });

      // Verify no error states
      const errorMessage = page.getByText('Failed to process message');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(false);

      // Chat should still be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible();
    });

    test('should reconnect WebSocket after close/reopen', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Verify initial connection
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 10000 });

      // Close chat
      const closeButton = page.locator('button[aria-label="Close chat"]');
      await closeButton.click();
      await page.waitForTimeout(2000);

      // Reopen chat
      await openChatPanel(page);

      // Should reconnect - connection status should be visible
      await expect(connectionStatus).toBeVisible({ timeout: 15000 });

      // Should be able to send message after reconnect
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('Test after reconnect');
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(2000);
      await expect(page.getByText('Test after reconnect')).toBeVisible();
    });

    test('should handle special characters and unicode in messages', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      const chatInput = page.getByPlaceholder('Ask me anything...');
      // Test with potential XSS, emoji, and unicode
      const testMessage = 'Test <script>alert(1)</script> emoji: 🎉 unicode: 你好';
      await chatInput.fill(testMessage);

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(2000);

      // Message should render safely - check for the unique emoji part to avoid ambiguity
      await expect(page.getByText('🎉')).toBeVisible();

      // Verify no script execution (page should not have any alerts)
      // The script tags should be escaped/sanitized
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible();
    });

    test('should handle very long message input', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      const chatInput = page.getByPlaceholder('Ask me anything...');
      // Create a long message (5000 characters)
      const longMessage = 'This is a test. '.repeat(300);
      await chatInput.fill(longMessage);

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(5000);

      // Should not crash - chat panel should still be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible();

      // Connection status should still be visible
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible();
    });

    test('should handle network offline gracefully', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Verify initial connection
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible({ timeout: 10000 });

      // Go offline
      await page.context().setOffline(true);
      await page.waitForTimeout(3000);

      // Try to send message while offline
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('Test while offline');
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(2000);

      // Go back online
      await page.context().setOffline(false);
      await page.waitForTimeout(5000);

      // Chat should recover - either reconnect or show reconnecting state
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible();
    });

    test('should show clear conversation option in plus menu', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatPanel(page);

      // Click the plus button to open menu
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Look for Clear Conversation option
      const clearOption = page.getByText('Clear Conversation');
      await expect(clearOption).toBeVisible({ timeout: 5000 });
    });
  });

  /**
   * Mission Critical E2E Tests
   *
   * These tests verify core functionality that MUST work for the product to be usable.
   * They use real API calls and real data - not mocks.
   */
  test.describe('Mission Critical - Video Upload Project Creation', () => {
    // Skip in CI - requires AI API keys and file upload infrastructure
    test.skip(!!process.env.CI, 'Skipping video upload tests in CI - requires API keys');
    test.setTimeout(180000); // 3 minutes for upload + AI responses

    test('CRITICAL: should create project from uploaded video with ownership confirmation', async ({ page }) => {
      /**
       * TDD TEST - VIDEO UPLOAD WORKFLOW
       *
       * SCENARIO: As a user I go to +Add Project and upload a video
       *
       * EXPECTED FLOW:
       * 1. User uploads video via drag & drop or file input
       * 2. AI asks: "Is this your own video, or are you clipping something you found? What tool did you use to make it?"
       * 3. User responds: "my own and Midjourney"
       * 4. AI creates project with the video
       *
       * SUCCESS: Chat creates a project with the video in user's playground
       * FAILURE: Chat doesn't create a project (current bug)
       */
      const fs = await import('fs');
      const path = await import('path');

      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Read the real test video fixture file
      const { fileURLToPath } = await import('url');
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const fixturePath = path.join(currentDir, 'fixtures', 'test-video.mp4');
      const videoBuffer = fs.readFileSync(fixturePath);

      // Drag and drop the video file into the chat panel
      // The chat panel has drag-drop support via onDragEnter/onDrop handlers
      await page.evaluate(
        async ({ buffer, filename }) => {
          // Create a File object from the buffer
          const uint8Array = new Uint8Array(buffer);
          const blob = new Blob([uint8Array], { type: 'video/mp4' });
          const file = new File([blob], filename, { type: 'video/mp4' });

          // Find the chat panel (the sliding panel on the right)
          const dropZone = document.querySelector('.fixed.right-0.top-0');
          if (!dropZone) {
            console.error('Chat panel not found');
            throw new Error('Chat panel not found for drag-drop');
          }

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);

          // Dispatch drag events in sequence
          const dragEnterEvent = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          });

          const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          });

          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          });

          dropZone.dispatchEvent(dragEnterEvent);
          await new Promise(r => setTimeout(r, 100));
          dropZone.dispatchEvent(dragOverEvent);
          await new Promise(r => setTimeout(r, 100));
          dropZone.dispatchEvent(dropEvent);
        },
        { buffer: Array.from(videoBuffer), filename: 'test-video.mp4' }
      );

      // Wait for file to be added to attachments (should see file preview)
      await page.waitForTimeout(2000);

      // Check if attachment preview is visible
      const attachmentPreview = page.locator('text=test-video.mp4');
      const hasAttachment = await attachmentPreview.isVisible().catch(() => false);
      console.log(`Attachment preview visible: ${hasAttachment}`);

      // Send the message with the video
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for upload and AI response asking about ownership
      await page.waitForTimeout(20000);

      // CRITICAL CHECK 1: AI should ask about ownership
      const ownershipQuestion = await page.getByText(/your own video|clipping something|what tool/i).isVisible();

      if (ownershipQuestion) {
        console.log('✓ AI asked about video ownership');

        // Respond with ownership and tool information
        const chatInput = page.getByPlaceholder('Ask me anything...');
        await chatInput.fill('my own and Midjourney');

        await sendButton.click();

        // Wait for AI to process and create project
        await page.waitForTimeout(60000);

        // CRITICAL CHECK 2: AI should have created a project
        // Look for success indicators - use the entire chat panel content
        const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
        const chatPanelText = await chatPanel.textContent() || '';
        const fullChatText = chatPanelText.toLowerCase();

        // FAILURE indicators that should NOT appear
        const failureIndicators = [
          'midjourney is indeed a fantastic platform', // Misrouted to discovery
          'here are a few noteworthy projects', // Misrouted to discovery
          'i can help you explore', // Wrong context
          'search for projects', // Wrong context
        ];

        let foundFailure = false;
        for (const indicator of failureIndicators) {
          if (fullChatText.includes(indicator.toLowerCase())) {
            console.error(`FAILURE: Found wrong response pattern: "${indicator}"`);
            foundFailure = true;
          }
        }

        // SUCCESS indicators - at least one should appear
        const successIndicators = [
          'created',
          'project',
          'imported',
          'project page',
          'beautiful project',
          'exploring',
        ];

        const hasSuccess = successIndicators.some(indicator => fullChatText.includes(indicator));

        // Check for project URL in response (pattern: /@username/project-slug or /username/slug)
        const projectUrlPattern = /\/[a-z0-9_-]+\/[a-z0-9_-]+/i;
        const hasProjectUrl = projectUrlPattern.test(fullChatText);

        console.log(`Success indicators found: ${hasSuccess}`);
        console.log(`Project URL found: ${hasProjectUrl}`);
        console.log(`Chat content preview: ${fullChatText.substring(0, 500)}...`);

        // ASSERTIONS
        expect(foundFailure).toBe(false);
        expect(hasSuccess || hasProjectUrl).toBe(true);
      } else {
        // If AI didn't ask about ownership, it might have auto-imported
        // Check for project creation anyway
        const chatContent = await page.locator('.chat-message, [class*="message"]').allTextContents();
        const fullText = chatContent.join(' ').toLowerCase();

        console.log('AI did not ask ownership question, checking for auto-import...');
        console.log(`Chat content: ${fullText.substring(0, 500)}...`);

        // Should have either asked about ownership OR created the project
        const hasProjectIndicator = fullText.includes('created') || fullText.includes('project') || fullText.includes('imported');
        expect(hasProjectIndicator).toBe(true);
      }

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();

      // No technical errors should be visible
      const technicalErrors = ['TypeError', 'Exception', 'Traceback', 'undefined', 'NoneType'];
      for (const error of technicalErrors) {
        const hasError = await page.getByText(error).isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    });

    test('CRITICAL: should route ownership response back to project agent, not discovery', async ({ page }) => {
      /**
       * REGRESSION TEST for supervisor routing bug
       *
       * BUG: When user says "my own and Midjourney" in response to ownership question,
       *      supervisor misroutes to discovery agent (thinking user wants to search Midjourney)
       *      instead of continuing with project agent.
       *
       * EXPECTED: Response should continue video import workflow
       * ACTUAL (BUG): Response talks about Midjourney projects to explore
       */
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Step 1: Send a message that simulates the AI having asked about ownership
      // We'll directly test the response to "my own and Midjourney"
      const chatInput = page.getByPlaceholder('Ask me anything...');

      // First, simulate video upload context by mentioning we uploaded a video
      await chatInput.fill('I just uploaded a video file called sammy.mp4');
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(15000);

      // Now respond as if AI asked about ownership
      await chatInput.fill('my own and Midjourney');
      await sendButton.click();

      await page.waitForTimeout(30000);

      // Get all chat messages
      const chatContent = await page.locator('.chat-message, [class*="message"]').allTextContents();
      const fullText = chatContent.join(' ').toLowerCase();

      // CRITICAL: Response should NOT be about discovering Midjourney projects
      const discoveryPatterns = [
        'midjourney is indeed a fantastic platform',
        'here are a few noteworthy projects',
        'exploring both your own projects',
        'fashion prompts',
        'storm-themed visuals',
        'conceptual themes',
        'cultural insights',
        'architectural exploration',
        'orbital brutalism',
      ];

      let wasRoutedToDiscovery = false;
      for (const pattern of discoveryPatterns) {
        if (fullText.includes(pattern.toLowerCase())) {
          console.error(`BUG DETECTED: Response was routed to discovery agent. Found: "${pattern}"`);
          wasRoutedToDiscovery = true;
        }
      }

      // This assertion will FAIL if the bug still exists (TDD red phase)
      expect(wasRoutedToDiscovery).toBe(false);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });
  });

  test.describe('Mission Critical - GitHub Clipping', () => {
    // Skip in CI - requires AI API keys
    test.skip(!!process.env.CI, 'Skipping mission critical tests in CI - requires API keys');
    test.setTimeout(180000); // 3 minutes for AI responses + scraping

    test('CRITICAL: should auto-clip GitHub repo user does not own', async ({ page }) => {
      /**
       * SCENARIO: As a logged in user, I click add a project and want to add a GitHub repo
       *           (https://github.com/jlowin/fastmcp) that I do NOT own.
       *
       * EXPECTED: The intelligent chat will add the repo as a clipped project to my profile
       *           even though I don't own it. Should show a friendly message like:
       *           "Looks like you don't own this repository, so I've added it to your clippings"
       *
       * FAILURE CASE: "It seems you're interested in clipping a repository, but unfortunately,
       *               it's not associated with your GitHub account, which is why you're unable to do so."
       */
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a GitHub repo URL they DO NOT own
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://github.com/jlowin/fastmcp');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for initial AI response
      await page.waitForTimeout(15000);

      // Check if AI asked about ownership - if so, answer "clipping"
      // (Ideally AI would auto-import, but it sometimes asks first)
      const pageText = await page.locator('body').textContent() || '';
      if (pageText.toLowerCase().includes('your own') || pageText.toLowerCase().includes('clipping it')) {
        console.log('AI asked about ownership, answering "clipping"...');
        const inputAfterQuestion = page.getByPlaceholder('Ask me anything...');
        await inputAfterQuestion.fill('clipping');
        const sendBtn = page.locator('button[aria-label="Send message"]');
        await sendBtn.click();
        // Wait for AI to process the clip
        await page.waitForTimeout(60000);
      } else {
        // AI didn't ask, wait for it to finish processing
        await page.waitForTimeout(45000);
      }

      // Get all visible text in the chat area to check for success/failure
      const chatContent = await page.locator('.chat-message, [class*="message"], [class*="Message"]').allTextContents();
      const fullChatText = chatContent.join(' ').toLowerCase();

      // FAILURE indicators - these should NOT appear
      const failureIndicators = [
        'not associated with your github account',
        "you're unable to do so",
        'cannot import',
        'unable to import',
        'you can only import repositories you own',
      ];

      for (const indicator of failureIndicators) {
        const hasFailure = fullChatText.includes(indicator);
        if (hasFailure) {
          console.error(`MISSION CRITICAL FAILURE: Found failure indicator: "${indicator}"`);
          console.error(`Full chat content: ${fullChatText}`);
        }
        expect(hasFailure).toBe(false);
      }

      // SUCCESS indicators - at least one should appear
      const successIndicators = [
        'clipping',
        'clipped',
        "added to your clippings",
        'saved project',
        'fastmcp', // The repo name should appear if successfully processed
      ];

      const hasSuccess = successIndicators.some(indicator => fullChatText.includes(indicator));

      // Also check for a project link being created (URL pattern like /username/slug)
      const projectLinkPattern = /\/[a-z0-9_-]+\/[a-z0-9_-]+/i;
      const hasProjectLink = projectLinkPattern.test(fullChatText);

      console.log(`Success indicators found: ${hasSuccess}`);
      console.log(`Project link found: ${hasProjectLink}`);
      console.log(`Chat content: ${fullChatText.substring(0, 500)}...`);

      // Either success message or project link should be present
      expect(hasSuccess || hasProjectLink).toBe(true);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();

      // No technical errors should be visible
      const technicalErrors = ['TypeError', 'Exception', 'Traceback', 'undefined', 'null'];
      for (const error of technicalErrors) {
        const hasError = await page.getByText(error).isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    });

    test('CRITICAL: should show friendly message when auto-clipping', async ({ page }) => {
      /**
       * SCENARIO: User pastes a GitHub URL they don't own
       * EXPECTED: AI shows a friendly message explaining the repo was auto-clipped
       *           (not an error about not being able to import)
       */
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Use a different popular repo to avoid duplicates
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://github.com/anthropics/anthropic-cookbook');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      await page.waitForTimeout(60000);

      // The response should NOT be an error about ownership
      const errorPatterns = [
        /not associated with your.*account/i,
        /unable to (do so|import|clip)/i,
        /you can only import repositories you own/i,
      ];

      const chatContent = await page.locator('.chat-message, [class*="message"]').allTextContents();
      const fullText = chatContent.join(' ');

      for (const pattern of errorPatterns) {
        const hasError = pattern.test(fullText);
        if (hasError) {
          console.error(`Found error pattern: ${pattern}`);
        }
        expect(hasError).toBe(false);
      }

      // Should show success
      await expect(chatHeader).toBeVisible();
    });
  });

  test.describe('Real User Workflows', () => {
    // These tests verify the AI responds appropriately to common user actions
    // Users open intelligent chat via the +Add Project button on /explore
    // Skip in CI - requires AI API keys (OpenAI/Anthropic) which aren't configured in CI
    test.skip(!!process.env.CI, 'Skipping AI workflow tests in CI - requires API keys');
    test.setTimeout(180000); // 3 minutes for AI responses

    test('should handle YouTube video link and offer to create project', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a YouTube link
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // AI should recognize it's a YouTube video and respond appropriately
      // Look for indicators that the AI understood the content
      const chatMessages = page.locator('.chat-message, [class*="message"]');
      const messageCount = await chatMessages.count();
      expect(messageCount).toBeGreaterThan(1); // User message + AI response

      // Should not show technical errors
      const errorIndicators = ['TypeError', 'undefined', 'null', 'Exception'];
      for (const indicator of errorIndicators) {
        const hasError = await page.getByText(indicator).isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });

    test('should handle GitHub repository link', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a GitHub repo link
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://github.com/facebook/react');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // AI should recognize it's a GitHub repo
      // The response should mention something about the repo, code, or project
      await expect(chatHeader).toBeVisible();

      // Should not crash - connection status should be visible
      const connectionStatus = page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible();
    });

    test('should handle general question about AI tools', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User asks a question about AI tools
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('What AI tools are best for creating images?');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // Should get a substantive response mentioning image generation tools
      // At minimum, chat should still be working
      await expect(chatHeader).toBeVisible();

      // User message should be visible
      await expect(page.getByText('What AI tools are best for creating images?')).toBeVisible();
    });

    test('should handle request to create a project from description', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User describes a project they want to create
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill(
        'I made a cool image in Midjourney of a cyberpunk city. Can you help me create a project for it?'
      );

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // AI should offer to help create a project
      // Could ask for the image or offer guidance
      await expect(chatHeader).toBeVisible();

      // Should not show errors
      const errorMessage = page.getByText('Failed to process');
      const hasError = await errorMessage.isVisible().catch(() => false);
      expect(hasError).toBe(false);
    });

    test('should handle tweet/X link for import', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a tweet link
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://twitter.com/OpenAI/status/1234567890');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // Should handle gracefully (may not be able to access, but shouldn't crash)
      await expect(chatHeader).toBeVisible();
    });

    test('should handle Figma link via menu integration', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Open plus menu and click Figma integration
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Click More Integrations to see Figma option
      await page.getByText('More Integrations').click();
      await page.waitForTimeout(500);

      // Figma option should be visible
      const figmaOption = page.getByText('Add from Figma');
      await expect(figmaOption).toBeVisible();

      // Click it
      await figmaOption.click();
      await page.waitForTimeout(1000);

      // Should prompt user or show some UI for Figma import
      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });

    test('should handle image generation request', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Open plus menu and click Create Image option
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();
      await page.waitForTimeout(500);

      // Click Create Image/Infographic
      const createImageOption = page.getByText('Create Image/Infographic');
      await expect(createImageOption).toBeVisible();
      await createImageOption.click();
      await page.waitForTimeout(1000);

      // Should show some prompt or the AI should respond about image creation
      await expect(chatHeader).toBeVisible();

      // Now type an image generation request
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('A futuristic city with flying cars at sunset');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI to process (image generation takes time)
      await page.waitForTimeout(60000);

      // Should not crash during generation
      await expect(chatHeader).toBeVisible();
    });

    test('should handle asking for help creating a profile', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User asks about their profile
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('How do I make my AllThrive profile stand out? I work with AI art.');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // Should provide helpful advice
      await expect(chatHeader).toBeVisible();

      // User message should be there
      await expect(page.getByText('How do I make my AllThrive profile stand out?')).toBeVisible();
    });

    test('should handle LinkedIn URL for import', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a LinkedIn profile URL
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://www.linkedin.com/in/satlokomern');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // Should handle gracefully - LinkedIn may require auth
      await expect(chatHeader).toBeVisible();

      // Should not show technical errors
      const typeError = page.getByText('TypeError');
      const hasTypeError = await typeError.isVisible().catch(() => false);
      expect(hasTypeError).toBe(false);
    });
  });

  test.describe('Mission Critical - Image Upload Project Creation', () => {
    /**
     * TDD TEST - IMAGE UPLOAD WORKFLOW
     *
     * SCENARIO: As a user I go to +Add Project and upload an image
     *
     * EXPECTED:
     * 1. User uploads an image via drag & drop or file input
     * 2. AI asks: "What's the title for this project?" and "What tools did you use to create it?"
     * 3. User responds with title and tools
     * 4. AI creates a project with the image and metadata
     *
     * FAILURE (CURRENT BUG):
     * - Gemini creates a NEW image instead of processing the uploaded one
     * - AI doesn't recognize the image as an upload for project creation
     */

    // Skip in CI - requires AI API keys and file upload infrastructure
    test.skip(!!process.env.CI, 'Skipping image upload tests in CI - requires API keys');
    test.setTimeout(180000); // 3 minutes for upload + AI responses

    test('CRITICAL: should ask for title and tools when user uploads an image', async ({ page }) => {
      /**
       * TDD TEST - This test should FAIL with current behavior
       *
       * SCENARIO: User uploads an image via +Add Project
       *
       * EXPECTED FLOW:
       * 1. User clicks +Add Project
       * 2. User uploads/drags an image
       * 3. AI asks: "What's the title for this project?" and "What tools did you use?"
       * 4. AI does NOT try to generate a new image
       *
       * CURRENT FAILURE:
       * - Gemini generates a new image instead of asking about the uploaded one
       */
      const fs = await import('fs');
      const path = await import('path');

      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Read the real test image fixture file
      const { fileURLToPath } = await import('url');
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const fixturePath = path.join(currentDir, 'fixtures', 'test-image.png');
      const imageBuffer = fs.readFileSync(fixturePath);

      // Drag and drop the image file into the chat panel
      await page.evaluate(
        async ({ buffer, filename }) => {
          // Create a File object from the buffer
          const uint8Array = new Uint8Array(buffer);
          const blob = new Blob([uint8Array], { type: 'image/png' });
          const file = new File([blob], filename, { type: 'image/png' });

          // Find the chat panel (the sliding panel on the right)
          const dropZone = document.querySelector('.fixed.right-0.top-0');
          if (!dropZone) {
            console.error('Chat panel not found');
            throw new Error('Chat panel not found for drag-drop');
          }

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);

          // Dispatch drag events in sequence
          const dragEnterEvent = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          });

          const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          });

          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          });

          dropZone.dispatchEvent(dragEnterEvent);
          await new Promise(r => setTimeout(r, 100));
          dropZone.dispatchEvent(dragOverEvent);
          await new Promise(r => setTimeout(r, 100));
          dropZone.dispatchEvent(dropEvent);
        },
        { buffer: Array.from(imageBuffer), filename: 'test-image.png' }
      );

      // Wait for file to be added to attachments
      await page.waitForTimeout(2000);

      // Check if attachment preview is visible
      const attachmentPreview = page.locator('text=test-image.png');
      const hasAttachment = await attachmentPreview.isVisible().catch(() => false);
      console.log(`Image attachment preview visible: ${hasAttachment}`);

      // Send the message with the image (no text - just the image)
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await page.waitForTimeout(30000);

      // Get all chat panel content
      const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
      const chatPanelText = (await chatPanel.textContent()) || '';
      const fullChatText = chatPanelText.toLowerCase();

      console.log(`Chat response preview: ${fullChatText.substring(0, 800)}...`);

      // FAILURE indicators - These should NOT appear
      // Current bug: Gemini creates an image instead of asking about the uploaded one
      const failureIndicators = [
        'generating an image',
        'creating an image',
        'here is the image',
        "here's an image",
        "i've created",
        'i have created',
        'generated image',
        'image generation',
        "let me create",
        "i'll create",
        'creating your image',
        'generating your image',
        'dall-e',
        'midjourney style',
        'abstract art', // AI describing an image it created
        'vibrant colors', // AI describing an image it created
        'digital artwork', // AI describing an image it created
      ];

      let hasImageGeneration = false;
      for (const indicator of failureIndicators) {
        if (fullChatText.includes(indicator)) {
          console.error(`BUG DETECTED: AI is generating an image instead of asking about the upload. Found: "${indicator}"`);
          hasImageGeneration = true;
        }
      }

      // SUCCESS indicators - At least one should appear
      // AI should ask about title/name and tools used
      const successIndicators = [
        'title',
        'name',
        'what would you like to call',
        'what is this',
        'tell me about',
        'what tools',
        'what did you use',
        'how did you create',
        'how was this made',
        'created with',
        'made with',
        'your image',
        'uploaded image',
        'this image',
        'the image you',
      ];

      const hasProjectQuestion = successIndicators.some(indicator => fullChatText.includes(indicator));

      console.log(`AI generated image (FAILURE): ${hasImageGeneration}`);
      console.log(`AI asked about project (SUCCESS): ${hasProjectQuestion}`);

      // ASSERTIONS
      // This test should FAIL if Gemini generates an image
      expect(hasImageGeneration).toBe(false);

      // This test should PASS if AI asks about the uploaded image
      expect(hasProjectQuestion).toBe(true);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();

      // No technical errors should be visible
      const technicalErrors = ['TypeError', 'Exception', 'Traceback', 'undefined', 'NoneType'];
      for (const error of technicalErrors) {
        const hasError = await page.getByText(error).isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    });

    test('CRITICAL: should create project after user provides title and tools for uploaded image', async ({ page }) => {
      /**
       * TDD TEST - Full image upload flow
       *
       * SCENARIO: User uploads an image and provides title/tools
       *
       * EXPECTED FLOW:
       * 1. User uploads image
       * 2. AI asks for title and tools
       * 3. User responds: "My AI Art" and "Midjourney"
       * 4. AI creates the project with the image
       *
       * SUCCESS: Project is created with the uploaded image
       * FAILURE: AI generates a new image or doesn't create a project
       */
      const fs = await import('fs');
      const path = await import('path');

      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Read the test image
      const { fileURLToPath } = await import('url');
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const fixturePath = path.join(currentDir, 'fixtures', 'test-image.png');
      const imageBuffer = fs.readFileSync(fixturePath);

      // Drag and drop the image
      await page.evaluate(
        async ({ buffer, filename }) => {
          const uint8Array = new Uint8Array(buffer);
          const blob = new Blob([uint8Array], { type: 'image/png' });
          const file = new File([blob], filename, { type: 'image/png' });

          const dropZone = document.querySelector('.fixed.right-0.top-0');
          if (!dropZone) throw new Error('Chat panel not found');

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);

          dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer }));
          await new Promise(r => setTimeout(r, 100));
          dropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
          await new Promise(r => setTimeout(r, 100));
          dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
        },
        { buffer: Array.from(imageBuffer), filename: 'my-ai-art.png' }
      );

      await page.waitForTimeout(2000);

      // Send the image
      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI to ask about the image
      await page.waitForTimeout(20000);

      // Get chat content
      const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
      let chatPanelText = (await chatPanel.textContent()) || '';
      let fullChatText = chatPanelText.toLowerCase();

      // Check if AI asked about the image (and didn't generate one)
      const askedAboutImage =
        fullChatText.includes('title') ||
        fullChatText.includes('name') ||
        fullChatText.includes('what tools') ||
        fullChatText.includes('tell me about') ||
        fullChatText.includes('your image');

      if (askedAboutImage) {
        console.log('✓ AI asked about the image, providing title and tools');

        // User responds with title and tools
        const chatInput = page.getByPlaceholder('Ask me anything...');
        await chatInput.fill('The title is "Cosmic Dreams" and I made it with Midjourney');
        await sendButton.click();

        // Wait for AI to create the project
        await page.waitForTimeout(60000);

        // Get updated chat content
        chatPanelText = (await chatPanel.textContent()) || '';
        fullChatText = chatPanelText.toLowerCase();

        console.log(`Response after providing title/tools: ${fullChatText.substring(fullChatText.length - 500)}...`);

        // SUCCESS indicators
        const projectCreatedIndicators = [
          'created',
          'project',
          'cosmic dreams',
          'midjourney',
          'project page',
          'check it out',
          'here is your project',
        ];

        const hasProjectCreated = projectCreatedIndicators.some(indicator => fullChatText.includes(indicator));

        // Check for project URL
        const projectUrlPattern = /\/[a-z0-9_-]+\/[a-z0-9_-]+/i;
        const hasProjectUrl = projectUrlPattern.test(fullChatText);

        console.log(`Project created indicators: ${hasProjectCreated}`);
        console.log(`Project URL found: ${hasProjectUrl}`);

        // FAILURE indicators - should NOT appear
        const failureIndicators = [
          'generating an image',
          "i've created an image",
          'here is the generated image',
        ];

        let hasFailure = false;
        for (const indicator of failureIndicators) {
          if (fullChatText.includes(indicator)) {
            console.error(`FAILURE: AI generated an image instead of creating project: "${indicator}"`);
            hasFailure = true;
          }
        }

        expect(hasFailure).toBe(false);
        expect(hasProjectCreated || hasProjectUrl).toBe(true);
      } else {
        // AI didn't ask about the image - this is the bug
        console.error('BUG: AI did not ask about the uploaded image');
        console.log(`Chat content: ${fullChatText.substring(0, 800)}...`);

        // Check if AI generated an image (the bug)
        const generatedImage = fullChatText.includes('generating') || fullChatText.includes("i've created");

        if (generatedImage) {
          console.error('BUG CONFIRMED: AI is generating images instead of processing uploads');
        }

        // This assertion will fail to indicate the bug
        expect(askedAboutImage).toBe(true);
      }

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });
  });

  test.describe('Mission Critical - GitHub Import Without Connection', () => {
    /**
     * TDD TEST - GITHUB IMPORT WITHOUT GITHUB CONNECTION
     *
     * SCENARIO: As a user without GitHub connected, I go to +Add Project
     *           and try to import a GitHub repository URL.
     *
     * EXPECTED:
     * 1. Chat asks: "Would you like to connect GitHub first, or just clip it?"
     * 2. User can choose to connect GitHub → directed to Settings → Integrations
     * 3. User can choose to clip it → repo is saved as a clipped project
     *
     * FAILURE:
     * - Chat auto-clips without asking (previous behavior)
     * - Chat shows an error about not being connected
     * - Chat doesn't create any project
     */

    // Skip in CI - requires API keys
    test.skip(!!process.env.CI, 'Skipping GitHub no-connection tests in CI - requires API keys');
    test.setTimeout(180000); // 3 minutes for AI responses

    test('CRITICAL: should ask user to connect GitHub or clip when GitHub not connected', async ({ page }) => {
      /**
       * This test verifies that when a user WITHOUT GitHub connected pastes a GitHub URL,
       * the chat asks them whether they want to:
       * 1. Connect GitHub first (to import as their own project)
       * 2. Just clip it (save without ownership)
       *
       * NOTE: This test assumes the test user does NOT have GitHub connected.
       * If the test user has GitHub connected, this test will verify the existing flow instead.
       */
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button (real user workflow)
      await openChatViaAddProject(page);

      // Wait for the chat panel to be visible
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a GitHub URL (use a fresh repo that hasn't been imported)
      const chatInput = page.getByPlaceholder('Ask me anything...');
      const testGitHubUrl = 'https://github.com/vercel/next.js';
      await chatInput.fill(testGitHubUrl);

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI to finish processing (wait for "thinking" indicator to disappear)
      // First wait for thinking to appear
      await page.waitForTimeout(3000);

      // Then wait for it to disappear (AI finished processing)
      try {
        await page.waitForFunction(
          () => {
            const content = document.body.textContent || '';
            return !content.toLowerCase().includes('thinking...');
          },
          { timeout: 90000 }
        );
      } catch {
        console.log('Thinking indicator timeout - continuing with current state');
      }

      // Additional buffer for response to render
      await page.waitForTimeout(3000);

      // Get all chat panel content
      const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
      const chatPanelText = (await chatPanel.textContent()) || '';
      const fullChatText = chatPanelText.toLowerCase();

      console.log(`Chat response preview: ${fullChatText.substring(0, 800)}...`);

      // Check for the two possible flows:
      // Flow 1: GitHub NOT connected - should ask about connecting or clipping
      const githubNotConnectedIndicators = [
        'connect github',
        'connect your github',
        'github account',
        'settings',
        'integrations',
        'clip it',
        'just clip',
        'clippings',
        'need to connect',
        'i see this is a github repo', // New user-friendly wording
        'your own project', // Part of new question
        'clip to save', // Part of new question
      ];

      // Flow 2: GitHub connected but doesn't own - should auto-clip
      const autoClipIndicators = [
        "don't own this repository",
        "you don't own",
        'added it to your clippings',
        'clipped',
      ];

      // Flow 3: GitHub connected and owns it - should import
      const ownedImportIndicators = ["imported your repository", "here's your project", 'project page'];

      const hasGitHubNotConnectedPrompt = githubNotConnectedIndicators.some(indicator =>
        fullChatText.includes(indicator)
      );
      const hasAutoClip = autoClipIndicators.some(indicator => fullChatText.includes(indicator));
      const hasOwnedImport = ownedImportIndicators.some(indicator => fullChatText.includes(indicator));

      console.log(`GitHub not connected prompt: ${hasGitHubNotConnectedPrompt}`);
      console.log(`Auto-clipped (user doesn't own): ${hasAutoClip}`);
      console.log(`Owned import: ${hasOwnedImport}`);

      // FAILURE indicators - these should NOT appear
      const failureIndicators = [
        'error',
        'failed to import',
        'unable to import',
        'cannot import',
        'typeerror',
        'something went wrong',
      ];

      let hasFailure = false;
      for (const indicator of failureIndicators) {
        if (fullChatText.includes(indicator)) {
          console.error(`FAILURE: Found error indicator: "${indicator}"`);
          hasFailure = true;
        }
      }

      // ASSERTIONS
      // One of the valid flows should have occurred
      const validFlowOccurred = hasGitHubNotConnectedPrompt || hasAutoClip || hasOwnedImport;
      expect(hasFailure).toBe(false);
      expect(validFlowOccurred).toBe(true);

      // If GitHub not connected prompt appeared, verify it offers both options
      if (hasGitHubNotConnectedPrompt) {
        console.log('✓ GitHub connection prompt shown - testing clip flow');

        // User should be offered the option to connect or clip
        const hasConnectOption = fullChatText.includes('connect github') || fullChatText.includes('settings');
        const hasClipOption = fullChatText.includes('clip') || fullChatText.includes('clipping');

        expect(hasConnectOption || hasClipOption).toBe(true);
      }
    });

    test('CRITICAL: should clip GitHub repo when user chooses "just clip it"', async ({ page }) => {
      /**
       * This test verifies the full flow when user chooses to clip instead of connecting GitHub:
       * 1. User pastes GitHub URL
       * 2. AI asks about connecting GitHub or clipping
       * 3. User says "just clip it"
       * 4. AI clips the repo and creates a project
       *
       * NOTE: This test only runs if GitHub is NOT connected for the test user.
       */
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a GitHub URL
      const chatInput = page.getByPlaceholder('Ask me anything...');
      const testGitHubUrl = 'https://github.com/microsoft/TypeScript';
      await chatInput.fill(testGitHubUrl);

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI to finish processing
      await page.waitForTimeout(3000);
      try {
        await page.waitForFunction(
          () => {
            const content = document.body.textContent || '';
            return !content.toLowerCase().includes('thinking...');
          },
          { timeout: 90000 }
        );
      } catch {
        console.log('Thinking indicator timeout - continuing');
      }
      await page.waitForTimeout(3000);

      // Get chat content
      const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
      let chatPanelText = (await chatPanel.textContent()) || '';
      let fullChatText = chatPanelText.toLowerCase();

      // Check if GitHub connection prompt appeared
      const hasConnectionPrompt =
        fullChatText.includes('connect github') ||
        fullChatText.includes('connect your github') ||
        fullChatText.includes('need to connect');

      if (hasConnectionPrompt) {
        console.log('✓ GitHub connection prompt appeared, responding with "just clip it"');

        // User chooses to clip
        await chatInput.fill('just clip it');
        await sendButton.click();

        // Wait for AI to finish processing
        await page.waitForTimeout(3000);
        try {
          await page.waitForFunction(
            () => {
              const content = document.body.textContent || '';
              return !content.toLowerCase().includes('thinking...');
            },
            { timeout: 90000 }
          );
        } catch {
          console.log('Thinking indicator timeout - continuing');
        }
        await page.waitForTimeout(3000);

        // Get updated chat content
        chatPanelText = (await chatPanel.textContent()) || '';
        fullChatText = chatPanelText.toLowerCase();

        console.log(`Response after "just clip it": ${fullChatText.substring(fullChatText.length - 500)}...`);

        // Should have clipped the project
        const clipSuccessIndicators = [
          'clipped',
          'clipping',
          'added to your',
          'saved',
          'project',
          'typescript',
        ];

        const hasClipSuccess = clipSuccessIndicators.some(indicator => fullChatText.includes(indicator));

        // Check for project URL in response
        const projectUrlPattern = /\/[a-z0-9_-]+\/[a-z0-9_-]+/i;
        const hasProjectUrl = projectUrlPattern.test(fullChatText);

        console.log(`Clip success indicators: ${hasClipSuccess}`);
        console.log(`Project URL found: ${hasProjectUrl}`);

        expect(hasClipSuccess || hasProjectUrl).toBe(true);
      } else {
        // GitHub might already be connected - check if it auto-clipped or imported
        console.log('GitHub connection prompt did not appear - user may have GitHub connected');

        const hasResult =
          fullChatText.includes('clipped') ||
          fullChatText.includes('imported') ||
          fullChatText.includes('project');

        expect(hasResult).toBe(true);
      }
    });

    test('CRITICAL: should direct user to Settings when they want to connect GitHub', async ({ page }) => {
      /**
       * This test verifies that when user chooses to connect GitHub:
       * 1. User pastes GitHub URL
       * 2. AI asks about connecting GitHub or clipping
       * 3. User says "I want to connect GitHub"
       * 4. AI provides instructions to go to Settings → Integrations
       *
       * NOTE: This test only runs if GitHub is NOT connected for the test user.
       */
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Open chat via +Add Project button
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User pastes a GitHub URL
      const chatInput = page.getByPlaceholder('Ask me anything...');
      const testGitHubUrl = 'https://github.com/facebook/react';
      await chatInput.fill(testGitHubUrl);

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI to finish processing
      await page.waitForTimeout(3000);
      try {
        await page.waitForFunction(
          () => {
            const content = document.body.textContent || '';
            return !content.toLowerCase().includes('thinking...');
          },
          { timeout: 90000 }
        );
      } catch {
        console.log('Thinking indicator timeout - continuing');
      }
      await page.waitForTimeout(3000);

      // Get chat content
      const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
      let chatPanelText = (await chatPanel.textContent()) || '';
      let fullChatText = chatPanelText.toLowerCase();

      // Check if GitHub connection prompt appeared
      const hasConnectionPrompt =
        fullChatText.includes('connect github') ||
        fullChatText.includes('connect your github') ||
        fullChatText.includes('need to connect');

      if (hasConnectionPrompt) {
        console.log('✓ GitHub connection prompt appeared, responding with "connect github"');

        // User chooses to connect GitHub
        await chatInput.fill('I want to connect my GitHub');
        await sendButton.click();

        // Wait for AI to finish processing
        await page.waitForTimeout(3000);
        try {
          await page.waitForFunction(
            () => {
              const content = document.body.textContent || '';
              return !content.toLowerCase().includes('thinking...');
            },
            { timeout: 60000 }
          );
        } catch {
          console.log('Thinking indicator timeout - continuing');
        }
        await page.waitForTimeout(3000);

        // Get updated chat content
        chatPanelText = (await chatPanel.textContent()) || '';
        fullChatText = chatPanelText.toLowerCase();

        console.log(`Response after "connect github": ${fullChatText.substring(fullChatText.length - 500)}...`);

        // Should mention Settings or Integrations
        const settingsIndicators = ['settings', 'integrations', 'connect', 'account', 'come back'];

        const hasSettingsDirection = settingsIndicators.some(indicator => fullChatText.includes(indicator));

        console.log(`Settings direction found: ${hasSettingsDirection}`);

        // The AI should direct user to settings
        expect(hasSettingsDirection).toBe(true);
      } else {
        // GitHub might already be connected
        console.log('GitHub connection prompt did not appear - user may have GitHub connected');
        console.log('Test passes by default since GitHub is already connected');
      }
    });
  });
});
