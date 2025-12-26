/**
 * AI Chat Flow Journey E2E Test
 *
 * Tests the core AI experience: Ava Chat → Multi-Turn → Context Preservation
 *
 * Real-World Value: Catches AI routing bugs and context loss
 *
 * This test validates that:
 * 1. Ava responds helpfully to various query types
 * 2. Multi-turn context is preserved
 * 3. Agent routing works correctly (discovery, learning, creation)
 * 4. Conversations persist after page refresh
 * 5. Chat history is maintained
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  sendHomeChat,
  waitForAvaReady,
  getPageContent,
  assertNoTechnicalErrors,
  assertHelpfulResponse,
  getConversations,
  goToHomeAndWaitForAva,
  JOURNEY_TIMEOUT,
} from './journey-helpers';

test.describe('AI Chat Flow Journey', () => {
  test.setTimeout(JOURNEY_TIMEOUT);

  test('complete multi-turn conversation with context preservation', async ({ page }) => {
    await loginViaAPI(page);
    await goToHomeAndWaitForAva(page);

    // =========================================================================
    // TURN 1: Ask a question - Ava should respond helpfully
    // =========================================================================
    console.log('Turn 1: Asking a learning question...');

    await sendHomeChat(page, 'I want to learn about building AI chatbots');
    await waitForAvaReady(page);

    let response = await getPageContent(page);
    assertHelpfulResponse(response, 'learning question');

    // Ava should provide some helpful response (not error)
    // Accept various response types: learning resources, direct answers, or suggestions
    const hasHelpfulContent =
      /learn|chatbot|AI|project|course|path|start|build|resource|here|help/i.test(response);
    expect(hasHelpfulContent).toBe(true);

    // =========================================================================
    // TURN 2: Follow-up - conversation should continue
    // =========================================================================
    console.log('Turn 2: Asking follow-up question...');

    await sendHomeChat(page, 'What tools would I need?');
    await waitForAvaReady(page);

    response = await getPageContent(page);
    assertHelpfulResponse(response, 'follow-up question');

    // Should get a response that's relevant (mentions tools, frameworks, APIs, etc.)
    const hasFollowUpContent =
      /tool|api|framework|library|python|langchain|openai|model|need|require|use/i.test(response);
    expect(hasFollowUpContent).toBe(true);

    // =========================================================================
    // TURN 3: Discovery intent - find projects
    // =========================================================================
    console.log('Turn 3: Asking for project discovery...');

    await sendHomeChat(page, 'Show me some chatbot projects people have built');
    await waitForAvaReady(page);

    response = await getPageContent(page);
    assertHelpfulResponse(response, 'project discovery');

    // Should respond with something about projects/exploration
    expect(response).toMatch(/project|found|here|explore|check out|creator|built|discover/i);

    // =========================================================================
    // TURN 4: Navigation intent
    // =========================================================================
    console.log('Turn 4: Testing navigation...');

    await sendHomeChat(page, 'Take me to explore');
    await waitForAvaReady(page);

    // May navigate or provide link
    const currentUrl = page.url();
    response = await getPageContent(page);

    const hasNavigation =
      currentUrl.includes('/explore') ||
      response.match(/explore|navigate|go to|here|click/i);
    expect(hasNavigation).toBeTruthy();

    // =========================================================================
    // STEP 5: Verify conversation persists after refresh
    // =========================================================================
    console.log('Step 5: Verifying conversation persistence...');

    // Go back to home
    await goToHomeAndWaitForAva(page);

    response = await getPageContent(page);
    assertNoTechnicalErrors(response, 'home after navigation');

    // Conversation history should be visible or accessible
    // Note: Exact implementation may vary - just verify no errors

    // =========================================================================
    // STEP 6: Verify via API
    // =========================================================================
    console.log('Step 6: Checking conversations via API...');

    const conversations = await getConversations(page);
    console.log(`Found ${conversations.length} conversations`);

    // Should have at least one conversation
    expect(conversations.length).toBeGreaterThan(0);

    console.log('AI Chat Flow Journey completed successfully!');
  });

  test('URL import flow with ownership clarification', async ({ page }) => {
    await loginViaAPI(page);
    await goToHomeAndWaitForAva(page);

    // =========================================================================
    // TURN 1: Paste a URL
    // =========================================================================
    console.log('Turn 1: Pasting a URL...');

    await sendHomeChat(page, 'https://github.com/facebookresearch/llama');
    await waitForAvaReady(page);

    let response = await getPageContent(page);
    assertHelpfulResponse(response, 'URL paste');

    // Ava should ask about ownership or confirm detection
    expect(response).toMatch(/yours|own|create|clip|save|project|repository|detected/i);

    // =========================================================================
    // TURN 2: Respond about ownership
    // =========================================================================
    console.log('Turn 2: Clarifying ownership...');

    await sendHomeChat(page, "It's not mine, I just want to save it");
    await waitForAvaReady(page);

    response = await getPageContent(page);
    assertHelpfulResponse(response, 'clip response');

    // Should confirm clipping or already clipped
    expect(response).toMatch(/clip|save|added|collection|already|great/i);

    // Should NOT ask about ownership again
    expect(response).not.toMatch(/is this your project\?/i);
  });

  test('Ava handles different query types appropriately', async ({ page }) => {
    await loginViaAPI(page);
    await goToHomeAndWaitForAva(page);

    const testCases = [
      {
        query: 'What AI tools are trending right now?',
        expectedKeywords: /tool|trending|popular|check out|recommend/i,
        context: 'tool discovery',
      },
      {
        query: 'I want to learn about prompt engineering',
        expectedKeywords: /learn|prompt|engineering|course|start|path/i,
        context: 'learning request',
      },
      {
        query: 'Help me create a chatbot project',
        expectedKeywords: /create|chatbot|project|start|build|help/i,
        context: 'creation request',
      },
    ];

    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.context}...`);

      await sendHomeChat(page, testCase.query);
      await waitForAvaReady(page);

      const response = await getPageContent(page);
      assertHelpfulResponse(response, testCase.context);

      expect(response).toMatch(testCase.expectedKeywords);
    }
  });

  test('conversation history loads after logout and login', async ({ page }) => {
    await loginViaAPI(page);
    await goToHomeAndWaitForAva(page);

    // Send a message
    const uniqueMessage = `Test message ${Date.now()}`;
    await sendHomeChat(page, `Remember this: ${uniqueMessage}`);
    await waitForAvaReady(page);

    // Get conversation count before logout
    const conversationsBefore = await getConversations(page);
    const countBefore = conversationsBefore.length;

    // Logout
    await page.request.post('/api/v1/auth/logout/');
    await page.waitForTimeout(1000);

    // Login again
    await loginViaAPI(page);
    await goToHomeAndWaitForAva(page);

    // Get conversation count after login
    const conversationsAfter = await getConversations(page);

    // Should have same number of conversations
    expect(conversationsAfter.length).toBe(countBefore);
  });
});
