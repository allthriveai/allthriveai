import { Page } from '@playwright/test';

// Use environment variables with fallbacks for local development
export const TEST_USER = {
  username: process.env.TEST_USER_USERNAME || 'e2e-test-user',
  email: process.env.TEST_USER_EMAIL || 'e2e-test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'e2eTestPassword123',
};

// Admin user for testing admin-only features
export const ADMIN_USER = {
  username: process.env.ADMIN_USER_USERNAME || 'e2e-admin-user',
  email: process.env.ADMIN_USER_EMAIL || 'e2e-admin@example.com',
  password: process.env.ADMIN_USER_PASSWORD || 'e2eAdminPassword123',
};

export const TEST_PROJECT_SLUG = process.env.TEST_PROJECT_SLUG || 'e2e-test-project';

// API base URL - use proxy in dev, direct in CI
export const API_BASE_URL = 'http://localhost:8000';

/**
 * Wait for the React app to recognize the authenticated user
 * Call this after navigating to a new page to ensure AuthContext has loaded
 */
export async function waitForAuth(page: Page, timeoutMs = 10000) {
  await page.waitForFunction(
    async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/auth/me/', {
          credentials: 'include'
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    { timeout: timeoutMs }
  );
  // Give React a moment to update
  await page.waitForTimeout(500);
}

/**
 * Dismiss the Ember onboarding modal by setting localStorage keys
 * This prevents the modal from blocking E2E test interactions.
 * Must be called after login when we know the user ID.
 */
export async function dismissOnboardingModal(page: Page, userId?: number | string) {
  await page.evaluate((uid) => {
    // If we have a user ID, set the user-specific Ember onboarding key
    if (uid) {
      const emberState = {
        hasSeenModal: true,
        completedAdventures: ['battle_pip', 'add_project', 'explore'],
        isDismissed: true,
        welcomePointsAwarded: true,
      };
      localStorage.setItem(`ember_onboarding_${uid}`, JSON.stringify(emberState));
    }

    // Also set the legacy keys for backwards compatibility
    localStorage.setItem('allthrive_onboarding_dismissed', 'true');
    localStorage.setItem('allthrive_onboarding_completed_adventures', JSON.stringify([
      'welcome',
      'personalize',
      'first_project'
    ]));
  }, userId);
}

/**
 * Login via test API endpoint from within page context
 * This ensures cookies are properly set in the browser
 */
export async function loginViaAPI(page: Page) {
  // Go to any page to establish context
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Login using fetch from within the page context (so cookies are set properly)
  const loginResult = await page.evaluate(async ({ email, password }) => {
    try {
      // Get CSRF token
      const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];

      const response = await fetch('http://localhost:8000/api/v1/auth/test-login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `${response.status}: ${text}` };
      }

      const data = await response.json();
      return { success: true, username: data.data?.username, userId: data.data?.id };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { email: TEST_USER.email, password: TEST_USER.password });

  if (!loginResult.success) {
    throw new Error(`Login failed: ${loginResult.error}`);
  }

  console.log(`✓ Logged in as: ${loginResult.username} (ID: ${loginResult.userId})`);

  // Dismiss onboarding modal with user ID to set correct localStorage key
  await dismissOnboardingModal(page, loginResult.userId);

  // Reload to initialize AuthContext with the new cookies
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Re-dismiss onboarding modal after reload (localStorage persists, but ensure it's set)
  await dismissOnboardingModal(page, loginResult.userId);
  await page.waitForTimeout(1500);
}

/**
 * Check if user is already logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('http://localhost:8000/api/v1/auth/me/');
    return response.ok();
  } catch {
    return false;
  }
}

/**
 * Logout via API
 */
export async function logoutViaAPI(page: Page) {
  const cookies = await page.context().cookies();
  const csrfCookie = cookies.find(c => c.name === 'csrftoken');

  await page.request.post('http://localhost:8000/api/v1/auth/logout/', {
    headers: csrfCookie ? {
      'X-CSRFToken': csrfCookie.value,
    } : {},
  });
}

/**
 * Login as admin user via test API endpoint
 * This ensures cookies are properly set in the browser for admin access
 */
export async function loginAsAdminViaAPI(page: Page) {
  // Go to any page to establish context
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Login using fetch from within the page context (so cookies are set properly)
  const loginResult = await page.evaluate(async ({ email, password }) => {
    try {
      // Get CSRF token
      const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];

      const response = await fetch('http://localhost:8000/api/v1/auth/test-login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `${response.status}: ${text}` };
      }

      const data = await response.json();
      return { success: true, username: data.data?.username, userId: data.data?.id, role: data.data?.role };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { email: ADMIN_USER.email, password: ADMIN_USER.password });

  if (!loginResult.success) {
    throw new Error(`Admin login failed: ${loginResult.error}`);
  }

  if (loginResult.role !== 'admin') {
    throw new Error(`User ${loginResult.username} is not an admin (role: ${loginResult.role}). Please ensure the e2e-admin-user has role='admin' in the database.`);
  }

  console.log(`✓ Logged in as admin: ${loginResult.username} (ID: ${loginResult.userId})`);

  // Dismiss onboarding modal with user ID to set correct localStorage key
  await dismissOnboardingModal(page, loginResult.userId);

  // Reload to initialize AuthContext with the new cookies
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Re-dismiss onboarding modal after reload (localStorage persists, but ensure it's set)
  await dismissOnboardingModal(page, loginResult.userId);
  await page.waitForTimeout(1500);
}
