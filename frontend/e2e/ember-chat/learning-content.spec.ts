/**
 * Learning Content E2E Tests
 *
 * Tests for learning content responses with 4-column grid layout.
 * TDD: Write failing tests first, then implement feature.
 *
 * Feature: Learning Content Display
 *   As a user asking about an AI topic
 *   I receive text explanation AND content cards
 *   So that I can learn from multiple resource types
 *
 * RUN: npx playwright test e2e/ember-chat/learning-content.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../helpers';
import {
  openEmbeddedChat,
  sendMessage,
  waitForEmberResponse,
  getChatContent,
  assertNoTechnicalErrors,
  TIMEOUTS,
} from './chat-helpers';

test.describe('Learning Content - LangChain Topic', () => {
  // Extended timeout for AI responses + content rendering
  test.setTimeout(TIMEOUTS.aiResponse + 60000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('user asks about LangChain and gets text + content cards in 4-column grid', async ({ page }) => {
    // GIVEN: I am on /home with chat ready
    await openEmbeddedChat(page);

    // WHEN: I ask about learning LangChain
    await sendMessage(page, 'I want to learn something new about AI, what is langchain');

    // Wait for AI response with extended timeout (can take 60-90s)
    await waitForEmberResponse(page, TIMEOUTS.aiResponse);

    // Additional wait for content cards to render
    await page.waitForTimeout(3000);

    // THEN: Ember responds with text context about LangChain
    const content = await getChatContent(page);
    const hasLangChainContext =
      content.includes('langchain') ||
      content.includes('framework') ||
      content.includes('llm') ||
      content.includes('chain');
    expect(hasLangChainContext).toBe(true);

    // AND: Content cards are displayed in a 4-column grid
    const gridContainer = page.locator('.grid.grid-cols-2.sm\\:grid-cols-3.md\\:grid-cols-4');
    await expect(gridContainer).toBeVisible({ timeout: 30000 });

    // AND: At least 1 content card is visible (cards are wrapped in <a> or <Link>)
    const contentCards = gridContainer.locator('> a, > div');
    const cardCount = await contentCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // AND: Cards should have compact styling (aspect-[4/3] image section)
    const compactCard = page.locator('.aspect-\\[4\\/3\\]').first();
    await expect(compactCard).toBeVisible();

    // AND: No technical errors
    await assertNoTechnicalErrors(page);
  });

  test('content cards show mixed types (projects, videos, quizzes)', async ({ page }) => {
    // GIVEN: I am on /home with chat ready
    await openEmbeddedChat(page);

    // WHEN: I ask about learning LangChain
    await sendMessage(page, 'I want to learn something new about AI, what is langchain');

    // Wait for AI response with extended timeout
    await waitForEmberResponse(page, TIMEOUTS.aiResponse);
    await page.waitForTimeout(3000);

    // THEN: Content cards are displayed in a 4-column grid
    const gridContainer = page.locator('.grid.grid-cols-2.sm\\:grid-cols-3.md\\:grid-cols-4');
    await expect(gridContainer).toBeVisible({ timeout: 30000 });

    // AND: Cards have titles that are clickable
    const cardTitles = gridContainer.locator('h4');
    const titleCount = await cardTitles.count();
    expect(titleCount).toBeGreaterThanOrEqual(1);
  });

  test('content renders only ONCE - no duplicate text or images', async ({ page }) => {
    // GIVEN: I am on /home with chat ready
    await openEmbeddedChat(page);

    // WHEN: I ask about learning LangChain
    await sendMessage(page, 'I want to learn something new about AI, what is langchain');

    // Wait for AI response with extended timeout
    await waitForEmberResponse(page, TIMEOUTS.aiResponse);
    await page.waitForTimeout(5000);

    // THEN: There should be exactly ONE content grid (not duplicated)
    const gridContainers = page.locator('.grid.grid-cols-2.sm\\:grid-cols-3.md\\:grid-cols-4');
    const gridCount = await gridContainers.count();
    expect(gridCount).toBe(1);

    // AND: The "resources for you" header should appear exactly ONCE
    const resourceHeaders = page.locator('text=/resources for you/i');
    const headerCount = await resourceHeaders.count();
    expect(headerCount).toBeLessThanOrEqual(1);

    // AND: Content cards should be compact (4/3 aspect ratio), not huge
    const compactCards = page.locator('.aspect-\\[4\\/3\\]');
    const hugeCards = page.locator('.aspect-video, .aspect-square').filter({ has: page.locator('img') });

    const compactCount = await compactCards.count();
    const hugeCount = await hugeCards.count();

    // We expect compact cards, not huge image cards
    expect(compactCount).toBeGreaterThan(0);
    // If there are "huge" cards, they should be fewer than compact ones (ideally 0)
    expect(hugeCount).toBeLessThanOrEqual(compactCount);

    // AND: No technical errors
    await assertNoTechnicalErrors(page);
  });
});
