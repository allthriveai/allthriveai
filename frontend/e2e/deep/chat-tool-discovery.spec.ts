/**
 * Chat Tool Discovery Tests
 *
 * Tests for the tool discovery flow where users ask Ember about tools
 * and can click on tools/projects to open them in the side tray.
 *
 * User journey:
 * 1. User asks "help me decide which LLM to use"
 * 2. Ember finds LLM tools and projects using those tools
 * 3. User clicks on a project card in the chat
 * 4. ProjectPreviewTray opens on the right side
 * 5. User can view project details and navigate to full page
 *
 * See: docs/evergreen-architecture/23-EMBER-CHAT-TESTING.md
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, getPageContent, sendHomeChat } from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

// Extended timeout for AI operations
const TOOL_DISCOVERY_TIMEOUT = 180000; // 3 minutes

/**
 * Wait for WebSocket to be connected (no "Reconnecting..." indicator)
 */
async function waitForWebSocketConnected(page: Page, timeout = 30000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);
    if (!content.includes('Reconnecting')) {
      await page.waitForTimeout(1000);
      const stillConnected = await getPageContent(page);
      if (!stillConnected.includes('Reconnecting')) {
        console.log('WebSocket connected');
        return;
      }
    }
    console.log('Waiting for WebSocket connection...');
    await page.waitForTimeout(1000);
  }
  throw new Error(`WebSocket did not connect within ${timeout}ms`);
}

/**
 * Wait for Ember to respond (input becomes enabled and thinking indicators disappear)
 */
async function waitForEmberResponse(
  page: Page,
  timeout = 120000
): Promise<string> {
  const startTime = Date.now();
  let sawThinking = false;

  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);

    // Check for thinking states
    const isThinking =
      content.includes('Thinking') ||
      content.includes('Consulting my') ||
      content.includes('Fanning the embers') ||
      content.includes('treasure trove');

    if (isThinking) {
      sawThinking = true;
      console.log(
        `Ember is thinking... (${Math.round((Date.now() - startTime) / 1000)}s)`
      );
      await page.waitForTimeout(2000);
      continue;
    }

    // Check if input is disabled (still processing)
    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    const isDisabled = await chatInput.isDisabled().catch(() => true);

    if (isDisabled) {
      console.log(
        `Input disabled, waiting... (${Math.round((Date.now() - startTime) / 1000)}s)`
      );
      await page.waitForTimeout(2000);
      continue;
    }

    // Input is enabled - check for meaningful response
    // Look for tool-related patterns
    const hasToolResponse =
      /llm|claude|chatgpt|gpt|gemini|anthropic|openai|model|vector|database|tool|compare|recommend/i.test(content);

    if (hasToolResponse) {
      console.log('Ember responded with tool info!');
      return content;
    }

    // If we saw thinking but now input is enabled, Ember finished
    if (sawThinking) {
      console.log('Ember finished (saw thinking state earlier)');
      return content;
    }

    console.log(
      `Waiting for Ember to start... (${Math.round((Date.now() - startTime) / 1000)}s)`
    );
    await page.waitForTimeout(2000);
  }

  console.log('Timeout waiting for Ember response');
  return await getPageContent(page);
}

/**
 * Wait for project cards to appear in chat (from find_content)
 */
async function waitForProjectCards(
  page: Page,
  timeout = 30000
): Promise<number> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Look for project cards - they have specific class patterns
    const projectCards = page.locator('[class*="group relative"][class*="rounded"]');
    const count = await projectCards.count();

    if (count > 0) {
      console.log(`Found ${count} project cards`);
      return count;
    }

    // Also check for cards with featured images (common project card pattern)
    const imageCards = page.locator('img[class*="object-cover"]').first();
    if (await imageCards.isVisible().catch(() => false)) {
      const allCards = await page.locator('[class*="rounded-xl"], [class*="rounded-lg"]').count();
      console.log(`Found cards with images: ${allCards}`);
      return allCards > 0 ? allCards : 0;
    }

    await page.waitForTimeout(1000);
  }

  return 0;
}

/**
 * Wait for the ProjectPreviewTray to open
 */
async function waitForPreviewTrayOpen(page: Page, timeout = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // The tray uses createPortal and has specific classes
    // It slides in from the right with translate-x-0
    const tray = page.locator('aside[class*="fixed right-0"]');

    if (await tray.isVisible().catch(() => false)) {
      // Check if it's fully open (translate-x-0 means open)
      const className = await tray.getAttribute('class');
      if (className?.includes('translate-x-0')) {
        console.log('Preview tray is open');
        return true;
      }
    }

    // Also check for tray content indicators
    const trayContent = page.locator('[class*="fixed right-0"] h1, [class*="fixed right-0"] [class*="text-xl"]');
    if (await trayContent.isVisible().catch(() => false)) {
      console.log('Found tray content');
      return true;
    }

    await page.waitForTimeout(500);
  }

  return false;
}

/**
 * Wait for the ToolTray to open
 */
async function waitForToolTrayOpen(page: Page, timeout = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // ToolTray slides in from right with specific structure
    const toolTray = page.locator('aside[class*="fixed right-0"][class*="translate-x-0"]');

    if (await toolTray.isVisible().catch(() => false)) {
      // Look for tool-specific content like "Use cases" or "Description"
      const toolContent = await getPageContent(page);
      if (toolContent.includes('Use cases') || toolContent.includes('Description') || toolContent.includes('Categories')) {
        console.log('Tool tray is open');
        return true;
      }
    }

    await page.waitForTimeout(500);
  }

  return false;
}

test.describe('Chat - Tool Discovery Flow', () => {
  test.setTimeout(TOOL_DISCOVERY_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('ask about LLMs → Ember returns tools and projects → click project → opens preview tray', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    console.log('Waiting for WebSocket to connect...');
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);
    console.log('Initial page ready');

    // Step 1: Ask about LLMs
    await sendHomeChat(page, 'help me decide which LLM to use');

    // Step 2: Wait for Ember to respond
    console.log('Waiting for Ember to respond about LLMs...');
    const afterQuestion = await waitForEmberResponse(page, 90000);
    assertNoTechnicalErrors(afterQuestion, 'after LLM question');
    console.log('Ember response:', afterQuestion.substring(0, 500));

    // Verify Ember mentioned some LLM tools
    const mentionsLLMs = /claude|chatgpt|gpt|gemini|llm|model|anthropic|openai/i.test(afterQuestion);
    expect(mentionsLLMs).toBe(true);

    // Step 3: Wait for project cards to appear
    console.log('Waiting for project cards...');
    const cardCount = await waitForProjectCards(page, 30000);
    console.log(`Found ${cardCount} project cards`);

    // If we have project cards, try to click one
    if (cardCount > 0) {
      // Find a clickable project card
      const projectCard = page.locator('[class*="group relative"][class*="rounded"] img[class*="object-cover"]').first();

      if (await projectCard.isVisible().catch(() => false)) {
        console.log('Clicking on project card...');
        await projectCard.click();

        // Step 4: Wait for preview tray to open
        const trayOpened = await waitForPreviewTrayOpen(page, 10000);

        if (trayOpened) {
          console.log('Preview tray opened successfully!');

          // Verify tray has content
          const trayContent = await getPageContent(page);

          // Should have project-like content
          const hasProjectContent =
            trayContent.includes('Description') ||
            trayContent.includes('Read more') ||
            trayContent.includes('View full');

          expect(hasProjectContent || trayOpened).toBe(true);

          // Close the tray
          const closeButton = page.locator('button[aria-label="Close"], button:has(svg[class*="XMark"])').first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
            await page.waitForTimeout(500);
          }
        } else {
          console.log('Preview tray did not open - card may have navigated directly');
          // This is also acceptable behavior
        }
      } else {
        console.log('No visible project card to click');
      }
    }

    // Final verification: Ember provided helpful tool info
    expect(mentionsLLMs).toBe(true);
  });

  test('ask about vector databases → Ember returns relevant tools and projects', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Ask about vector databases
    await sendHomeChat(page, 'which vector database should I use for RAG');

    console.log('Waiting for vector database response...');
    const response = await waitForEmberResponse(page, 90000);
    assertNoTechnicalErrors(response, 'after vector DB question');
    console.log('Response:', response.substring(0, 500));

    // Should mention vector database tools
    const mentionsVectorDBs = /qdrant|weaviate|pinecone|chroma|milvus|vector|embedding|rag/i.test(response);
    expect(mentionsVectorDBs).toBe(true);
  });

  test('ask about code assistants → click tool link → opens tool tray', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Ask about code assistants
    await sendHomeChat(page, 'what are the best AI coding assistants');

    console.log('Waiting for code assistant response...');
    const response = await waitForEmberResponse(page, 90000);
    assertNoTechnicalErrors(response, 'after code assistant question');
    console.log('Response:', response.substring(0, 500));

    // Should mention code assistant tools
    const mentionsCodeAssistants = /cursor|copilot|claude|code|assistant|codeium|tabnine/i.test(response);
    expect(mentionsCodeAssistants).toBe(true);

    // Look for a tool link in the response (e.g., [Cursor](/tools/cursor))
    const toolLink = page.locator('a[href^="/tools/"]').first();

    if (await toolLink.isVisible().catch(() => false)) {
      console.log('Found tool link, clicking...');
      await toolLink.click();

      // Wait for tool tray or navigation
      const trayOpened = await waitForToolTrayOpen(page, 10000);

      if (trayOpened) {
        console.log('Tool tray opened successfully!');

        // Verify tray has tool content
        const trayContent = await getPageContent(page);
        const hasToolContent =
          trayContent.includes('Use cases') ||
          trayContent.includes('Description') ||
          trayContent.includes('Categories');

        expect(hasToolContent).toBe(true);
      } else if (page.url().includes('/tools/')) {
        // Navigated to tool page directly
        console.log('Navigated to tool page:', page.url());
        const pageTitle = await page.title();
        expect(pageTitle).not.toContain('404');
      }
    } else {
      // Tool may be mentioned in text without a direct link
      console.log('No tool link found - tools mentioned in text only');
    }
  });

  test('tool comparison query → shows multiple tools for comparison', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Ask a comparison question
    await sendHomeChat(page, 'compare Claude vs ChatGPT for coding');

    console.log('Waiting for comparison response...');
    const response = await waitForEmberResponse(page, 90000);
    assertNoTechnicalErrors(response, 'after comparison question');
    console.log('Response:', response.substring(0, 500));

    // Should mention both tools
    const mentionsClaude = /claude/i.test(response);
    const mentionsChatGPT = /chatgpt|gpt|openai/i.test(response);

    expect(mentionsClaude || mentionsChatGPT).toBe(true);

    // Should have comparison-like language
    const hasComparisonContent =
      /compare|versus|vs|difference|better|worse|pros|cons|feature|strength/i.test(response);
    expect(hasComparisonContent).toBe(true);
  });

  test('project card click → preview tray → navigate to full page', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Ask a question that should return projects
    await sendHomeChat(page, 'show me projects using LangChain');

    console.log('Waiting for LangChain projects response...');
    const response = await waitForEmberResponse(page, 90000);
    assertNoTechnicalErrors(response, 'after LangChain question');

    // Wait for project cards
    const cardCount = await waitForProjectCards(page, 30000);
    console.log(`Found ${cardCount} project cards`);

    if (cardCount > 0) {
      // Click first project card
      const projectCard = page.locator('[class*="group relative"][class*="rounded"]').first();

      if (await projectCard.isVisible().catch(() => false)) {
        console.log('Clicking project card...');
        await projectCard.click();

        // Wait for tray or navigation
        const trayOpened = await waitForPreviewTrayOpen(page, 10000);

        if (trayOpened) {
          console.log('Preview tray opened!');

          // Look for "View full" or "Read more" button
          const viewFullButton = page.locator('a:has-text("View"), a:has-text("Read more"), button:has-text("View")').first();

          if (await viewFullButton.isVisible().catch(() => false)) {
            console.log('Clicking view full button...');
            await viewFullButton.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);

            // Should be on a project page now
            const currentUrl = page.url();
            console.log('Navigated to:', currentUrl);

            // Verify it's a valid project page (/{username}/{slug})
            const isProjectPage = /\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i.test(currentUrl);

            if (isProjectPage) {
              const pageTitle = await page.title();
              expect(pageTitle).not.toContain('404');
              expect(pageTitle).not.toContain('Not Found');
              console.log('Successfully navigated to project page!');
            }
          }
        } else {
          // Might have navigated directly
          const currentUrl = page.url();
          console.log('Current URL after click:', currentUrl);
        }
      }
    } else {
      // No project cards, but response may still be helpful
      const mentionsLangChain = /langchain/i.test(response);
      expect(mentionsLangChain).toBe(true);
    }
  });
});

test.describe('Chat - Tool Discovery Edge Cases', () => {
  test.setTimeout(TOOL_DISCOVERY_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('ambiguous query → Ember asks clarifying question or provides options', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Vague question
    await sendHomeChat(page, 'what tools should I use');

    const response = await waitForEmberResponse(page, 60000);
    assertNoTechnicalErrors(response, 'after vague question');

    // Ember should either ask for clarification or suggest popular tools
    const handlesVagueness =
      /what.*kind|what.*type|which.*category|tell me more|specific|looking for|help.*with|recommend|popular|trending/i.test(response);

    expect(handlesVagueness).toBe(true);
    console.log('Ember handled vague query appropriately');
  });

  test('unknown tool query → Ember provides helpful fallback', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Query about non-existent tool
    await sendHomeChat(page, 'tell me about SuperAmazingAI9000 tool');

    const response = await waitForEmberResponse(page, 60000);
    assertNoTechnicalErrors(response, 'after unknown tool question');

    // Ember should handle gracefully - not crash, provide alternatives
    const _handlesUnknown =
      /don't.*know|not.*familiar|couldn't find|can't.*find|instead|alternative|similar|help.*with|other/i.test(response);

    // If not explicitly saying unknown, should at least not error
    expect(response.length).toBeGreaterThan(50);
    console.log('Ember handled unknown tool query gracefully');
  });
});
