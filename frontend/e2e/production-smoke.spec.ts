/**
 * Production E2E Smoke Tests
 *
 * These tests run against PRODUCTION after each deployment to catch bugs
 * that slip through local testing (like the S3 URL validation issue).
 *
 * IMPORTANT: These tests are run by GitHub Actions after deploy.
 * They use an API key to authenticate as the smoke test user (Sally Jones).
 *
 * Environment Variables Required:
 * - PROD_URL: Production frontend URL (https://allthrive.ai)
 * - API_URL: Production API URL (https://api.allthrive.ai)
 * - PROD_SMOKE_TEST_KEY: API key for smoke test endpoint
 *
 * Run locally (requires PROD_SMOKE_TEST_KEY):
 *   PROD_SMOKE_TEST_KEY=xxx npx playwright test e2e/production-smoke.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  loginToProduction,
  waitForChatReady,
  cleanupTestData,
  createConsoleErrorCollector,
  PROD_URL,
  API_URL,
} from './helpers/production-auth';
import type { ConsoleErrorCollector } from './helpers/production-auth';

// Skip tests if not configured for production
const isProductionConfigured = !!process.env.PROD_SMOKE_TEST_KEY;

// Track created resources for cleanup
let createdProjectIds: number[] = [];
let createdAvatarIds: number[] = [];
let createdBattleIds: number[] = [];
let consoleCollector: ConsoleErrorCollector;

test.describe('Production Smoke Tests', () => {
  test.skip(!isProductionConfigured, 'PROD_SMOKE_TEST_KEY not configured');

  test.beforeEach(async ({ page }) => {
    // Reset cleanup trackers
    createdProjectIds = [];
    createdAvatarIds = [];
    createdBattleIds = [];

    // Set up console error collection
    consoleCollector = createConsoleErrorCollector(page);
    consoleCollector.start();

    // Login to production
    await loginToProduction(page);
  });

  test.afterEach(async ({ page }) => {
    // Stop console collection
    consoleCollector.stop();

    // Log any console errors for debugging
    if (consoleCollector.hasErrors()) {
      console.log(consoleCollector.getErrorsSummary());
    }

    // Cleanup any test data created
    await cleanupTestData(page, {
      projectIds: createdProjectIds,
      avatarIds: createdAvatarIds,
      battleIds: createdBattleIds,
    });
  });

  test('Test 1: URL paste triggers project creation flow', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate to home (chat with Ava)
    await page.goto(`${PROD_URL}/home`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for chat to be ready
    await waitForChatReady(page);

    // Paste a GitHub URL
    const testUrl = 'https://github.com/facebook/react';
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await chatInput.fill(testUrl);

    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    // Wait for Ava's response
    await page.waitForTimeout(10000);

    // Verify we got a response (not an error)
    const pageContent = await page.locator('body').textContent();

    // Check for technical errors
    const technicalErrors = [
      'TypeError',
      'Exception',
      'Traceback',
      '500',
      'Internal Server Error',
      'WebSocket error',
    ];

    for (const error of technicalErrors) {
      const hasError = pageContent?.includes(error) || false;
      expect(hasError).toBe(false);
    }

    // Verify Ava responded with something about the URL/project
    // (We don't assert on exact content since AI responses vary)
    const hasResponse =
      pageContent?.includes('project') ||
      pageContent?.includes('React') ||
      pageContent?.includes('github') ||
      pageContent?.includes('repository') ||
      pageContent?.includes('Would you like');

    expect(hasResponse).toBe(true);

    console.log('✓ Test 1 passed: URL paste triggered response from Ava');
  });

  test('Test 2: Avatar generation completes within 30 seconds', async ({
    page,
  }) => {
    test.setTimeout(45000); // 45s total timeout

    // Clear console errors from login phase
    consoleCollector.clear();

    // Navigate to home
    await page.goto(`${PROD_URL}/home`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for chat to be ready
    await waitForChatReady(page);

    // Trigger avatar creation
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await chatInput.fill('create an avatar');

    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    // Wait for avatar wizard/modal to appear (use waitFor instead of arbitrary timeout)
    const avatarPromptInput = page
      .locator(
        'textarea[placeholder*="Describe"], textarea[placeholder*="avatar"], input[placeholder*="avatar"]'
      )
      .first();

    // Wait up to 10s for avatar UI to appear
    const hasAvatarUI = await avatarPromptInput
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (hasAvatarUI) {
      // Fill in a simple prompt
      await avatarPromptInput.fill('a friendly robot');

      // Click generate
      const generateButton = page
        .locator(
          'button:has-text("Generate"), button:has-text("Create"), button:has-text("Make")'
        )
        .first();

      if (await generateButton.isVisible()) {
        await generateButton.click();

        // Wait for avatar to generate (up to 30 seconds)
        const startTime = Date.now();
        let avatarGenerated = false;

        while (Date.now() - startTime < 30000) {
          // Check for generated avatar image
          const avatarImage = page.locator(
            'img[src*="avatar"], img[alt*="avatar"], [data-testid="generated-avatar"]'
          );

          if ((await avatarImage.count()) > 0) {
            avatarGenerated = true;
            console.log(
              `✓ Avatar generated in ${(Date.now() - startTime) / 1000}s`
            );
            break;
          }

          // Check for console errors (catches "Not connected" and WebSocket issues)
          if (consoleCollector.hasCriticalErrors()) {
            throw new Error(
              `Critical console error during avatar generation:\n${consoleCollector.getErrorsSummary()}`
            );
          }

          // Check for error in UI
          const hasError = await page
            .getByText('error', { exact: false })
            .isVisible()
            .catch(() => false);

          if (hasError) {
            // Check if it's the S3 URL validation error we fixed
            const pageContent = await page.locator('body').textContent();
            if (pageContent?.includes('Invalid reference image URL')) {
              throw new Error(
                'S3 URL validation error - this is the bug we fixed!'
              );
            }
          }

          await page.waitForTimeout(1000);
        }

        // STRICT: Avatar generation must succeed within 30 seconds
        // If external AI is slow, we should know about it
        expect(avatarGenerated).toBe(true);
        console.log('✓ Avatar generated successfully');
      }
    } else {
      // STRICT: Avatar UI must appear - this is a critical failure
      // If it doesn't appear, something is wrong with the chat or avatar flow
      const pageContent = await page.locator('body').textContent();

      // Log what we see for debugging
      console.log('Avatar UI did not appear. Page content:', pageContent?.slice(0, 500));

      // Check for specific errors
      if (pageContent?.includes('Error') || pageContent?.includes('error')) {
        throw new Error('Avatar creation failed with error on page');
      }

      // Fail the test - avatar UI not appearing is a critical issue
      throw new Error(
        'Avatar creation UI did not appear after sending "create an avatar" message. ' +
        'This indicates the AI chat or avatar flow is broken.'
      );
    }

    // STRICT: Check for any critical console errors during the flow
    expect(consoleCollector.hasCriticalErrors()).toBe(false);

    // Verify no technical errors on page
    const technicalErrors = ['TypeError', 'Exception', 'Traceback', '500'];
    const pageContent = await page.locator('body').textContent();

    for (const error of technicalErrors) {
      const hasError = pageContent?.includes(error) || false;
      expect(hasError).toBe(false);
    }

    console.log('✓ Test 2 passed: Avatar generation flow completed');
  });

  test('Test 3: Ava chat responds without errors', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate to home
    await page.goto(`${PROD_URL}/home`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for chat to be ready
    await waitForChatReady(page);

    // Ask a question
    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await chatInput.fill('what is a context window');

    const sendButton = page
      .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
      .first();
    await sendButton.click();

    // Wait for response (with streaming)
    await page.waitForTimeout(15000);

    // Get page content
    const pageContent = await page.locator('body').textContent();

    // Verify no technical errors
    const technicalErrors = [
      'TypeError',
      'Exception',
      'Traceback',
      '500',
      'Internal Server Error',
      'NoneType',
      'AttributeError',
    ];

    for (const error of technicalErrors) {
      const hasError = pageContent?.includes(error) || false;
      expect(hasError).toBe(false);
    }

    // Verify we got some response (any non-empty AI response)
    // Look for common elements that indicate a response
    const hasResponse =
      (pageContent?.length || 0) > 500 && // Page has content
      (pageContent?.includes('context') || // Mentioned our topic
        pageContent?.includes('token') || // Related term
        pageContent?.includes('AI') || // Related term
        pageContent?.includes('model')); // Related term

    // If no response-related content, at least verify no error messages
    if (!hasResponse) {
      const hasErrorMessage =
        pageContent?.includes('Error') || pageContent?.includes('error');
      expect(hasErrorMessage).toBe(false);
    }

    console.log('✓ Test 3 passed: Ava chat responded without errors');
  });

  test('Test 4: Prompt battle UI loads', async ({ page }) => {
    test.setTimeout(120000);

    // Navigate to battles page
    await page.goto(`${PROD_URL}/battles`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Check page loaded without errors
    const pageContent = await page.locator('body').textContent();

    // Verify no technical errors
    const technicalErrors = [
      'TypeError',
      'Exception',
      'Traceback',
      '500',
      'Internal Server Error',
    ];

    for (const error of technicalErrors) {
      const hasError = pageContent?.includes(error) || false;
      expect(hasError).toBe(false);
    }

    // Verify battles page content is present
    const hasBattleUI =
      pageContent?.includes('Battle') ||
      pageContent?.includes('battle') ||
      pageContent?.includes('Pip') ||
      pageContent?.includes('Challenge');

    expect(hasBattleUI).toBe(true);

    // Try to start a battle with Pip
    const battlePipButton = page
      .locator(
        'button:has-text("Battle Pip"), button:has-text("Challenge Pip"), [data-testid="battle-pip"]'
      )
      .first();

    if (await battlePipButton.isVisible()) {
      await battlePipButton.click();
      await page.waitForTimeout(5000);

      // Verify battle UI appeared
      const battleStarted =
        (await page.locator('text=Round').isVisible().catch(() => false)) ||
        (await page.locator('text=prompt').isVisible().catch(() => false)) ||
        (await page.locator('text=Prompt').isVisible().catch(() => false)) ||
        (await page
          .locator('[data-testid="battle-arena"]')
          .isVisible()
          .catch(() => false));

      if (battleStarted) {
        // Store battle ID for cleanup
        const url = page.url();
        const battleIdMatch = url.match(/\/battles\/(\d+)/);
        if (battleIdMatch) {
          createdBattleIds.push(parseInt(battleIdMatch[1]));
        }
        console.log('✓ Battle with Pip started successfully');
      } else {
        console.log('⚠ Battle may be loading or different UI');
      }
    } else {
      console.log('⚠ Battle Pip button not found (may be different UI)');
    }

    console.log('✓ Test 4 passed: Prompt battle page loaded');
  });
});

// Health check test - runs first to verify basic connectivity
test.describe('Production Health Check', () => {
  test.skip(!isProductionConfigured, 'PROD_SMOKE_TEST_KEY not configured');

  test('API is reachable', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/health/`);
    expect(response.ok()).toBe(true);
  });

  test('AI providers are connected', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/health/ai/`);

    // AI health endpoint should respond
    expect(response.ok()).toBe(true);

    const data = await response.json();

    // Log the response for debugging
    console.log('AI Health Response:', JSON.stringify(data, null, 2));

    // At least one of OpenAI or Gemini must be working (we have fallbacks)
    const openaiOk = data.providers?.openai?.status === 'ok';
    const geminiOk = data.providers?.gemini?.status === 'ok';

    if (!openaiOk && !geminiOk) {
      throw new Error(
        `Both AI providers are down!\n` +
        `OpenAI: ${JSON.stringify(data.providers?.openai)}\n` +
        `Gemini: ${JSON.stringify(data.providers?.gemini)}`
      );
    }

    // Log which models are available
    if (data.models?.openai) {
      console.log('OpenAI models:', JSON.stringify(data.models.openai));
    }
    if (data.models?.gemini) {
      console.log('Gemini models:', JSON.stringify(data.models.gemini));
    }

    console.log('✓ AI providers connected');
  });

  test('Frontend is reachable', async ({ page }) => {
    const response = await page.goto(PROD_URL);
    expect(response?.ok()).toBe(true);
  });

  test('Smoke test endpoint is configured', async ({ request }) => {
    // This should return 401 (unauthorized) not 500 (not configured)
    const response = await request.post(`${API_URL}/api/v1/auth/smoke-test/`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Smoke-Test-Key': 'invalid-key',
      },
    });

    // 401 means endpoint exists and is configured (invalid key)
    // 429 means rate limited (still indicates endpoint exists)
    // 500 would mean SMOKE_TEST_API_KEY is not set
    expect([401, 429]).toContain(response.status());
  });
});
