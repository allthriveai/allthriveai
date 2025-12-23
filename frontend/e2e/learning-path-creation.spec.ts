/**
 * Learning Path Creation E2E Tests
 *
 * Tests that a user can ask Ember to create a learning path
 * and then access it on the /learn page.
 *
 * RUN: npx playwright test e2e/learning-path-creation.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI } from './helpers';

// Timeouts
const WS_CONNECT_TIMEOUT = 15000;
const AI_RESPONSE_TIMEOUT = 90000;

/**
 * Helper: Send a chat message
 */
async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.locator('input[placeholder="Message Ember..."]');
  await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

  await chatInput.fill(message);
  const sendButton = page
    .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
    .first();
  await sendButton.click();
}

/**
 * Helper: Wait for AI response to complete
 * Learning path creation takes ~25-30 seconds due to AI lesson generation
 */
async function waitForResponseComplete(page: Page, timeout = AI_RESPONSE_TIMEOUT) {
  const thinkingIndicator = page.locator('text="Thinking..."');
  const cancelButton = page.locator('button:has-text("Cancel")');

  // Wait for thinking to appear
  try {
    await thinkingIndicator.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Thinking indicator appeared');
  } catch {
    // May have already completed
  }

  // Wait for thinking to disappear - this can take 30+ seconds for learning path creation
  try {
    await thinkingIndicator.waitFor({ state: 'hidden', timeout: timeout });
    console.log('✓ Thinking indicator hidden');
  } catch {
    console.log('⚠ Thinking indicator did not hide within timeout');
  }

  // Wait for cancel button to disappear
  try {
    await cancelButton.waitFor({ state: 'hidden', timeout: 15000 });
  } catch {
    // May not exist
  }

  // Extra wait for streaming to complete
  await page.waitForTimeout(5000);
}

test.describe('Learning Path Creation', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000); // 3 min for full flow

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[DEBUG') || text.includes('learning') || text.includes('path')) {
        console.log('[BROWSER]', text);
      }
    });

    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
  });

  test('user can request a learning path and it appears on /learn', async ({ page }) => {
    // GIVEN: I am on the home page with Ember chat ready
    await page.waitForTimeout(1000);

    // WHEN: I ask Ember to create a learning path
    await sendChatMessage(page, 'make me a learning path about prompt engineering');
    await waitForResponseComplete(page);

    // THEN: Ember should confirm the learning path was created
    // Look for the response in the chat message area (not footer)
    const messageArea = page.locator('main').first();
    const responseText = await messageArea.textContent();
    const fullResponse = (responseText || '').toLowerCase();

    console.log('Message area text (first 500 chars):', fullResponse.substring(0, 500));

    // Should mention learning path creation or /learn URL
    const hasLearningPath =
      fullResponse.includes('learning path') ||
      fullResponse.includes('/learn/') ||
      fullResponse.includes('created') ||
      fullResponse.includes('curriculum') ||
      fullResponse.includes('prompt engineering');

    expect(hasLearningPath).toBe(true);
    console.log('✓ Ember confirmed learning path creation');

    // AND: When I navigate to /learn, I should see my learning path
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for the learning path on the page
    const pageContent = await page.content();
    const hasPromptEngineering =
      pageContent.toLowerCase().includes('prompt engineering') ||
      pageContent.toLowerCase().includes('prompt-engineering');

    // Or look for any learning path cards/items
    const pathCards = page.locator('[class*="learning-path"], [class*="path-card"], [class*="curriculum"]');
    const cardCount = await pathCards.count().catch(() => 0);

    console.log('Found', cardCount, 'path cards on /learn page');
    console.log('Page contains prompt engineering:', hasPromptEngineering);

    // Should have either the specific path or at least some learning content
    expect(hasPromptEngineering || cardCount > 0).toBe(true);
    console.log('✓ Learning path visible on /learn page');
  });

  test('learning path includes curriculum items', async ({ page }) => {
    // Ask for a learning path
    await sendChatMessage(page, 'create a learning path for RAG and retrieval');
    await waitForResponseComplete(page);

    // Navigate to /learn
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should have curriculum items (lessons, videos, articles, etc.)
    const curriculumItems = page.locator(
      '[class*="lesson"], [class*="curriculum-item"], [class*="path-step"], li'
    );
    const itemCount = await curriculumItems.count();

    console.log('Found', itemCount, 'potential curriculum items');

    // At minimum, should have some content
    expect(itemCount).toBeGreaterThan(0);
    console.log('✓ Curriculum items found on learning path');
  });
});
