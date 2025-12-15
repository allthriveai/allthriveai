import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

/**
 * Helper to open the Events Calendar panel from the sidebar menu
 */
async function openEventsCalendar(page: import('@playwright/test').Page) {
  // Navigate to explore page which has the dashboard layout
  await page.goto('/explore');
  await page.waitForLoadState('domcontentloaded');

  // Wait for the page to fully load with user context
  await page.waitForTimeout(1000);

  // Look for Events Calendar in the sidebar - it might be directly visible or under a section
  // The sidebar should be visible on desktop
  const eventsCalendarLink = page.getByRole('button', { name: /events calendar/i })
    .or(page.locator('a:has-text("Events Calendar")'))
    .or(page.locator('button:has-text("Events Calendar")'))
    .first();

  // If not visible, try expanding the MEMBERSHIP section first
  if (!(await eventsCalendarLink.isVisible({ timeout: 2000 }).catch(() => false))) {
    const membershipSection = page.locator('button:has-text("MEMBERSHIP"), div:has-text("MEMBERSHIP")').first();
    if (await membershipSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await membershipSection.click();
      await page.waitForTimeout(300);
    }
  }

  await eventsCalendarLink.click();

  // Wait for the events panel to open
  await expect(page.locator('h2:has-text("Events Calendar")')).toBeVisible({ timeout: 10000 });
}

test.describe('Events Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should open events calendar panel from menu', async ({ page }) => {
    await openEventsCalendar(page);

    // Verify the panel is open
    await expect(page.locator('h2:has-text("Events Calendar")')).toBeVisible();
  });

  test('should show close button in events panel', async ({ page }) => {
    await openEventsCalendar(page);

    // Should have a close button
    await expect(page.locator('button[aria-label="Close"]')).toBeVisible();
  });

  test('should close events panel when clicking close button', async ({ page }) => {
    await openEventsCalendar(page);

    // Close the panel
    await page.locator('button[aria-label="Close"]').click();

    // Panel should be hidden
    await expect(page.locator('h2:has-text("Events Calendar")')).not.toBeVisible({ timeout: 3000 });
  });

  test('non-admin user should NOT see Add Event button', async ({ page }) => {
    // The e2e-test-user is NOT an admin, so they should not see the Add Event button
    await openEventsCalendar(page);

    // The Add Event button (with title="Add Event") should NOT be visible for non-admin users
    // This tests the fix: previously it checked user.isStaff which was always undefined
    // Now it correctly checks user.role === 'admin'
    const addEventButton = page.locator('button[title="Add Event"]');
    await expect(addEventButton).not.toBeVisible();
  });
});

test.describe('Events Calendar - Admin User', () => {
  test.skip('admin user should see Add Event button', async ({ page: _page }) => {
    // TODO: This test requires an admin user to be set up
    // Currently skipped until we have an e2e-admin-user fixture
    //
    // The test would:
    // 1. Login as admin user
    // 2. Open events calendar panel
    // 3. Verify the "Add Event" button (title="Add Event") IS visible
    // 4. Click it and verify the form opens
    //
    // To enable this test:
    // 1. Create an admin e2e user in the database
    // 2. Add loginAsAdmin helper or update helpers.ts with admin credentials
    // 3. Remove the .skip from this test
  });
});
