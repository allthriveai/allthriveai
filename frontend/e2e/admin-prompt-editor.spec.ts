import { test, expect, Page } from '@playwright/test';
import { loginAsAdminViaAPI, loginViaAPI, API_BASE_URL } from './helpers';

/**
 * Admin Prompt Challenge Prompts E2E Tests
 *
 * These tests verify the admin prompt library management functionality.
 * Requires an admin user to be set up in the database.
 *
 * Setup:
 * 1. Create admin user: e2e-admin@example.com with password e2eAdminPassword123
 * 2. Set user role to 'admin' in the database
 *
 * Run with: npx playwright test e2e/admin-prompt-editor.spec.ts
 * Run headed: npx playwright test e2e/admin-prompt-editor.spec.ts --headed
 */

// Helper to wait for page to be ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for the Prompt Library heading to appear
  await page.waitForSelector('h1:has-text("Prompt")', { timeout: 15000 });
  // Wait for the Add Prompt button to be visible (confirms admin page loaded)
  await page.waitForSelector('button:has-text("Add Prompt")', { timeout: 10000 });
  // Small delay to ensure page is fully interactive
  await page.waitForTimeout(500);
}

// Helper to create a prompt via API for testing
async function createPromptViaAPI(page: Page, promptText: string): Promise<number> {
  const result = await page.evaluate(
    async ({ apiBase, text }) => {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

      const response = await fetch(`${apiBase}/api/v1/battles/admin/prompt-challenge-prompts/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        body: JSON.stringify({
          promptText: text,
          difficulty: 'medium',
          weight: 1.0,
          isActive: true,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create prompt: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.id;
    },
    { apiBase: API_BASE_URL, text: promptText }
  );

  return result;
}

// Helper to delete a prompt via API for cleanup
async function deletePromptViaAPI(page: Page, promptId: number): Promise<void> {
  await page.evaluate(
    async ({ apiBase, id }) => {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

      await fetch(`${apiBase}/api/v1/battles/admin/prompt-challenge-prompts/${id}/`, {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
      });
    },
    { apiBase: API_BASE_URL, id: promptId }
  );
}

// Helper to get prompt count via API
async function getPromptCountViaAPI(page: Page): Promise<number> {
  const result = await page.evaluate(async (apiBase) => {
    const response = await fetch(`${apiBase}/api/v1/battles/admin/prompt-challenge-prompts/stats/`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.total || 0;
  }, API_BASE_URL);

  return result;
}

// =========================================================================
// Admin Access Tests
// =========================================================================

test.describe('Admin Prompt Editor - Access Control', () => {
  test('non-admin user should be redirected from admin page', async ({ page }) => {
    // Login as regular user
    await loginViaAPI(page);

    // Try to navigate to admin prompt page
    await page.goto('/admin/prompt-challenge-prompts');
    await page.waitForLoadState('domcontentloaded');

    // Should be redirected away (to home or see access denied)
    // The page redirects non-admins to '/'
    await page.waitForTimeout(2000);

    // Should either be on home page or not on admin page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/admin/prompt-challenge-prompts');

    // Should NOT see the admin-specific elements
    // Look for the specific "Add Prompt" button which only appears on admin page
    const hasAddPromptButton = await page.getByRole('button', { name: /Add Prompt/i }).isVisible().catch(() => false);
    expect(hasAddPromptButton).toBeFalsy();

    // Should NOT see the stats cards that are admin-only
    const hasTotalPromptsCard = await page.getByText('Total Prompts').isVisible().catch(() => false);
    expect(hasTotalPromptsCard).toBeFalsy();
  });
});

test.describe('Admin Prompt Editor - Page Load & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test('should navigate to admin prompt challenge page', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Verify page title/heading - look for heading level 1 with "Prompt" and "Library"
    const heading = page.getByRole('heading', { level: 1 }).filter({ hasText: /Prompt/ });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Library');
  });

  test('should display stats cards', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Check for stats cards - use button role since cards are clickable buttons
    await expect(page.getByRole('button', { name: /Total Prompts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Active \d+$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Inactive/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Total Uses/i })).toBeVisible();
  });

  test('should display search and filter controls', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Check for search input
    await expect(page.getByPlaceholder('Search prompts...')).toBeVisible();

    // Check for filter dropdowns - use combobox role
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByRole('combobox').nth(1)).toBeVisible();
  });

  test('should display Add Prompt button', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    const addButton = page.getByRole('button', { name: /Add Prompt/i });
    await expect(addButton).toBeVisible();
  });
});

// =========================================================================
// Prompt List & Display Tests
// =========================================================================

test.describe('Admin Prompt Editor - Prompt List', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test('should display prompts in table format', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Wait for loading to complete
    await page.waitForSelector('text=Loading prompts...', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Check for table headers (on desktop view)
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) {
      // Look for column headers in the table
      const headerRow = page.locator('div').filter({ hasText: /^Prompt$/ }).first();
      const _hasHeaders = await headerRow.isVisible().catch(() => false);

      // If we have prompts, we should see the table
      const promptCount = await getPromptCountViaAPI(page);
      if (promptCount > 0) {
        // Should have prompt text visible
        const promptTexts = page.locator('p.line-clamp-2');
        const count = await promptTexts.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should show empty state when no prompts', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Wait for loading to complete
    await page.waitForSelector('text=Loading prompts...', { state: 'hidden', timeout: 10000 }).catch(() => {});

    // Check prompt count
    const promptCount = await getPromptCountViaAPI(page);

    if (promptCount === 0) {
      // Should show empty state
      await expect(page.getByText('No prompts found')).toBeVisible();
      await expect(page.getByText('Add your first prompt')).toBeVisible();
    }
  });
});

// =========================================================================
// Search & Filter Tests
// =========================================================================

test.describe('Admin Prompt Editor - Search & Filters', () => {
  let testPromptId: number;
  const uniqueSearchTerm = `E2E_SEARCH_TEST_${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test prompt
    if (testPromptId) {
      await deletePromptViaAPI(page, testPromptId).catch(() => {});
    }
  });

  test('should filter prompts by search query', async ({ page }) => {
    // Create a test prompt with unique text
    testPromptId = await createPromptViaAPI(page, `${uniqueSearchTerm} - Create a beautiful landscape`);

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Type in search box
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(uniqueSearchTerm);

    // Wait for search to take effect
    await page.waitForTimeout(1000);

    // Should show the matching prompt
    await expect(page.getByText(uniqueSearchTerm)).toBeVisible({ timeout: 5000 });
  });

  test('should filter prompts by difficulty', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Select "Easy" difficulty filter
    const difficultySelect = page.locator('select').filter({ hasText: 'All Difficulties' });
    await difficultySelect.selectOption('easy');

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // All visible difficulty badges should be "Easy"
    const badges = page.locator('span').filter({ hasText: 'Easy' });
    const badgeCount = await badges.count();

    // If there are easy prompts, verify they show
    if (badgeCount > 0) {
      // No "Medium" or "Hard" badges should be visible in the prompts list
      const mediumBadge = page.locator('span.inline-flex').filter({ hasText: 'Medium' });
      const hardBadge = page.locator('span.inline-flex').filter({ hasText: 'Hard' });

      const mediumCount = await mediumBadge.count();
      const hardCount = await hardBadge.count();

      expect(mediumCount).toBe(0);
      expect(hardCount).toBe(0);
    }
  });

  test('should filter by active status using stats cards', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Click on "Active" stats card to filter - use the button with "Active" followed by a number
    const activeCard = page.getByRole('button', { name: /^Active \d+$/i });
    await activeCard.click();

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // The Active card should now have a ring (selected state)
    await expect(activeCard).toHaveClass(/ring-2/);
  });
});

// =========================================================================
// Create Prompt Tests
// =========================================================================

test.describe('Admin Prompt Editor - Create Prompt', () => {
  let createdPromptId: number | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup
    if (createdPromptId) {
      await deletePromptViaAPI(page, createdPromptId).catch(() => {});
      createdPromptId = null;
    }
  });

  test('should open add prompt tray when clicking Add Prompt button', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Click Add Prompt button
    const addButton = page.getByRole('button', { name: /Add Prompt/i });
    await addButton.click();

    // Wait for tray to slide in
    await page.waitForTimeout(500);

    // Should see the tray with form elements
    await expect(page.getByText('Add New Prompt')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/Enter the prompt text/i)).toBeVisible();
  });

  test('should create a new prompt successfully', async ({ page }) => {
    const newPromptText = `E2E Test Prompt - Create a stunning ${Date.now()}`;

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Click Add Prompt button
    await page.getByRole('button', { name: /Add Prompt/i }).click();
    await page.waitForTimeout(500);

    // Fill in the form
    const promptTextarea = page.getByPlaceholder(/Enter the prompt text/i);
    await promptTextarea.fill(newPromptText);

    // Don't change difficulty - leave as default (medium)

    // Click Save/Create button
    const saveButton = page.getByRole('button', { name: /Save|Create/i }).last();
    await saveButton.click();

    // Wait for tray to close and list to refresh
    await page.waitForTimeout(2000);

    // Verify the tray closed
    await expect(page.getByText('Add New Prompt')).not.toBeVisible({ timeout: 3000 });

    // Search for the new prompt
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(newPromptText.substring(0, 25));
    await page.waitForTimeout(1500);

    // Verify the new prompt appears in the list (use a more flexible locator)
    const promptInList = page.locator('p').filter({ hasText: newPromptText.substring(0, 25) });
    await expect(promptInList.first()).toBeVisible({ timeout: 10000 });

    // Get the ID for cleanup (we'll delete via API search)
    const result = await page.evaluate(
      async ({ apiBase, searchText }) => {
        const response = await fetch(
          `${apiBase}/api/v1/battles/admin/prompt-challenge-prompts/?search=${encodeURIComponent(searchText)}`,
          { credentials: 'include' }
        );
        const data = await response.json();
        return data.prompts?.[0]?.id;
      },
      { apiBase: API_BASE_URL, searchText: newPromptText.substring(0, 20) }
    );
    createdPromptId = result;
  });

  test('should validate prompt text minimum length', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Click Add Prompt button
    await page.getByRole('button', { name: /Add Prompt/i }).click();
    await page.waitForTimeout(500);

    // Try to submit with short text
    const promptTextarea = page.getByPlaceholder(/Enter the prompt text/i);
    await promptTextarea.fill('Short');

    // Click the save button
    const saveButton = page.getByRole('button', { name: /Save|Create/i }).last();
    await saveButton.click();
    await page.waitForTimeout(500);

    // Should show validation error - the exact message from the code
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible({ timeout: 3000 });
  });
});

// =========================================================================
// Edit Prompt Tests
// =========================================================================

test.describe('Admin Prompt Editor - Edit Prompt', () => {
  let testPromptId: number;
  const originalText = `E2E Edit Test Original - ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
    // Create a test prompt to edit
    testPromptId = await createPromptViaAPI(page, originalText);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup
    if (testPromptId) {
      await deletePromptViaAPI(page, testPromptId).catch(() => {});
    }
  });

  test('should open edit tray when clicking edit button', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompt
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(originalText.substring(0, 20));
    await page.waitForTimeout(1000);

    // Click edit button (pencil icon)
    const editButton = page.locator('button[title="Edit"]').first();
    await editButton.click();

    // Wait for tray to open
    await page.waitForTimeout(500);

    // Should see edit form with existing text
    await expect(page.getByText('Edit Prompt')).toBeVisible({ timeout: 5000 });
    const textarea = page.getByPlaceholder(/Enter the prompt text/i);
    const currentValue = await textarea.inputValue();
    expect(currentValue).toContain('E2E Edit Test Original');
  });

  test('should update prompt successfully', async ({ page }) => {
    const updatedText = `E2E Edit Test Updated - ${Date.now()}`;

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompt
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(originalText.substring(0, 20));
    await page.waitForTimeout(1000);

    // Click edit button
    const editButton = page.locator('button[title="Edit"]').first();
    await editButton.click();
    await page.waitForTimeout(500);

    // Update the text
    const textarea = page.getByPlaceholder(/Enter the prompt text/i);
    await textarea.clear();
    await textarea.fill(updatedText);

    // Save
    const saveButton = page.getByRole('button', { name: /Save|Update/i }).last();
    await saveButton.click();

    // Wait for tray to close
    await page.waitForTimeout(2000);

    // Search for updated text
    await searchInput.clear();
    await searchInput.fill(updatedText.substring(0, 20));
    await page.waitForTimeout(1000);

    // Verify updated prompt appears
    await expect(page.getByText(updatedText.substring(0, 40))).toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Delete Prompt Tests
// =========================================================================

test.describe('Admin Prompt Editor - Delete Prompt', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test('should show delete confirmation when clicking delete button', async ({ page }) => {
    // Create a prompt to delete
    const promptText = `E2E Delete Test - ${Date.now()}`;
    const promptId = await createPromptViaAPI(page, promptText);

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompt
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(promptText.substring(0, 20));
    await page.waitForTimeout(1000);

    // Click delete button (trash icon)
    const deleteButton = page.locator('button[title="Delete"]').first();
    await deleteButton.click();

    // Should show confirmation buttons
    await expect(page.locator('button[title="Confirm Delete"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('button[title="Cancel"]')).toBeVisible();

    // Click cancel
    await page.locator('button[title="Cancel"]').click();

    // Confirmation should disappear
    await expect(page.locator('button[title="Confirm Delete"]')).not.toBeVisible();

    // Cleanup
    await deletePromptViaAPI(page, promptId);
  });

  test('should delete prompt when confirming', async ({ page }) => {
    // Create a prompt to delete
    const promptText = `E2E Delete Confirm Test - ${Date.now()}`;
    await createPromptViaAPI(page, promptText);

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompt
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(promptText.substring(0, 20));
    await page.waitForTimeout(1000);

    // Verify prompt exists
    await expect(page.getByText(promptText.substring(0, 40))).toBeVisible();

    // Click delete button
    const deleteButton = page.locator('button[title="Delete"]').first();
    await deleteButton.click();

    // Confirm deletion
    const confirmButton = page.locator('button[title="Confirm Delete"]');
    await confirmButton.click();

    // Wait for deletion
    await page.waitForTimeout(2000);

    // Prompt should no longer appear
    await expect(page.getByText(promptText.substring(0, 40))).not.toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Bulk Selection Tests
// =========================================================================

test.describe('Admin Prompt Editor - Bulk Selection', () => {
  const testPromptIds: number[] = [];

  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);

    // Create multiple test prompts
    for (let i = 0; i < 3; i++) {
      const id = await createPromptViaAPI(page, `E2E Bulk Test ${i} - ${Date.now()}`);
      testPromptIds.push(id);
    }
  });

  test.afterEach(async ({ page }) => {
    // Cleanup all test prompts
    for (const id of testPromptIds) {
      await deletePromptViaAPI(page, id).catch(() => {});
    }
    testPromptIds.length = 0;
  });

  test('should select individual prompts with checkboxes', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Bulk Test');
    await page.waitForTimeout(1000);

    // Click on first checkbox
    const checkboxes = page.locator('input[type="checkbox"]');
    const firstCheckbox = checkboxes.nth(1); // Skip header checkbox
    await firstCheckbox.click();

    // Should show selection bar
    await expect(page.getByText(/1 prompt.* selected/i)).toBeVisible({ timeout: 3000 });
  });

  test('should select all prompts with header checkbox', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Bulk Test');
    await page.waitForTimeout(1000);

    // Click header checkbox (select all)
    const headerCheckbox = page.locator('input[type="checkbox"]').first();
    await headerCheckbox.click();

    // Should show selection bar with count
    await expect(page.getByText(/\d+ prompts? selected/i)).toBeVisible({ timeout: 3000 });
  });

  test('should show bulk action buttons when prompts selected', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Bulk Test');
    await page.waitForTimeout(1000);

    // Select a prompt
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(1).click();

    // Should see bulk action buttons
    await expect(page.getByRole('button', { name: /Bulk Edit/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /Delete Selected/i })).toBeVisible();
    await expect(page.getByText('Clear Selection')).toBeVisible();
  });

  test('should clear selection when clicking Clear Selection', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Bulk Test');
    await page.waitForTimeout(1000);

    // Select prompts
    const headerCheckbox = page.locator('input[type="checkbox"]').first();
    await headerCheckbox.click();

    // Should show selection bar
    await expect(page.getByText(/prompts? selected/i)).toBeVisible();

    // Click Clear Selection
    await page.getByText('Clear Selection').click();

    // Selection bar should disappear
    await expect(page.getByText(/prompts? selected/i)).not.toBeVisible({ timeout: 3000 });
  });
});

// =========================================================================
// Bulk Edit Tests
// =========================================================================

test.describe('Admin Prompt Editor - Bulk Edit', () => {
  const testPromptIds: number[] = [];

  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);

    // Create test prompts
    for (let i = 0; i < 2; i++) {
      const id = await createPromptViaAPI(page, `E2E Bulk Edit Test ${i} - ${Date.now()}`);
      testPromptIds.push(id);
    }
  });

  test.afterEach(async ({ page }) => {
    for (const id of testPromptIds) {
      await deletePromptViaAPI(page, id).catch(() => {});
    }
    testPromptIds.length = 0;
  });

  test('should open bulk edit modal', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search and select prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Bulk Edit Test');
    await page.waitForTimeout(1000);

    // Select all
    const headerCheckbox = page.locator('input[type="checkbox"]').first();
    await headerCheckbox.click();
    await page.waitForTimeout(500);

    // Click Bulk Edit
    await page.getByRole('button', { name: /Bulk Edit/i }).click();

    // Should see bulk edit modal
    await expect(page.getByRole('heading', { name: /Bulk Edit.*Prompts?/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Only fill in the fields you want to update')).toBeVisible();
  });

  test('should bulk update difficulty', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search and select prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Bulk Edit Test');
    await page.waitForTimeout(1000);

    // Select all
    const headerCheckbox = page.locator('input[type="checkbox"]').first();
    await headerCheckbox.click();
    await page.waitForTimeout(500);

    // Click Bulk Edit
    await page.getByRole('button', { name: /Bulk Edit/i }).click();
    await page.waitForTimeout(500);

    // Select difficulty in modal
    const difficultySelect = page.locator('.fixed select').filter({ hasText: /No change/i }).nth(1);
    await difficultySelect.selectOption('hard');

    // Click Update All
    await page.getByRole('button', { name: /Update All/i }).click();

    // Wait for update
    await page.waitForTimeout(2000);

    // Verify prompts now have "Hard" difficulty
    const hardBadges = page.locator('span.inline-flex').filter({ hasText: 'Hard' });
    const count = await hardBadges.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// Bulk Delete Tests
// =========================================================================

test.describe('Admin Prompt Editor - Bulk Delete', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test('should show bulk delete confirmation modal', async ({ page }) => {
    // Create test prompts
    const ids: number[] = [];
    for (let i = 0; i < 2; i++) {
      const id = await createPromptViaAPI(page, `E2E Bulk Delete Modal Test ${i} - ${Date.now()}`);
      ids.push(id);
    }

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search and select prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Bulk Delete Modal Test');
    await page.waitForTimeout(1000);

    // Select all
    const headerCheckbox = page.locator('input[type="checkbox"]').first();
    await headerCheckbox.click();
    await page.waitForTimeout(500);

    // Click Delete Selected
    await page.getByRole('button', { name: /Delete Selected/i }).click();

    // Should see confirmation modal
    await expect(page.getByRole('heading', { name: /Delete.*Prompts?/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('This action cannot be undone')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Delete All/i })).toBeVisible();

    // Cancel and cleanup
    await page.getByRole('button', { name: /Cancel/i }).click();

    for (const id of ids) {
      await deletePromptViaAPI(page, id).catch(() => {});
    }
  });

  test('should cancel bulk delete', async ({ page }) => {
    // Create test prompts
    const promptText = `E2E Bulk Delete Cancel Test - ${Date.now()}`;
    const id = await createPromptViaAPI(page, promptText);

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search and select prompt
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(promptText.substring(0, 30));
    await page.waitForTimeout(1000);

    // Select
    const checkbox = page.locator('input[type="checkbox"]').nth(1);
    await checkbox.click();
    await page.waitForTimeout(500);

    // Click Delete Selected
    await page.getByRole('button', { name: /Delete Selected/i }).click();
    await page.waitForTimeout(500);

    // Click Cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Modal should close
    await expect(page.getByText('This action cannot be undone')).not.toBeVisible({ timeout: 3000 });

    // Prompt should still exist
    await expect(page.getByText(promptText.substring(0, 40))).toBeVisible();

    // Cleanup
    await deletePromptViaAPI(page, id);
  });

  test('should bulk delete prompts when confirmed', async ({ page }) => {
    // Create test prompts
    const uniqueMarker = `E2E_BULK_DELETE_${Date.now()}`;
    const ids: number[] = [];
    for (let i = 0; i < 2; i++) {
      const id = await createPromptViaAPI(page, `${uniqueMarker}_${i} - Test prompt for deletion`);
      ids.push(id);
    }

    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompts
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill(uniqueMarker);
    await page.waitForTimeout(1000);

    // Verify prompts exist (use first() since multiple prompts contain the marker)
    await expect(page.getByText(uniqueMarker).first()).toBeVisible();

    // Select all
    const headerCheckbox = page.locator('input[type="checkbox"]').first();
    await headerCheckbox.click();
    await page.waitForTimeout(500);

    // Click Delete Selected
    await page.getByRole('button', { name: /Delete Selected/i }).click();
    await page.waitForTimeout(500);

    // Confirm deletion
    await page.getByRole('button', { name: /Delete All/i }).click();

    // Wait for deletion
    await page.waitForTimeout(2000);

    // Prompts should no longer appear (count should be 0)
    await expect(page.getByText(uniqueMarker).first()).not.toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Pagination Tests
// =========================================================================

test.describe('Admin Prompt Editor - Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
  });

  test('should show pagination when more than 20 prompts exist', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Check if pagination is visible (only shows when totalPages > 1)
    const promptCount = await getPromptCountViaAPI(page);

    if (promptCount > 20) {
      // Should see pagination controls
      await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();
      await expect(page.getByText(/Showing \d+ to \d+ of \d+ prompts/)).toBeVisible();
    }
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    const promptCount = await getPromptCountViaAPI(page);

    if (promptCount > 20) {
      // Click next page button
      const nextButton = page.locator('button').filter({ has: page.locator('svg.w-5.h-5') }).last();
      await nextButton.click();

      // Wait for page change
      await page.waitForTimeout(1000);

      // Should show page 2
      await expect(page.getByText(/Page 2 of/)).toBeVisible();
    }
  });
});

// =========================================================================
// Toggle Active Status Tests
// =========================================================================

test.describe('Admin Prompt Editor - Toggle Active Status', () => {
  let testPromptId: number;

  test.beforeEach(async ({ page }) => {
    await loginAsAdminViaAPI(page);
    testPromptId = await createPromptViaAPI(page, `E2E Toggle Active Test - ${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (testPromptId) {
      await deletePromptViaAPI(page, testPromptId).catch(() => {});
    }
  });

  test('should toggle prompt active status', async ({ page }) => {
    await page.goto('/admin/prompt-challenge-prompts');
    await waitForPageReady(page);

    // Search for our test prompt
    const searchInput = page.getByPlaceholder('Search prompts...');
    await searchInput.fill('E2E Toggle Active Test');
    await page.waitForTimeout(1000);

    // Find and click the toggle button (checkmark icon)
    const toggleButton = page.locator('button[title="Deactivate"]').first();
    const isActive = await toggleButton.isVisible().catch(() => false);

    if (isActive) {
      // Click to deactivate
      await toggleButton.click();
      await page.waitForTimeout(1500);

      // Should now show "Activate" button
      await expect(page.locator('button[title="Activate"]').first()).toBeVisible({ timeout: 5000 });
    } else {
      // Find activate button and click
      const activateButton = page.locator('button[title="Activate"]').first();
      await activateButton.click();
      await page.waitForTimeout(1500);

      // Should now show "Deactivate" button
      await expect(page.locator('button[title="Deactivate"]').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
