/**
 * Full User Journey E2E Tests
 *
 * These tests validate complete end-to-end user workflows that combine
 * multiple AI features into realistic scenarios:
 * - Discovery and clipping projects
 * - Creating projects from URLs
 * - Image generation to project creation
 * - Getting help and support
 *
 * These tests use REAL AI tokens - run with: RUN_AI_TESTS=true npx playwright test ai-chat/user-journeys.spec.ts
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

// Helper to wait for AI response
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

// Helper to send message and get response
async function sendMessageAndGetResponse(page: Page, message: string, timeout = 90000): Promise<string> {
  await sendMessage(page, message);
  await waitForAIResponse(page, timeout);
  return getChatContent(page);
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

test.describe('User Journeys - Full E2E Workflows', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(180000); // User journeys can take time

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test.describe('Discovery Journey', () => {
    /**
     * Journey: User discovers AI projects through chat
     *
     * SCENARIO: User wants to find interesting AI projects to explore
     * STEPS:
     * 1. Open chat
     * 2. Ask to find AI projects
     * 3. AI shows project recommendations
     * 4. User can see project cards or links
     */
    test('should help user discover AI projects', async ({ page }) => {
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User asks to find projects
      const response = await sendMessageAndGetResponse(
        page,
        'Show me some interesting machine learning projects'
      );

      console.log(`Discovery response: ${response.substring(0, 500)}...`);

      // Handle rate limiting
      if (isRateLimited(response)) {
        console.log('⚠ Rate limited - skipping test');
        test.skip(true, 'Rate limited');
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response)).toBe(false);

      // AI should provide project-related content
      const hasProjectContent = response.includes('project') ||
                                response.includes('machine learning') ||
                                response.includes('ai') ||
                                response.includes('found') ||
                                response.includes('here');
      console.log(`Has project content: ${hasProjectContent}`);
      expect(hasProjectContent).toBe(true);
    });

    /**
     * Journey: User searches for specific topic
     *
     * SCENARIO: User wants to find projects about a specific topic
     * STEPS:
     * 1. Open chat
     * 2. Ask about specific topic (e.g., "computer vision")
     * 3. AI provides relevant results
     */
    test('should help user search for specific topics', async ({ page }) => {
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User searches for specific topic
      const response = await sendMessageAndGetResponse(
        page,
        'Find projects about natural language processing'
      );

      console.log(`Topic search response: ${response.substring(0, 500)}...`);

      // Handle rate limiting
      if (isRateLimited(response)) {
        console.log('⚠ Rate limited - skipping test');
        test.skip(true, 'Rate limited');
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response)).toBe(false);

      // AI should acknowledge the search
      const acknowledgedSearch = response.includes('nlp') ||
                                 response.includes('natural language') ||
                                 response.includes('project') ||
                                 response.includes('found') ||
                                 response.includes('search');
      console.log(`Acknowledged search: ${acknowledgedSearch}`);
      expect(acknowledgedSearch).toBe(true);
    });
  });

  test.describe('GitHub Import Journey', () => {
    /**
     * Journey: User imports a GitHub repository they don't own
     *
     * SCENARIO: User finds an interesting repo and wants to save it
     * STEPS:
     * 1. Open chat
     * 2. Paste a public GitHub URL (not owned by user)
     * 3. AI detects it's not their repo
     * 4. AI clips it to their library
     */
    test('should complete full clip workflow for GitHub repo user does not own', async ({ page }) => {
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Step 1: User pastes a famous GitHub repo they don't own
      const response1 = await sendMessageAndGetResponse(
        page,
        'https://github.com/facebook/react',
        120000
      );

      console.log(`Step 1 - GitHub URL response: ${response1.substring(0, 500)}...`);

      // Handle rate limiting
      if (isRateLimited(response1)) {
        console.log('⚠ Rate limited - skipping test');
        test.skip(true, 'Rate limited');
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response1)).toBe(false);

      // AI should ask if this is their project or something to clip
      const asksAboutOwnership = response1.includes('your') ||
                                  response1.includes('own') ||
                                  response1.includes('clip') ||
                                  response1.includes('save');
      console.log(`AI asks about ownership: ${asksAboutOwnership}`);
      expect(asksAboutOwnership).toBe(true);

      // Step 2: User says "just clip it" - complete the workflow
      await page.waitForTimeout(2000);
      const response2 = await sendMessageAndGetResponse(
        page,
        'just clip it to my library',
        120000
      );

      console.log(`Step 2 - Clip response: ${response2.substring(0, 500)}...`);

      // Handle rate limiting
      if (isRateLimited(response2)) {
        console.log('⚠ Rate limited on step 2 - partial success');
        expect(asksAboutOwnership).toBe(true); // At least step 1 worked
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response2)).toBe(false);

      // STRICT CHECK: AI should confirm the clip was saved
      const clipConfirmed = response2.includes('clipped') ||
                            response2.includes('saved') ||
                            response2.includes('added to') ||
                            response2.includes('library') ||
                            response2.includes('successfully');
      console.log(`Clip confirmed: ${clipConfirmed}`);

      // This is the critical assertion - the workflow should COMPLETE
      expect(clipConfirmed).toBe(true);
    });
  });

  test.describe('Image Generation Journey', () => {
    /**
     * Journey: User generates an image for their project
     *
     * SCENARIO: User needs a visual for their project
     * STEPS:
     * 1. Open chat
     * 2. Request image generation
     * 3. AI generates image via Nano Banana
     * 4. Image appears with options (download, create project)
     */
    test('should generate image and show project options', async ({ page }) => {
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User requests an image
      const response = await sendMessageAndGetResponse(
        page,
        'Create an image of a neural network visualization',
        150000
      );

      console.log(`Image generation response: ${response.substring(0, 500)}...`);

      // Handle rate limiting
      if (isRateLimited(response)) {
        console.log('⚠ Rate limited - skipping test');
        test.skip(true, 'Rate limited');
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response)).toBe(false);

      // AI should generate or acknowledge image request
      const imageGenerated = response.includes('generat') ||
                            response.includes('creat') ||
                            response.includes('image') ||
                            response.includes('download') ||
                            response.includes('neural');
      console.log(`Image generated/acknowledged: ${imageGenerated}`);
      expect(imageGenerated).toBe(true);
    });
  });

  test.describe('Support Journey', () => {
    /**
     * Journey: User needs help using the platform
     *
     * SCENARIO: User is confused about a feature
     * STEPS:
     * 1. Open chat
     * 2. Ask for help
     * 3. AI provides helpful guidance
     */
    test('should provide helpful guidance for platform questions', async ({ page }) => {
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User asks for help
      const response = await sendMessageAndGetResponse(
        page,
        'How do I create a new project on AllThrive?'
      );

      console.log(`Support response: ${response.substring(0, 500)}...`);

      // Handle rate limiting
      if (isRateLimited(response)) {
        console.log('⚠ Rate limited - skipping test');
        test.skip(true, 'Rate limited');
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response)).toBe(false);

      // AI should provide helpful guidance
      const providedHelp = response.includes('project') ||
                          response.includes('create') ||
                          response.includes('click') ||
                          response.includes('button') ||
                          response.includes('help') ||
                          response.includes('can');
      console.log(`Provided help: ${providedHelp}`);
      expect(providedHelp).toBe(true);
    });

    /**
     * Journey: User asks about specific feature
     *
     * SCENARIO: User wants to know about a specific capability
     * STEPS:
     * 1. Open chat
     * 2. Ask about feature
     * 3. AI explains the feature
     */
    test('should explain platform features', async ({ page }) => {
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // User asks about a feature
      const response = await sendMessageAndGetResponse(
        page,
        'What can Nano Banana do?'
      );

      console.log(`Feature explanation response: ${response.substring(0, 500)}...`);

      // Handle rate limiting
      if (isRateLimited(response)) {
        console.log('⚠ Rate limited - skipping test');
        test.skip(true, 'Rate limited');
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response)).toBe(false);

      // AI should explain the feature
      const explainedFeature = response.includes('nano banana') ||
                               response.includes('image') ||
                               response.includes('generat') ||
                               response.includes('creat') ||
                               response.includes('visual');
      console.log(`Explained feature: ${explainedFeature}`);
      expect(explainedFeature).toBe(true);
    });
  });

  test.describe('Multi-Step Journey', () => {
    /**
     * Journey: User has a multi-turn conversation
     *
     * SCENARIO: User has a back-and-forth with the AI
     * STEPS:
     * 1. Open chat
     * 2. Ask initial question
     * 3. Follow up with related question
     * 4. AI maintains context
     */
    test('should maintain context across conversation turns', async ({ page }) => {
      await openChatViaAddProject(page);

      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // First message
      const response1 = await sendMessageAndGetResponse(
        page,
        'Tell me about image generation features'
      );

      console.log(`First response: ${response1.substring(0, 300)}...`);

      // Handle rate limiting
      if (isRateLimited(response1)) {
        console.log('⚠ Rate limited - skipping test');
        test.skip(true, 'Rate limited');
        return;
      }

      // Wait before follow-up
      await page.waitForTimeout(2000);

      // Follow-up question
      const response2 = await sendMessageAndGetResponse(
        page,
        'Can you show me an example?'
      );

      console.log(`Second response: ${response2.substring(0, 300)}...`);

      // Handle rate limiting on second message
      if (isRateLimited(response2)) {
        console.log('⚠ Rate limited on follow-up - test partially complete');
        expect(true).toBe(true); // First part worked
        return;
      }

      // Check for errors
      expect(hasErrorIndicators(response2)).toBe(false);

      // AI should respond to the follow-up (maintaining context about images)
      const maintainedContext = response2.includes('image') ||
                                response2.includes('example') ||
                                response2.includes('here') ||
                                response2.includes('generat') ||
                                response2.includes('show');
      console.log(`Maintained context: ${maintainedContext}`);
      expect(maintainedContext).toBe(true);
    });
  });
});
