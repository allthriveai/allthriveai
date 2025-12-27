/**
 * Production Authentication Helper for E2E Smoke Tests
 *
 * This helper authenticates against the production smoke test endpoint
 * using an API key (since production uses OAuth-only, no passwords).
 *
 * Environment Variables Required:
 * - PROD_URL: Production frontend URL (https://allthrive.ai)
 * - API_URL: Production API URL (https://api.allthrive.ai)
 * - PROD_SMOKE_TEST_KEY: API key for smoke test endpoint
 */

import { Page } from '@playwright/test';

// Production URLs from environment
export const PROD_URL = process.env.PROD_URL || 'https://allthrive.ai';
export const API_URL = process.env.API_URL || 'https://api.allthrive.ai';
export const SMOKE_TEST_KEY = process.env.PROD_SMOKE_TEST_KEY || '';

// Test user info (Allie Jones)
export const SMOKE_TEST_USER = {
  email: 'allie@allthrive.ai',
  name: 'Allie Jones',
};

interface LoginResult {
  success: boolean;
  error?: string;
  userId?: number;
  username?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Login to production using the smoke test API key endpoint.
 * Sets JWT cookies in the browser for authenticated requests.
 */
export async function loginToProduction(page: Page): Promise<LoginResult> {
  if (!SMOKE_TEST_KEY) {
    throw new Error(
      'PROD_SMOKE_TEST_KEY environment variable is required for production smoke tests'
    );
  }

  // Navigate to production to establish browser context
  await page.goto(PROD_URL);
  await page.waitForLoadState('domcontentloaded');

  // Authenticate via smoke test endpoint
  const loginResult = await page.evaluate(
    async ({ apiUrl, smokeTestKey }) => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/smoke-test/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Smoke-Test-Key': smokeTestKey,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `${response.status}: ${text}` };
        }

        const data = await response.json();
        return {
          success: true,
          userId: data.user?.id,
          username: data.user?.username,
          accessToken: data.access,
          refreshToken: data.refresh,
        };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
    { apiUrl: API_URL, smokeTestKey: SMOKE_TEST_KEY }
  );

  if (!loginResult.success) {
    throw new Error(`Production smoke test login failed: ${loginResult.error}`);
  }

  console.log(
    `✓ Production smoke test login successful: ${loginResult.username} (ID: ${loginResult.userId})`
  );

  // Dismiss onboarding modals
  await dismissProductionOnboarding(page, loginResult.userId);

  // Reload to ensure AuthContext picks up the cookies
  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissProductionOnboarding(page, loginResult.userId);

  // Wait for auth to be recognized
  await page.waitForTimeout(1500);

  return loginResult;
}

/**
 * Dismiss onboarding modals for production smoke test user
 */
async function dismissProductionOnboarding(
  page: Page,
  userId?: number
): Promise<void> {
  await page.evaluate((uid) => {
    if (uid) {
      const avaState = {
        hasSeenModal: true,
        completedAdventures: ['battle_pip', 'add_project', 'explore'],
        isDismissed: true,
        welcomePointsAwarded: true,
      };
      localStorage.setItem(`ava_onboarding_${uid}`, JSON.stringify(avaState));
    }

    localStorage.setItem('allthrive_onboarding_dismissed', 'true');
    localStorage.setItem(
      'allthrive_onboarding_completed_adventures',
      JSON.stringify(['welcome', 'personalize', 'first_project'])
    );
  }, userId);
}

/**
 * Wait for WebSocket chat to be ready
 */
export async function waitForChatReady(
  page: Page,
  timeoutMs = 15000
): Promise<void> {
  const chatInput = page.locator('input[placeholder="Message Ava..."]');
  await chatInput.waitFor({ state: 'visible', timeout: timeoutMs });
  // Wait for WebSocket connection to be established
  await page.waitForTimeout(1000);
}

/**
 * Send a message in the chat and wait for response
 */
export async function sendChatMessage(
  page: Page,
  message: string,
  waitForResponseMs = 30000
): Promise<string> {
  const chatInput = page.locator('input[placeholder="Message Ava..."]');
  await chatInput.fill(message);

  const sendButton = page
    .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
    .first();
  await sendButton.click();

  // Wait for response to appear (look for assistant message)
  await page.waitForTimeout(waitForResponseMs);

  // Get the last assistant message
  const assistantMessages = page.locator(
    '[data-role="assistant"], .assistant-message, [class*="assistant"]'
  );
  const count = await assistantMessages.count();

  if (count > 0) {
    const lastMessage = assistantMessages.last();
    return (await lastMessage.textContent()) || '';
  }

  return '';
}

/**
 * Cleanup test data created during smoke tests
 */
export async function cleanupTestData(
  page: Page,
  options: {
    projectIds?: number[];
    avatarIds?: number[];
    battleIds?: number[];
  }
): Promise<void> {
  const { projectIds = [], avatarIds = [], battleIds = [] } = options;

  // Delete projects
  for (const id of projectIds) {
    await page.evaluate(
      async ({ apiUrl, projectId }) => {
        const csrfToken = document.cookie
          .split('; ')
          .find((row) => row.startsWith('csrftoken='))
          ?.split('=')[1];

        await fetch(`${apiUrl}/api/v1/projects/${projectId}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': csrfToken || '' },
          credentials: 'include',
        });
      },
      { apiUrl: API_URL, projectId: id }
    );
  }

  // Delete avatars
  for (const id of avatarIds) {
    await page.evaluate(
      async ({ apiUrl, avatarId }) => {
        const csrfToken = document.cookie
          .split('; ')
          .find((row) => row.startsWith('csrftoken='))
          ?.split('=')[1];

        await fetch(`${apiUrl}/api/v1/me/avatars/${avatarId}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': csrfToken || '' },
          credentials: 'include',
        });
      },
      { apiUrl: API_URL, avatarId: id }
    );
  }

  // Forfeit/abandon battles
  for (const id of battleIds) {
    await page.evaluate(
      async ({ apiUrl, battleId }) => {
        const csrfToken = document.cookie
          .split('; ')
          .find((row) => row.startsWith('csrftoken='))
          ?.split('=')[1];

        await fetch(`${apiUrl}/api/v1/battles/${battleId}/forfeit/`, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrfToken || '' },
          credentials: 'include',
        });
      },
      { apiUrl: API_URL, battleId: id }
    );
  }
}
