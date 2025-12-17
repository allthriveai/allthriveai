/**
 * Multi-Agent Routing E2E Tests
 *
 * These tests validate that the AI supervisor correctly routes user messages
 * to the appropriate agent based on intent detection.
 *
 * Agents in the system:
 * - Discovery Agent: Searches and explores projects (find, search, discover, trending)
 * - Project Agent: Creates/imports projects (github, youtube, upload, import)
 * - Nano Banana: Creates images/infographics (create image, infographic)
 * - Support Agent: General help (fallback for questions)
 * - Scout (Learning): Quiz and learning help (learn, quiz, progress)
 *
 * These tests use REAL AI tokens - run with: RUN_AI_TESTS=true npx playwright test ai-chat/
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

// Helper to wait for AI response (waits for "thinking" to disappear)
async function waitForAIResponse(page: Page, timeout = 90000) {
  await page.waitForTimeout(3000); // Initial wait for thinking to start

  try {
    await page.waitForFunction(
      () => {
        const content = document.body.textContent || '';
        // Wait until thinking indicator is gone
        return !content.toLowerCase().includes('thinking...');
      },
      { timeout }
    );
  } catch {
    console.log('Thinking indicator timeout - continuing with current state');
  }

  await page.waitForTimeout(2000); // Buffer for response to render
}

// Helper to get chat panel text content
async function getChatContent(page: Page): Promise<string> {
  const chatPanel = page.locator('.fixed.right-0.top-0, [class*="slide"], [class*="chat"]').first();
  const text = (await chatPanel.textContent()) || '';
  return text.toLowerCase();
}

// Helper to check for technical errors in response
async function assertNoTechnicalErrors(page: Page) {
  const technicalErrors = ['TypeError', 'Exception', 'Traceback', 'NoneType', 'AttributeError'];
  for (const error of technicalErrors) {
    const hasError = await page.getByText(error).isVisible().catch(() => false);
    expect(hasError).toBe(false);
  }
}

test.describe('Multi-Agent Routing', () => {
  // Skip all tests unless explicitly enabled
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');

  // Increase timeout for AI responses
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test.describe('Discovery Agent Routing', () => {
    /**
     * Test: Discovery agent should handle "find projects" requests
     *
     * EXPECTED BEHAVIOR:
     * - User asks to find/search/discover projects
     * - Supervisor routes to Discovery agent
     * - Discovery agent searches and returns project recommendations
     *
     * SUCCESS INDICATORS:
     * - Response mentions projects, creators, or search results
     * - Response does NOT try to create/import a project
     * - Response does NOT ask for a URL or file upload
     */
    test('should route "find AI projects" to Discovery agent', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatViaAddProject(page);

      // Verify chat is open
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Send a discovery-intent message
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('Find me some cool AI art projects to explore');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await waitForAIResponse(page);

      // Get the chat content
      const chatContent = await getChatContent(page);
      console.log(`Chat response preview: ${chatContent.substring(0, 500)}...`);

      // SUCCESS: Discovery agent should return project recommendations
      const discoverySuccessIndicators = [
        'project',
        'creator',
        'explore',
        'check out',
        'recommend',
        'found',
        'here are',
        'trending',
        'popular',
      ];

      const hasDiscoveryResponse = discoverySuccessIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      // FAILURE: Should NOT try to create a project or ask for URL
      const wrongRoutingIndicators = [
        'paste a url',
        'upload a file',
        'what url would you like',
        'connect your github',
        'import your project',
      ];

      const hasWrongRouting = wrongRoutingIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      console.log(`Discovery response found: ${hasDiscoveryResponse}`);
      console.log(`Wrong routing detected: ${hasWrongRouting}`);

      // Assertions
      expect(hasWrongRouting).toBe(false);
      expect(hasDiscoveryResponse).toBe(true);

      // No technical errors
      await assertNoTechnicalErrors(page);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });
  });

  test.describe('Project Agent Routing', () => {
    /**
     * Test: Project agent should handle GitHub URL imports
     *
     * EXPECTED BEHAVIOR:
     * - User pastes a GitHub URL
     * - Supervisor routes to Project agent
     * - Project agent processes the URL and either:
     *   a) Imports the repo (if user owns it)
     *   b) Clips the repo (if user doesn't own it)
     *   c) Asks about ownership
     *
     * SUCCESS INDICATORS:
     * - Response mentions the repository name
     * - Response talks about importing, clipping, or creating a project
     * - Response does NOT recommend other projects to explore
     */
    test('should route GitHub URL to Project agent', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatViaAddProject(page);

      // Verify chat is open
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Send a GitHub URL (project intent)
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://github.com/sindresorhus/awesome');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await waitForAIResponse(page);

      // Get the chat content
      const chatContent = await getChatContent(page);
      console.log(`Chat response preview: ${chatContent.substring(0, 600)}...`);

      // SUCCESS: Project agent should process the repo
      const projectSuccessIndicators = [
        'awesome', // The repo name
        'import',
        'clip',
        'project',
        'repository',
        'github',
        'created',
        'added',
        'your own',
        'ownership',
      ];

      const hasProjectResponse = projectSuccessIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      // FAILURE: Should NOT be a discovery/search response
      const wrongRoutingIndicators = [
        'here are some projects you might like',
        'i found these trending',
        'check out these creators',
        'explore these',
      ];

      const hasWrongRouting = wrongRoutingIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      console.log(`Project response found: ${hasProjectResponse}`);
      console.log(`Wrong routing detected: ${hasWrongRouting}`);

      // Assertions
      expect(hasWrongRouting).toBe(false);
      expect(hasProjectResponse).toBe(true);

      // No technical errors
      await assertNoTechnicalErrors(page);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });
  });

  test.describe('Image Generation Routing (Nano Banana)', () => {
    /**
     * Test: Nano Banana should handle "create an image" requests
     *
     * EXPECTED BEHAVIOR:
     * - User asks to create an image or infographic
     * - Supervisor routes to Nano Banana (image generation agent)
     * - Nano Banana either:
     *   a) Starts generating an image
     *   b) Asks for more details about what to create
     *
     * SUCCESS INDICATORS:
     * - Response talks about creating/generating an image
     * - Response may ask for description or style preferences
     * - Response does NOT try to import a URL or search projects
     *
     * NOTE: Image generation takes longer and uses more tokens
     */
    test('should route "create an image" to Nano Banana agent', async ({ page }) => {
      // Increase timeout for image generation
      test.setTimeout(180000);

      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatViaAddProject(page);

      // Verify chat is open
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Send an image generation request
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('Create an image of a futuristic city with flying cars at sunset');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response (image generation can take longer)
      await waitForAIResponse(page, 120000);

      // Get the chat content
      const chatContent = await getChatContent(page);
      console.log(`Chat response preview: ${chatContent.substring(0, 600)}...`);

      // SUCCESS: Nano Banana should be generating or asking about the image
      const imageGenSuccessIndicators = [
        'image',
        'generating',
        'create',
        'futuristic',
        'city',
        'visual',
        'design',
        'style',
        'infographic',
        'picture',
      ];

      const hasImageGenResponse = imageGenSuccessIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      // FAILURE: Should NOT be a search/discovery or project import response
      const wrongRoutingIndicators = [
        'here are some projects',
        'paste a url',
        'github repository',
        'upload a file',
        'trending projects',
      ];

      const hasWrongRouting = wrongRoutingIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      console.log(`Image gen response found: ${hasImageGenResponse}`);
      console.log(`Wrong routing detected: ${hasWrongRouting}`);

      // Assertions
      expect(hasWrongRouting).toBe(false);
      expect(hasImageGenResponse).toBe(true);

      // No technical errors
      await assertNoTechnicalErrors(page);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });
  });

  test.describe('Support Agent Routing', () => {
    /**
     * Test: Support agent should handle general help questions
     *
     * EXPECTED BEHAVIOR:
     * - User asks a general question about the platform
     * - Supervisor routes to Support agent
     * - Support agent provides helpful guidance
     *
     * SUCCESS INDICATORS:
     * - Response provides helpful information or guidance
     * - Response may direct user to features or settings
     * - Response does NOT try to create a project or search
     */
    test('should route "how do I" questions to Support agent', async ({ page }) => {
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatViaAddProject(page);

      // Verify chat is open
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Send a support/help question
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('How do I change my profile settings on AllThrive?');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response
      await waitForAIResponse(page);

      // Get the chat content
      const chatContent = await getChatContent(page);
      console.log(`Chat response preview: ${chatContent.substring(0, 600)}...`);

      // SUCCESS: Support agent should provide helpful guidance
      const supportSuccessIndicators = [
        'profile',
        'settings',
        'account',
        'change',
        'update',
        'edit',
        'navigate',
        'go to',
        'click',
        'help',
        'can',
      ];

      const hasSupportResponse = supportSuccessIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      // FAILURE: Should NOT try to create/import project or generate image
      const wrongRoutingIndicators = [
        'generating your image',
        'clipping this repository',
        'here are some trending projects',
        'paste a github url',
      ];

      const hasWrongRouting = wrongRoutingIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      console.log(`Support response found: ${hasSupportResponse}`);
      console.log(`Wrong routing detected: ${hasWrongRouting}`);

      // Assertions
      expect(hasWrongRouting).toBe(false);
      expect(hasSupportResponse).toBe(true);

      // No technical errors
      await assertNoTechnicalErrors(page);

      // Chat should remain functional
      await expect(chatHeader).toBeVisible();
    });
  });

  test.describe('Workflow Continuation', () => {
    /**
     * Test: When an agent asks a question, user's response should go back to SAME agent
     *
     * This is a CRITICAL test for a known bug where:
     * - Project agent asks "Is this your own video or clipping?"
     * - User responds "my own and Midjourney"
     * - Supervisor incorrectly routes to Discovery agent (because of "Midjourney" keyword)
     *
     * EXPECTED BEHAVIOR:
     * - User pastes GitHub URL
     * - Project agent asks about ownership
     * - User responds with ownership info
     * - Response stays with Project agent and creates/clips the project
     *
     * FAILURE CASE:
     * - User's response gets routed to a different agent (e.g., Discovery)
     */
    test('CRITICAL: user response to ownership question should stay with Project agent', async ({ page }) => {
      // This is a longer multi-step test
      test.setTimeout(180000);

      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      await openChatViaAddProject(page);

      // Verify chat is open
      const chatHeader = page.getByText('All Thrive AI Chat');
      await expect(chatHeader).toBeVisible({ timeout: 10000 });

      // Step 1: Send a GitHub URL
      const chatInput = page.getByPlaceholder('Ask me anything...');
      await chatInput.fill('https://github.com/chalk/chalk');

      const sendButton = page.locator('button[aria-label="Send message"]');
      await sendButton.click();

      // Wait for AI response (should ask about ownership)
      await waitForAIResponse(page);

      // Get initial response
      let chatContent = await getChatContent(page);
      console.log(`Step 1 response: ${chatContent.substring(0, 400)}...`);

      // Check if Project agent asked about ownership
      const ownershipQuestionIndicators = [
        'your own',
        'clipping',
        'clip',
        'own this',
        'your project',
      ];

      const askedAboutOwnership = ownershipQuestionIndicators.some(indicator =>
        chatContent.includes(indicator)
      );

      if (askedAboutOwnership) {
        console.log('✓ Project agent asked about ownership');

        // Step 2: Respond with ownership info
        await chatInput.fill('just clip it - I found this library and want to save it');
        await sendButton.click();

        // Wait for AI response - but it might navigate to project page!
        await page.waitForTimeout(5000);

        // Check if we were navigated to a project page (SUCCESS case)
        const currentUrl = page.url();
        const navigatedToProject = currentUrl.includes('/chalk') || currentUrl.includes('/project');

        if (navigatedToProject) {
          console.log(`✓ SUCCESS: Navigated to project page: ${currentUrl}`);
          // The project was created and we were redirected - this is success!
          expect(navigatedToProject).toBe(true);
        } else {
          // Still on same page, wait for response in chat
          await waitForAIResponse(page, 120000);

          // Get the final response
          chatContent = await getChatContent(page);
          console.log(`Step 2 response: ${chatContent.substring(Math.max(0, chatContent.length - 600))}...`);

          // SUCCESS: Project agent should have clipped/created the project
          const successIndicators = [
            'clipped',
            'saved',
            'created',
            'project',
            'chalk',
            'added',
            'library',
          ];

          const hasSuccess = successIndicators.some(indicator =>
            chatContent.includes(indicator)
          );

          // FAILURE: Should NOT have been routed to Discovery agent
          const wrongRoutingIndicators = [
            'here are some projects you might like',
            'i found these trending',
            'explore these',
            'searching for',
            'let me search',
          ];

          const hasWrongRouting = wrongRoutingIndicators.some(indicator =>
            chatContent.includes(indicator)
          );

          console.log(`Success indicators found: ${hasSuccess}`);
          console.log(`Wrong routing detected: ${hasWrongRouting}`);

          // Assertions
          expect(hasWrongRouting).toBe(false);
          expect(hasSuccess).toBe(true);
        }
      } else {
        // If it auto-clipped without asking, that's also acceptable
        console.log('Project agent auto-processed without ownership question (also valid)');

        const autoProcessIndicators = ['clipped', 'created', 'imported', 'saved', 'chalk'];
        const hasAutoProcess = autoProcessIndicators.some(indicator =>
          chatContent.includes(indicator)
        );

        expect(hasAutoProcess).toBe(true);
      }

      // No technical errors (only check if we're still on a page with potential errors)
      const currentUrl = page.url();
      if (!currentUrl.includes('/chalk')) {
        await assertNoTechnicalErrors(page);
        // Chat should remain functional
        await expect(chatHeader).toBeVisible();
      } else {
        // We're on project page - verify it loaded correctly
        const projectTitle = page.locator('h1, [class*="title"]').first();
        await expect(projectTitle).toBeVisible({ timeout: 10000 });
        console.log('✓ Project page loaded successfully');
      }
    });
  });
});
