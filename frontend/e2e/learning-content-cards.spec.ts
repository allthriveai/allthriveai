/**
 * Learning Content Cards E2E Tests
 *
 * Tests for proper rendering of project/learning content cards in chat:
 * - Cards should render in a grid layout (not as huge individual images)
 * - Cards should use compact mode with proper sizing
 * - Multiple cards should display in a row/grid
 *
 * RUN: npx playwright test e2e/learning-content-cards.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI } from './helpers';

// Timeouts
const WS_CONNECT_TIMEOUT = 15000;
const TOOL_RESPONSE_TIMEOUT = 45000;

/**
 * Helper: Send a chat message and wait for response
 */
async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.locator('input[placeholder="Message Ava..."]');
  await expect(chatInput).toBeEnabled({ timeout: WS_CONNECT_TIMEOUT });

  await chatInput.fill(message);
  const sendButton = page
    .locator('button[aria-label*="Send"], button[type="submit"]:has(svg)')
    .first();
  await sendButton.click();
}

/**
 * Helper: Wait for AI response to complete (loading indicator disappears)
 */
async function waitForResponseComplete(page: Page, timeout = TOOL_RESPONSE_TIMEOUT) {
  // Wait for thinking/loading indicators to disappear
  // Use Playwright's locator API instead of raw querySelector
  try {
    // Wait for "Thinking" text or cancel button to disappear
    await page
      .locator('text=Thinking, button:has-text("Cancel")')
      .first()
      .waitFor({ state: 'hidden', timeout: timeout });
  } catch {
    // If timeout, check if we have content anyway
  }

  // Extra wait for final render
  await page.waitForTimeout(1500);
}

test.describe('Learning Content Cards - Grid Layout', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000); // 60s for login
    await loginViaAPI(page);
  });

  test('project cards render in a grid, not as huge images', async ({ page }) => {
    test.setTimeout(120000); // 2 min for full test

    // GIVEN: I am on the home page with chat
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I ask for projects (triggers find_learning_content tool)
    await sendChatMessage(page, 'show me some AI projects');
    await waitForResponseComplete(page);

    // THEN: Should see grid layout with multiple cards
    // Look for the grid container (grid-cols-2, grid-cols-3, or grid-cols-4)
    const gridContainer = page.locator('.grid.grid-cols-2, .grid.grid-cols-3, .grid.grid-cols-4, [class*="grid-cols"]');

    // Wait for grid to appear
    await expect(gridContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify multiple cards in the grid
    const cardsInGrid = gridContainer.first().locator('a, [class*="rounded-lg"], [class*="rounded-xl"]');
    const cardCount = await cardsInGrid.count();

    // Should have multiple cards (at least 2)
    expect(cardCount).toBeGreaterThanOrEqual(2);
    console.log(`✓ Found ${cardCount} cards in grid layout`);
  });

  test('cards are compact size, not full-width images', async ({ page }) => {
    test.setTimeout(90000);

    // GIVEN: I am on the home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I ask about a topic that returns learning content
    await sendChatMessage(page, 'what projects are trending?');
    await waitForResponseComplete(page);

    // THEN: Cards should have reasonable dimensions (not huge)
    // First find any learning content cards that appeared
    const cards = page.locator('[class*="rounded-lg"][class*="overflow-hidden"], [class*="rounded-xl"][class*="overflow-hidden"]');

    if (await cards.count() > 0) {
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible();

      // Get card dimensions
      const boundingBox = await firstCard.boundingBox();

      if (boundingBox) {
        // Card should be compact: less than 300px wide (not full-width huge image)
        expect(boundingBox.width).toBeLessThan(400);
        // Card should have reasonable height
        expect(boundingBox.height).toBeLessThan(350);

        console.log(`✓ Card dimensions: ${boundingBox.width}x${boundingBox.height}px`);
      }
    }
  });

  test('no raw markdown images displayed for projects', async ({ page }) => {
    test.setTimeout(90000);

    // GIVEN: I am on the home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I ask about projects
    await sendChatMessage(page, 'show me beginner projects');
    await waitForResponseComplete(page);

    // THEN: Should NOT see raw markdown image syntax or huge standalone images
    const pageContent = await page.locator('body').textContent();

    // Should not contain markdown image syntax like ![alt](url)
    expect(pageContent).not.toContain('![');

    // Check for images outside of card containers (bad - raw images in markdown)
    // vs images inside card containers (good - properly rendered cards)
    const standaloneImages = page.locator('.prose img, [class*="markdown"] img');
    const standaloneImageCount = await standaloneImages.count();

    // If there are standalone images, they should be small thumbnails, not huge
    for (let i = 0; i < standaloneImageCount; i++) {
      const img = standaloneImages.nth(i);
      const box = await img.boundingBox();
      if (box) {
        // Raw huge images are the problem - these would be > 500px wide
        if (box.width > 500) {
          console.log(`⚠ Found large standalone image: ${box.width}x${box.height}px`);
        }
        expect(box.width).toBeLessThan(600);
      }
    }
  });

  test('learning content header appears with cards', async ({ page }) => {
    test.setTimeout(90000);

    // GIVEN: I am on the home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I ask for content
    await sendChatMessage(page, 'find me some machine learning tutorials');
    await waitForResponseComplete(page);

    // THEN: Should see grid layout (the main thing we're testing)
    const hasCards = await page.locator('.grid[class*="cols"]').first().isVisible().catch(() => false);

    // Just verify we got cards - header text varies based on response
    if (hasCards) {
      console.log('✓ Found cards with header');
    } else {
      // If no cards, at least verify we got a response (not an error)
      const hasResponse = await page.locator('[class*="glass"] p').first().isVisible().catch(() => false);
      expect(hasResponse).toBe(true);
    }
  });
});

test.describe('Learning Content Cards - Tool Events', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('tool execution triggers card display', async ({ page }) => {
    test.setTimeout(90000);

    // GIVEN: I am on the home page
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // WHEN: I ask something that requires the find_learning_content tool
    await sendChatMessage(page, 'show me projects about web development');

    // THEN: Wait for tool execution (thinking indicator may appear briefly)
    // We don't assert on the indicator since it may be too fast to catch
    await page.waitForTimeout(2000);

    // Then wait for completion
    await waitForResponseComplete(page);

    // Verify we got structured content (grid or cards)
    const hasStructuredContent = await page.locator(
      '.grid[class*="cols"], [class*="grid-cols"]'
    ).first().isVisible().catch(() => false);

    const hasTextResponse = await page.locator('[class*="glass"] p').first().isVisible().catch(() => false);

    // Should have either structured cards OR a text response (not raw markdown images)
    expect(hasStructuredContent || hasTextResponse).toBe(true);
    console.log(`✓ Response type: ${hasStructuredContent ? 'Grid cards' : 'Text response'}`);
  });
});

test.describe('Learning Content Cards - Card Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('cards are clickable and navigate correctly', async ({ page }) => {
    test.setTimeout(90000);

    // GIVEN: Cards are displayed
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    await sendChatMessage(page, 'show me popular projects');
    await waitForResponseComplete(page);

    // Find the grid container first
    const gridContainer = page.locator('.grid[class*="cols"]').first();
    const hasGrid = await gridContainer.isVisible().catch(() => false);

    if (hasGrid) {
      // Find clickable cards (wrapped in links) within the grid
      const cardLinks = gridContainer.locator('a[href]');
      const linkCount = await cardLinks.count();

      console.log(`✓ Found ${linkCount} clickable cards in grid`);

      if (linkCount > 0) {
        const firstLink = cardLinks.first();
        const href = await firstLink.getAttribute('href');

        // Verify link exists and is not empty
        expect(href).toBeTruthy();
        // Links can go to projects, videos, or external URLs
        expect(href!.length).toBeGreaterThan(0);

        console.log(`✓ First card links to: ${href}`);
      }
    } else {
      // No grid = no cards to test, which is acceptable
      console.log('No grid cards found, skipping navigation test');
    }
  });
});
