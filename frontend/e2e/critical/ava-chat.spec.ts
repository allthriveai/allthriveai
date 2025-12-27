/**
 * Critical Ava chat E2E test.
 *
 * Ensures Ava can accept a message and return control to the user.
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../helpers';
import { waitForAvaReady } from '../deep/deep-helpers';

test.describe('Critical Ava chat', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('Ava responds and input re-enables', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: 15000 });

    const beforeContent = (await page.locator('body').textContent()) || '';

    await chatInput.fill('Say hi in one short sentence.');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    await waitForAvaReady(page, 90000);

    const afterContent = (await page.locator('body').textContent()) || '';
    expect(afterContent.length).toBeGreaterThan(beforeContent.length);
    await expect(chatInput).toBeEnabled();
  });
});
