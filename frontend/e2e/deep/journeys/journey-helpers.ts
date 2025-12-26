/**
 * Journey Test Helpers
 *
 * Utility functions for complete user journey E2E tests.
 * These tests validate end-to-end user flows, not individual features.
 */

import { Page, expect } from '@playwright/test';
import {
  loginViaAPI,
  logoutViaAPI,
  TEST_USER,
  ADMIN_USER,
  dismissOnboardingModal,
} from '../../helpers';
import {
  sendHomeChat,
  waitForEmberReady,
  getPageContent,
  DEEP_AI_TIMEOUT,
  WS_CONNECT_TIMEOUT,
  BATTLE_PHASE_TIMEOUT,
  createPipBattleAndJoin,
  submitBattlePrompt,
  TEST_USER_2,
} from '../deep-helpers';
import {
  assertHelpfulResponse,
  assertNoTechnicalErrors,
  assertNoRejection,
} from '../ai-quality-assertions';

// Re-export commonly used utilities
export {
  loginViaAPI,
  logoutViaAPI,
  TEST_USER,
  ADMIN_USER,
  TEST_USER_2,
  dismissOnboardingModal,
  sendHomeChat,
  waitForEmberReady,
  getPageContent,
  assertHelpfulResponse,
  assertNoTechnicalErrors,
  assertNoRejection,
  createPipBattleAndJoin,
  submitBattlePrompt,
  // Re-export timeouts from deep-helpers
  DEEP_AI_TIMEOUT,
  WS_CONNECT_TIMEOUT,
  BATTLE_PHASE_TIMEOUT,
};

// ============================================================================
// JOURNEY-SPECIFIC TIMEOUTS
// ============================================================================

export const JOURNEY_TIMEOUT = 300000; // 5 minutes per journey test
export const AI_RESPONSE_WAIT = 60000; // 1 minute for AI response
export const BATTLE_COMPLETE_WAIT = 120000; // 2 minutes for battle completion
export const PAGE_LOAD_WAIT = 5000; // 5 seconds for page transitions
export const API_WAIT = 3000; // 3 seconds for API calls

// ============================================================================
// GAMIFICATION STATE HELPERS
// ============================================================================

export interface GamificationState {
  totalPoints: number;
  tier: string;
  level: number;
  streakDays: number;
}

/**
 * Get user's gamification state via API
 */
export async function getGamificationState(page: Page): Promise<GamificationState> {
  const response = await page.request.get('/api/v1/me/thrive-circle/my_status/');

  if (!response.ok()) {
    throw new Error(`Failed to get gamification state: ${response.status()}`);
  }

  const data = await response.json();

  return {
    totalPoints: data.total_points || 0,
    tier: data.tier || 'seedling',
    level: data.level || 1,
    streakDays: data.current_streak_days || 0,
  };
}

/**
 * Verify points increased after an action
 */
export async function verifyPointsIncreased(
  page: Page,
  previousPoints: number,
  context: string
): Promise<number> {
  // Wait for points to be awarded (async)
  await page.waitForTimeout(API_WAIT);

  const currentState = await getGamificationState(page);

  if (currentState.totalPoints <= previousPoints) {
    console.warn(
      `Points did not increase in ${context}: was ${previousPoints}, now ${currentState.totalPoints}`
    );
  }

  return currentState.totalPoints;
}

/**
 * Get user's achievements
 */
export async function getAchievements(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/v1/me/achievements/');

  if (!response.ok()) {
    return [];
  }

  const data = await response.json();
  return (data.results || data || []).map((a: { slug: string }) => a.slug);
}

/**
 * Get user's daily quests status
 */
export async function getDailyQuests(
  page: Page
): Promise<Array<{ id: string; status: string; title: string }>> {
  const response = await page.request.get('/api/v1/me/side-quests/daily/');

  if (!response.ok()) {
    return [];
  }

  const data = await response.json();
  return (data.results || data || []).map((q: { id: string; status: string; title: string }) => ({
    id: q.id,
    status: q.status,
    title: q.title,
  }));
}

// ============================================================================
// BATTLE HELPERS
// ============================================================================

export interface BattleResult {
  won: boolean;
  pointsEarned: number;
  battleId: string;
}

/**
 * Complete a full battle flow and return the result
 */
export async function completeBattleFlow(
  page: Page,
  prompt: string
): Promise<BattleResult> {
  const initialState = await getGamificationState(page);

  // Create and join battle
  const { battleId } = await createPipBattleAndJoin(page);

  // Wait for battle to start (countdown phase)
  await page.waitForTimeout(12000); // Wait for countdown

  // Look for prompt input
  const promptInput = page.locator(
    'textarea[placeholder*="prompt"], input[placeholder*="prompt"]'
  );

  // Wait for active phase with extended timeout
  await expect(promptInput).toBeVisible({ timeout: BATTLE_PHASE_TIMEOUT });

  // Submit prompt
  await promptInput.fill(prompt);
  const submitButton = page.locator('button:has-text("Submit")').first();
  await submitButton.click();

  // Wait for battle completion
  await page.waitForFunction(
    () => document.body.textContent?.match(/complete|winner|result|score|finished/i),
    { timeout: BATTLE_COMPLETE_WAIT }
  );

  await page.waitForTimeout(API_WAIT);

  // Check points
  const finalState = await getGamificationState(page);
  const pointsEarned = finalState.totalPoints - initialState.totalPoints;

  // Check if won
  const content = await getPageContent(page);
  const won = /you.*win|winner.*you|victory/i.test(content);

  return { won, pointsEarned, battleId };
}

// ============================================================================
// PROJECT HELPERS
// ============================================================================

/**
 * Get user's projects via API
 */
export async function getUserProjects(page: Page): Promise<Array<{ id: number; title: string; slug: string }>> {
  const response = await page.request.get('/api/v1/me/projects/');

  if (!response.ok()) {
    return [];
  }

  const data = await response.json();
  return (data.results || data || []).map((p: { id: number; title: string; slug: string }) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
  }));
}

/**
 * Get user's clipped (saved) projects
 */
export async function getClippedProjects(
  page: Page,
  username: string
): Promise<Array<{ id: number; title: string }>> {
  const response = await page.request.get(`/api/v1/users/${username}/clipped-projects/`);

  if (!response.ok()) {
    return [];
  }

  const data = await response.json();
  return (data.results || data || []).map((p: { id: number; title: string }) => ({
    id: p.id,
    title: p.title,
  }));
}

// ============================================================================
// CONVERSATION HELPERS
// ============================================================================

/**
 * Get user's conversations
 */
export async function getConversations(page: Page): Promise<Array<{ id: string; messageCount: number }>> {
  const response = await page.request.get('/api/v1/me/conversations/');

  if (!response.ok()) {
    return [];
  }

  const data = await response.json();
  return (data.results || data || []).map((c: { id: string; message_count: number }) => ({
    id: c.id,
    messageCount: c.message_count || 0,
  }));
}

// ============================================================================
// ONBOARDING HELPERS
// ============================================================================

/**
 * Check if user has completed onboarding
 */
export async function hasCompletedOnboarding(page: Page): Promise<boolean> {
  const result = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('ember_onboarding_'));
    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.hasSeenModal) return true;
      } catch {
        // Ignore parse errors
      }
    }
    return localStorage.getItem('allthrive_onboarding_dismissed') === 'true';
  });

  return result;
}

/**
 * Reset onboarding state for testing new user flow
 */
export async function resetOnboardingState(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Remove all onboarding-related keys
    const keysToRemove = Object.keys(localStorage).filter(
      (k) =>
        k.startsWith('ember_onboarding_') ||
        k.startsWith('allthrive_onboarding_')
    );
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  });
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Navigate to home and wait for Ember to be ready
 */
export async function goToHomeAndWaitForEmber(page: Page): Promise<void> {
  await page.goto('/home');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(PAGE_LOAD_WAIT);

  // Wait for chat input to be available
  const chatInput = page.locator('input[placeholder="Message Ember..."]');
  await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });
}

/**
 * Navigate to profile and verify it loads
 */
export async function goToProfile(page: Page, username: string): Promise<void> {
  await page.goto(`/${username}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(PAGE_LOAD_WAIT);

  const content = await getPageContent(page);
  assertNoTechnicalErrors(content, 'profile page');
}

/**
 * Navigate to explore and wait for content
 */
export async function goToExplore(page: Page): Promise<void> {
  await page.goto('/explore');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(PAGE_LOAD_WAIT);

  const content = await getPageContent(page);
  assertNoTechnicalErrors(content, 'explore page');
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that user is on expected URL
 */
export function assertOnPage(page: Page, pathPattern: RegExp | string): void {
  const url = page.url();
  if (typeof pathPattern === 'string') {
    expect(url).toContain(pathPattern);
  } else {
    expect(url).toMatch(pathPattern);
  }
}

/**
 * Assert page has no technical errors
 */
export async function assertPageHealthy(page: Page, context: string): Promise<void> {
  const content = await getPageContent(page);
  assertNoTechnicalErrors(content, context);
}

/**
 * Assert element is visible with custom message
 */
export async function assertVisible(
  page: Page,
  selector: string,
  message: string,
  timeout = 10000
): Promise<void> {
  try {
    await expect(page.locator(selector).first()).toBeVisible({ timeout });
  } catch {
    throw new Error(`${message}: Element "${selector}" not visible within ${timeout}ms`);
  }
}
