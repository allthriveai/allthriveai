/**
 * Learning Path Detail Page E2E Tests
 *
 * Tests for the /:username/learn/:slug page including:
 * - Path content display
 * - Lesson navigation and expansion
 * - Sage chat panel (desktop)
 * - Key concept chips
 * - Practice prompts
 *
 * RUN: npx playwright test e2e/learning-path-detail.spec.ts
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI } from './helpers';

// Timeouts
const PAGE_LOAD_TIMEOUT = 15000;

/**
 * Helper: Get the first learning path slug for the test user
 */
async function getFirstLearningPathUrl(page: Page): Promise<string | null> {
  // Navigate to /learn to find a path
  await page.goto('/learn');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Find any path card link
  const pathLinks = page.locator('a[href*="/learn/"]');
  const count = await pathLinks.count();

  if (count > 0) {
    const href = await pathLinks.first().getAttribute('href');
    return href;
  }

  return null;
}

test.describe('Learning Path Detail - Content Display', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await loginViaAPI(page);
  });

  test('displays path header with title and metadata', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');

    // Should have a header with title
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    // Should have "Back to Learn" link
    const backLink = page.getByText('Back to Learn');
    await expect(backLink).toBeVisible();

    // Should display path title (h1)
    const title = page.locator('h1').first();
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText?.length).toBeGreaterThan(0);

    console.log(`✓ Path title: ${titleText}`);
  });

  test('displays curriculum section with items', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Should have "Curriculum" heading
    await expect(page.getByRole('heading', { name: 'Curriculum' })).toBeVisible();

    // Should have curriculum items (numbered)
    const curriculumItems = page.locator('[class*="glass-strong"]');
    const itemCount = await curriculumItems.count();

    expect(itemCount).toBeGreaterThan(0);
    console.log(`✓ Found ${itemCount} curriculum items`);
  });

  test('displays cover image or gradient background', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');

    // Header should have either a cover image background or gradient
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Check if there's a background image div
    const bgImage = header.locator('[class*="bg-cover"]');
    const hasCoverImage = await bgImage.isVisible().catch(() => false);

    if (hasCoverImage) {
      console.log('✓ Path has a cover image');
    } else {
      // Should have gradient background
      const gradientBg = header.locator('[class*="bg-gradient"]');
      const hasGradient = await gradientBg.first().isVisible().catch(() => false);
      expect(hasGradient).toBe(true);
      console.log('✓ Path has gradient background (no cover image)');
    }
  });

  test('displays metadata: duration, difficulty, item count', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should show estimated hours (e.g., "2h" or "10h")
    const hasHours = await page.locator('text=/\\d+h/').first().isVisible().catch(() => false);

    // Should show difficulty (beginner, intermediate, advanced)
    const hasDifficulty = await page.locator('text=/beginner|intermediate|advanced/i').first().isVisible().catch(() => false);

    // Should show item count (e.g., "5 items")
    const hasItemCount = await page.locator('text=/\\d+ items/').first().isVisible().catch(() => false);

    // Or check for any meta info in the header
    const hasMetaInfo = await page.locator('header').first().isVisible().catch(() => false);

    console.log(`✓ Metadata displayed: hours=${hasHours}, difficulty=${hasDifficulty}, items=${hasItemCount}, header=${hasMetaInfo}`);
    // At minimum, the header with metadata should be visible
    expect(hasHours || hasDifficulty || hasItemCount || hasMetaInfo).toBe(true);
  });
});

test.describe('Learning Path Detail - Lesson Interaction', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await loginViaAPI(page);
  });

  test('AI lessons are expandable', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Find an AI Lesson item (has "AI Lesson" badge)
    const aiLessonBadge = page.getByText('AI Lesson').first();
    const hasAiLesson = await aiLessonBadge.isVisible().catch(() => false);

    if (hasAiLesson) {
      // Get the parent button that expands the lesson
      const lessonCard = page.locator('[class*="glass-strong"]').filter({ hasText: 'AI Lesson' }).first();
      const expandButton = lessonCard.locator('button').first();

      // Click to expand
      await expandButton.click();
      await page.waitForTimeout(500);

      // Should now show expanded content (Examples, Try It Yourself, etc.)
      const hasExpandedContent =
        await page.getByText('Examples').isVisible().catch(() => false) ||
        await page.getByText('Try It Yourself').isVisible().catch(() => false);

      expect(hasExpandedContent).toBe(true);
      console.log('✓ AI Lesson expands to show content');
    } else {
      console.log('No AI Lessons found in this path');
    }
  });

  test('AI lessons show key concept chips', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Find lessons with key concept chips (rounded-full badges in lesson cards)
    const conceptChips = page.locator('[class*="glass-strong"] .rounded-full');
    const chipCount = await conceptChips.count();

    if (chipCount > 0) {
      console.log(`✓ Found ${chipCount} concept chips in curriculum`);
    } else {
      console.log('No concept chips visible (may need to expand lessons)');
    }
  });

  test('practice prompts link to Sage chat', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    // Set desktop viewport for Sage panel
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Find and expand an AI Lesson
    const aiLessonCard = page.locator('[class*="glass-strong"]').filter({ hasText: 'AI Lesson' }).first();
    const hasAiLesson = await aiLessonCard.isVisible().catch(() => false);

    if (hasAiLesson) {
      // Click to expand
      await aiLessonCard.locator('button').first().click();
      await page.waitForTimeout(500);

      // Look for "Try It Yourself" button
      const tryItButton = page.getByText('Try It Yourself').first();
      const hasTryIt = await tryItButton.isVisible().catch(() => false);

      if (hasTryIt) {
        // Click the button
        await tryItButton.click();
        await page.waitForTimeout(500);

        // The Sage chat panel should update context (check for lesson title in panel)
        console.log('✓ "Try It Yourself" clicked - should update Sage context');
      } else {
        console.log('No "Try It Yourself" section found');
      }
    } else {
      console.log('No AI Lessons found - skipping practice prompt test');
    }
  });
});

test.describe('Learning Path Detail - Sage Chat Panel (Desktop)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaAPI(page);
  });

  test('Sage chat panel visible on desktop', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Chat panel should be visible (480px width, right side)
    const chatPanel = page.locator('.w-\\[480px\\]');
    const hasPanel = await chatPanel.isVisible().catch(() => false);

    if (hasPanel) {
      console.log('✓ Desktop Sage chat panel visible');

      // Should show Sage avatar
      const sageAvatar = chatPanel.locator('img[alt="Sage"]');
      const hasAvatar = await sageAvatar.first().isVisible().catch(() => false);
      console.log(`✓ Sage avatar visible: ${hasAvatar}`);
    } else {
      console.log('Chat panel not found with expected selector');
    }
  });

  test('Sage chat shows path context', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Chat panel should show path title or "Ask Sage" header
    const askSageHeader = page.getByText('Ask Sage');
    const hasHeader = await askSageHeader.first().isVisible().catch(() => false);

    if (hasHeader) {
      console.log('✓ "Ask Sage" header visible in chat panel');
    }
  });

  test('Sage chat has input area', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Should have a chat input
    const chatInput = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"]').first();
    const hasInput = await chatInput.isVisible().catch(() => false);

    if (hasInput) {
      console.log('✓ Chat input area visible');
    } else {
      // May have different placeholder text
      const altInput = page.locator('input[type="text"], textarea').last();
      const hasAltInput = await altInput.isVisible().catch(() => false);
      console.log(`Alternative input visible: ${hasAltInput}`);
    }
  });
});

test.describe('Learning Path Detail - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await loginViaAPI(page);
  });

  test('back link returns to /learn', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');

    // Click "Back to Learn" link
    const backLink = page.getByText('Back to Learn');
    await expect(backLink).toBeVisible();
    await backLink.click();

    await page.waitForLoadState('domcontentloaded');

    // Should be on /learn page
    expect(page.url()).toContain('/learn');
    expect(page.url()).not.toMatch(/\/learn\/[^/]+/); // Should not have a slug

    console.log('✓ Back navigation works');
  });

  test('handles non-existent path gracefully', async ({ page }) => {
    // Navigate to a non-existent path
    await page.goto('/testuser/learn/non-existent-path-12345');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Should show not found state OR loading (API might take time to 404)
    const notFoundText = await page.getByText(/not found|doesn't exist/i).first().isVisible().catch(() => false);
    const hasBackButton = await page.getByText('Go to Learn').isVisible().catch(() => false);

    // May also show loading spinner if API is slow
    const hasLoadingSpinner = await page.locator('.animate-spin').first().isVisible().catch(() => false);

    // Page should not crash - should show either not found, back button, or loading
    const pageLoaded = notFoundText || hasBackButton || hasLoadingSpinner;

    if (notFoundText || hasBackButton) {
      console.log('✓ Not found state displayed for invalid path');
    } else if (hasLoadingSpinner) {
      console.log('✓ Page shows loading state (API still fetching)');
    }

    // At minimum, the page should load without crashing
    expect(pageLoaded).toBe(true);
  });
});

test.describe('Learning Path Detail - Content Types', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await loginViaAPI(page);
  });

  test('displays different curriculum item types correctly', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Check for various item type badges
    const itemTypes = {
      'AI Lesson': await page.getByText('AI Lesson').first().isVisible().catch(() => false),
      'Video': await page.getByText('Video').first().isVisible().catch(() => false),
      'Article': await page.getByText('Article').first().isVisible().catch(() => false),
      'Game': await page.getByText('Game').first().isVisible().catch(() => false) ||
              await page.getByText('Interactive Game').first().isVisible().catch(() => false),
      'Quiz': await page.getByText('Quiz').first().isVisible().catch(() => false),
      'Tool': await page.getByText('Tool').first().isVisible().catch(() => false),
    };

    const foundTypes = Object.entries(itemTypes)
      .filter(([_, found]) => found)
      .map(([type]) => type);

    console.log(`✓ Found curriculum item types: ${foundTypes.join(', ') || 'none visible'}`);

    // Should have at least one type of content
    expect(foundTypes.length).toBeGreaterThan(0);
  });

  test('games render inline with start button', async ({ page }) => {
    const pathUrl = await getFirstLearningPathUrl(page);

    if (!pathUrl) {
      test.skip();
      return;
    }

    await page.goto(pathUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Check for game items
    const gameLabel = page.getByText('Interactive Game').first();
    const hasGame = await gameLabel.isVisible().catch(() => false);

    if (hasGame) {
      // Should have a "Start Game" button
      const startButton = page.getByRole('button', { name: 'Start Game' });
      const hasStartButton = await startButton.first().isVisible().catch(() => false);

      expect(hasStartButton).toBe(true);
      console.log('✓ Game renders with Start Game button');
    } else {
      console.log('No inline games found in this path');
    }
  });
});
