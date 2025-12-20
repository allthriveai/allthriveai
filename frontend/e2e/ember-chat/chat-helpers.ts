/**
 * Ember Chat E2E Test Helpers
 *
 * Reusable utilities for testing the unified Ember chat system.
 * These helpers abstract common patterns to keep tests focused on behavior.
 */

import { Page, Locator, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Re-export expect for use in helper functions only
// Tests should import expect directly from @playwright/test

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONSTANTS
// ============================================================================

export const FIXTURES_PATH = path.join(__dirname, '../fixtures');

export const TEST_FILES = {
  image: path.join(FIXTURES_PATH, 'test-image.png'),
  video: path.join(FIXTURES_PATH, 'test-video.mp4'),
  screenshot: path.join(FIXTURES_PATH, 'linkedin-screenshot.png'),
};

// Timeouts for different operations
export const TIMEOUTS = {
  chatConnect: 10000,      // WebSocket connection
  aiResponse: 90000,       // Standard AI response
  imageGeneration: 180000, // Nano Banana image generation
  projectCreation: 120000, // Project creation workflow
  upload: 30000,           // File upload
};

// ============================================================================
// CHAT ACCESS HELPERS
// ============================================================================

/**
 * Open chat on /home page (embedded layout)
 * Chat is already visible on this page
 */
export async function openEmbeddedChat(page: Page): Promise<void> {
  await page.goto('/home');
  await page.waitForLoadState('domcontentloaded');

  // Wait for chat input to be ready
  const chatInput = page.locator('input[placeholder="Message Ember..."]');
  await expect(chatInput).toBeVisible({ timeout: TIMEOUTS.chatConnect });
}

/**
 * Open chat sidebar from any page
 * Clicks the chat icon in the header
 */
export async function openChatSidebar(page: Page, fromPage: string = '/explore'): Promise<void> {
  await page.goto(fromPage);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Click chat icon in header (the "Chat" button with dragon icon)
  const chatButton = page.locator('button:has-text("Chat"), [data-testid="chat-toggle"]');
  await chatButton.first().click();

  // Wait for sidebar to slide in
  await page.waitForTimeout(500);

  // Verify chat is open - sidebar uses "Ask me anything..." placeholder
  const chatInput = page.locator('input[placeholder="Ask me anything..."], input[placeholder="Message Ember..."]');
  await expect(chatInput.first()).toBeVisible({ timeout: TIMEOUTS.chatConnect });
}

/**
 * Get the chat container element
 */
export function getChatContainer(page: Page): Locator {
  // Match both embedded and sidebar layouts
  return page.locator('[class*="chat"], [data-testid="chat-container"]').first();
}

/**
 * Get the chat input element
 */
export function getChatInput(page: Page): Locator {
  return page.locator('input[placeholder="Message Ember..."], input[placeholder="Ask me anything..."]').first();
}

/**
 * Get the send button element
 */
export function getSendButton(page: Page): Locator {
  return page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
}

// ============================================================================
// MESSAGE HELPERS
// ============================================================================

/**
 * Send a message in chat
 */
export async function sendMessage(page: Page, message: string): Promise<void> {
  const input = getChatInput(page);
  await input.fill(message);

  const sendButton = getSendButton(page);
  await sendButton.click();
}

/**
 * Wait for Ember's response to complete
 * Watches for loading indicators to disappear
 */
export async function waitForEmberResponse(page: Page, timeout = TIMEOUTS.aiResponse): Promise<void> {
  // Wait a moment for processing to start
  await page.waitForTimeout(2000);

  try {
    // Wait for loading indicator to disappear
    await page.waitForFunction(
      () => {
        const body = document.body.textContent?.toLowerCase() || '';
        const loadingIndicators = [
          'thinking...',
          'processing...',
          'loading...',
          'connecting...',
        ];
        return !loadingIndicators.some(indicator => body.includes(indicator));
      },
      { timeout }
    );
  } catch {
    console.log('Loading indicator timeout - continuing with current state');
  }

  // Buffer for response to fully render
  await page.waitForTimeout(1500);
}

/**
 * Get all assistant messages from chat
 */
export async function getAssistantMessages(page: Page): Promise<string[]> {
  const messages = await page.locator('[class*="assistant"], [data-sender="assistant"]').allTextContents();
  return messages.map(m => m.toLowerCase());
}

/**
 * Get the last assistant message
 */
export async function getLastAssistantMessage(page: Page): Promise<string> {
  const messages = await getAssistantMessages(page);
  return messages[messages.length - 1] || '';
}

/**
 * Check if any assistant message contains specific text
 */
export async function assistantSaid(page: Page, text: string): Promise<boolean> {
  const messages = await getAssistantMessages(page);
  return messages.some(m => m.includes(text.toLowerCase()));
}

/**
 * Get the full chat content as lowercase text
 */
export async function getChatContent(page: Page): Promise<string> {
  // Get full page content - simpler and more reliable than finding specific container
  const text = (await page.locator('body').textContent()) || '';
  return text.toLowerCase();
}

// ============================================================================
// MEDIA UPLOAD HELPERS
// ============================================================================

/**
 * Upload a file via drag and drop
 */
export async function dragDropFile(page: Page, filePath: string): Promise<void> {
  const input = getChatInput(page);
  const inputBox = await input.boundingBox();

  if (!inputBox) {
    throw new Error('Chat input not found for drag and drop');
  }

  // Create a DataTransfer with the file
  const dataTransfer = await page.evaluateHandle(async (filePath) => {
    const dt = new DataTransfer();
    const response = await fetch(filePath);
    const blob = await response.blob();
    const file = new File([blob], filePath.split('/').pop() || 'file', { type: blob.type });
    dt.items.add(file);
    return dt;
  }, filePath);

  // Dispatch drag events on the chat container or input area
  const dropZone = page.locator('[class*="chat"], [data-testid="chat-drop-zone"]').first();

  await dropZone.dispatchEvent('dragenter', { dataTransfer });
  await dropZone.dispatchEvent('dragover', { dataTransfer });
  await dropZone.dispatchEvent('drop', { dataTransfer });
}

/**
 * Upload a file via the chat system
 * Clicks the plus menu's "Upload Image or Video" option which triggers a file picker
 * Uses file chooser interception for reliable file upload
 */
export async function uploadFileViaInput(page: Page, filePath: string): Promise<void> {
  // Click plus menu button (has aria-label="Add integration")
  const plusButton = page.locator('button[aria-label="Add integration"]');
  await plusButton.click();
  await page.waitForTimeout(300);

  // Set up file chooser listener before clicking upload
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);

  // Click "Upload Image or Video" option
  const uploadOption = page.locator('button[role="menuitem"]:has-text("Upload Image or Video")');
  await uploadOption.click();

  // File chooser should be triggered by the plus menu
  const fileChooser = await fileChooserPromise;
  if (fileChooser) {
    await fileChooser.setFiles(filePath);
    // Wait for file to be added to attachments
    await page.waitForTimeout(500);
  } else {
    throw new Error('File chooser was not triggered - upload functionality may not be working');
  }
}

/**
 * Check if an image/media preview is shown in chat
 */
export async function hasMediaPreview(page: Page): Promise<boolean> {
  const preview = page.locator('[class*="preview"], img[src*="blob:"], img[src*="upload"]');
  return (await preview.count()) > 0;
}

/**
 * Check if attachment previews are shown in the input area
 */
export async function hasAttachmentPreview(page: Page): Promise<boolean> {
  // Look for the attachment preview chips that show file names with paperclip icons
  // The chips are in a flex container with gap-2 and have paperclip icons
  // Also check for text containing typical file extensions
  const attachmentChips = page.locator('.mb-2.flex.flex-wrap.gap-2 > div');
  const chipCount = await attachmentChips.count();

  if (chipCount > 0) return true;

  // Fallback: look for text containing file extension in the input area
  const fileNameVisible = await page.locator('text=.png, text=.jpg, text=.jpeg, text=.mp4, text=.webm').first().isVisible().catch(() => false);
  return fileNameVisible;
}

/**
 * Get count of attached files
 */
export async function getAttachmentCount(page: Page): Promise<number> {
  const attachmentChips = page.locator('.mb-2.flex.flex-wrap.gap-2 > div');
  return await attachmentChips.count();
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert Ember asked about media ownership (project vs clipping)
 */
export async function assertAskedAboutOwnership(page: Page): Promise<void> {
  const content = await getChatContent(page);

  const ownershipIndicators = [
    'your own',
    'your project',
    'working on',
    'something you made',
    'something you found',
    'clipping',
    'save to',
  ];

  const asked = ownershipIndicators.some(indicator => content.includes(indicator));
  expect(asked).toBe(true);
}

/**
 * Assert Ember asked about tools used
 */
export async function assertAskedAboutTools(page: Page): Promise<void> {
  const content = await getChatContent(page);

  const toolIndicators = [
    'tools',
    'made with',
    'built with',
    'created with',
    'what did you use',
    'how did you make',
  ];

  const asked = toolIndicators.some(indicator => content.includes(indicator));
  expect(asked).toBe(true);
}

/**
 * Assert no technical errors in chat
 */
export async function assertNoTechnicalErrors(page: Page): Promise<void> {
  const technicalErrors = [
    'TypeError',
    'Exception',
    'Traceback',
    'NoneType',
    'AttributeError',
    'Error:',
    'undefined',
    'null',
  ];

  for (const error of technicalErrors) {
    const hasError = await page.getByText(error, { exact: false }).isVisible().catch(() => false);
    if (hasError) {
      const content = await getChatContent(page);
      console.error(`Technical error found: ${error}`);
      console.error(`Context: ${content.substring(0, 500)}`);
    }
    expect(hasError).toBe(false);
  }
}

/**
 * Assert a project was created
 */
export async function assertProjectCreated(page: Page): Promise<boolean> {
  const content = await getChatContent(page);

  const successIndicators = [
    'created',
    'project is ready',
    'added to your',
    'successfully',
    'here\'s your project',
  ];

  return successIndicators.some(indicator => content.includes(indicator));
}

/**
 * Assert media was saved to clippings
 */
export async function assertSavedToClippings(page: Page): Promise<boolean> {
  const content = await getChatContent(page);

  const successIndicators = [
    'clipped',
    'saved to',
    'added to clippings',
    'saved',
  ];

  return successIndicators.some(indicator => content.includes(indicator));
}

// ============================================================================
// WORKFLOW HELPERS
// ============================================================================

/**
 * Complete a project creation from media upload
 * Answers Ember's questions with "my project"
 */
export async function createProjectFromMedia(
  page: Page,
  filePath: string,
  toolName: string = ''
): Promise<void> {
  // Upload the file
  await uploadFileViaInput(page, filePath);
  await page.waitForTimeout(2000);

  // Wait for Ember to respond
  await waitForEmberResponse(page);

  // Answer ownership question
  const response = toolName
    ? `This is my project, I made it with ${toolName}`
    : 'This is my project';

  await sendMessage(page, response);
  await waitForEmberResponse(page, TIMEOUTS.projectCreation);
}

/**
 * Save media as clipping
 * Answers Ember's questions with "clipping"
 */
export async function saveMediaAsClipping(page: Page, filePath: string): Promise<void> {
  // Upload the file
  await uploadFileViaInput(page, filePath);
  await page.waitForTimeout(2000);

  // Wait for Ember to respond
  await waitForEmberResponse(page);

  // Answer to save as clipping
  await sendMessage(page, 'Save this to my clippings');
  await waitForEmberResponse(page);
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

/**
 * Take a screenshot with timestamp
 */
export async function debugScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/debug-${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Log chat content for debugging
 */
export async function debugLogChat(page: Page, label: string = 'Chat'): Promise<void> {
  const content = await getChatContent(page);
  console.log(`\n=== ${label} ===`);
  console.log(content.substring(0, 1000));
  console.log('='.repeat(50) + '\n');
}
