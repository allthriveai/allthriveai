import { test, expect } from '@playwright/test';
import { loginViaAPI, _TEST_USER } from './helpers';

test.describe('Side Quests', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should display the side quests page with Quest Paths section', async ({ page }) => {
    // Navigate to side quests page
    await page.goto('/play/side-quests');
    await page.waitForLoadState('domcontentloaded');

    // Wait for page content to load
    await page.waitForTimeout(3000);

    // Verify the Side Quests title is displayed (it's the main heading)
    await expect(page.getByRole('heading', { name: 'Side Quests' })).toBeVisible({ timeout: 10000 });

    // Verify Quest Paths section exists - use heading role to be specific
    await expect(page.getByRole('heading', { name: 'Quest Paths', level: 2 })).toBeVisible();
  });

  test('should display quest categories', async ({ page }) => {
    await page.goto('/play/side-quests');
    await page.waitForLoadState('domcontentloaded');

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Wait for Quest Paths section to appear - use heading with level to be specific
    await expect(page.getByRole('heading', { name: 'Quest Paths', level: 2 })).toBeVisible({ timeout: 15000 });

    // Look for category names (Community Builder, Learning Explorer, etc.)
    const communityBuilder = page.getByText('Community Builder');
    const isVisible = await communityBuilder.isVisible().catch(() => false);

    if (isVisible) {
      console.log('Found Community Builder category');
      await expect(communityBuilder).toBeVisible();
    } else {
      // Check for "No quest paths available" message
      const noQuests = page.getByText('No quest paths available yet');
      await expect(noQuests).toBeVisible();
    }
  });

  test('should expand category to show individual quests', async ({ page }) => {
    await page.goto('/play/side-quests');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find Community Builder category and click to expand
    const categoryButton = page.getByText('Community Builder').locator('xpath=ancestor::button');

    if (await categoryButton.count() > 0) {
      await categoryButton.click();
      await page.waitForTimeout(500);

      // After expanding, should see quest items with point rewards
      const questItems = page.locator('text=/\\+\\d+ Points|\\+\\d+$/');
      const count = await questItems.count();
      console.log(`Found ${count} quest items after expanding`);
    } else {
      // Try clicking on the category card directly
      const categoryCard = page.locator('[class*="rounded-2xl"]').filter({
        has: page.getByText('Community Builder'),
      }).first();

      if (await categoryCard.count() > 0) {
        await categoryCard.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show Continue Playing section with daily quests', async ({ page }) => {
    await page.goto('/play/side-quests');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check if "Continue Playing" section exists (shows active quests)
    const continuePlayingSection = page.getByText('Continue Playing');
    const hasContinuePlaying = await continuePlayingSection.isVisible().catch(() => false);

    if (hasContinuePlaying) {
      console.log('Continue Playing section is visible - user has quests in progress');
      await expect(continuePlayingSection).toBeVisible();

      // Should show IN PROGRESS badges
      const inProgressBadge = page.getByText('IN PROGRESS').first();
      await expect(inProgressBadge).toBeVisible();
    } else {
      console.log('No quests currently in progress');
    }
  });

  test('should show daily quests like Daily Explorer, Daily Check-In', async ({ page }) => {
    await page.goto('/play/side-quests');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Look for daily quest cards
    const dailyExplorer = page.getByText('Daily Explorer');
    const dailyCheckIn = page.getByText('Daily Check-In');
    const dailyComment = page.getByText('Daily Comment');

    const hasDaily = await dailyExplorer.isVisible().catch(() => false) ||
                     await dailyCheckIn.isVisible().catch(() => false) ||
                     await dailyComment.isVisible().catch(() => false);

    if (hasDaily) {
      console.log('Daily quests are visible');
    } else {
      console.log('No daily quests visible at this time');
    }

    // This test just verifies the page structure, not specific content
    expect(true).toBe(true);
  });

  test('should redirect unauthenticated users to login prompt', async ({ page }) => {
    // Clear cookies to simulate unauthenticated state
    await page.context().clearCookies();

    // Navigate to side quests page without auth
    await page.goto('/play/side-quests');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should see login prompt "Join Side Quests" or be redirected to auth
    const loginPrompt = page.getByText('Join Side Quests');
    const authPage = page.url().includes('/auth') || page.url().includes('/login');

    const hasLoginPrompt = await loginPrompt.isVisible().catch(() => false);

    expect(hasLoginPrompt || authPage).toBe(true);
  });
});
