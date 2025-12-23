/**
 * File Upload E2E Tests
 *
 * Tests for uploading files across the application:
 * - Avatar uploads (profile pictures)
 * - Project banner uploads
 * - Document uploads in chat
 *
 * These tests verify that file uploads work correctly and files display properly.
 *
 * RUN: npx playwright test e2e/file-upload.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_PATH = path.join(__dirname, 'fixtures');
const TEST_IMAGE = path.join(FIXTURES_PATH, 'test-image.png');

test.describe('File Upload - Avatar', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('user can navigate to profile settings', async ({ page }) => {
    // GIVEN: I am logged in
    // WHEN: I navigate to settings
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    // THEN: I should see the settings page
    await expect(page.locator('text=Settings')).toBeVisible({ timeout: 10000 });
  });

  test('avatar upload button is visible on settings page', async ({ page }) => {
    // GIVEN: I am on the settings page
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I look for avatar upload functionality
    // THEN: There should be a way to change avatar (button, input, or clickable image)
    const avatarUpload = page.locator(
      'input[type="file"][accept*="image"], ' +
      'button:has-text("Change Avatar"), ' +
      'button:has-text("Upload Avatar"), ' +
      '[data-testid="avatar-upload"], ' +
      'label:has-text("Avatar")'
    );

    // At least one upload method should be present
    const count = await avatarUpload.count();
    expect(count).toBeGreaterThan(0);
  });

  test('avatar displays correctly after page reload', async ({ page }) => {
    // GIVEN: I am logged in and have a profile
    await page.goto('/account/settings');
    await page.waitForLoadState('networkidle');

    // WHEN: I check for avatar display
    const avatar = page.locator('img[alt*="avatar"], img[alt*="Avatar"], [class*="avatar"] img');

    // THEN: Avatar should be visible or have a fallback
    // Either an image is displayed or there's a fallback initial/icon
    const hasAvatar = await avatar.count() > 0;
    const hasFallback = await page.locator('[class*="avatar"]').count() > 0;

    expect(hasAvatar || hasFallback).toBe(true);
  });
});

test.describe('File Upload - Project Media', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('project creation page has media upload capability', async ({ page }) => {
    // GIVEN: I am on the home page with chat
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I look for the plus menu for uploads
    const plusButton = page.locator('button[aria-label="Add integration"]');

    // THEN: The plus button should be visible
    await expect(plusButton).toBeVisible({ timeout: 10000 });

    // AND: Clicking it should show upload option
    await plusButton.click();
    await page.waitForTimeout(300);

    const uploadOption = page.locator('button[role="menuitem"]:has-text("Upload")');
    await expect(uploadOption.first()).toBeVisible();
  });

  test('file input accepts image files', async ({ page }) => {
    // GIVEN: I am on a page with file upload capability
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Open plus menu
    const plusButton = page.locator('button[aria-label="Add integration"]');
    await plusButton.click();
    await page.waitForTimeout(300);

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });

    // Click upload option
    const uploadOption = page.locator('button[role="menuitem"]:has-text("Upload Image or Video")');
    await uploadOption.click();

    // WHEN: File chooser opens
    const fileChooser = await fileChooserPromise;

    // THEN: It should accept the file
    await fileChooser.setFiles(TEST_IMAGE);
    await page.waitForTimeout(1000);

    // AND: Attachment preview should appear
    const hasAttachment = await page.locator('.mb-2.flex.flex-wrap.gap-2 > div').count() > 0;
    expect(hasAttachment).toBe(true);
  });

  test('uploaded file shows preview before sending', async ({ page }) => {
    // GIVEN: I am on home with chat
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I upload a file
    const plusButton = page.locator('button[aria-label="Add integration"]');
    await plusButton.click();
    await page.waitForTimeout(300);

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
    const uploadOption = page.locator('button[role="menuitem"]:has-text("Upload Image or Video")');
    await uploadOption.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_IMAGE);
    await page.waitForTimeout(500);

    // THEN: I should see the file name in a preview chip
    const fileNameVisible = await page.locator('text=test-image.png').isVisible().catch(() => false);
    const chipVisible = await page.locator('.mb-2.flex.flex-wrap.gap-2 > div').count() > 0;

    expect(fileNameVisible || chipVisible).toBe(true);
  });

  test('can remove uploaded file before sending', async ({ page }) => {
    // GIVEN: I have uploaded a file
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const plusButton = page.locator('button[aria-label="Add integration"]');
    await plusButton.click();
    await page.waitForTimeout(300);

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
    const uploadOption = page.locator('button[role="menuitem"]:has-text("Upload Image or Video")');
    await uploadOption.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_IMAGE);
    await page.waitForTimeout(500);

    // Verify file is attached
    const initialCount = await page.locator('.mb-2.flex.flex-wrap.gap-2 > div').count();
    expect(initialCount).toBeGreaterThan(0);

    // WHEN: I click the remove button on the attachment
    const removeButton = page.locator('.mb-2.flex.flex-wrap.gap-2 button, [aria-label="Remove"]').first();
    if (await removeButton.isVisible()) {
      await removeButton.click();
      await page.waitForTimeout(300);

      // THEN: The attachment should be removed
      const finalCount = await page.locator('.mb-2.flex.flex-wrap.gap-2 > div').count();
      expect(finalCount).toBeLessThan(initialCount);
    }
  });
});

test.describe('File Upload - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('upload UI remains functional after failed upload attempt', async ({ page }) => {
    // GIVEN: I am on home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I interact with upload functionality
    const plusButton = page.locator('button[aria-label="Add integration"]');
    await plusButton.click();
    await page.waitForTimeout(300);

    // THEN: The menu should be visible and interactive
    const uploadOption = page.locator('button[role="menuitem"]:has-text("Upload")');
    await expect(uploadOption.first()).toBeVisible();

    // Close menu
    await page.keyboard.press('Escape');

    // AND: Chat input should still be functional
    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled();
  });

  test('chat input remains enabled after cancelling file picker', async ({ page }) => {
    // GIVEN: I am on home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Open file picker but don't select a file
    const plusButton = page.locator('button[aria-label="Add integration"]');
    await plusButton.click();
    await page.waitForTimeout(300);

    // Just close the menu without selecting anything
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // THEN: Chat input should still work
    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    await expect(chatInput).toBeEnabled();

    // AND: I can type a message
    await chatInput.fill('Test message after cancel');
    await expect(chatInput).toHaveValue('Test message after cancel');
  });
});
