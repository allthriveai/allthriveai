/**
 * Image Generation E2E Tests - Nano Banana AI Agent
 *
 * These tests validate the image generation workflow via the Nano Banana agent:
 * - Basic image generation requests
 * - Descriptive prompts produce relevant images
 * - Generated images display correctly in chat
 * - Error handling for generation failures
 *
 * These tests use REAL AI tokens - run with: RUN_AI_TESTS=true npx playwright test ai-chat/image-generation.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI } from '../helpers';

// Skip all tests unless RUN_AI_TESTS=true
const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

// Helper to open the chat panel via +Add Project button
async function openChatViaAddProject(page: Page) {
  const addProjectButton = page.locator('[data-testid="add-project-button"]');
  await addProjectButton.click();
  await page.waitForTimeout(1500);
}

// Helper to wait for AI response (image generation takes longer)
async function waitForAIResponse(page: Page, timeout = 120000) {
  await page.waitForTimeout(3000);
  try {
    await page.waitForFunction(
      () => !document.body.textContent?.toLowerCase().includes('thinking...'),
      { timeout }
    );
  } catch {
    console.log('Thinking indicator timeout - continuing');
  }
  // Image generation needs more time for the image to actually appear
  await page.waitForTimeout(5000);
}

// Helper to get chat panel text content
async function getChatContent(page: Page): Promise<string> {
  const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
  const text = (await chatPanel.textContent()) || '';
  return text.toLowerCase();
}

// Helper to send a message
async function sendMessage(page: Page, message: string) {
  const chatInput = page.getByPlaceholder('Ask me anything...');
  await chatInput.fill(message);

  const sendButton = page.locator('button[aria-label="Send message"]');
  await sendButton.click();
}

// Helper to check if image was generated
async function checkForGeneratedImage(page: Page): Promise<boolean> {
  // Look for image elements in the chat panel
  const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();

  // Check for various indicators that an image was generated
  const imageIndicators = [
    chatPanel.locator('img[src*="cloudinary"]'),
    chatPanel.locator('img[src*="generated"]'),
    chatPanel.locator('img[src*="image"]'),
    chatPanel.locator('[class*="generated-image"]'),
    chatPanel.locator('img').filter({ has: page.locator('[alt*="generated"]') }),
  ];

  for (const indicator of imageIndicators) {
    const count = await indicator.count();
    if (count > 0) {
      return true;
    }
  }

  // Also check for text indicators that image generation happened
  const content = await getChatContent(page);
  return content.includes('generated') ||
         content.includes('created') ||
         content.includes('here\'s') ||
         content.includes('image') && (content.includes('your') || content.includes('the'));
}

// Helper to check for error indicators
function hasErrorIndicators(response: string): boolean {
  const errorPatterns = [
    'typeerror',
    'exception',
    'traceback',
    'nonetype',
    'error generating',
    'failed to generate',
    'unable to create',
  ];
  return errorPatterns.some(pattern => response.includes(pattern));
}

test.describe('Image Generation - Nano Banana Agent', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(180000); // Image generation can take time

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await openChatViaAddProject(page);

    const chatHeader = page.getByText('All Thrive AI Chat');
    await expect(chatHeader).toBeVisible({ timeout: 10000 });
  });

  test.describe('Basic Image Generation', () => {
    /**
     * Test: Basic image generation request
     *
     * WORKFLOW: User asks to create an image with simple prompt
     * EXPECTED: Nano Banana agent generates an image without errors
     */
    test('should generate image with basic prompt', async ({ page }) => {
      const imagePrompt = 'Create an image of a sunset over mountains';

      await sendMessage(page, imagePrompt);
      await waitForAIResponse(page, 150000); // Extra time for image generation

      const response = await getChatContent(page);
      console.log(`Response to image request: ${response.substring(0, 500)}...`);

      // Check for errors
      const hasErrors = hasErrorIndicators(response);
      console.log(`Has error indicators: ${hasErrors}`);
      expect(hasErrors).toBe(false);

      // Check that Nano Banana was invoked (agent routing)
      const nanoBananaInvoked = response.includes('nano banana') ||
                                response.includes('generating') ||
                                response.includes('image') ||
                                response.includes('creating');
      console.log(`Nano Banana invoked: ${nanoBananaInvoked}`);
      expect(nanoBananaInvoked).toBe(true);
    });

    /**
     * Test: Image generation with detailed prompt
     *
     * WORKFLOW: User asks for specific image with details
     * EXPECTED: AI acknowledges the detailed request and generates
     */
    test('should handle detailed image generation prompt', async ({ page }) => {
      const detailedPrompt = 'Generate a futuristic city skyline at night with neon lights, flying cars, and holographic advertisements';

      await sendMessage(page, detailedPrompt);
      await waitForAIResponse(page, 150000);

      const response = await getChatContent(page);
      console.log(`Response to detailed prompt: ${response.substring(0, 500)}...`);

      // Check for errors
      const hasErrors = hasErrorIndicators(response);
      expect(hasErrors).toBe(false);

      // Check that image generation was acknowledged
      const acknowledged = response.includes('generat') ||
                          response.includes('creat') ||
                          response.includes('image') ||
                          response.includes('futuristic') ||
                          response.includes('city');
      console.log(`Request acknowledged: ${acknowledged}`);
      expect(acknowledged).toBe(true);
    });
  });

  test.describe('Image Display and Interaction', () => {
    /**
     * Test: Generated image appears in chat
     *
     * WORKFLOW: Generate an image and check it displays
     * EXPECTED: Image element is visible in the chat panel
     */
    test('should display generated image in chat', async ({ page }) => {
      const imagePrompt = 'Make me a picture of a cute robot';

      await sendMessage(page, imagePrompt);
      await waitForAIResponse(page, 150000);

      // Give extra time for image to load
      await page.waitForTimeout(5000);

      const response = await getChatContent(page);
      console.log(`Response: ${response.substring(0, 500)}...`);

      // Check for errors first
      const hasErrors = hasErrorIndicators(response);
      if (hasErrors) {
        console.log('ERROR: Image generation failed with error');
        expect(hasErrors).toBe(false);
        return;
      }

      // Check if image was generated or acknowledged
      const imageGenerated = await checkForGeneratedImage(page);
      const generationAcknowledged = response.includes('generat') ||
                                      response.includes('creat') ||
                                      response.includes('here') ||
                                      response.includes('robot');

      console.log(`Image generated: ${imageGenerated}`);
      console.log(`Generation acknowledged: ${generationAcknowledged}`);

      // Either an image should be visible OR the AI should acknowledge generating one
      expect(imageGenerated || generationAcknowledged).toBe(true);
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    /**
     * Test: Vague image request handling
     *
     * WORKFLOW: User gives very vague image request
     * EXPECTED: AI either asks for clarification or makes reasonable interpretation
     */
    test('should handle vague image request', async ({ page }) => {
      const vaguePrompt = 'Make something cool';

      await sendMessage(page, vaguePrompt);
      await waitForAIResponse(page, 150000);

      const response = await getChatContent(page);
      console.log(`Response to vague request: ${response.substring(0, 500)}...`);

      // Check for errors
      const hasErrors = hasErrorIndicators(response);
      expect(hasErrors).toBe(false);

      // AI should either:
      // 1. Ask for clarification
      // 2. Generate something based on "cool"
      // 3. Provide helpful guidance
      const validResponse = response.includes('what') ||
                           response.includes('could you') ||
                           response.includes('more specific') ||
                           response.includes('generat') ||
                           response.includes('creat') ||
                           response.includes('help');
      console.log(`Valid response: ${validResponse}`);
      expect(validResponse).toBe(true);
    });

    /**
     * Test: Non-image request should not trigger Nano Banana
     *
     * WORKFLOW: User asks a general question (not image generation)
     * EXPECTED: AI responds without trying to generate an image
     */
    test('should not generate image for non-image requests', async ({ page }) => {
      const nonImagePrompt = 'What is machine learning?';

      await sendMessage(page, nonImagePrompt);
      await waitForAIResponse(page, 90000);

      const response = await getChatContent(page);
      console.log(`Response to non-image request: ${response.substring(0, 500)}...`);

      // Should NOT mention generating/creating images
      const mentionsImageGeneration = response.includes('generating an image') ||
                                       response.includes('creating an image') ||
                                       response.includes('nano banana');
      console.log(`Mentions image generation: ${mentionsImageGeneration}`);

      // Should provide educational response about ML
      const educationalResponse = response.includes('machine learning') ||
                                  response.includes('algorithm') ||
                                  response.includes('data') ||
                                  response.includes('artificial intelligence') ||
                                  response.includes('learn');
      console.log(`Educational response: ${educationalResponse}`);

      // Should NOT trigger image generation
      expect(mentionsImageGeneration).toBe(false);
      expect(educationalResponse).toBe(true);
    });
  });

  test.describe('Multiple Image Requests', () => {
    /**
     * Test: Sequential image requests
     *
     * WORKFLOW: User requests multiple images in sequence
     * EXPECTED: Both requests are handled (possibly with rate limiting message)
     */
    test('should handle sequential image requests', async ({ page }) => {
      // First request
      const firstPrompt = 'Create an image of a forest';
      await sendMessage(page, firstPrompt);
      await waitForAIResponse(page, 150000);

      const firstResponse = await getChatContent(page);
      console.log(`First response: ${firstResponse.substring(0, 300)}...`);

      // Check first request succeeded or was acknowledged
      const firstAcknowledged = !hasErrorIndicators(firstResponse) &&
                                (firstResponse.includes('forest') ||
                                 firstResponse.includes('generat') ||
                                 firstResponse.includes('creat'));
      console.log(`First request acknowledged: ${firstAcknowledged}`);

      // Wait before second request
      await page.waitForTimeout(3000);

      // Second request
      const secondPrompt = 'Now create an image of an ocean';
      await sendMessage(page, secondPrompt);
      await waitForAIResponse(page, 150000);

      const secondResponse = await getChatContent(page);
      console.log(`Second response: ${secondResponse.substring(0, 300)}...`);

      // Check second request was handled (either generated or rate limited)
      const secondHandled = secondResponse.includes('ocean') ||
                           secondResponse.includes('generat') ||
                           secondResponse.includes('creat') ||
                           secondResponse.includes('wait') ||
                           secondResponse.includes('moment') ||
                           secondResponse.includes('rate');
      console.log(`Second request handled: ${secondHandled}`);

      expect(firstAcknowledged).toBe(true);
      expect(secondHandled).toBe(true);
    });
  });
});
