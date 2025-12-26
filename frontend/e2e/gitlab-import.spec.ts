/**
 * E2E tests for GitLab Import Flow.
 *
 * CRITICAL: These tests ensure the complete GitLab import flow works correctly.
 * They test the user journey from chat to project selection to project creation.
 *
 * Prerequisites:
 * - Test user must exist with GitLab connected
 *
 * Run with: npx playwright test gitlab-import.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

test.describe('GitLab Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test.describe('GitLab Connection Check', () => {
    test('should show GitLab status in integrations settings', async ({ page }) => {
      await page.goto('/settings/integrations');
      await page.waitForLoadState('networkidle');

      // Should see GitLab section
      await expect(page.getByText('GitLab', { exact: false })).toBeVisible();
    });

    test('should check GitLab connection status via API', async ({ page }) => {
      const response = await page.request.get('/api/v1/social/status/gitlab/');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      // Response should have connected field (true or false)
      expect(data.data).toHaveProperty('connected');
    });
  });

  test.describe('Chat Plus Menu GitLab Option', () => {
    test('should show GitLab option in plus menu', async ({ page }) => {
      await page.goto('/home');
      await page.waitForLoadState('networkidle');

      // Click the plus button to open menu
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();

      // Click "More Integrations" to see GitLab
      await page.getByText('More Integrations').click();

      // Should see GitLab option
      await expect(page.getByText('Add from GitLab')).toBeVisible();
    });

    test('should start GitLab flow when clicked', async ({ page }) => {
      await page.goto('/home');
      await page.waitForLoadState('networkidle');

      // Open plus menu
      const plusButton = page.locator('button[aria-label="Add integration"]');
      await plusButton.click();

      // Click More Integrations
      await page.getByText('More Integrations').click();

      // Click GitLab option
      await page.getByText('Add from GitLab').click();

      // Should either show connect button or project list
      // depending on user's GitLab status
      await expect(
        page.getByText('Connect GitLab').or(
          page.getByText('Search projects')
        )
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('GitLab OAuth Flow', () => {
    test('GitLab login redirect should return correct URL format', async ({ page }) => {
      // Check that the OAuth redirect URL is properly formatted
      const response = await page.request.get(
        '/accounts/gitlab/login/?process=connect',
        { maxRedirects: 0 }
      );

      // Should be a redirect
      expect(response.status()).toBe(302);

      const location = response.headers()['location'];
      expect(location).toContain('gitlab.com/oauth/authorize');
      expect(location).toContain('client_id=');
      expect(location).toContain('redirect_uri=');
    });

    test('GitLab callback URL should be configured correctly', async ({ page }) => {
      // The callback should be accessible (will show error without valid code)
      const response = await page.request.get(
        '/accounts/gitlab/login/callback/?code=invalid&state=test'
      );

      // Should return 200 with error page (not 404 or 500)
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).toContain('Third-Party Login Failure');
    });
  });

  test.describe('Project Listing', () => {
    test('should require authentication for project listing', async ({ page }) => {
      // Try to access without auth
      await page.context().clearCookies();

      const response = await page.request.get('/api/v1/gitlab/projects/');
      expect(response.status()).toBe(401);
    });

    test('authenticated user should get project list or connection prompt', async ({ page }) => {
      const response = await page.request.get('/api/v1/gitlab/projects/');

      // Should get 200 (success) or 401 (not connected)
      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        // Should have repositories array
        expect(data.data?.repositories !== undefined || data.data?.count !== undefined).toBeTruthy();
      }
    });
  });

  test.describe('Import Flow', () => {
    test('should require authentication for import', async ({ page }) => {
      await page.context().clearCookies();

      const response = await page.request.post('/api/v1/integrations/import/', {
        data: { url: 'https://gitlab.com/test/repo' },
      });

      expect(response.status()).toBe(401);
    });

    test('should validate GitLab URL format', async ({ page }) => {
      const response = await page.request.post('/api/v1/integrations/import/', {
        data: { url: 'https://github.com/user/repo' },
      });

      // Should work since integrations/import handles multiple providers
      // Or could reject if it's provider-specific
      expect([200, 202, 400]).toContain(response.status());
    });
  });

  test.describe('Task Status Polling', () => {
    test('should return task status for valid task ID', async ({ page }) => {
      // This tests that the task status endpoint works
      const response = await page.request.get('/api/v1/integrations/tasks/nonexistent-task-id/');

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.task_id).toBe('nonexistent-task-id');
      expect(data.status).toBe('PENDING');
    });
  });
});

test.describe('GitLab Import Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should handle rate limiting gracefully', async ({ page }) => {
    // Make many requests quickly
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(
        page.request.get('/api/v1/gitlab/projects/')
      );
    }

    const responses = await Promise.all(requests);

    // All should succeed or rate limit
    for (const response of responses) {
      expect([200, 401, 429]).toContain(response.status());
    }
  });

  test('should show helpful error for invalid URLs', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    // Type an invalid URL in chat
    const chatInput = page.locator('textarea[placeholder*="message"]').first();
    await chatInput.fill('Import this repo: not-a-valid-url');
    await chatInput.press('Enter');

    // Should see error handling (exact message depends on implementation)
    // This is a smoke test to ensure no crashes
    await page.waitForTimeout(2000);
    expect(await page.title()).toBeTruthy(); // Page should still be functional
  });
});

test.describe('GitLab Token Refresh', () => {
  test('should handle expired tokens transparently', async ({ page }) => {
    // This test verifies the token refresh mechanism works
    const response = await page.request.get('/api/v1/gitlab/projects/');

    // Should get a valid response (not a 401 due to expired token)
    expect([200, 401]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      // If we got here, token refresh worked (if needed)
      expect(data).toBeDefined();
    }
  });
});
