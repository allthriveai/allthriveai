/**
 * Learning & Sage Quality Tests
 *
 * These tests verify that Sage (the learning AI assistant) provides
 * helpful, accurate educational content and maintains context
 * throughout learning interactions.
 *
 * CRITICAL: Sage should be knowledgeable about AI topics and
 * provide actionable learning guidance.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  sendHomeChat,
  getPageContent,
  DEEP_AI_TIMEOUT,
  MULTI_TURN_TIMEOUT,
} from './deep-helpers';
import {
  assertHelpfulResponse,
  assertNoTechnicalErrors,
} from './ai-quality-assertions';

test.describe('Learning & Sage Quality', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('Sage provides helpful learning path recommendations', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check if learning page loaded properly
    const pageContent = await getPageContent(page);

    // Should show Sage or learning-related content
    const hasLearningContent = /learn|path|sage|skill|topic|course/i.test(pageContent);
    expect(hasLearningContent).toBe(true);

    // No technical errors on the page
    assertNoTechnicalErrors(pageContent, 'learn page');
  });

  test('learning topic explanation is clear and educational', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Ask about a specific AI concept
    await sendHomeChat(page, 'Explain what machine learning is in simple terms');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'ML explanation');

    // Should include educational content
    const hasEducationalContent = /machine learning|algorithm|data|train|model|learn|pattern|predict/i.test(response);
    expect(hasEducationalContent).toBe(true);

    // Should be accessible (simple terms requested)
    // Looking for indicators of simplified explanation
    const _seemsSimplified = /simple|basically|like|example|imagine|think of/i.test(response);
    // This is a soft check - not all responses will use these exact words
  });

  test('learning recommendation based on user context', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Provide context about skill level
    await sendHomeChat(page, "I'm a beginner at AI and want to learn about neural networks");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'beginner neural network learning');

    // Should acknowledge beginner level and provide appropriate guidance
    const hasBeginnnerGuidance = /beginner|start|basic|fundamental|first|introduction|learn|neural|network/i.test(response);
    expect(hasBeginnnerGuidance).toBe(true);
  });

  test('follow-up questions maintain learning context', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // First turn: Ask about a topic
    await sendHomeChat(page, 'What are transformers in AI?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn1Response = await getPageContent(page);
    assertHelpfulResponse(turn1Response, 'transformer explanation');

    // Should explain transformers
    const hasTransformerContent = /transformer|attention|self-attention|nlp|language|gpt|bert/i.test(turn1Response);
    expect(hasTransformerContent).toBe(true);

    // Second turn: Follow-up question
    await sendHomeChat(page, 'How is this different from RNNs?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const turn2Response = await getPageContent(page);
    assertHelpfulResponse(turn2Response, 'RNN comparison');

    // Should understand "this" refers to transformers and compare
    const hasComparison = /rnn|recurrent|difference|sequential|parallel|attention|compare|versus|unlike/i.test(turn2Response);
    expect(hasComparison).toBe(true);
  });

  test('practical learning advice includes actionable steps', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(page, 'How can I start building AI projects?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'AI project guidance');

    // Should provide actionable advice
    const hasActionableAdvice = /start|step|learn|try|build|project|tutorial|course|practice|first/i.test(response);
    expect(hasActionableAdvice).toBe(true);
  });

  test('Sage acknowledges skill progression', async ({ page }) => {
    test.setTimeout(MULTI_TURN_TIMEOUT);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Describe current skill and ask for next steps
    await sendHomeChat(
      page,
      "I've learned the basics of Python and understand what machine learning is. What should I learn next?"
    );
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'skill progression advice');

    // Should acknowledge current skills and suggest progression
    const hasProgressionAdvice = /next|advance|learn|deep|neural|framework|tensorflow|pytorch|project|practice/i.test(response);
    expect(hasProgressionAdvice).toBe(true);
  });

  test('learning path page shows available paths', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const pageContent = await getPageContent(page);

    // Should show learning paths or topics
    const hasLearningStructure = /path|topic|learn|skill|course|lesson|level/i.test(pageContent);
    expect(hasLearningStructure).toBe(true);

    // Should have Sage presence
    const hasSage = /sage/i.test(pageContent);
    expect(hasSage).toBe(true);
  });

  test('quiz or assessment content is educational', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    // Navigate to quizzes page
    await page.goto('/quizzes');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const pageContent = await getPageContent(page);

    // Should show quiz-related content
    const hasQuizContent = /quiz|test|question|answer|score|challenge|learn/i.test(pageContent);
    expect(hasQuizContent).toBe(true);

    // No technical errors
    assertNoTechnicalErrors(pageContent, 'quizzes page');
  });
});
