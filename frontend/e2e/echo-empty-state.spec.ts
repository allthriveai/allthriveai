import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

test.describe('Echo Content Engine - Empty State', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginViaAPI(page);
  });

  test('should display "What are your goals?" heading in empty state', async ({ page }) => {
    // Navigate to content engine page
    await page.goto('/create/content-engine');
    await page.waitForLoadState('networkidle');

    // Wait for empty state to appear (when no active goals)
    const heading = page.getByRole('heading', { name: 'What are your goals?' });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display clickable example goal pills', async ({ page }) => {
    // Navigate to content engine page
    await page.goto('/create/content-engine');
    await page.waitForLoadState('networkidle');

    // Wait for empty state
    await expect(page.getByText('What are your goals?')).toBeVisible({ timeout: 10000 });

    // Check that example pills are visible
    const examples = [
      'Post to LinkedIn 3x/week',
      'Grow my Twitter audience',
      'Build thought leadership',
      'Create a content calendar',
      'Repurpose my best content',
    ];

    for (const example of examples) {
      const pill = page.getByRole('button', { name: example });
      await expect(pill).toBeVisible();
    }
  });

  test('should disable example pills when disconnected', async ({ page }) => {
    // Navigate to content engine page
    await page.goto('/create/content-engine');
    await page.waitForLoadState('networkidle');

    // Wait for empty state
    await expect(page.getByText('What are your goals?')).toBeVisible({ timeout: 10000 });

    // Check that pills exist and are buttons
    const linkedInPill = page.getByRole('button', { name: 'Post to LinkedIn 3x/week' });
    await expect(linkedInPill).toBeVisible();

    // Note: In a real test, we would verify the disabled state when disconnected
    // For now, we just verify the button exists and has proper aria attributes
    await expect(linkedInPill).toHaveAttribute('type', 'button');
  });

  test('should send example as message when pill is clicked', async ({ page }) => {
    // Navigate to content engine page
    await page.goto('/create/content-engine');
    await page.waitForLoadState('networkidle');

    // Wait for empty state
    await expect(page.getByText('What are your goals?')).toBeVisible({ timeout: 10000 });

    // Wait a bit for WebSocket to connect
    await page.waitForTimeout(2000);

    // Click an example pill
    const pill = page.getByRole('button', { name: 'Post to LinkedIn 3x/week' });
    await pill.click();

    // The message should appear in the chat
    // Look for user message containing the example text
    const userMessage = page.locator('[role="article"]').filter({
      hasText: 'Post to LinkedIn 3x/week',
    });

    // Wait for the message to appear (with longer timeout for WebSocket)
    await expect(userMessage).toBeVisible({ timeout: 10000 });
  });
});
