import { Page, ConsoleMessage } from '@playwright/test';

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

// API base URL - use relative URLs to go through Vite proxy
// This ensures cookies are sent correctly (same origin)
export const API_BASE_URL = '';

/**
 * Wait for the React app to recognize the authenticated user
 * Call this after navigating to a new page to ensure AuthContext has loaded
 */
export async function waitForAuth(page: Page, timeoutMs = 10000) {
  await page.waitForFunction(
    async () => {
      try {
        const response = await fetch('/api/v1/auth/me/', {
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

      const response = await fetch('/api/v1/auth/test-login/', {
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

  // Reload to initialize AuthContext with the new cookies
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

/**
 * Check if user is already logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('/api/v1/auth/me/');
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

  await page.request.post('/api/v1/auth/logout/', {
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

      const response = await fetch('/api/v1/auth/test-login/', {
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

  // Reload to initialize AuthContext with the new cookies
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

/**
 * Console error collector for detecting JavaScript errors during tests.
 * Use this to catch errors that appear in console but not in UI.
 */
export interface ConsoleErrorCollector {
  errors: string[];
  warnings: string[];
  start: () => void;
  stop: () => void;
  hasErrors: () => boolean;
  hasCriticalErrors: () => boolean;
  getErrorsSummary: () => string;
  clear: () => void;
}

/**
 * Create a console error collector for a page.
 * Call start() before the test actions and check hasErrors() after.
 *
 * @example
 * const consoleCollector = createConsoleErrorCollector(page);
 * consoleCollector.start();
 * // ... perform test actions ...
 * expect(consoleCollector.hasCriticalErrors()).toBe(false);
 */
export function createConsoleErrorCollector(page: Page): ConsoleErrorCollector {
  const errors: string[] = [];
  const warnings: string[] = [];
  let handler: ((msg: ConsoleMessage) => void) | null = null;

  // Patterns that indicate critical errors we should fail tests for
  const criticalErrorPatterns = [
    /Not connected\. Please try again/i,
    /WebSocket.*error/i,
    /Failed to connect/i,
    /Connection.*failed/i,
    /TypeError/i,
    /ReferenceError/i,
    /Cannot read propert/i,
    /undefined is not/i,
    /null is not/i,
    /Network error/i,
    /500.*Internal Server Error/i,
  ];

  // Patterns to ignore (known benign warnings)
  const ignorePatterns = [
    /Download the React DevTools/i,
    /componentWillReceiveProps has been renamed/i,
    /findDOMNode is deprecated/i,
    /ResizeObserver loop/i,
  ];

  const collector: ConsoleErrorCollector = {
    errors,
    warnings,

    start() {
      handler = (msg: ConsoleMessage) => {
        const text = msg.text();

        // Skip ignored patterns
        if (ignorePatterns.some((pattern) => pattern.test(text))) {
          return;
        }

        if (msg.type() === 'error') {
          errors.push(text);
        } else if (msg.type() === 'warning') {
          warnings.push(text);
        }
      };
      page.on('console', handler);
    },

    stop() {
      if (handler) {
        page.off('console', handler);
        handler = null;
      }
    },

    hasErrors() {
      return errors.length > 0;
    },

    hasCriticalErrors() {
      return errors.some((error) =>
        criticalErrorPatterns.some((pattern) => pattern.test(error))
      );
    },

    getErrorsSummary() {
      if (errors.length === 0) return 'No console errors';
      return `Console errors (${errors.length}):\n${errors.map((e) => `  - ${e}`).join('\n')}`;
    },

    clear() {
      errors.length = 0;
      warnings.length = 0;
    },
  };

  return collector;
}
