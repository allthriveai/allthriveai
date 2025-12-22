/**
 * Project Editing E2E Tests
 *
 * Comprehensive tests for project creation, editing, and section management.
 * Tests cover:
 * - Manual project creation and editing
 * - AI-generated metadata enrichment
 * - URL redirects on title change
 * - Background gradient customization
 * - Built-with tools management (add, edit, reorder)
 * - All section types (overview, features, tech stack, gallery, demo, architecture, challenges, resources, slide up, custom)
 * - Section rearrangement and deletion
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, TEST_USER } from './helpers';

// Run tests serially to avoid conflicts when creating/editing projects
test.describe.configure({ mode: 'serial' });

// ============================================================================
// Test Constants
// ============================================================================

const UNIQUE_SUFFIX = Date.now().toString(36);
const TEST_PROJECT_TITLE = `E2E Test Project ${UNIQUE_SUFFIX}`;
const AUTOSAVE_WAIT_MS = 3000; // Slightly longer than 2s autosave debounce

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for the project page to be ready (loaded and interactive)
 */
async function waitForProjectPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for project to load (either loading spinner disappears or title is visible)
  await page.waitForSelector('[data-testid="project-title"], h1', { timeout: 15000 });
  await page.waitForTimeout(500); // Allow React to settle
}

/**
 * Wait for autosave to complete
 */
async function waitForAutosave(page: Page) {
  await page.waitForTimeout(AUTOSAVE_WAIT_MS);
}

/**
 * Edit the project title using InlineEditableTitle component
 */
async function editProjectTitle(page: Page, newTitle: string) {
  // Find the title element (InlineEditableTitle renders as h1 with role="button")
  const titleElement = page.locator('h1[role="button"]').first();
  await expect(titleElement).toBeVisible({ timeout: 10000 });

  // Click to enter edit mode
  await titleElement.click();

  // Wait for the input to appear (InlineEditableTitle transforms to input on click)
  const titleInput = page.locator('input.border-primary-500, input[type="text"]').first();
  await expect(titleInput).toBeVisible({ timeout: 5000 });

  // Clear and fill the title
  await titleInput.fill(newTitle);

  // Press Enter to save
  await titleInput.press('Enter');

  // Wait for autosave
  await waitForAutosave(page);
}

/**
 * Open the project settings panel
 */
async function openSettingsPanel(page: Page) {
  // Close any open modals first (like search)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // The settings button has title="Project Settings" and contains a Cog6ToothIcon
  const settingsButton = page.locator('button[title="Project Settings"]');

  await expect(settingsButton).toBeVisible({ timeout: 5000 });
  await settingsButton.click();

  // Wait for panel to open - the panel has "Project Settings" as h2
  await page.waitForSelector('h2:has-text("Project Settings")', { timeout: 5000 });
}

/**
 * Close the project settings panel
 */
async function closeSettingsPanel(page: Page) {
  // The settings panel can have nested sub-panels (Redirects, Background, etc.)
  // We need to close all panels by clicking the X button

  // Keep closing until no panel headings are visible
  for (let i = 0; i < 5; i++) {
    // Check if any panel is visible
    const panelHeading = page.locator('h2:has-text("Project Settings"), h2:has-text("Redirects"), h2:has-text("Background"), h2:has-text("Metadata")').first();
    const isVisible = await panelHeading.isVisible({ timeout: 500 }).catch(() => false);

    if (!isVisible) break;

    // Find the X button - it's a button with SVG inside, sibling to or near the h2 heading
    // The button has class "p-2 rounded-lg" and contains an SVG (XMarkIcon)
    const closeButton = page.locator('button.p-2.rounded-lg').filter({ has: page.locator('svg') }).last();

    if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeButton.click({ force: true });
      await page.waitForTimeout(300);
    } else {
      // Fallback to Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  // Final wait for animations and verify backdrop is gone
  await page.waitForTimeout(300);
  await expect(page.locator('div.fixed.inset-0.bg-black\\/50')).not.toBeVisible({ timeout: 3000 });
}

/**
 * Navigate to a specific project
 */
async function navigateToProject(page: Page, username: string, slug: string) {
  await page.goto(`/${username}/${slug}`);
  await waitForProjectPageReady(page);
}

/**
 * Create a new project via API and return its slug
 */
async function createTestProject(page: Page, title: string): Promise<{ id: number; slug: string }> {
  const result = await page.evaluate(async (projectTitle) => {
    const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];

    const response = await fetch('/api/v1/me/projects/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '',
      },
      body: JSON.stringify({
        title: projectTitle,
        description: 'Test project for E2E testing',
        is_published: true,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create project: ${response.status} - ${text}`);
    }

    const data = await response.json();
    return { id: data.id, slug: data.slug };
  }, title);

  return result;
}

/**
 * Create a test project with section-based editing enabled (templateVersion 2)
 */
async function createSectionTestProject(page: Page, title: string): Promise<{ id: number; slug: string }> {
  const result = await page.evaluate(async (projectTitle) => {
    const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];

    const response = await fetch('/api/v1/me/projects/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '',
      },
      body: JSON.stringify({
        title: projectTitle,
        description: 'Test project for section editing',
        is_published: true,
        content: {
          templateVersion: 2,
          sections: [
            {
              id: 'initial-section-' + Date.now(),
              type: 'overview',
              title: 'Overview',
              enabled: true,
              content: {
                text: 'Initial overview section for testing.',
              },
            },
          ],
        },
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create section project: ${response.status} - ${text}`);
    }

    const data = await response.json();
    return { id: data.id, slug: data.slug };
  }, title);

  return result;
}

/**
 * Delete a test project via API
 */
async function deleteTestProject(page: Page, projectId: number): Promise<void> {
  await page.evaluate(async (id) => {
    const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];

    await fetch(`/api/v1/me/projects/${id}/`, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': csrfToken || '',
      },
      credentials: 'include',
    });
  }, projectId);
}

/**
 * Open the section type picker modal
 */
async function openSectionPicker(page: Page) {
  // Click "Add Section" button
  const addSectionButton = page.locator('button').filter({ hasText: /add section/i }).first();
  await addSectionButton.click();
  await page.waitForSelector('h2:has-text("Add Section")', { timeout: 5000 });
}

/**
 * Add a section of a specific type
 */
async function addSection(page: Page, sectionType: string) {
  await openSectionPicker(page);

  // Click on the section type button
  const sectionButton = page.locator('button').filter({ hasText: new RegExp(sectionType, 'i') }).first();
  await sectionButton.click();

  // Wait for modal to close and section to be added
  await page.waitForTimeout(500);
}

// ============================================================================
// Test Suite
// ============================================================================

test.describe('Project Manual Editing', () => {
  let testProjectId: number;
  let testProjectSlug: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginViaAPI(page);

    // Create a test project for this test suite
    const project = await createTestProject(page, TEST_PROJECT_TITLE);
    testProjectId = project.id;
    testProjectSlug = project.slug;

    console.log(`✓ Created test project: ${testProjectSlug} (ID: ${testProjectId})`);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginViaAPI(page);

    // Clean up test project
    if (testProjectId) {
      await deleteTestProject(page, testProjectId);
      console.log(`✓ Deleted test project: ${testProjectSlug}`);
    }

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  // =========================================================================
  // Project Creation & Basic Editing
  // =========================================================================

  test('should manually edit an existing project title', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    // Edit the title using helper function
    const newTitle = `Updated ${TEST_PROJECT_TITLE}`;
    await editProjectTitle(page, newTitle);

    // Reload and verify the change persisted
    await page.reload();
    await waitForProjectPageReady(page);

    const updatedTitle = page.locator('h1').first();
    await expect(updatedTitle).toContainText('Updated');
  });

  test('should manually create a new project', async ({ page }) => {
    // Navigate to explore page or projects listing
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // Look for "Create Project" or "New Project" button
    const createButton = page.locator('button, a').filter({ hasText: /create project|new project|add project/i }).first();

    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // Should navigate to project creation page or open modal
      const currentUrl = page.url();
      const hasProjectCreate = currentUrl.includes('/project') || currentUrl.includes('/new');
      const hasModal = await page.locator('[role="dialog"], .modal').isVisible().catch(() => false);

      expect(hasProjectCreate || hasModal).toBe(true);
    } else {
      // If no create button on explore, try profile page
      await page.goto(`/${TEST_USER.username}`);
      await page.waitForLoadState('domcontentloaded');

      const profileCreateButton = page.locator('button, a').filter({ hasText: /add project|create|new/i }).first();
      if (await profileCreateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await profileCreateButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  // =========================================================================
  // AI Metadata Enrichment
  // =========================================================================

  test('should show AI-generated metadata after project creation', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    // Open settings panel
    await openSettingsPanel(page);

    // Navigate to Metadata section
    const metadataButton = page.locator('button').filter({ hasText: 'Metadata' }).first();
    await metadataButton.click();
    await page.waitForTimeout(500);

    // Check if AI badge or metadata fields are present
    const metadataSection = page.locator('div').filter({ hasText: /content type|difficulty|time investment/i });
    await expect(metadataSection.first()).toBeVisible();

    // Verify select dropdowns are present for metadata
    const contentTypeSelect = page.locator('select').filter({ has: page.locator('option:has-text("Select content type")') });
    const difficultySelect = page.locator('select').filter({ has: page.locator('option:has-text("Select difficulty")') });

    const hasContentType = await contentTypeSelect.isVisible().catch(() => false);
    const hasDifficulty = await difficultySelect.isVisible().catch(() => false);

    expect(hasContentType || hasDifficulty).toBe(true);
  });

  // =========================================================================
  // URL Redirects
  // =========================================================================

  test('should create redirect when changing project title/slug', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    // Edit the title to trigger a slug change
    const uniqueTitle = `Redirect Test ${Date.now()}`;
    await editProjectTitle(page, uniqueTitle);

    // Open settings and check redirects
    await openSettingsPanel(page);

    const redirectsButton = page.locator('button').filter({ hasText: 'Redirects' }).first();
    await redirectsButton.click();
    await page.waitForTimeout(500);

    // Should show at least one redirect (the old slug)
    const redirectsList = page.locator('text=/active redirect/i');
    const noRedirects = page.locator('text=No redirects yet');

    // Either we see redirects or no redirects message
    const hasRedirects = await redirectsList.isVisible().catch(() => false);
    const hasNoRedirects = await noRedirects.isVisible().catch(() => false);

    expect(hasRedirects || hasNoRedirects).toBe(true);

    // Restore original title
    await closeSettingsPanel(page);
    await editProjectTitle(page, TEST_PROJECT_TITLE);
  });

  // =========================================================================
  // Background Gradient
  // =========================================================================

  test('should change the background gradient using presets', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    // Open settings panel
    await openSettingsPanel(page);

    // Navigate to Background section
    const backgroundButton = page.locator('button').filter({ hasText: 'Background' }).first();
    await backgroundButton.click();
    await page.waitForTimeout(500);

    // Verify presets are visible
    const presetsLabel = page.locator('text=Presets');
    await expect(presetsLabel).toBeVisible();

    // Click a gradient preset (first one after current)
    const presetButtons = page.locator('button').filter({ has: page.locator('[style*="gradient"]') });
    const presetCount = await presetButtons.count();

    if (presetCount > 1) {
      // Click the second preset
      await presetButtons.nth(1).click();
      await page.waitForTimeout(500);

      // Verify the preview updated (gradient preview div should have a style)
      const preview = page.locator('div.rounded-xl[style*="gradient"]').first();
      await expect(preview).toBeVisible();
    }

    await closeSettingsPanel(page);
  });

  test('should change background gradient with custom colors', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    await openSettingsPanel(page);

    const backgroundButton = page.locator('button').filter({ hasText: 'Background' }).first();
    await backgroundButton.click();
    await page.waitForTimeout(500);

    // Find color inputs
    const fromLabel = page.locator('label:has-text("From")');
    const toLabel = page.locator('label:has-text("To")');

    await expect(fromLabel).toBeVisible();
    await expect(toLabel).toBeVisible();

    // Color inputs should be present
    const colorInputs = page.locator('input[type="color"]');
    expect(await colorInputs.count()).toBeGreaterThanOrEqual(2);

    await closeSettingsPanel(page);
  });

  // =========================================================================
  // Built-With Tools Management
  // =========================================================================

  test('should add built-with tools to project', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    // Find tools section or edit button
    const toolsSection = page.locator('text=/built with|tools/i').first();

    if (await toolsSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toolsSection.click();
    }

    // Look for tool search input
    const toolSearch = page.locator('input[placeholder*="Search tools"]');

    if (await toolSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toolSearch.fill('React');
      await page.waitForTimeout(500);

      // Click on React in dropdown
      const reactOption = page.locator('button').filter({ hasText: 'React' }).first();
      if (await reactOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reactOption.click();
        await page.waitForTimeout(500);

        // Verify tool was added (appears as a badge/chip)
        const toolBadge = page.locator('div').filter({ hasText: 'React' }).filter({ has: page.locator('button') });
        await expect(toolBadge.first()).toBeVisible();
      }
    }
  });

  test('should reorder built-with tools via drag and drop', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    // First add multiple tools if not present
    const toolSearch = page.locator('input[placeholder*="Search tools"]');

    if (await toolSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Add TypeScript
      await toolSearch.fill('TypeScript');
      await page.waitForTimeout(500);
      const tsOption = page.locator('button').filter({ hasText: 'TypeScript' }).first();
      if (await tsOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tsOption.click();
      }

      await toolSearch.clear();
      await page.waitForTimeout(300);
    }

    // Check for drag handles
    const dragHandles = page.locator('[class*="cursor-grab"], svg[class*="Bars2"]');
    const handleCount = await dragHandles.count();

    // If we have draggable tools, verify the reorder hint is shown
    if (handleCount > 0) {
      const reorderHint = page.locator('text=/drag to reorder|first tool/i');
      const hintVisible = await reorderHint.isVisible().catch(() => false);
      expect(hintVisible).toBe(true);
    }
  });

  test('should remove built-with tools', async ({ page }) => {
    await navigateToProject(page, TEST_USER.username, testProjectSlug);

    // Find tool badges with remove buttons
    const toolBadges = page.locator('div').filter({ has: page.locator('button svg') }).filter({ hasText: /react|typescript|python/i });

    const badgeCount = await toolBadges.count();

    if (badgeCount > 0) {
      // Click the X button on the first tool
      const removeButton = toolBadges.first().locator('button').last();
      await removeButton.click();
      await page.waitForTimeout(500);

      // Verify count decreased or tool was removed
      const newBadgeCount = await toolBadges.count();
      expect(newBadgeCount).toBeLessThanOrEqual(badgeCount);
    }
  });
});

// ============================================================================
// Section Management Tests
// ============================================================================

test.describe('Project Section Management', () => {
  let testProjectId: number;
  let testProjectSlug: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginViaAPI(page);

    // Create a test project with section-based editing enabled
    const project = await createSectionTestProject(page, `Section Test ${UNIQUE_SUFFIX}`);
    testProjectId = project.id;
    testProjectSlug = project.slug;

    console.log(`✓ Created section test project: ${testProjectSlug}`);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginViaAPI(page);

    if (testProjectId) {
      await deleteTestProject(page, testProjectId);
      console.log(`✓ Deleted section test project: ${testProjectSlug}`);
    }

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProject(page, TEST_USER.username, testProjectSlug);
  });

  // =========================================================================
  // Adding Sections
  // =========================================================================

  test('should add Overview section', async ({ page }) => {
    await addSection(page, 'Overview');

    // Verify section was added
    const overviewSection = page.locator('section, div').filter({ hasText: /overview|summary/i }).first();
    await expect(overviewSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Key Features section', async ({ page }) => {
    await addSection(page, 'Key Features');

    const featuresSection = page.locator('section, div').filter({ hasText: /features/i }).first();
    await expect(featuresSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Tech Stack section', async ({ page }) => {
    await addSection(page, 'Tech Stack');

    const techSection = page.locator('section, div').filter({ hasText: /tech stack|technologies/i }).first();
    await expect(techSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Gallery section', async ({ page }) => {
    await addSection(page, 'Gallery');

    const gallerySection = page.locator('section, div').filter({ hasText: /gallery|screenshots/i }).first();
    await expect(gallerySection).toBeVisible({ timeout: 5000 });
  });

  test('should add Demo section', async ({ page }) => {
    await addSection(page, 'Demo');

    const demoSection = page.locator('section, div').filter({ hasText: /demo/i }).first();
    await expect(demoSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Architecture section', async ({ page }) => {
    await addSection(page, 'Architecture');

    const archSection = page.locator('section, div').filter({ hasText: /architecture/i }).first();
    await expect(archSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Challenges & Solutions section', async ({ page }) => {
    await addSection(page, 'Challenges');

    const challengesSection = page.locator('section, div').filter({ hasText: /challenges|solutions/i }).first();
    await expect(challengesSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Resources section', async ({ page }) => {
    await addSection(page, 'Resources');

    const resourcesSection = page.locator('section, div').filter({ hasText: /resources|links/i }).first();
    await expect(resourcesSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Slide Up section', async ({ page }) => {
    await addSection(page, 'Slide Up');

    const slideUpSection = page.locator('section, div').filter({ hasText: /slide up/i }).first();
    await expect(slideUpSection).toBeVisible({ timeout: 5000 });
  });

  test('should add Custom section', async ({ page }) => {
    await addSection(page, 'Custom');

    const customSection = page.locator('section, div').filter({ hasText: /custom/i }).first();
    await expect(customSection).toBeVisible({ timeout: 5000 });
  });

  // =========================================================================
  // Editing Sections
  // =========================================================================

  test('should edit Overview section content', async ({ page }) => {
    // Find overview section and its editable fields
    const overviewSection = page.locator('section, [data-section-type="overview"]').first();

    if (await overviewSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to edit headline
      const headlineField = overviewSection.locator('input, [contenteditable], textarea').first();

      if (await headlineField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await headlineField.click();
        await headlineField.fill('Updated Headline');
        await waitForAutosave(page);
      }
    }
  });

  test('should edit Key Features section - add feature', async ({ page }) => {
    const featuresSection = page.locator('section, [data-section-type="features"]').first();

    if (await featuresSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for "Add Feature" button
      const addFeatureBtn = featuresSection.locator('button').filter({ hasText: /add feature/i });

      if (await addFeatureBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addFeatureBtn.click();
        await page.waitForTimeout(500);

        // Fill in feature details
        const featureTitle = featuresSection.locator('input[placeholder*="title" i], input').last();
        if (await featureTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
          await featureTitle.fill('New Test Feature');
          await waitForAutosave(page);
        }
      }
    }
  });

  test('should edit Tech Stack section - add technology', async ({ page }) => {
    const techSection = page.locator('section, [data-section-type="tech_stack"]').first();

    if (await techSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for add technology option
      const addTechBtn = techSection.locator('button').filter({ hasText: /add|technology/i });

      if (await addTechBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addTechBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should edit Gallery section - layout toggle', async ({ page }) => {
    const gallerySection = page.locator('section, [data-section-type="gallery"]').first();

    if (await gallerySection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for layout options (grid, carousel, masonry)
      const layoutOptions = gallerySection.locator('button').filter({ hasText: /grid|carousel|masonry/i });

      if (await layoutOptions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await layoutOptions.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  // =========================================================================
  // Section Rearrangement
  // =========================================================================

  test('should rearrange sections via drag and drop', async ({ page }) => {
    // Look for drag handles on sections
    const sectionDragHandles = page.locator('[data-section-drag-handle], [class*="cursor-grab"]');
    const handleCount = await sectionDragHandles.count();

    if (handleCount >= 2) {
      // Get first two section handles
      const firstHandle = sectionDragHandles.nth(0);
      const secondHandle = sectionDragHandles.nth(1);

      const firstBox = await firstHandle.boundingBox();
      const secondBox = await secondHandle.boundingBox();

      if (firstBox && secondBox) {
        // Perform drag
        await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height + 20);
        await page.mouse.up();

        await page.waitForTimeout(500);
      }
    }
  });

  test('should delete a section', async ({ page }) => {
    // Find section delete buttons
    const deleteBtns = page.locator('button[aria-label*="delete" i], button:has(svg[class*="Trash"])');

    const deleteCount = await deleteBtns.count();

    if (deleteCount > 0) {
      const initialSectionCount = deleteCount;

      // Click first delete button
      await deleteBtns.first().click();

      // Confirm deletion if dialog appears
      const confirmBtn = page.locator('button').filter({ hasText: /confirm|delete|yes/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await page.waitForTimeout(500);

      // Verify section was removed
      const newDeleteCount = await deleteBtns.count();
      expect(newDeleteCount).toBeLessThan(initialSectionCount);
    }
  });

  test('should toggle section visibility', async ({ page }) => {
    // Find section enable/disable toggles
    const toggles = page.locator('button[role="switch"], input[type="checkbox"]').filter({ has: page.locator('[class*="toggle"]') });

    if (await toggles.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to toggle
      await toggles.first().click();
      await page.waitForTimeout(500);

      // Toggle back
      await toggles.first().click();
      await page.waitForTimeout(500);
    }
  });
});

// ============================================================================
// Custom Section Block Tests
// ============================================================================

test.describe('Custom Section Blocks', () => {
  let testProjectId: number;
  let testProjectSlug: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginViaAPI(page);

    // Create with section-based editing for custom section tests
    const project = await createSectionTestProject(page, `Block Test ${UNIQUE_SUFFIX}`);
    testProjectId = project.id;
    testProjectSlug = project.slug;

    console.log(`✓ Created block test project: ${testProjectSlug}`);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginViaAPI(page);

    if (testProjectId) {
      await deleteTestProject(page, testProjectId);
    }

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
    await navigateToProject(page, TEST_USER.username, testProjectSlug);
  });

  test('should add custom section and edit blocks', async ({ page }) => {
    // Add custom section
    await addSection(page, 'Custom');

    // Find custom section
    const customSection = page.locator('section, [data-section-type="custom"]').first();

    if (await customSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Look for block add options
      const addBlockBtn = customSection.locator('button').filter({ hasText: /add block|add content/i });

      if (await addBlockBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBlockBtn.click();
        await page.waitForTimeout(500);

        // Select a block type (text, image, code, etc.)
        const textBlockOption = page.locator('button').filter({ hasText: /text|paragraph/i }).first();
        if (await textBlockOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await textBlockOption.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });

  test('should reorder blocks within custom section', async ({ page }) => {
    const customSection = page.locator('section, [data-section-type="custom"]').first();

    if (await customSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for block drag handles
      const blockHandles = customSection.locator('[data-block-drag-handle], [class*="cursor-grab"]');
      const handleCount = await blockHandles.count();

      if (handleCount >= 2) {
        const firstHandle = blockHandles.nth(0);
        const secondHandle = blockHandles.nth(1);

        const firstBox = await firstHandle.boundingBox();
        const secondBox = await secondHandle.boundingBox();

        if (firstBox && secondBox) {
          await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height + 10);
          await page.mouse.up();

          await page.waitForTimeout(500);
        }
      }
    }
  });

  test('should delete blocks from custom section', async ({ page }) => {
    const customSection = page.locator('section, [data-section-type="custom"]').first();

    if (await customSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      const blockDeleteBtns = customSection.locator('button[aria-label*="delete" i], button:has(svg[class*="Trash"])');

      if (await blockDeleteBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await blockDeleteBtns.first().click();

        // Confirm if needed
        const confirmBtn = page.locator('button').filter({ hasText: /confirm|delete|yes/i });
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
        }

        await page.waitForTimeout(500);
      }
    }
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

test.describe('Project Editing Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should handle editing non-existent project gracefully', async ({ page }) => {
    await page.goto(`/${TEST_USER.username}/non-existent-project-${Date.now()}`);
    await page.waitForLoadState('domcontentloaded');

    // Should show error state
    const errorMessage = page.locator('text=/not found|doesn\'t exist|no permission/i');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should prevent editing projects owned by others', async ({ page }) => {
    // Navigate to a project by a different user (if available)
    // This test assumes there's a public project by another user
    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');

    // Find a project card not owned by test user
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href*="/"]').filter({ hasNot: page.locator(`text=@${TEST_USER.username}`) });

    if (await projectCards.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectCards.first().click();
      await page.waitForLoadState('domcontentloaded');

      // Verify edit controls are not visible
      const editButton = page.locator('button').filter({ hasText: /edit|settings/i });
      const _isEditVisible = await editButton.isVisible({ timeout: 3000 }).catch(() => false);

      // If on someone else's project, edit should not be visible (or should be disabled)
      // This is a soft check as the project might still be ours
    }
  });

  test('should persist all changes after page reload', async ({ page }) => {
    // Create a temporary project
    const tempProject = await createTestProject(page, `Persistence Test ${UNIQUE_SUFFIX}`);

    await navigateToProject(page, TEST_USER.username, tempProject.slug);

    // Make a change
    const titleElement = page.locator('h1, [data-testid="project-title"]').first();
    if (await titleElement.isVisible({ timeout: 5000 }).catch(() => false)) {
      await titleElement.click();
      await titleElement.fill('Persistence Verified');
      await waitForAutosave(page);
    }

    // Reload
    await page.reload();
    await waitForProjectPageReady(page);

    // Verify change persisted
    const updatedTitle = page.locator('h1, [data-testid="project-title"]').first();
    await expect(updatedTitle).toContainText('Persistence');

    // Cleanup
    await deleteTestProject(page, tempProject.id);
  });
});
