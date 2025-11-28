import { Page } from '@playwright/test';

export const TEST_USER = {
  username: 'e2e-test-user',
  email: 'e2e-test@example.com',
  password: 'e2eTestPass123!',
};

export const TEST_PROJECT_SLUG = 'e2e-test-project';

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
      return { success: true, username: data.data?.username };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }, { email: TEST_USER.email, password: TEST_USER.password });

  if (!loginResult.success) {
    throw new Error(`Login failed: ${loginResult.error}`);
  }

  console.log(`✓ Logged in as: ${loginResult.username}`);

  // Reload to initialize AuthContext with the new cookies
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
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
