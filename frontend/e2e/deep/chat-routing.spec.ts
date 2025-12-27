/**
 * Chat Routing Tests - Tool/Agent Selection Verification
 *
 * These tests verify that Ava routes to the correct tool/action
 * based on user intent. Wrong routing causes confusing responses.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  sendHomeChat,
  getPageContent,
  DEEP_AI_TIMEOUT,
} from './deep-helpers';
import { assertHelpfulResponse } from './ai-quality-assertions';

test.describe('Tool Selection - Learning Intent', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  const LEARNING_QUERIES = [
    { query: 'What is a context window?', keywords: /context|token|limit|memory|window/i },
    { query: 'Explain how embeddings work', keywords: /embed|vector|represent|dimension|space/i },
    { query: 'Teach me about transformers', keywords: /transform|attention|model|architecture/i },
    { query: 'Help me understand fine-tuning', keywords: /fine.?tun|train|adapt|model|data/i },
    { query: 'What are prompt engineering best practices?', keywords: /prompt|engineer|practice|tip|technique/i },
  ];

  for (const { query, keywords } of LEARNING_QUERIES) {
    test(`"${query}" triggers learning response`, async ({ page }) => {
      test.setTimeout(DEEP_AI_TIMEOUT);

      await sendHomeChat(page, query);
      await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

      const response = await getPageContent(page);
      assertHelpfulResponse(response, `learning: ${query}`);

      // Should contain relevant educational content
      expect(keywords.test(response)).toBe(true);

      // Should NOT suggest project creation or navigation
      const wrongRoute = /create.*project|let me take you to|navigate to/i.test(response);
      expect(wrongRoute).toBe(false);
    });
  }
});

test.describe('Tool Selection - Discovery Intent', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  const DISCOVERY_QUERIES = [
    { query: 'Show me trending projects', keywords: /project|trending|popular|here|found/i },
    { query: 'Find AI art projects', keywords: /art|project|ai|found|here|image|generat/i },
    { query: 'What are others building?', keywords: /project|build|creat|community|member/i },
    { query: 'Recommend some projects for me', keywords: /recommend|project|suggest|might like/i },
  ];

  for (const { query, keywords } of DISCOVERY_QUERIES) {
    test(`"${query}" triggers discovery response`, async ({ page }) => {
      test.setTimeout(DEEP_AI_TIMEOUT);

      await sendHomeChat(page, query);
      await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

      const response = await getPageContent(page);
      assertHelpfulResponse(response, `discovery: ${query}`);

      // Should contain discovery-related content
      expect(keywords.test(response)).toBe(true);
    });
  }
});

test.describe('Tool Selection - Creation Intent', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('"make my avatar" triggers avatar creation flow', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Make my avatar');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'avatar creation');

    // Should start avatar creation flow
    const hasAvatarFlow = /avatar|creat|generat|image|photo|upload|style/i.test(response);
    expect(hasAvatarFlow).toBe(true);
  });

  test('"create an infographic about AI" triggers media creation', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Create an infographic about machine learning');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'infographic creation');

    // Should start creation flow, not just search
    const hasCreationFlow = /creat|generat|design|make|infographic|visual/i.test(response);
    expect(hasCreationFlow).toBe(true);
  });

  test('"start a new project" triggers project creation', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'I want to start a new project');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'project creation');

    // Should start project creation conversation
    const hasProjectFlow = /project|creat|start|what|kind|type|build|name/i.test(response);
    expect(hasProjectFlow).toBe(true);
  });
});

test.describe('Tool Selection - Navigation Intent', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('"take me to explore" triggers navigation', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Take me to explore');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    // Should either navigate or acknowledge the navigation intent
    const currentUrl = page.url();
    const response = await getPageContent(page);

    // Check if navigated OR provided navigation info
    const hasNavigation = currentUrl.includes('/explore') ||
      /explore|here|go to|navigate|click|take you/i.test(response);
    expect(hasNavigation).toBe(true);
  });

  test('"where are the battles" triggers navigation info', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Where are the battles?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'battles navigation');

    // Should mention battles/prompt battles
    const hasBattleInfo = /battle|prompt|compete|challenge|pip/i.test(response);
    expect(hasBattleInfo).toBe(true);
  });

  test('"go to my profile" triggers navigation', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Go to my profile');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const currentUrl = page.url();
    const response = await getPageContent(page);

    // Check if navigated OR provided navigation info
    const hasNavigation = currentUrl.includes('/e2e-test-user') ||
      /profile|here|go to|navigate/i.test(response);
    expect(hasNavigation).toBe(true);
  });
});

test.describe('Tool Selection - Fun/Game Intent', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('"play a game" triggers game launch or suggestion', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Play a game');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'game request');

    // Should offer game options or launch inline game
    const hasGameContent = /game|play|quiz|challenge|battle|fun|trivia|snake|ethic/i.test(response);
    expect(hasGameContent).toBe(true);
  });

  test('"I am bored" triggers activity suggestion', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, "I'm bored");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'boredom response');

    // Should suggest activities, games, or exploration
    const hasActivities = /game|play|explore|learn|try|quiz|battle|project|fun/i.test(response);
    expect(hasActivities).toBe(true);
  });
});

test.describe('Tool Selection - Ambiguous Intent Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('"show me" alone gets clarified or defaults sensibly', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Show me');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'ambiguous show me');

    // Should ask clarification OR default to discovery
    const hasClarification = /what|which|would you like|see|project|explore/i.test(response);
    expect(hasClarification).toBe(true);
  });

  test('combined topic + action is handled correctly', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, 'Create a RAG chatbot project');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'topic + action combo');

    // Should start project creation, NOT just search for RAG
    const hasCreation = /creat|project|build|start|name|what|help/i.test(response);
    expect(hasCreation).toBe(true);
  });

  test('negation is understood correctly', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    await sendHomeChat(page, "I don't want to create a project, just learn about RAG");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'negation handling');

    // Should focus on learning, NOT project creation
    const hasLearning = /rag|retrieval|augment|learn|understand|explain|knowledge/i.test(response);
    expect(hasLearning).toBe(true);

    // Should NOT push project creation
    const pushesCreation = /let's create|start.*project|name.*project/i.test(response);
    expect(pushesCreation).toBe(false);
  });
});
