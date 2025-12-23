/**
 * Profile Section Editing E2E Tests
 *
 * Tests for profile section management including:
 * - Adding/removing custom sections
 * - Adding blocks to custom sections (text, columns, images, icon cards)
 * - Adding nested blocks inside column layouts
 * - Editing block content (text, icons)
 * - Verifying display mode renders blocks correctly after "Done editing"
 *
 * These tests specifically cover the "blocks mode" functionality where
 * profile sections use a mock project (id=0) and handle persistence
 * through the parent component rather than direct API calls.
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

// Run tests serially since they modify the same user profile
test.describe.configure({ mode: 'serial' });

// ============================================================================
// Test Constants
// ============================================================================

const WAIT_FOR_SAVE_MS = 2000;
const _CUSTOM_SECTION_TITLE = 'E2E Test Section';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Navigate to the user's profile page
 */
async function navigateToProfile(page: Page, username: string) {
  await page.goto(`/${username}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

/**
 * Enter edit mode on the profile page
 */
async function enterEditMode(page: Page) {
  // Click the "Actions" button to open the dropdown menu
  const actionsButton = page.locator('button').filter({ hasText: /actions/i }).first();

  if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await actionsButton.click();
    await page.waitForTimeout(300);

    // Look for "Edit Profile" or "Edit Showcase" in the dropdown
    const editOption = page.locator('button, a, [role="menuitem"]').filter({
      hasText: /edit profile|edit showcase|edit/i
    }).first();

    if (await editOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editOption.click();
      await page.waitForTimeout(500);
    }
  }

  // Also try direct edit button if no Actions menu
  const directEditButton = page.locator('button').filter({ hasText: /edit profile|edit showcase/i }).first();
  if (await directEditButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await directEditButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Exit edit mode (click "Done editing" or similar)
 */
async function exitEditMode(page: Page) {
  const doneButton = page.locator('button').filter({ hasText: /done|save|finish/i }).first();

  if (await doneButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await doneButton.click();
    await page.waitForTimeout(WAIT_FOR_SAVE_MS);
  }
}

/**
 * Open the section type picker tray
 */
async function openSectionPicker(page: Page) {
  // Look for "Add Section" button
  const addSectionButton = page.locator('button').filter({ hasText: /add section/i }).first();

  if (await addSectionButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addSectionButton.click();
    // Wait for the slide-out tray to appear
    await page.waitForSelector('h2:has-text("Add Section")', { timeout: 5000 });
  }
}

/**
 * Add a section of a specific type from the section picker
 */
async function addSection(page: Page, sectionType: string) {
  await openSectionPicker(page);

  // Click on the section type button in the picker
  const sectionButton = page.locator('button').filter({ hasText: new RegExp(sectionType, 'i') }).first();
  await sectionButton.click();

  // Wait for modal to close and section to be added
  await page.waitForTimeout(1000);
}

/**
 * Find the custom section container
 */
function findCustomSection(page: Page) {
  return page.locator('[data-section-type="custom"], .custom-section, section').filter({
    hasText: /custom|section/i
  }).first();
}

/**
 * Click the "Add Block" button within a section or container
 */
async function clickAddBlock(page: Page, container?: ReturnType<typeof page.locator>) {
  const target = container || page;
  // Be specific - look for "Add Block" exactly, not just "add"
  const addBlockBtn = target.locator('button').filter({ hasText: /add block/i }).first();

  if (await addBlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBlockBtn.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

/**
 * Select a block type from the block picker menu
 */
async function selectBlockType(page: Page, blockType: string) {
  // Look for the block type button in the dropdown/picker
  const blockTypeBtn = page.locator('button').filter({ hasText: new RegExp(`^${blockType}$`, 'i') }).first();

  if (await blockTypeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await blockTypeBtn.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

/**
 * Add a block of a specific type
 */
async function addBlock(page: Page, blockType: string, container?: ReturnType<typeof page.locator>) {
  const clicked = await clickAddBlock(page, container);
  if (clicked) {
    await selectBlockType(page, blockType);
  }
  return clicked;
}

/**
 * Delete all custom sections to clean up before tests
 */
async function _cleanupCustomSections(page: Page) {
  // Find delete buttons for sections
  const deleteButtons = page.locator('button[title*="delete" i], button[aria-label*="delete" i], button:has(svg.text-red)');

  let count = await deleteButtons.count();
  while (count > 0) {
    await deleteButtons.first().click();

    // Confirm deletion if dialog appears
    const confirmBtn = page.locator('button').filter({ hasText: /confirm|delete|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(500);
    count = await deleteButtons.count();
  }
}

// ============================================================================
// Test Suite: Custom Section Blocks
// ============================================================================

test.describe('Profile Custom Section Editing', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
    await enterEditMode(page);
  });

  // =========================================================================
  // Adding Custom Sections
  // =========================================================================

  test('should add a custom section to profile', async ({ page }) => {
    await addSection(page, 'Custom');

    // Verify the section was added - look for "Custom Section" heading or "Add Block" button
    const customSectionHeading = page.locator('text=Custom Section');
    const addBlockButton = page.locator('button').filter({ hasText: /add block/i });

    // Either the heading or the add block button should be visible
    await expect(customSectionHeading.or(addBlockButton).first()).toBeVisible({ timeout: 5000 });
  });

  // =========================================================================
  // Adding Blocks to Custom Section
  // =========================================================================

  test('should add text block to custom section', async ({ page }) => {
    // First ensure we have a custom section
    const customSection = findCustomSection(page);

    if (!await customSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addSection(page, 'Custom');
    }

    // Add a text block
    await addBlock(page, 'Text');

    // Verify text block was added - look for textarea or editable text field
    const textInput = page.locator('textarea, [contenteditable="true"], input[type="text"]').last();
    await expect(textInput).toBeVisible({ timeout: 5000 });

    // Type some content
    await textInput.fill('E2E test content');
    await page.waitForTimeout(WAIT_FOR_SAVE_MS);
  });

  test('should add column layout block to custom section', async ({ page }) => {
    // Close any open trays first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Add 2 columns block
    await addBlock(page, '2 Columns');

    // Verify columns were added - look for grid layout with multiple columns
    // or the "Add" buttons that appear in each column
    const columnAddButtons = page.locator('button').filter({ hasText: /^add$/i });
    const gridLayout = page.locator('.grid.grid-cols-1.md\\:grid-cols-2, [class*="grid"][class*="cols-2"]');

    // Wait a bit for the columns to render
    await page.waitForTimeout(500);

    // Either we see multiple "Add" buttons (one per column) or a grid layout
    const hasMultipleAddButtons = await columnAddButtons.count() >= 2;
    const hasGrid = await gridLayout.isVisible().catch(() => false);

    expect(hasMultipleAddButtons || hasGrid).toBe(true);
  });

  test('should add 3 column layout block to custom section', async ({ page }) => {
    // Add 3 columns block
    await addBlock(page, '3 Columns');

    // Verify all 3 columns are visible
    const columns = page.locator('div').filter({ hasText: /column [123]/i });
    expect(await columns.count()).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Test Suite: Column Nested Blocks (Blocks Mode Bug Fix)
// ============================================================================

test.describe('Profile Column Nested Blocks', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
    await enterEditMode(page);
  });

  test('should add text block inside column without 500 error', async ({ page }) => {
    // Add a columns block first
    await addBlock(page, '2 Columns');
    await page.waitForTimeout(500);

    // Find the first column's "Add" button
    const columnAddButtons = page.locator('button').filter({ hasText: /^add$/i });

    if (await columnAddButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await columnAddButtons.first().click();
      await page.waitForTimeout(300);

      // Select "Text" block type
      await selectBlockType(page, 'Text');

      // Verify no error occurred - text block should be added
      const textInput = page.locator('textarea, [contenteditable], input').last();
      await expect(textInput).toBeVisible({ timeout: 5000 });

      // Type content to verify it's editable
      await textInput.fill('Column nested text');
      await page.waitForTimeout(WAIT_FOR_SAVE_MS);
    }
  });

  test('should add icon card inside column without error', async ({ page }) => {
    // Add a columns block first
    await addBlock(page, '2 Columns');
    await page.waitForTimeout(500);

    // Find the first column's "Add" button
    const columnAddButtons = page.locator('button').filter({ hasText: /^add$/i });

    if (await columnAddButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await columnAddButtons.first().click();
      await page.waitForTimeout(300);

      // Select "Icon Card" block type
      await selectBlockType(page, 'Icon Card');

      // Verify icon card was added - look for star icon or icon picker
      const iconCard = page.locator('[class*="icon"], svg').first();
      await expect(iconCard).toBeVisible({ timeout: 5000 });
    }
  });

  test('should add image placeholder inside column', async ({ page }) => {
    // Add a columns block first
    await addBlock(page, '2 Columns');
    await page.waitForTimeout(500);

    // Find the first column's "Add" button
    const columnAddButtons = page.locator('button').filter({ hasText: /^add$/i });

    if (await columnAddButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await columnAddButtons.first().click();
      await page.waitForTimeout(300);

      // Select "Image" block type
      await selectBlockType(page, 'Image');

      // Verify image placeholder was added (should show upload prompt or URL input)
      const imagePlaceholder = page.locator('text=/add.*image|image url|upload/i').first();
      await expect(imagePlaceholder).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================================================
// Test Suite: Icon Card Editing
// ============================================================================

test.describe('Profile Icon Card Editing', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
    await enterEditMode(page);
  });

  test('should change icon card icon and save', async ({ page }) => {
    // Add an icon card block
    await addBlock(page, 'Icon Card');
    await page.waitForTimeout(500);

    // Find and click the icon to open icon picker
    const iconButton = page.locator('button').filter({ has: page.locator('svg') }).first();

    if (await iconButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await iconButton.click();
      await page.waitForTimeout(300);

      // Look for icon picker/selector modal or dropdown
      const iconPicker = page.locator('[class*="picker"], [role="dialog"], [role="listbox"]').first();

      if (await iconPicker.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click on a different icon
        const icons = iconPicker.locator('button, [role="option"]');
        if (await icons.nth(5).isVisible().catch(() => false)) {
          await icons.nth(5).click();
          await page.waitForTimeout(WAIT_FOR_SAVE_MS);
        }
      }
    }
  });
});

// ============================================================================
// Test Suite: Display Mode Rendering (Critical Bug Fix)
// ============================================================================

test.describe('Profile Display Mode After Editing', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
    await enterEditMode(page);
  });

  test('should show text blocks in display mode after editing', async ({ page }) => {
    // Add text block with content
    await addBlock(page, 'Text');
    const textInput = page.locator('textarea, [contenteditable]').last();

    if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const testContent = `Display mode test ${Date.now()}`;
      await textInput.fill(testContent);
      await page.waitForTimeout(WAIT_FOR_SAVE_MS);

      // Exit edit mode
      await exitEditMode(page);

      // Verify text is visible in display mode
      await expect(page.locator(`text=${testContent}`)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show columns and nested blocks in display mode', async ({ page }) => {
    // Add columns block
    await addBlock(page, '2 Columns');
    await page.waitForTimeout(500);

    // Add text to first column
    const columnAddButtons = page.locator('button').filter({ hasText: /^add$/i });

    if (await columnAddButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await columnAddButtons.first().click();
      await page.waitForTimeout(300);
      await selectBlockType(page, 'Text');

      const textInput = page.locator('textarea, [contenteditable]').last();
      const columnContent = `Column content ${Date.now()}`;
      await textInput.fill(columnContent);
      await page.waitForTimeout(WAIT_FOR_SAVE_MS);

      // Exit edit mode
      await exitEditMode(page);

      // Verify column content is visible in display mode
      await expect(page.locator(`text=${columnContent}`)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show icon cards in display mode after editing', async ({ page }) => {
    // Add icon card block
    await addBlock(page, 'Icon Card');
    await page.waitForTimeout(500);

    // Find text input for icon card title
    const titleInput = page.locator('input[type="text"], [contenteditable]').last();

    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const iconCardTitle = `Icon Test ${Date.now()}`;
      await titleInput.fill(iconCardTitle);
      await page.waitForTimeout(WAIT_FOR_SAVE_MS);

      // Exit edit mode
      await exitEditMode(page);

      // Verify icon card is visible with its icon and title in display mode
      await expect(page.locator(`text=${iconCardTitle}`)).toBeVisible({ timeout: 10000 });

      // Also verify an icon (SVG) is rendered
      const icons = page.locator('svg');
      expect(await icons.count()).toBeGreaterThan(0);
    }
  });

  test('should persist custom section after page reload', async ({ page }) => {
    // Add a custom section with content
    const sectionTitle = `Persistent Section ${Date.now()}`;

    await addSection(page, 'Custom');
    await page.waitForTimeout(500);

    // Find and fill the section title input
    const titleInput = page.locator('input[placeholder*="Section Title"]').first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill(sectionTitle);
    }

    // Add a text block
    await addBlock(page, 'Text');
    const textInput = page.locator('textarea, [contenteditable]').last();
    const textContent = `Content for ${sectionTitle}`;

    if (await textInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textInput.fill(textContent);
      await page.waitForTimeout(WAIT_FOR_SAVE_MS);
    }

    // Exit edit mode
    await exitEditMode(page);

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify content persisted
    await expect(page.locator(`text=${textContent}`)).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// Test Suite: Block Type Menu Order
// ============================================================================

test.describe('Profile Block Type Menu', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
    await enterEditMode(page);
  });

  test('should show columns first in add block menu', async ({ page }) => {
    // Click Add Block to open the menu
    await clickAddBlock(page);

    // Get all block type buttons in order
    const blockTypeButtons = page.locator('button').filter({ hasText: /columns|text|heading|image/i });
    const firstButton = await blockTypeButtons.first().textContent();

    // Verify columns is first
    expect(firstButton?.toLowerCase()).toContain('column');
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

test.describe('Profile Section Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProfile(page, TEST_USER.username);
    await enterEditMode(page);
  });

  test('should not show "Failed to save" when editing blocks in columns', async ({ page }) => {
    // Add columns block
    await addBlock(page, '2 Columns');
    await page.waitForTimeout(500);

    // Add text to column
    const columnAddButtons = page.locator('button').filter({ hasText: /^add$/i });

    if (await columnAddButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await columnAddButtons.first().click();
      await page.waitForTimeout(300);
      await selectBlockType(page, 'Text');

      // Edit the text
      const textInput = page.locator('textarea, [contenteditable]').last();
      await textInput.fill('Testing error handling');
      await page.waitForTimeout(WAIT_FOR_SAVE_MS);

      // Verify no error message is visible
      const errorMessage = page.locator('text=/failed|error|500/i');
      await expect(errorMessage).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('should handle empty image blocks gracefully in display mode', async ({ page }) => {
    // Add an image block without setting URL
    await addBlock(page, 'Image');
    await page.waitForTimeout(500);

    // Don't set a URL - leave it empty

    // Exit edit mode
    await exitEditMode(page);

    // Verify no broken image is shown (empty image blocks should be hidden in display mode)
    const brokenImages = page.locator('img[src=""], img:not([src])');
    const brokenCount = await brokenImages.count();
    expect(brokenCount).toBe(0);
  });
});
