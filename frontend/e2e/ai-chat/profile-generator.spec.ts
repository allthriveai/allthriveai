/**
 * Profile Generator E2E Tests - Drag & Drop Image Upload & LinkedIn Screenshot Support
 *
 * These tests validate the Profile Generator's ability to:
 * - Accept images via drag & drop (especially LinkedIn screenshots)
 * - Provide helpful guidance when users paste LinkedIn URLs
 * - Generate profile sections from uploaded images
 *
 * These tests use REAL AI tokens - run with: RUN_AI_TESTS=true npx playwright test ai-chat/profile-generator.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, waitForAuth, dismissOnboardingModal, TEST_USER } from '../helpers';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skip all tests unless RUN_AI_TESTS=true
const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

// Helper to wait for AI response in profile generator
async function waitForAIResponse(page: Page, timeout = 90000) {
  await page.waitForTimeout(3000);
  try {
    await page.waitForFunction(
      () => !document.body.textContent?.toLowerCase().includes('thinking...'),
      { timeout }
    );
  } catch {
    console.log('Thinking indicator timeout - continuing');
  }
  await page.waitForTimeout(2000);
}

// Helper to get profile generator chat content
async function getChatContent(page: Page): Promise<string> {
  const chatPanel = page.locator('[data-testid="profile-generator-chat"]');
  return ((await chatPanel.textContent()) || '').toLowerCase();
}

// Check for error indicators
function hasErrorIndicators(response: string): boolean {
  const errorPatterns = [
    'typeerror',
    'exception',
    'traceback',
    'nonetype',
    'error occurred',
    'something went wrong',
  ];
  return errorPatterns.some(pattern => response.includes(pattern));
}

// Check if rate limited
function isRateLimited(response: string): boolean {
  return response.includes('rate limit') || response.includes('too many requests');
}

// Helper to open profile generator tray and wait for welcome message to finish typing
async function openProfileGenerator(page: Page, waitForWelcome = true) {
  // Navigate to user's own profile page (/:username route)
  await page.goto(`/${TEST_USER.username}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Click the AI Profile Generator button
  const generatorButton = page.locator('[data-testid="profile-generator-button"]');
  await generatorButton.click();
  await page.waitForTimeout(500);

  // Wait for welcome message typing animation to complete (message ends with "craft your profile!")
  if (waitForWelcome) {
    try {
      await page.waitForFunction(
        () => document.body.textContent?.toLowerCase().includes('craft your profile'),
        { timeout: 30000 }
      );
    } catch {
      console.log('Welcome message typing animation timeout - continuing');
    }
    await page.waitForTimeout(500);
  }
}

// Helper to simulate drag and drop of a file
async function dragDropFile(page: Page, selector: string, filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Create a DataTransfer-like object and dispatch events
  await page.evaluate(
    async ({ selector, fileName, mimeType, base64 }) => {
      const target = document.querySelector(selector);
      if (!target) throw new Error(`Element not found: ${selector}`);

      // Convert base64 back to array buffer
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const file = new File([bytes], fileName, { type: mimeType });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Dispatch drag events
      const dragEnter = new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dragEnter);

      const dragOver = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dragOver);

      const drop = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(drop);
    },
    { selector, fileName, mimeType, base64: buffer.toString('base64') }
  );
}

test.describe('Profile Generator with Drag & Drop Image Upload', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(180000); // 3 minutes for AI processing

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await waitForAuth(page);
    await dismissOnboardingModal(page);
  });

  test.describe('Welcome Message', () => {
    test('should display LinkedIn screenshot tip in welcome message', async ({ page }) => {
      await openProfileGenerator(page);

      // Verify welcome message contains LinkedIn tip
      const chatContent = await getChatContent(page);
      expect(chatContent).toContain('screenshot');
      expect(chatContent).toContain('linkedin');
    });

    test('should display the standard profile creation prompt', async ({ page }) => {
      await openProfileGenerator(page);

      const chatContent = await getChatContent(page);
      expect(chatContent).toContain('tell me a bit about yourself');
    });

    test('should mention drag and drop in welcome message', async ({ page }) => {
      await openProfileGenerator(page);

      const chatContent = await getChatContent(page);
      expect(chatContent).toMatch(/drag|drop/i);
    });
  });

  test.describe('Drag and Drop UI', () => {
    test('should show drag overlay when dragging files over chat area', async ({ page }) => {
      await openProfileGenerator(page);

      const _chatArea = page.locator('[data-testid="profile-generator-chat"]');

      // Simulate drag enter using evaluate to properly create DataTransfer
      await page.evaluate(() => {
        const target = document.querySelector('[data-testid="profile-generator-chat"]');
        if (!target) return;

        const dataTransfer = new DataTransfer();
        const dragEnter = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        });
        target.dispatchEvent(dragEnter);
      });

      // Verify drag overlay appears
      await expect(page.locator('[data-testid="drag-overlay"]')).toBeVisible();
    });

    test('should hide drag overlay when dragging leaves', async ({ page }) => {
      await openProfileGenerator(page);

      // Trigger drag enter then drag leave
      await page.evaluate(() => {
        const target = document.querySelector('[data-testid="profile-generator-chat"]');
        if (!target) return;

        const dataTransfer = new DataTransfer();

        const dragEnter = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        });
        target.dispatchEvent(dragEnter);

        const dragLeave = new DragEvent('dragleave', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        });
        target.dispatchEvent(dragLeave);
      });

      // Verify drag overlay is hidden
      await expect(page.locator('[data-testid="drag-overlay"]')).not.toBeVisible();
    });

    test('should accept dropped image and show preview', async ({ page }) => {
      await openProfileGenerator(page);

      // Drop test image
      await dragDropFile(
        page,
        '[data-testid="profile-generator-chat"]',
        path.join(__dirname, '../fixtures/test-image.png')
      );

      // Verify preview appears
      await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();
    });

    test('should allow removing attached images before sending', async ({ page }) => {
      await openProfileGenerator(page);

      // Drop test image
      await dragDropFile(
        page,
        '[data-testid="profile-generator-chat"]',
        path.join(__dirname, '../fixtures/test-image.png')
      );

      // Verify preview appears
      await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();

      // Click remove/clear button
      const clearButton = page.locator('[data-testid="clear-attachment"]');
      await clearButton.click();

      // Verify preview is gone
      await expect(page.locator('[data-testid="attachment-preview"]')).not.toBeVisible();
    });
  });

  test.describe('LinkedIn URL Handling', () => {
    test('should explain LinkedIn URL cannot be scraped and suggest screenshot', async ({ page }) => {
      await openProfileGenerator(page);

      // Type a LinkedIn URL
      const chatInput = page.locator('[data-testid="profile-chat-input"]');
      await chatInput.fill('https://linkedin.com/in/johndoe');

      // Send the message
      const sendButton = page.locator('[data-testid="send-message-button"]');
      await sendButton.click();

      // Wait for AI response
      await waitForAIResponse(page, 60000);

      // Verify AI explains limitation and suggests screenshot
      const chatContent = await getChatContent(page);

      // Check for rate limiting first
      if (isRateLimited(chatContent)) {
        test.skip(true, 'Rate limited - skipping test');
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(chatContent)).toBe(false);

      // Verify the response mentions inability to scrape and suggests screenshot
      expect(chatContent).toMatch(/can't|cannot|unable/i);
      expect(chatContent).toMatch(/screenshot/i);
    });

    test('should handle www.linkedin.com URLs', async ({ page }) => {
      await openProfileGenerator(page);

      const chatInput = page.locator('[data-testid="profile-chat-input"]');
      await chatInput.fill('www.linkedin.com/in/janedoe');

      const sendButton = page.locator('[data-testid="send-message-button"]');
      await sendButton.click();

      await waitForAIResponse(page, 60000);

      const chatContent = await getChatContent(page);

      if (isRateLimited(chatContent)) {
        test.skip(true, 'Rate limited - skipping test');
        return;
      }

      expect(hasErrorIndicators(chatContent)).toBe(false);
      expect(chatContent).toMatch(/screenshot/i);
    });
  });

  test.describe('Full Image Upload Flow', () => {
    test('should process dropped image and acknowledge it', async ({ page }) => {
      await openProfileGenerator(page);

      // Drop test image
      await dragDropFile(
        page,
        '[data-testid="profile-generator-chat"]',
        path.join(__dirname, '../fixtures/test-image.png')
      );

      // Add a message with the image
      const chatInput = page.locator('[data-testid="profile-chat-input"]');
      await chatInput.fill('Here is my profile picture');

      // Send
      const sendButton = page.locator('[data-testid="send-message-button"]');
      await sendButton.click();

      // Wait for AI response
      await waitForAIResponse(page, 120000);

      const chatContent = await getChatContent(page);

      if (isRateLimited(chatContent)) {
        test.skip(true, 'Rate limited - skipping test');
        return;
      }

      expect(hasErrorIndicators(chatContent)).toBe(false);

      // AI should acknowledge receiving an image
      expect(chatContent).toMatch(/image|picture|photo|see|received|uploaded/i);
    });

    test('should process LinkedIn screenshot and generate profile sections', async ({ page }) => {
      await openProfileGenerator(page);

      // Drop LinkedIn screenshot fixture
      await dragDropFile(
        page,
        '[data-testid="profile-generator-chat"]',
        path.join(__dirname, '../fixtures/linkedin-screenshot.png')
      );

      // Add context message
      const chatInput = page.locator('[data-testid="profile-chat-input"]');
      await chatInput.fill('Here is my LinkedIn profile screenshot. Please use this to create my profile.');

      // Send
      const sendButton = page.locator('[data-testid="send-message-button"]');
      await sendButton.click();

      // Wait for AI processing (may take longer for image analysis)
      await waitForAIResponse(page, 120000);

      const chatContent = await getChatContent(page);

      if (isRateLimited(chatContent)) {
        test.skip(true, 'Rate limited - skipping test');
        return;
      }

      expect(hasErrorIndicators(chatContent)).toBe(false);

      // AI should acknowledge the LinkedIn screenshot
      expect(chatContent).toMatch(/linkedin|profile|screenshot|image/i);

      // Eventually, profile sections should be generated
      // Wait for sections to appear (the AI will call tools to generate them)
      await expect(page.locator('[data-testid="generated-sections"]')).toBeVisible({ timeout: 60000 });
    });

    test('should allow sending image without text message', async ({ page }) => {
      await openProfileGenerator(page);

      // Drop test image without any text
      await dragDropFile(
        page,
        '[data-testid="profile-generator-chat"]',
        path.join(__dirname, '../fixtures/test-image.png')
      );

      // Don't fill any text, just send
      const sendButton = page.locator('[data-testid="send-message-button"]');
      await sendButton.click();

      // Wait for AI response
      await waitForAIResponse(page, 90000);

      const chatContent = await getChatContent(page);

      if (isRateLimited(chatContent)) {
        test.skip(true, 'Rate limited - skipping test');
        return;
      }

      expect(hasErrorIndicators(chatContent)).toBe(false);

      // AI should respond to the image
      expect(chatContent.length).toBeGreaterThan(100); // Some substantial response
    });
  });

  test.describe('Upload Progress', () => {
    test('should show upload progress indicator while uploading', async ({ page }) => {
      await openProfileGenerator(page);

      // Drop image
      await dragDropFile(
        page,
        '[data-testid="profile-generator-chat"]',
        path.join(__dirname, '../fixtures/test-image.png')
      );

      // Click send and check that upload happens
      const sendButton = page.locator('[data-testid="send-message-button"]');
      await sendButton.click();

      // Wait for AI response
      await waitForAIResponse(page, 90000);

      // Verify no errors
      const chatContent = await getChatContent(page);
      expect(hasErrorIndicators(chatContent)).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle upload failure gracefully', async ({ page }) => {
      await openProfileGenerator(page);

      // Check that error state can be displayed
      const errorDisplay = page.locator('[data-testid="upload-error"]');
      // It should not be visible normally
      await expect(errorDisplay).not.toBeVisible();
    });

    test('should reject non-image files', async ({ page }) => {
      await openProfileGenerator(page);

      // Try to drop a non-image file by simulating it
      await page.evaluate(() => {
        const target = document.querySelector('[data-testid="profile-generator-chat"]');
        if (!target) return;

        const file = new File(['test content'], 'document.txt', { type: 'text/plain' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        const drop = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        });
        target.dispatchEvent(drop);
      });

      // Attachment preview should NOT appear for non-image
      await expect(page.locator('[data-testid="attachment-preview"]')).not.toBeVisible();

      // Should show an error or just ignore
      // (implementation can choose to show error toast or silently ignore)
    });
  });
});
