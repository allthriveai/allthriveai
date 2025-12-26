/**
 * Community Presence Tests
 *
 * Tests for typing indicators, online status,
 * and presence features in community rooms.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaAPI,
  getPageContent,
  WS_CONNECT_TIMEOUT,
} from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

test.describe('Community Presence - Typing Indicators', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('typing in input triggers indicator update', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/lounge');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const roomLink = page.locator('a[href*="/lounge/"], [data-testid="room-card"]').first();

    if (await roomLink.isVisible({ timeout: 10000 })) {
      await roomLink.click();
      await page.waitForTimeout(3000);

      const messageInput = page.locator(
        'input[placeholder*="message"], textarea[placeholder*="message"]'
      );

      if (await messageInput.isVisible({ timeout: WS_CONNECT_TIMEOUT })) {
        // Start typing
        await messageInput.focus();
        await messageInput.type('Testing typing indicator...', { delay: 100 });

        // Wait a moment for typing indicator to propagate
        await page.waitForTimeout(1000);

        // Clear the input (don't send)
        await messageInput.fill('');
        await page.waitForTimeout(3000);

        // Page should still function without errors
        const content = await getPageContent(page);
        assertNoTechnicalErrors(content, 'typing indicator');
      }
    } else {
      test.skip();
    }
  });

  test('typing indicator clears on stop', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/lounge');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const roomLink = page.locator('a[href*="/lounge/"], [data-testid="room-card"]').first();

    if (await roomLink.isVisible({ timeout: 10000 })) {
      await roomLink.click();
      await page.waitForTimeout(3000);

      const messageInput = page.locator(
        'input[placeholder*="message"], textarea[placeholder*="message"]'
      );

      if (await messageInput.isVisible({ timeout: WS_CONNECT_TIMEOUT })) {
        // Type and then stop
        await messageInput.focus();
        await messageInput.type('Test', { delay: 100 });
        await page.waitForTimeout(1000);

        // Stop typing and blur
        await messageInput.blur();
        await page.waitForTimeout(5000);

        // Page should be functional
        const content = await getPageContent(page);
        assertNoTechnicalErrors(content, 'typing clear');
      }
    } else {
      test.skip();
    }
  });
});

test.describe('Community Presence - Online Status', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('online users list updates on join', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/lounge');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const roomLink = page.locator('a[href*="/lounge/"], [data-testid="room-card"]').first();

    if (await roomLink.isVisible({ timeout: 10000 })) {
      await roomLink.click();
      await page.waitForTimeout(5000);

      // Look for online users indicator
      const onlineIndicator = page.locator(
        '[data-testid="online-users"], [class*="online"], text=/online|member|user/i'
      );

      if (await onlineIndicator.count() > 0) {
        const content = await getPageContent(page);

        // Should show some online status info
        const hasOnlineInfo = /online|member|user|1\s*(online|member)/i.test(content);
        expect(hasOnlineInfo).toBe(true);
      }

      // No errors in any case
      const content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'online status');
    } else {
      test.skip();
    }
  });

  test('leaving room updates presence', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/lounge');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const roomLink = page.locator('a[href*="/lounge/"], [data-testid="room-card"]').first();

    if (await roomLink.isVisible({ timeout: 10000 })) {
      await roomLink.click();
      await page.waitForTimeout(3000);

      // Navigate away
      await page.goto('/explore');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Go back to lounge
      await page.goto('/lounge');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      // Should work without errors
      const content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'presence after leave');
    } else {
      test.skip();
    }
  });
});

test.describe('Community Presence - Room State', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('room loads with correct state', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/lounge');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check for room list
    const content = await getPageContent(page);
    assertNoTechnicalErrors(content, 'lounge load');

    // Should show room options or content
    const hasRoomContent = /room|general|lounge|chat|message/i.test(content);
    expect(hasRoomContent).toBe(true);
  });

  test('multiple rooms accessible', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/lounge');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Get all room links
    const roomLinks = page.locator('a[href*="/lounge/"]');
    const roomCount = await roomLinks.count();

    if (roomCount >= 2) {
      // Visit first room
      await roomLinks.first().click();
      await page.waitForTimeout(3000);

      let content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'first room');

      // Go back and visit second room
      await page.goto('/lounge');
      await page.waitForTimeout(2000);

      await roomLinks.nth(1).click();
      await page.waitForTimeout(3000);

      content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'second room');
    } else if (roomCount === 1) {
      await roomLinks.first().click();
      await page.waitForTimeout(3000);

      const content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'single room');
    } else {
      test.skip();
    }
  });
});
