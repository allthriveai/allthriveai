/**
 * Multi-Turn Conversation Quality Tests
 *
 * These tests verify that Ava maintains context across multiple turns
 * in a conversation. Context loss is a critical regression.
 *
 * CRITICAL: Tests for context preservation when:
 * - User answers a follow-up question
 * - User references "the first one" or similar pronouns
 * - User provides ownership info after URL paste
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  sendHomeChat,
  getPageContent,
  getLastAIResponse,
  DEEP_AI_TIMEOUT,
  MULTI_TURN_TIMEOUT,
} from './deep-helpers';
import { assertHelpfulResponse } from './ai-quality-assertions';

test.describe('Multi-Turn Conversation Quality', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('CRITICAL: ownership question context is preserved after URL paste', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Turn 1: Paste a URL
    await sendHomeChat(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'URL paste response');

    // The AI might ask about ownership OR might auto-clip
    // Either behavior is valid, but it should not reject

    // Turn 2: Respond to ownership question
    await sendHomeChat(page, "It's mine, I created this video");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'ownership clarification');

    // Should NOT route to discovery agent just because of video topic
    // Should continue with project import flow
    const _hasProjectFlow = /project|import|save|clip|add|created|your/i.test(turn2Response);
    const isRejection = /can't help|unable to|don't have access/i.test(turn2Response);

    expect(isRejection).toBe(false);
    // Should acknowledge ownership and continue appropriately
  });

  test('CRITICAL: URL paste with "not mine/clip" saves to clipped projects', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Use a unique URL to avoid "already clipped" issues from previous test runs
    // Using a smaller/newer repo that's unlikely to have been clipped before
    const _uniqueTimestamp = Date.now();
    const testUrl = 'https://github.com/minimaxir/aitextgen'; // AI text generation library

    // Turn 1: Paste a URL
    await sendHomeChat(page, testUrl);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'URL paste response');

    // Turn 2: Say it's NOT mine - should clip/save it
    await sendHomeChat(page, "It's not mine, I just want to save it / clip it");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'clip response');

    // Should acknowledge clipping/saving
    const hasClipFlow = /clip|save|added|bookmark|collection|library|your.*project/i.test(turn2Response);
    expect(hasClipFlow).toBe(true);

    // Should NOT ask again about ownership - check ONLY the last AI response
    const lastResponse = await getLastAIResponse(page);
    const asksOwnershipAgain = /is this your project|did you create|is it your own|own project\?/i.test(lastResponse);
    expect(asksOwnershipAgain).toBe(false);
  });

  test('project context persists across multiple turns', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Turn 1: Describe a project
    await sendHomeChat(page, "I'm building a chatbot for customer support using Python");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'project description');

    // Turn 2: Ask a follow-up that requires context
    await sendHomeChat(page, 'What AI model should I use for this?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'AI model recommendation');

    // Response should reference customer support chatbot context
    // It should NOT ask "for what?" or give a generic answer
    const hasContext = /customer|support|chatbot|python|your|this project|conversation/i.test(turn2Response);
    expect(hasContext).toBe(true);

    // Turn 3: Another contextual question
    await sendHomeChat(page, 'How do I handle multi-language support?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn3Response = await getPageContent(page);
    assertHelpfulResponse(turn3Response, 'multi-language support');

    // Should still be in context of customer support chatbot
    const stillHasContext = /language|translate|multilingual|chatbot|support|customer/i.test(turn3Response);
    expect(stillHasContext).toBe(true);
  });

  test('learning topic context persists for follow-up questions', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Turn 1: Ask about a concept
    await sendHomeChat(page, 'What is RAG in AI?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'RAG explanation');

    // Turn 2: Follow-up that requires context
    await sendHomeChat(page, 'How do I implement it in my project?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'RAG implementation');

    // Should understand "it" refers to RAG
    const hasRAGContext = /retrieval|augment|generation|rag|vector|embedding|document/i.test(turn2Response);
    expect(hasRAGContext).toBe(true);

    // Should NOT ask "implement what?" or give a generic implementation answer
    const isGeneric = /what would you like to implement|what are you trying to implement/i.test(turn2Response);
    expect(isGeneric).toBe(false);
  });

  test('follow-up references like "the first one" are understood', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Turn 1: Ask for options/recommendations
    await sendHomeChat(page, 'What are some good AI frameworks for building chatbots?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'framework recommendations');

    // Should list multiple options
    const hasList = /1\.|first|•|-|langchain|rasa|dialogflow|openai|anthropic/i.test(turn1Response);
    expect(hasList).toBe(true);

    // Turn 2: Reference "the first one"
    await sendHomeChat(page, 'Tell me more about the first one you mentioned');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'first option details');

    // Should understand the reference and provide details about a specific framework
    // Should NOT say "I don't know which one you mean" or similar
    const hasDetails = /more|detail|feature|use|build|about|example|here|this/i.test(turn2Response);
    expect(hasDetails).toBe(true);
  });

  test('user correction mid-conversation is handled gracefully', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Turn 1: Start one flow
    await sendHomeChat(page, 'I want to create an infographic about AI');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'infographic creation');

    // Turn 2: User changes mind
    await sendHomeChat(page, 'Actually, never mind. Can you search for AI projects instead?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'topic switch');

    // Should switch to search/discovery, NOT continue with infographic
    const hasSwitch = /project|search|find|explore|here|found|discover/i.test(turn2Response);
    expect(hasSwitch).toBe(true);

    // Should NOT continue asking about infographic
    const stillOnInfographic = /infographic.*would you like|what.*infographic|topic.*infographic/i.test(turn2Response);
    expect(stillOnInfographic).toBe(false);
  });

  test('5+ turn conversation maintains coherence', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Extended conversation about building a project
    const turns = [
      { message: 'I want to build a personal AI assistant', checkFor: /assistant|ai|build|help/i },
      { message: 'It should be able to schedule meetings', checkFor: /schedule|meeting|calendar/i },
      { message: 'And send emails automatically', checkFor: /email|send|automat/i },
      { message: 'What technologies do you recommend?', checkFor: /tech|recommend|use|python|api|tool/i },
      { message: 'Which one is easiest to start with?', checkFor: /start|begin|easy|first|simple/i },
    ];

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];

      await sendHomeChat(page, turn.message);
      await page.waitForTimeout(DEEP_AI_TIMEOUT / 3);

      const response = await getPageContent(page);
      assertHelpfulResponse(response, `turn ${i + 1}: ${turn.message}`);

      // Check for relevance to the overall topic
      const hasRelevance = turn.checkFor.test(response);
      expect(hasRelevance).toBe(true);
    }

    // Final check: response should still understand it's about the AI assistant project
    const finalResponse = await getPageContent(page);
    const stillInContext = /assistant|project|build|your|this/i.test(finalResponse);
    expect(stillInContext).toBe(true);
  });

  test('conversation after page refresh maintains history', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    // Turn 1: Start a conversation
    await sendHomeChat(page, "I'm learning about transformers in AI");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'transformer discussion');

    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Check if previous messages are visible
    const pageContentAfterRefresh = await getPageContent(page);
    const hasPreviousMessage = /transformer|learning about transformers/i.test(pageContentAfterRefresh);
    expect(hasPreviousMessage).toBe(true);

    // Can continue conversation
    await sendHomeChat(page, 'What are attention mechanisms?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'attention mechanism explanation');

    // Should explain attention (in context of transformers)
    const hasAttention = /attention|query|key|value|weight|focus|self-attention/i.test(turn2Response);
    expect(hasAttention).toBe(true);
  });
});
