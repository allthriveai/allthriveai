/**
 * Chat Parity Tests - Sidebar vs Home Chat Comparison
 *
 * These tests verify that Ava chat behaves identically whether accessed
 * from the home page (/home) or via the sidebar on other pages.
 *
 * CRITICAL: The user identified sidebar vs home chat inconsistency as a pain point.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  sendHomeChat,
  sendSidebarChat,
  getPageContent,
  DEEP_AI_TIMEOUT,
} from './deep-helpers';
import { assertHelpfulResponse } from './ai-quality-assertions';

test.describe('Chat Parity - Sidebar vs Home', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('greeting response is friendly and helpful in BOTH contexts', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    // Test 1: Home chat greeting
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(page, 'Hello! How are you today?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const homeResponse = await getPageContent(page);
    assertHelpfulResponse(homeResponse, 'home greeting');
    assertTopicRelevance(homeResponse, 'greeting', 'home greeting');

    // Test 2: Sidebar chat greeting (on explore page)
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendSidebarChat(page, 'Hello! How are you today?');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const sidebarResponse = await getPageContent(page);
    assertHelpfulResponse(sidebarResponse, 'sidebar greeting');
    assertTopicRelevance(sidebarResponse, 'greeting', 'sidebar greeting');

    // Both should be friendly (not comparing exact responses, just quality)
  });

  test('learning questions work identically in BOTH contexts', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    const learningQuestion = 'What is RAG in AI and how does it work?';

    // Test 1: Home chat learning question
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(page, learningQuestion);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const homeResponse = await getPageContent(page);
    assertHelpfulResponse(homeResponse, 'home learning question');

    // Should explain RAG concepts
    const hasRAGContent = /retrieval|augment|generation|document|knowledge|embedding|vector|search/i.test(homeResponse);
    expect(hasRAGContent).toBe(true);

    // Test 2: Sidebar chat learning question
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendSidebarChat(page, learningQuestion);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const sidebarResponse = await getPageContent(page);
    assertHelpfulResponse(sidebarResponse, 'sidebar learning question');

    // Should also explain RAG concepts
    const sidebarHasRAG = /retrieval|augment|generation|document|knowledge|embedding|vector|search/i.test(sidebarResponse);
    expect(sidebarHasRAG).toBe(true);
  });

  test('URL paste handling is consistent in BOTH contexts', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    const githubUrl = 'https://github.com/openai/whisper';

    // Test 1: Home chat URL paste
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(page, githubUrl);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const homeResponse = await getPageContent(page);
    assertHelpfulResponse(homeResponse, 'home URL paste');

    // Should recognize GitHub URL and offer import/project flow
    const hasProjectFlow = /project|save|clip|import|your own|repository|github|whisper/i.test(homeResponse);
    expect(hasProjectFlow).toBe(true);

    // Test 2: Sidebar chat URL paste
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendSidebarChat(page, githubUrl);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const sidebarResponse = await getPageContent(page);
    assertHelpfulResponse(sidebarResponse, 'sidebar URL paste');

    // Should also recognize GitHub URL
    const sidebarHasProjectFlow = /project|save|clip|import|your own|repository|github|whisper/i.test(sidebarResponse);
    expect(sidebarHasProjectFlow).toBe(true);
  });

  test('URL paste + clip flow works in BOTH contexts', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 3); // Extra time for multi-turn in both contexts

    // Use less commonly clipped repos to avoid "already exists" issues
    const homeTestUrl = 'https://github.com/ggerganov/llama.cpp'; // Llama C++ implementation
    const sidebarTestUrl = 'https://github.com/pytorch/pytorch'; // PyTorch

    // Test 1: Home chat - URL paste then clip
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(page, homeTestUrl);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    // Say it's not mine, want to clip it
    await sendHomeChat(page, "Not mine, just want to save/clip it");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const homeResponse = await getPageContent(page);
    assertHelpfulResponse(homeResponse, 'home clip flow');

    // Should acknowledge clipping or mention the save action
    const homeHasClip = /clip|save|added|bookmark|collection|reference/i.test(homeResponse);
    expect(homeHasClip).toBe(true);

    // Test 2: Sidebar chat - URL paste then clip (new conversation)
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendSidebarChat(page, sidebarTestUrl);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    await sendSidebarChat(page, "It's not my project, I want to clip it");
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const sidebarResponse = await getPageContent(page);
    assertHelpfulResponse(sidebarResponse, 'sidebar clip flow');

    // Should also acknowledge clipping or saving
    const sidebarHasClip = /clip|save|added|bookmark|collection|reference/i.test(sidebarResponse);
    expect(sidebarHasClip).toBe(true);
  });

  test('discovery requests work in BOTH contexts', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    const discoveryRequest = 'Show me some trending AI art projects';

    // Test 1: Home chat discovery
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(page, discoveryRequest);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const homeResponse = await getPageContent(page);
    assertHelpfulResponse(homeResponse, 'home discovery request');

    // Should show projects or discuss discovery
    const hasDiscovery = /project|art|ai|found|here|explore|trending|popular/i.test(homeResponse);
    expect(hasDiscovery).toBe(true);

    // Test 2: Sidebar discovery
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendSidebarChat(page, discoveryRequest);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const sidebarResponse = await getPageContent(page);
    assertHelpfulResponse(sidebarResponse, 'sidebar discovery request');

    const sidebarHasDiscovery = /project|art|ai|found|here|explore|trending|popular/i.test(sidebarResponse);
    expect(sidebarHasDiscovery).toBe(true);
  });

  test('navigation commands work correctly from SIDEBAR', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT);

    // Sidebar-specific test: navigation should work even in sidebar context
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendSidebarChat(page, 'Take me to my learning paths');
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const response = await getPageContent(page);
    assertHelpfulResponse(response, 'sidebar navigation');

    // Should either navigate or provide link to learning paths
    const hasNavigation = /learn|path|here|go to|navigate|click/i.test(response);
    expect(hasNavigation).toBe(true);
  });

  test('help requests work in BOTH contexts', async ({ page }) => {
    test.setTimeout(DEEP_AI_TIMEOUT * 2);

    const helpRequest = 'What can you help me with?';

    // Test 1: Home chat help
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(page, helpRequest);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const homeResponse = await getPageContent(page);
    assertHelpfulResponse(homeResponse, 'home help request');

    // Should list capabilities
    const hasCapabilities = /help|learn|project|create|explore|discover|build/i.test(homeResponse);
    expect(hasCapabilities).toBe(true);

    // Test 2: Sidebar help
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendSidebarChat(page, helpRequest);
    await page.waitForTimeout(DEEP_AI_TIMEOUT / 2);

    const sidebarResponse = await getPageContent(page);
    assertHelpfulResponse(sidebarResponse, 'sidebar help request');

    const sidebarHasCapabilities = /help|learn|project|create|explore|discover|build/i.test(sidebarResponse);
    expect(sidebarHasCapabilities).toBe(true);
  });
});
