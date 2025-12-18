import { test, expect } from '@playwright/test';
import { loginAsAdminViaAPI } from './helpers';

test.describe('Admin Task Option Creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test('debug: check what payload frontend sends when creating option', async ({ page }) => {
    // Navigate to admin tasks
    await page.goto('/admin/tasks');
    await page.waitForLoadState('networkidle');

    // Intercept network requests
    page.on('request', request => {
      if (request.url().includes('/admin/tasks/options')) {
        console.log('>>> REQUEST:', request.method(), request.url());
        console.log('>>> Body:', request.postData());
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/admin/tasks/options')) {
        console.log('<<< RESPONSE:', response.status(), response.url());
        try {
          const body = await response.json();
          console.log('<<< Body:', JSON.stringify(body, null, 2));
        } catch {
          const text = await response.text();
          console.log('<<< Body (text):', text);
        }
      }
    });

    // Take screenshot of the page
    await page.screenshot({ path: 'test-results/01-tasks-page.png' });

    // Click "New Task" button
    const newTaskButton = page.locator('button:has-text("New Task")');
    await expect(newTaskButton).toBeVisible({ timeout: 10000 });
    await newTaskButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/02-task-modal.png' });

    // Find the + button next to Status select
    // The TaskOptionSelect has a + button (PlusIcon) next to each select
    const plusButtons = page.locator('button:has(svg.w-5.h-5)').filter({ hasText: '' });
    const allButtons = await plusButtons.all();
    console.log('Found buttons with icons:', allButtons.length);

    // Look specifically for the Plus button near Status
    // Structure: div > label "Status" > div with select and button
    const statusLabel = page.locator('label:has-text("Status")').first();
    const statusContainer = statusLabel.locator('..'); // parent div
    const addButton = statusContainer.locator('button').last();

    console.log('Clicking add button for Status...');
    await addButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/03-add-status-form.png' });

    // Now there should be an input field for the new status name
    const nameInput = page.locator('input[placeholder*="status" i], input[placeholder*="name" i]').first();
    const isInputVisible = await nameInput.isVisible().catch(() => false);
    console.log('Name input visible:', isInputVisible);

    if (isInputVisible) {
      const uniqueName = `E2E Status ${Date.now()}`;
      console.log('Entering name:', uniqueName);
      await nameInput.fill(uniqueName);
      await page.screenshot({ path: 'test-results/04-entered-name.png' });

      // Click the save/check button
      const checkButton = page.locator('button:has(svg[class*="w-4"][class*="h-4"])').first();
      console.log('Clicking save button...');
      await checkButton.click();

      // Wait for the API call
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/05-after-save.png' });
    } else {
      console.log('Could not find input field. Taking screenshot...');
      await page.screenshot({ path: 'test-results/03-no-input-found.png' });
    }
  });

  test('should successfully create a new task status option', async ({ page }) => {
    await page.goto('/admin/tasks');
    await page.waitForLoadState('networkidle');

    // Click "New Task"
    await page.click('button:has-text("New Task")');
    await page.waitForTimeout(1000);

    // Find and click + button for Status field
    const statusSection = page.locator('label:has-text("Status")').first().locator('..');
    await statusSection.locator('button').last().click();
    await page.waitForTimeout(500);

    // Fill in new status name
    const uniqueName = `Test Status ${Date.now()}`;
    await page.fill('input[placeholder*="status" i]', uniqueName);

    // Capture the API response
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/admin/tasks/options') && resp.request().method() === 'POST',
      { timeout: 10000 }
    );

    // Click save button (check icon)
    await page.locator('button:has(svg)').filter({ hasNot: page.locator('text=Cancel') }).first().click();

    const response = await responsePromise;
    const status = response.status();
    const body = await response.json().catch(() => ({}));

    console.log('Response status:', status);
    console.log('Response body:', JSON.stringify(body, null, 2));

    // Expect success (200 or 201)
    expect([200, 201]).toContain(status);
    expect(body.name).toBe(uniqueName);
    expect(body.optionType || body.option_type).toBe('status');
  });
});
