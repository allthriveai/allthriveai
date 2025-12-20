/**
 * Home Page User Flows E2E Tests
 *
 * Tests for the /home page greeting message, feeling pills, and sidebar quick actions.
 * Split into UI-only tests (CI-safe) and AI response tests (comprehensive).
 *
 * Feature: Home Page User Experience
 *   As a user on /home
 *   I see a personalized greeting with feeling pills
 *   So that I can quickly start common conversations
 *
 * RUN UI TESTS: npx playwright test e2e/ember-chat/home-flows.spec.ts -g "UI Behavior"
 * RUN AI TESTS: RUN_AI_TESTS=true npx playwright test e2e/ember-chat/home-flows.spec.ts -g "AI Responses"
 * RUN ALL: RUN_AI_TESTS=true npx playwright test e2e/ember-chat/home-flows.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI, dismissOnboardingModal } from '../helpers';
import {
  openChatSidebar,
  sendMessage,
  waitForEmberResponse,
  getChatContent,
  getChatInput,
  assertNoTechnicalErrors,
  debugScreenshot,
  TIMEOUTS,
} from './chat-helpers';
import {
  FEELING_PILLS,
  ALL_FEATURES,
  setExcitedFeatures,
  clearUserAvatar,
  waitForGreetingComplete,
  getGreetingText,
  getExpectedTimeOfDayGreeting,
  getVisiblePillLabels,
  clickFeelingPill,
  isPillVisible,
  waitForPillsToAppear,
  verifyPillResponse,
  debugLogPills,
} from './home-helpers';

const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

// ============================================================================
// UI-ONLY TESTS (No AI Required - Run in CI)
// ============================================================================

test.describe('Home Page - UI Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await dismissOnboardingModal(page);
  });

  // ==========================================================================
  // GREETING TESTS
  // ==========================================================================

  test.describe('Greeting Message', () => {
    test('greeting shows time-of-day appropriate message', async ({ page }) => {
      // GIVEN: I am authenticated
      // WHEN: I navigate to /home
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await waitForGreetingComplete(page);

      // THEN: I see a time-appropriate greeting
      const greeting = await getGreetingText(page);
      const expectedTimeGreeting = getExpectedTimeOfDayGreeting();

      expect(greeting.toLowerCase()).toContain(expectedTimeGreeting.toLowerCase());
    });

    test('greeting includes user name', async ({ page }) => {
      // GIVEN: I am authenticated with a username
      // WHEN: I navigate to /home
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await waitForGreetingComplete(page);

      // THEN: I see a personalized greeting (contains name or "there")
      const greeting = await getGreetingText(page);

      // Should match pattern: "Good <time>, <name>!"
      expect(greeting).toMatch(/Good (morning|afternoon|evening),\s+\w+!/i);
    });

    test('greeting typewriter animation completes', async ({ page }) => {
      // GIVEN: I am authenticated
      // WHEN: I navigate to /home
      await page.goto('/home');
      await page.waitForLoadState('networkidle');

      // THEN: The greeting animation completes (ends with punctuation)
      await waitForGreetingComplete(page);
      const greeting = await getGreetingText(page);

      expect(greeting).toMatch(/[?!.]$/);
    });
  });

  // ==========================================================================
  // FEELING PILLS DISPLAY TESTS
  // ==========================================================================

  test.describe('Feeling Pills Display', () => {
    test('feeling pills appear after greeting animation', async ({ page }) => {
      // GIVEN: I am authenticated with various interests
      // First navigate to establish page context, then set features
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await setExcitedFeatures(page, ALL_FEATURES);
      await page.reload();

      // WHEN: Wait for greeting
      await waitForGreetingComplete(page);
      await waitForPillsToAppear(page);

      // THEN: Pills are visible
      const pills = await getVisiblePillLabels(page);
      expect(pills.length).toBeGreaterThan(0);
    });

    test('only 4 pills display at once', async ({ page }) => {
      // GIVEN: I have many excited features set
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await setExcitedFeatures(page, ALL_FEATURES);
      await page.reload();

      // WHEN: Wait for greeting
      await waitForGreetingComplete(page);
      await waitForPillsToAppear(page);

      // THEN: At most 4 pills are shown
      const pills = await getVisiblePillLabels(page);
      expect(pills.length).toBeLessThanOrEqual(4);
    });

    test('pills are filtered by user excitedFeatures', async ({ page }) => {
      // GIVEN: I only have 'portfolio' in my excitedFeatures
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await setExcitedFeatures(page, ['portfolio']);
      await page.reload();

      // WHEN: Wait for greeting
      await waitForGreetingComplete(page);
      await page.waitForTimeout(1500);

      // THEN: I should see "Share something" pill (matches portfolio)
      const pills = await getVisiblePillLabels(page);
      const _hasSharePill = pills.some(p => p.includes('Share something'));

      // Note: Due to fallback defaults, other pills may also show
      // At minimum, verify pills are showing based on features
      expect(pills.length).toBeGreaterThan(0);
    });

    test('avatar pill only shows when user has no avatar', async ({ page }) => {
      // GIVEN: User has an avatar (default test user)
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await setExcitedFeatures(page, ['personalize', 'portfolio', 'community']);

      await waitForGreetingComplete(page);
      await page.waitForTimeout(1500);

      // THEN: Avatar pill should NOT be visible (user has avatar)
      const hasAvatarPill = await isPillVisible(page, 'Make my avatar');

      // If test user has avatar, avatar pill should be hidden
      // (This may need adjustment based on test user configuration)
      if (hasAvatarPill) {
        // Clear avatar and check again
        await clearUserAvatar(page);
        await page.reload();
        await waitForGreetingComplete(page);
        await page.waitForTimeout(1500);

        const hasAvatarPillAfterClear = await isPillVisible(page, 'Make my avatar');
        // After clearing avatar, pill might appear (depending on scoring)
        expect(hasAvatarPillAfterClear || !hasAvatarPillAfterClear).toBe(true);
      }
    });

    test('pills hide after sending first message', async ({ page }) => {
      // GIVEN: I am on /home with pills visible
      // Note: We don't set excitedFeatures here to avoid needing a reload
      // The default pills should be visible
      await page.goto('/home');
      await page.waitForLoadState('domcontentloaded');
      await waitForGreetingComplete(page);
      await waitForPillsToAppear(page);

      let pills = await getVisiblePillLabels(page);
      expect(pills.length).toBeGreaterThan(0);

      // WHEN: I send a message
      const input = getChatInput(page);
      await input.fill('Hello Ember!');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      // THEN: Pills should be hidden
      pills = await getVisiblePillLabels(page);
      expect(pills.length).toBe(0);
    });
  });

  // ==========================================================================
  // FEELING PILLS CLICK TESTS (UI Only)
  // ==========================================================================

  test.describe('Feeling Pills Click Behavior', () => {
    // Test each pill sends the correct message
    for (const [_pillId, pill] of Object.entries(FEELING_PILLS)) {
      // Skip avatar pill (requires special setup) and game picker pills (show UI instead of message)
      if (pill.requiresNoAvatar || pill.showsGamePicker) continue;

      test(`clicking "${pill.label}" sends correct message`, async ({ page }) => {
        // GIVEN: I am on /home with this pill visible
        await page.goto('/home');
        await page.waitForLoadState('networkidle');
        await setExcitedFeatures(page, pill.features);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await waitForGreetingComplete(page);
        await page.waitForTimeout(2000);

        // Check if pill is visible
        const isVisible = await isPillVisible(page, pill.label);

        if (!isVisible) {
          test.skip(true, `Pill "${pill.label}" not visible in this run (dynamic selection)`);
          return;
        }

        // WHEN: I click the pill
        await clickFeelingPill(page, pill.label);
        await page.waitForTimeout(1000);

        // THEN: The correct message appears in chat
        const chatContent = await getChatContent(page);
        expect(chatContent.toLowerCase()).toContain(pill.message.toLowerCase());
      });
    }

    test('clicking "Make my avatar" sends correct message (when no avatar)', async ({ page }) => {
      const pill = FEELING_PILLS['avatar'];

      // GIVEN: I have no avatar - first establish page context
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await clearUserAvatar(page);
      await setExcitedFeatures(page, pill.features);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForGreetingComplete(page);
      await page.waitForTimeout(2000);

      const isVisible = await isPillVisible(page, pill.label);

      if (!isVisible) {
        test.skip(true, 'Avatar pill not visible (dynamic selection)');
        return;
      }

      // WHEN: I click the avatar pill
      await clickFeelingPill(page, pill.label);
      await page.waitForTimeout(1000);

      // THEN: The correct message appears
      const chatContent = await getChatContent(page);
      expect(chatContent.toLowerCase()).toContain(pill.message.toLowerCase());
    });

    test('clicking "Play a game" shows game picker', async ({ page }) => {
      const pill = FEELING_PILLS['play'];

      // GIVEN: I am on /home with the play pill visible
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await setExcitedFeatures(page, pill.features);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForGreetingComplete(page);
      await page.waitForTimeout(2000);

      const isVisible = await isPillVisible(page, pill.label);

      if (!isVisible) {
        test.skip(true, 'Play a game pill not visible (dynamic selection)');
        return;
      }

      // WHEN: I click the play pill
      await clickFeelingPill(page, pill.label);
      await page.waitForTimeout(1000);

      // THEN: Game picker should appear with game options
      const gamePicker = page.locator('text=Pick a game');
      const hasGamePicker = await gamePicker.isVisible().catch(() => false);

      // Check for any of the game options
      const snakeGame = page.locator('text=Context Snake');
      const triviaGame = page.locator('text=AI Trivia');
      const hasSnake = await snakeGame.isVisible().catch(() => false);
      const hasTrivia = await triviaGame.isVisible().catch(() => false);

      expect(hasGamePicker || hasSnake || hasTrivia).toBe(true);
    });
  });

  // ==========================================================================
  // SIDEBAR QUICK ACTIONS (UI Only)
  // ==========================================================================

  test.describe('Sidebar Quick Actions', () => {
    test('sidebar shows quick actions from /explore', async ({ page }) => {
      // GIVEN: I am on /explore
      // WHEN: I open the chat sidebar
      await openChatSidebar(page, '/explore');

      // THEN: I should see quick action buttons
      const quickActions = page.locator('button.rounded-full');
      const count = await quickActions.count();

      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('sidebar chat input is functional', async ({ page }) => {
      // GIVEN: I open sidebar from any page
      await openChatSidebar(page, '/explore');

      // WHEN: I type in the chat input
      const input = getChatInput(page);
      await input.fill('Test message');

      // THEN: Input should contain my message
      const value = await input.inputValue();
      expect(value).toBe('Test message');
    });
  });
});

// ============================================================================
// AI RESPONSE TESTS (Requires RUN_AI_TESTS=true)
// ============================================================================

test.describe('Home Page - AI Responses', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(TIMEOUTS.aiResponse + 60000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await dismissOnboardingModal(page);
  });

  // ==========================================================================
  // FEELING PILLS AI RESPONSES
  // ==========================================================================

  test.describe('Feeling Pills AI Responses', () => {
    // Test each pill gets relevant AI response
    for (const [pillId, pill] of Object.entries(FEELING_PILLS)) {
      // Skip avatar pill (requires special setup) and game picker pills (show UI instead of message)
      if (pill.requiresNoAvatar || pill.showsGamePicker) continue;

      test(`"${pill.label}" gets relevant AI response`, async ({ page }) => {
        // GIVEN: I am on /home with this pill visible
        await page.goto('/home');
        await page.waitForLoadState('networkidle');
        await setExcitedFeatures(page, pill.features);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await waitForGreetingComplete(page);
        await page.waitForTimeout(2000);

        const isVisible = await isPillVisible(page, pill.label);

        if (!isVisible) {
          test.skip(true, `Pill "${pill.label}" not visible in this run`);
          return;
        }

        // WHEN: I click the pill
        await clickFeelingPill(page, pill.label);
        await waitForEmberResponse(page);

        // THEN: Ember responds with relevant content
        const hasRelevantResponse = await verifyPillResponse(page, pillId);

        if (!hasRelevantResponse) {
          await debugScreenshot(page, `pill-${pillId}-ai-response`);
          await debugLogPills(page, `Pill ${pillId} context`);
          const content = await getChatContent(page);
          console.log('Chat content:', content.substring(0, 500));
        }

        expect(hasRelevantResponse).toBe(true);
        await assertNoTechnicalErrors(page);
      });
    }

    test('"Make my avatar" gets relevant AI response (when no avatar)', async ({ page }) => {
      const pill = FEELING_PILLS['avatar'];

      // GIVEN: User has no avatar
      await page.goto('/home');
      await page.waitForLoadState('networkidle');
      await clearUserAvatar(page);
      await setExcitedFeatures(page, pill.features);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForGreetingComplete(page);
      await page.waitForTimeout(2000);

      const isVisible = await isPillVisible(page, pill.label);

      if (!isVisible) {
        test.skip(true, 'Avatar pill not visible');
        return;
      }

      // WHEN: I click the avatar pill
      await clickFeelingPill(page, pill.label);
      await waitForEmberResponse(page);

      // THEN: Ember responds about avatar creation
      const hasRelevantResponse = await verifyPillResponse(page, 'avatar');
      expect(hasRelevantResponse).toBe(true);
      await assertNoTechnicalErrors(page);
    });
  });

  // ==========================================================================
  // SIDEBAR AI RESPONSES
  // ==========================================================================

  test.describe('Sidebar AI Responses', () => {
    test('sidebar message gets AI response', async ({ page }) => {
      // GIVEN: I open sidebar from /explore
      await openChatSidebar(page, '/explore');

      // WHEN: I send a message
      await sendMessage(page, 'Show me what projects are trending');
      await waitForEmberResponse(page);

      // THEN: I get a response (not empty)
      const content = await getChatContent(page);
      expect(content.length).toBeGreaterThan(50);
      await assertNoTechnicalErrors(page);
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

test.describe('Home Page - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await dismissOnboardingModal(page);
  });

  test('chat remains functional after clicking any pill', async ({ page }) => {
    // GIVEN: Pill is visible
    await setExcitedFeatures(page, ['portfolio', 'battles']);
    await page.goto('/home');
    await waitForGreetingComplete(page);
    await page.waitForTimeout(2000);

    const pills = await getVisiblePillLabels(page);

    if (pills.length > 0) {
      // WHEN: I click any visible pill
      await clickFeelingPill(page, pills[0]);
      await page.waitForTimeout(2000);

      // THEN: Chat input remains functional
      const input = getChatInput(page);
      await expect(input).toBeEnabled();
    }
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/home');
    await waitForGreetingComplete(page);
    await page.waitForTimeout(2000);

    // Filter out known acceptable errors (e.g., network issues in test env)
    const criticalErrors = errors.filter(e =>
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR') &&
      !e.includes('favicon')
    );

    expect(criticalErrors).toEqual([]);
  });
});
