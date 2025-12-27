/**
 * Critical WebSocket E2E Tests
 *
 * Focused, PR-blocking checks for chat WebSocket connectivity.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../helpers';

const WS_CONNECT_TIMEOUT = 15000;

test.describe('Critical WebSocket checks', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('chat input is enabled on home page', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeVisible({ timeout: WS_CONNECT_TIMEOUT });
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });
  });

  test('user message is rendered after send', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

    const message = 'Critical WS check message';
    await chatInput.fill(message);

    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    await page.waitForTimeout(1000);
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain(message);
  });
});
