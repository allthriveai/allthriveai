/**
 * Smoke Tests - Run in CI on every PR
 *
 * These tests verify critical functionality and AI response quality.
 * They catch regressions before merge.
 *
 * IMPORTANT: These tests check that AI responses are HELPFUL, not rejections.
 * An AI saying "I can't help" or giving empty responses is a FAILURE.
 *
 * Run locally: npx playwright test e2e/smoke.spec.ts
 * Run all tests: npx playwright test
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

// Timeouts
const WS_CONNECT_TIMEOUT = 15000;
const AI_RESPONSE_TIMEOUT = 45000;

// AI rejection patterns - if response contains these, TEST FAILS
const AI_REJECTION_PATTERNS = [
  /I can't help/i,
  /I'm unable to/i,
  /I cannot assist/i,
  /I don't have access/i,
  /I'm not able to/i,
  /sorry.*can't/i,
  /unable to process/i,
  /error occurred/i,
  /something went wrong/i,
];

// Technical error patterns - should never appear
const TECHNICAL_ERROR_PATTERNS = [
  /TypeError/,
  /Exception/,
  /Traceback/,
  /NoneType/,
  /AttributeError/,
  /undefined is not/,
  /null is not/,
  /Internal Server Error/,
  /500 error/i,
];

/**
 * Helper: Check response is helpful, not a rejection
 */
function assertHelpfulResponse(text: string, context: string) {
  // Check for rejections
  for (const pattern of AI_REJECTION_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`AI REJECTION in ${context}: Response contains "${pattern.source}"\nResponse: ${text.substring(0, 200)}...`);
    }
  }

  // Check for technical errors
  for (const pattern of TECHNICAL_ERROR_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`TECHNICAL ERROR in ${context}: Response contains "${pattern.source}"\nResponse: ${text.substring(0, 200)}...`);
    }
  }

  // Response should have meaningful content (not empty or too short)
  if (text.trim().length < 20) {
    throw new Error(`EMPTY RESPONSE in ${context}: Response too short (${text.length} chars)`);
  }
}

// ============================================================================
// PAGE LOAD TESTS - Basic sanity checks
// ============================================================================

test.describe('Smoke - Page Loads', () => {
  test('app loads and user can authenticate', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test('home page loads with chat', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Chat input should be present and enabled (WebSocket connected)
    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });
  });

  test('explore page loads', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    const exploreHeading = page.getByRole('heading', { name: /explore/i }).first();
    await expect(exploreHeading).toBeVisible({ timeout: 10000 });
  });

  test('learn page loads', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto('/learn');
    await page.waitForLoadState('domcontentloaded');

    // Should see learn content or empty state
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent?.length).toBeGreaterThan(100);
  });

  test('profile page loads', async ({ page }) => {
    await loginViaAPI(page);
    await page.goto(`/${TEST_USER.username}`);
    await page.waitForLoadState('domcontentloaded');

    // Should see profile content
    const pageContent = await page.locator('body').textContent();
    expect(pageContent?.toLowerCase()).toContain(TEST_USER.username.toLowerCase());
  });

  test('unauthenticated user sees public pages', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});

// ============================================================================
// EMBER AI QUALITY TESTS - Verify AI gives helpful responses
// ============================================================================

test.describe('Smoke - Ember AI Quality', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('Ember responds to greeting (not rejection)', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Send greeting
    await chatInput.fill('Hello! How are you?');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(AI_RESPONSE_TIMEOUT);

    // Get response text
    const messages = page.locator('[data-testid="assistant-message"], [class*="assistant"], [class*="ember"]');
    const lastMessage = messages.last();

    if (await lastMessage.isVisible()) {
      const responseText = await lastMessage.textContent() || '';
      assertHelpfulResponse(responseText, 'greeting');

      // Should be friendly
      expect(responseText.toLowerCase()).toMatch(/hello|hi|hey|good|great|help|assist/i);
    }
  });

  test('Ember explains concepts correctly (context window)', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Ask about context window
    await chatInput.fill('What is a context window in AI?');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(AI_RESPONSE_TIMEOUT);

    // Check page content for relevant response
    const pageContent = await page.locator('body').textContent() || '';

    // Should contain relevant keywords
    const hasRelevantContent = /token|memory|limit|input|character|length|model/i.test(pageContent);
    expect(hasRelevantContent).toBe(true);

    // Should NOT be a rejection
    assertHelpfulResponse(pageContent, 'context window explanation');
  });

  test('Ember handles URL paste (project creation flow)', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Paste a GitHub URL
    await chatInput.fill('https://github.com/facebook/react');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(AI_RESPONSE_TIMEOUT);

    const pageContent = await page.locator('body').textContent() || '';

    // Should ask about project type or offer to import
    const hasProjectFlow = /project|save|clip|import|your own|repository|github/i.test(pageContent);
    expect(hasProjectFlow).toBe(true);

    // Should NOT reject
    assertHelpfulResponse(pageContent, 'URL paste');
  });

  test('Ember can discuss learning paths', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    // Ask about learning paths
    await chatInput.fill('Can you help me create a learning path about machine learning?');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(AI_RESPONSE_TIMEOUT);

    const pageContent = await page.locator('body').textContent() || '';

    // Should discuss learning paths
    const hasLearningContent = /learning|path|course|topic|study|start|begin|concept/i.test(pageContent);
    expect(hasLearningContent).toBe(true);

    // Should NOT reject
    assertHelpfulResponse(pageContent, 'learning path request');
  });
});

// ============================================================================
// PROFILE TESTS - User profile functionality
// ============================================================================

test.describe('Smoke - Profile', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('profile tabs work', async ({ page }) => {
    // Test activity tab
    await page.goto(`/${TEST_USER.username}?tab=activity`);
    await page.waitForLoadState('domcontentloaded');
    const activityContent = await page.locator('body').textContent();
    expect(activityContent).toBeTruthy();

    // Test playground tab
    await page.goto(`/${TEST_USER.username}?tab=playground`);
    await page.waitForLoadState('domcontentloaded');
    const playgroundContent = await page.locator('body').textContent();
    expect(playgroundContent).toBeTruthy();

    // Test clipped tab
    await page.goto(`/${TEST_USER.username}?tab=clipped`);
    await page.waitForLoadState('domcontentloaded');
    const clippedContent = await page.locator('body').textContent();
    expect(clippedContent).toBeTruthy();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    // Should see settings form
    const pageContent = await page.locator('body').textContent() || '';
    expect(pageContent.toLowerCase()).toMatch(/settings|account|profile|email/i);
  });
});

// ============================================================================
// NAVIGATION TESTS - Core navigation works
// ============================================================================

test.describe('Smoke - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('main navigation links work', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Click explore link
    const exploreLink = page.locator('a[href="/explore"], nav >> text=Explore').first();
    if (await exploreLink.isVisible()) {
      await exploreLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/explore');
    }
  });

  test('chat sidebar opens on other pages', async ({ page }) => {
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Try to open chat sidebar
    const chatButton = page.locator('button:has-text("Chat"), [data-testid="chat-toggle"]').first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
      await page.waitForTimeout(500);

      // Chat input should appear
      const chatInput = page.locator('input[placeholder*="Message"], input[placeholder*="Ask"]').first();
      await expect(chatInput).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================================================
// ERROR DETECTION TESTS - No technical errors visible
// ============================================================================

test.describe('Smoke - Error Detection', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('no console errors on home page', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Filter out known/acceptable errors
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('ResizeObserver') &&
        !err.includes('Failed to load resource')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('no technical errors visible on page', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pageContent = await page.locator('body').textContent() || '';

    for (const pattern of TECHNICAL_ERROR_PATTERNS) {
      expect(pageContent).not.toMatch(pattern);
    }
  });
});
