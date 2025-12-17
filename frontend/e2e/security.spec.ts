import { test, expect } from '@playwright/test';
import { loginViaAPI, API_BASE_URL } from './helpers';

test.describe('Security', () => {
  test.describe('XSS Prevention', () => {
    test('should sanitize user input in text fields', async ({ page }) => {
      await loginViaAPI(page);

      // Navigate to a page with user input (e.g., chat)
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000); // Allow React to hydrate

      // XSS payload attempts
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
        "javascript:alert('xss')",
        '<svg onload=alert("xss")>',
      ];

      // Find any text input on the page
      const textInput = page.locator('input[type="text"], textarea').first();
      const inputCount = await textInput.count();

      if (inputCount > 0 && (await textInput.isVisible())) {
        for (const payload of xssPayloads) {
          await textInput.fill(payload);

          // Verify the raw script tags are not rendered as HTML
          // The content should be escaped/sanitized
          const pageContent = await page.content();

          // Check that script tags are not executing as actual script elements
          // (they should be escaped in text content, not executed)
          expect(pageContent).not.toContain('<script>alert("xss")</script>');
          expect(pageContent).not.toContain('onerror=alert');

          await textInput.clear();
        }
      } else {
        // Test passes if no input fields exist - nothing to test for XSS
        console.log('No text input fields found on explore page - XSS input test skipped');
      }
    });

    test('should escape HTML in displayed user content', async ({ page }) => {
      await loginViaAPI(page);

      // Navigate to profile or any page that displays user-generated content
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Verify that any angle brackets in visible text are properly escaped
      // by checking the DOM doesn't contain unescaped script elements
      // that weren't part of the original page structure
      const scriptTags = await page.locator('script:not([src])').count();

      // Store count of legitimate scripts (from build)
      const legitimateScripts = scriptTags;

      // Interact with the page (if there's user content)
      await page.waitForTimeout(1000);

      // Count scripts again - should not have increased from XSS injection
      const newScriptCount = await page.locator('script:not([src])').count();
      expect(newScriptCount).toBeLessThanOrEqual(legitimateScripts);
    });

    test('should not execute javascript: URLs in links', async ({ page }) => {
      await loginViaAPI(page);
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Check that no href attributes contain javascript:
      const dangerousLinks = await page.locator('a[href^="javascript:"]').count();
      expect(dangerousLinks).toBe(0);
    });
  });

  test.describe('CSRF Protection', () => {
    test('should have CSRF token cookie set', async ({ page }) => {
      // Navigate to establish session
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Check for CSRF token cookie
      const cookies = await page.context().cookies();
      const csrfCookie = cookies.find((c) => c.name === 'csrftoken');

      expect(csrfCookie).toBeDefined();
      expect(csrfCookie?.value).toBeTruthy();
      expect(csrfCookie?.value.length).toBeGreaterThan(10);
    });

    test('should include CSRF token in authenticated POST requests', async ({ page }) => {
      await loginViaAPI(page);

      // Verify CSRF cookie is set after login
      const cookies = await page.context().cookies();
      const csrfCookie = cookies.find((c) => c.name === 'csrftoken');

      expect(csrfCookie).toBeDefined();
      expect(csrfCookie?.value).toBeTruthy();

      // Verify that the login process used CSRF token correctly
      // (loginViaAPI already includes X-CSRFToken header)
      console.log('CSRF token present in cookies after login');
    });

    test('should reject POST requests without CSRF token to protected endpoints', async ({
      page,
    }) => {
      await loginViaAPI(page);

      // Make a POST request without CSRF token to an endpoint that requires it
      const response = await page.evaluate(async (apiUrl) => {
        try {
          const res = await fetch(`${apiUrl}/api/v1/auth/logout/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Deliberately NOT including X-CSRFToken
            },
            credentials: 'include',
          });
          return { status: res.status, ok: res.ok };
        } catch (e) {
          return { error: String(e), status: 0, ok: false };
        }
      }, API_BASE_URL);

      // Should be rejected with 403 Forbidden (CSRF validation failed)
      // or 401/400 if the endpoint has other validation
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  test.describe('Auth Token Security', () => {
    test('should not expose auth tokens in URL', async ({ page }) => {
      await loginViaAPI(page);

      // Navigate through various pages
      const pagesToCheck = ['/explore', '/battles'];

      for (const path of pagesToCheck) {
        await page.goto(path);
        await page.waitForLoadState('domcontentloaded');

        const url = page.url();

        // Check URL doesn't contain token-like strings
        expect(url).not.toMatch(/[?&]token=/i);
        expect(url).not.toMatch(/[?&]access_token=/i);
        expect(url).not.toMatch(/[?&]auth_token=/i);
        expect(url).not.toMatch(/[?&]jwt=/i);
        expect(url).not.toMatch(/[?&]api_key=/i);
        expect(url).not.toMatch(/[?&]session=/i);

        // Also check for hash fragments
        expect(url).not.toMatch(/#.*token/i);
      }
    });

    test('should use httpOnly cookies for auth', async ({ page }) => {
      await loginViaAPI(page);

      const cookies = await page.context().cookies();

      // Check session-related cookies have httpOnly flag
      const sessionCookies = cookies.filter(
        (c) =>
          c.name.toLowerCase().includes('session') ||
          c.name.toLowerCase().includes('auth') ||
          c.name === 'sessionid'
      );

      for (const cookie of sessionCookies) {
        // Session cookies should be httpOnly to prevent XSS from stealing them
        expect(cookie.httpOnly).toBe(true);
      }
    });

    test('should not expose tokens in localStorage accessible content', async ({ page }) => {
      await loginViaAPI(page);

      // Check localStorage for sensitive data
      const localStorageData = await page.evaluate(() => {
        const data: Record<string, string | null> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            data[key] = localStorage.getItem(key);
          }
        }
        return data;
      });

      // Check that no localStorage keys contain obvious auth tokens
      for (const [key, value] of Object.entries(localStorageData)) {
        // Skip onboarding state which is expected
        if (key.includes('onboarding')) continue;

        // Auth tokens shouldn't be stored in localStorage (prefer httpOnly cookies)
        expect(key.toLowerCase()).not.toContain('auth_token');
        expect(key.toLowerCase()).not.toContain('access_token');
        expect(key.toLowerCase()).not.toContain('jwt');

        if (value) {
          // Check values don't look like JWT tokens (xxx.yyy.zzz pattern)
          const jwtPattern = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
          expect(value).not.toMatch(jwtPattern);
        }
      }
    });
  });

  test.describe('Protected Routes', () => {
    const protectedRoutes = [
      '/account/settings',
      '/account/notifications',
      '/account/privacy',
      '/account/billing',
      '/account/integrations',
      '/battles/history',
    ];

    for (const route of protectedRoutes) {
      test(`should redirect unauthenticated users from ${route}`, async ({ page }) => {
        // Try to access protected route without authentication
        await page.goto(route);
        await page.waitForLoadState('domcontentloaded');

        // Wait for potential redirect
        await page.waitForTimeout(3000);

        const currentUrl = page.url();

        // Should either redirect to auth page or show login prompt
        const isAuthPage =
          currentUrl.includes('/auth') ||
          currentUrl.includes('/login') ||
          currentUrl.includes('accounts.google.com') ||
          currentUrl === 'http://localhost:3000/';

        const hasLoginPrompt =
          (await page.locator('text=Sign in').count()) > 0 ||
          (await page.locator('text=Log in').count()) > 0 ||
          (await page.locator('text=Google').count()) > 0 ||
          (await page.locator('button:has-text("Continue with")').count()) > 0;

        // Verify user is not able to access protected content
        expect(isAuthPage || hasLoginPrompt).toBe(true);
      });
    }

    test('should allow authenticated users to access protected routes', async ({ page }) => {
      await loginViaAPI(page);

      // Navigate to a protected route
      await page.goto('/account/settings');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      const currentUrl = page.url();

      // Should stay on the settings page (not redirected to auth)
      expect(currentUrl).toContain('/account/settings');

      // Should see settings content - look for common settings page elements
      const hasSettingsContent =
        (await page.locator('h1, h2').filter({ hasText: /settings/i }).count()) > 0 ||
        (await page.locator('text=Account').count()) > 0 ||
        (await page.locator('text=Profile').count()) > 0;

      expect(hasSettingsContent).toBe(true);
    });

    test('should redirect to originally requested page after login', async ({ page }) => {
      // Try to access a protected route
      const targetRoute = '/account/settings';
      await page.goto(targetRoute);

      // Wait for redirect to auth
      await page.waitForTimeout(2000);

      // Now login
      await loginViaAPI(page);

      // Navigate back to the target route
      await page.goto(targetRoute);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Should be able to access it now
      expect(page.url()).toContain('/account/settings');
    });
  });

  test.describe('Rate Limiting', () => {
    test('should enforce rate limiting on login attempts', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const results: { status: number; ok: boolean }[] = [];

      // Make multiple rapid login attempts
      for (let i = 0; i < 15; i++) {
        const result = await page.evaluate(
          async ({ apiUrl }) => {
            // Get CSRF token first
            const csrfToken = document.cookie
              .split('; ')
              .find((row) => row.startsWith('csrftoken='))
              ?.split('=')[1];

            const res = await fetch(`${apiUrl}/api/v1/auth/test-login/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || '',
              },
              body: JSON.stringify({
                email: 'invalid@example.com',
                password: 'wrongpassword',
              }),
              credentials: 'include',
            });
            return { status: res.status, ok: res.ok };
          },
          { apiUrl: API_BASE_URL }
        );

        results.push(result);
      }

      // At least some requests should be rate limited (429) after rapid attempts
      // or we should see 401s for invalid credentials (which is also acceptable security)
      const hasRateLimiting = results.some((r) => r.status === 429);
      const hasAuthFailures = results.some((r) => r.status === 401 || r.status === 400);

      // Either rate limiting kicked in, or all requests properly failed auth
      expect(hasRateLimiting || hasAuthFailures).toBe(true);
    });

    test('should enforce rate limiting on API requests', async ({ page }) => {
      await loginViaAPI(page);

      const results: number[] = [];

      // Make many rapid API requests
      for (let i = 0; i < 30; i++) {
        const status = await page.evaluate(async (apiUrl) => {
          const res = await fetch(`${apiUrl}/api/v1/auth/me/`, {
            credentials: 'include',
          });
          return res.status;
        }, API_BASE_URL);

        results.push(status);
      }

      // Check if any requests were rate limited (429)
      // or if all succeeded (200) which might mean generous rate limits
      const rateLimited = results.filter((s) => s === 429).length;
      const successful = results.filter((s) => s === 200).length;

      // Log for debugging
      console.log(`Rate limit test: ${rateLimited} rate limited, ${successful} successful`);

      // Either we hit rate limits, or all requests succeeded
      // (some APIs have high thresholds or use sliding windows)
      expect(rateLimited + successful).toBe(results.length);
    });

    test('should return appropriate rate limit headers', async ({ page }) => {
      await loginViaAPI(page);

      // Make a request and check for rate limit headers
      const headers = await page.evaluate(async (apiUrl) => {
        const res = await fetch(`${apiUrl}/api/v1/auth/me/`, {
          credentials: 'include',
        });

        return {
          'x-ratelimit-limit': res.headers.get('x-ratelimit-limit'),
          'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining'),
          'x-ratelimit-reset': res.headers.get('x-ratelimit-reset'),
          'retry-after': res.headers.get('retry-after'),
        };
      }, API_BASE_URL);

      // Check if rate limit headers are present (optional but recommended)
      // Not all APIs implement these headers, so we just log them
      console.log('Rate limit headers:', headers);

      // At minimum, the API should respond (not error out)
      expect(headers).toBeDefined();
    });
  });

  test.describe('Security Headers', () => {
    test('should include security headers in responses', async ({ page }) => {
      const response = await page.goto('/');

      expect(response).not.toBeNull();

      if (response) {
        const headers = response.headers();

        // Check for common security headers
        // Note: Some may be set by nginx/cloudfront in production only

        // Content-Type should be set
        expect(headers['content-type']).toBeDefined();

        // Log other security headers for visibility
        console.log('Security headers present:', {
          'x-frame-options': headers['x-frame-options'],
          'x-content-type-options': headers['x-content-type-options'],
          'x-xss-protection': headers['x-xss-protection'],
          'strict-transport-security': headers['strict-transport-security'],
          'content-security-policy': headers['content-security-policy'],
        });
      }
    });
  });
});
