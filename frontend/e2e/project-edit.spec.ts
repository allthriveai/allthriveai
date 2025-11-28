import { test, expect } from '@playwright/test';
import { loginViaAPI, waitForAuth, TEST_USER, TEST_PROJECT_SLUG } from './helpers';

/**
 * E2E Tests for Project Editing via Sidebar Tray
 *
 * These tests verify:
 * - Opening the edit tray
 * - Editing project fields
 * - Autosave functionality
 * - UI updates without closing tray
 * - Like state preservation
 */

test.describe('Project Edit Tray', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate via login form
    await loginViaAPI(page);

    // No need to go to homepage - login already redirects there
    // Just wait to ensure AuthContext is fully initialized
    await page.waitForTimeout(1000);
  });

  test('should open edit tray when clicking Quick Edit button', async ({ page }) => {
    // Navigate to project detail page
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);

    // Wait for page to load
    await page.waitForSelector('h1');

    // Click the three-dot menu
    await page.click('[aria-label="Options menu"], button:has-text("⋮")');

    // Click Quick Edit
    await page.click('button:has-text("Quick Edit")');

    // Verify tray is open
    await expect(page.locator('text=Edit Project')).toBeVisible();

    // Verify tabs are visible
    await expect(page.locator('button:has-text("Content")')).toBeVisible();
    await expect(page.locator('button:has-text("Hero Display")')).toBeVisible();
    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
  });

  test('should open edit tray with E keyboard shortcut', async ({ page }) => {
    // Navigate to project detail page
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for ProjectDetailPage to mount and check auth
    // The three-dot menu button appears ONLY if isOwner is true
    // isOwner = user && project && user.username === project.username
    // So we need to wait for BOTH the project AND the user to load

    // Wait for project to load (h1 with title)
    await page.waitForSelector('h1', { timeout: 10000 });

    // Wait a moment for AuthContext to provide user
    await page.waitForTimeout(3000);

    // Debug: Check what the React app knows about the user
    const reactAuthState = await page.evaluate(() => {
      // Try to access the auth state from window (if exposed) or localStorage
      const cookies = document.cookie;
      return { cookies, url: window.location.href };
    });
    console.log('React state:', reactAuthState);

    // Check if we can call /auth/me from the page context
    const meCheck = await page.evaluate(async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/auth/me/', { credentials: 'include' });
        const data = await res.json();
        return { status: res.status, data };
      } catch (e) {
        return { error: String(e) };
      }
    });
    console.log('/auth/me from page:', meCheck);

    // Now check if owner UI appeared
    const hasOwnerMenu = await page.locator('[aria-label="Options menu"], button:has-text("⋮")').isVisible().catch(() => false);

    if (!hasOwnerMenu) {
      throw new Error(`Owner menu did not appear. Auth state: ${JSON.stringify(meCheck)}`);
    }

    // Press E key
    await page.keyboard.press('e');

    // Verify tray is open
    await expect(page.locator('text=Edit Project')).toBeVisible();
  });

  test('should update project title and show autosave', async ({ page }) => {
    // Navigate to project detail page
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.waitForSelector('h1');

    // Get original title
    const originalTitle = await page.locator('h1').first().textContent();

    // Open edit tray
    await page.keyboard.press('e');
    await expect(page.locator('text=Edit Project')).toBeVisible();

    // Find and update the title field
    const titleInput = page.locator('input[placeholder*="project title"], input[value]:near(:text("Project Title"))').first();
    await titleInput.clear();

    const newTitle = `Updated Project ${Date.now()}`;
    await titleInput.fill(newTitle);

    // Wait for "Saving..." indicator
    await expect(page.locator('text=Saving...')).toBeVisible({ timeout: 3000 });

    // Wait for save to complete
    await expect(page.locator('text=/Saved at/')).toBeVisible({ timeout: 5000 });

    // Verify tray stays open
    await expect(page.locator('text=Edit Project')).toBeVisible();

    // Verify title updated in main view
    await expect(page.locator('h1', { hasText: newTitle })).toBeVisible();

    // Verify title persists in edit field
    await expect(titleInput).toHaveValue(newTitle);
  });

  test('should update description and reflect in UI', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.waitForSelector('h1');

    // Open edit tray
    await page.keyboard.press('e');

    // Update description
    const descriptionInput = page.locator('textarea[placeholder*="description"]').first();
    const newDescription = `E2E test description ${Date.now()}`;
    await descriptionInput.clear();
    await descriptionInput.fill(newDescription);

    // Wait for autosave
    await expect(page.locator('text=/Saved at/')).toBeVisible({ timeout: 5000 });

    // Verify description visible in tray
    await expect(descriptionInput).toHaveValue(newDescription);
  });

  test('should close tray with X button', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.keyboard.press('e');

    // Verify tray is open
    await expect(page.locator('text=Edit Project')).toBeVisible();

    // Click X button
    await page.click('button[aria-label="Close"], button:has(svg):near(:text("Edit Project"))');

    // Verify tray is closed
    await expect(page.locator('text=Edit Project')).not.toBeVisible();
  });

  test('should close tray with overlay click', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.keyboard.press('e');

    // Verify tray is open
    await expect(page.locator('text=Edit Project')).toBeVisible();

    // Click overlay (dark background)
    await page.locator('.fixed.inset-0.bg-black\\/20').click({ position: { x: 10, y: 10 } });

    // Verify tray is closed
    await expect(page.locator('text=Edit Project')).not.toBeVisible();
  });

  test('should preserve like state after edit', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.waitForSelector('h1');

    // Get initial heart count (if visible)
    const heartButton = page.locator('button:has-text("♥"), button:has(svg):near(:text("0"))').first();
    const initialHeartCount = await heartButton.textContent().catch(() => '0');

    // Open edit tray and make a change
    await page.keyboard.press('e');
    const titleInput = page.locator('input[placeholder*="project title"]').first();
    await titleInput.fill(`Test ${Date.now()}`);

    // Wait for save
    await expect(page.locator('text=/Saved at/')).toBeVisible({ timeout: 5000 });

    // Get heart count after edit
    const finalHeartCount = await heartButton.textContent().catch(() => '0');

    // Verify heart count unchanged
    expect(finalHeartCount).toBe(initialHeartCount);
  });

  test('should switch between tabs in edit tray', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.keyboard.press('e');

    // Click on Hero Display tab
    await page.click('button:has-text("Hero Display")');
    await expect(page.locator('text=/Choose how to showcase/')).toBeVisible();

    // Click on Settings tab
    await page.click('button:has-text("Settings")');
    await expect(page.locator('text=Visibility')).toBeVisible();

    // Click back to Content tab
    await page.click('button:has-text("Content")');
    await expect(page.locator('input[placeholder*="project title"]')).toBeVisible();
  });

  test('should open full editor from tray', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.keyboard.press('e');

    // Click the "Open full editor" button (arrow icon in header)
    await page.click('button[title="Open full editor"]');

    // Verify navigation to edit page
    await expect(page).toHaveURL(new RegExp(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}/edit`));
  });

  test('should not trigger E shortcut when typing in inputs', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);

    // Open tray
    await page.keyboard.press('e');
    await expect(page.locator('text=Edit Project')).toBeVisible();

    // Focus on title input
    const titleInput = page.locator('input[placeholder*="project title"]').first();
    await titleInput.click();

    // Type 'e' in the input
    await titleInput.press('e');

    // Verify tray is still open (not toggled)
    await expect(page.locator('text=Edit Project')).toBeVisible();

    // Verify 'e' was typed in input
    const value = await titleInput.inputValue();
    expect(value).toContain('e');
  });
});

test.describe('Project Edit - Hero Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('e');
    await page.click('button:has-text("Hero Display")');
  });

  test('should switch hero display modes', async ({ page }) => {
    // Click on Quote mode
    await page.click('button:has-text("Quote")');

    // Verify quote input appears
    await expect(page.locator('textarea[placeholder*="quote"]')).toBeVisible();

    // Click on Video mode
    await page.click('button:has-text("Video")');

    // Verify video input appears
    await expect(page.locator('input[placeholder*="Video URL"], input[placeholder*="YouTube"]')).toBeVisible();
  });
});

test.describe('Project Edit - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await page.goto(`/${TEST_USER.username}/${TEST_PROJECT_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('e');
    await page.click('button:has-text("Settings")');
  });

  test('should toggle showcase setting', async ({ page }) => {
    // Find showcase checkbox
    const showcaseCheckbox = page.locator('input[type="checkbox"]:near(:text("Showcase"))').first();

    // Get initial state
    const initialState = await showcaseCheckbox.isChecked();

    // Toggle
    await showcaseCheckbox.click();

    // Wait a moment for update
    await page.waitForTimeout(1000);

    // Verify state changed
    const newState = await showcaseCheckbox.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should update project slug', async ({ page }) => {
    // Find slug input
    const slugInput = page.locator('input[type="text"]:near(:text("Project URL"))').last();

    // Update slug
    const newSlug = `test-slug-${Date.now()}`;
    await slugInput.clear();
    await slugInput.fill(newSlug);

    // Wait for save
    await expect(page.locator('text=/Saved at/')).toBeVisible({ timeout: 5000 });

    // Verify URL updated (check browser URL bar)
    await expect(page).toHaveURL(new RegExp(`/${TEST_USER.username}/${newSlug}`));
  });
});
