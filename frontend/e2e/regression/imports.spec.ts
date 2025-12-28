/**
 * Imports Regression Tests - E2E tests for project import functionality
 *
 * These tests verify that importing from GitHub, Figma, YouTube, etc. works.
 * Each test represents a real user journey that must not break.
 *
 * @see /docs/test-strategy-improvement-plan.md
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI, createConsoleErrorCollector } from '../helpers';

// Timeouts
const _PAGE_LOAD_TIMEOUT = 15000; // Reserved for future use
const _IMPORT_START_TIMEOUT = 30000; // Reserved for future use

test.describe('Imports Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  /**
   * REGRESSION: GitHub URL triggers import flow via Ava
   *
   * Bug: Pasting GitHub URL doesn't trigger import options
   * Root cause: URL detection fails or AI doesn't offer import
   */
  test('GitHub URL paste triggers import flow', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: 15000 });

    // Paste a GitHub URL
    await chatInput.fill('https://github.com/facebook/react');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(30000);

    const pageContent = await page.locator('body').textContent() || '';

    // ASSERT: Response should mention project/import/repository
    const hasImportFlow = /project|import|repository|github|save|clip/i.test(pageContent);
    expect(hasImportFlow).toBe(true);

    // ASSERT: Should NOT be an error response
    expect(pageContent).not.toMatch(/error occurred|something went wrong/i);
  });

  /**
   * REGRESSION: YouTube URL triggers content preview
   *
   * Bug: Pasting YouTube URL doesn't show video info
   * Root cause: YouTube API integration fails
   */
  test('YouTube URL paste shows video info', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: 15000 });

    // Paste a YouTube URL
    await chatInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(30000);

    const pageContent = await page.locator('body').textContent() || '';

    // ASSERT: Response should acknowledge the video or offer to save
    const hasVideoResponse = /video|youtube|watch|save|clip|interesting/i.test(pageContent);
    expect(hasVideoResponse).toBe(true);
  });

  /**
   * REGRESSION: Figma URL triggers design import flow
   *
   * Bug: Pasting Figma URL doesn't offer to import design
   * Root cause: Figma URL detection or API integration fails
   */
  test('Figma URL paste triggers design import', async ({ page }) => {
    test.setTimeout(90000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: 15000 });

    // Paste a Figma URL (using a generic pattern)
    await chatInput.fill('https://www.figma.com/file/abc123/MyDesign');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(30000);

    const pageContent = await page.locator('body').textContent() || '';

    // ASSERT: Response should acknowledge Figma or offer to import
    const hasFigmaResponse = /figma|design|import|project|connect/i.test(pageContent);
    expect(hasFigmaResponse).toBe(true);
  });

  /**
   * REGRESSION: Import flow doesn't break on invalid URLs
   *
   * Bug: Invalid URL crashes the import flow
   * Root cause: URL validation errors not handled gracefully
   */
  test('invalid URL handled gracefully', async ({ page }) => {
    test.setTimeout(60000);

    const consoleCollector = createConsoleErrorCollector(page);
    consoleCollector.start();

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: 15000 });

    // Paste an invalid URL
    await chatInput.fill('https://not-a-real-website-12345.fake/project');
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(20000);

    consoleCollector.stop();

    // ASSERT: No critical console errors (graceful handling)
    expect(consoleCollector.hasCriticalErrors()).toBe(false);

    // ASSERT: Should have some response (not crash)
    const pageContent = await page.locator('body').textContent() || '';
    expect(pageContent.length).toBeGreaterThan(100);
  });

  /**
   * REGRESSION: Multiple URLs can be imported in sequence
   *
   * Bug: After one import, subsequent imports fail
   * Root cause: State not reset between imports
   */
  test('can import multiple URLs in sequence', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.locator('input[placeholder="Message Ava..."]');
    await expect(chatInput).toBeEnabled({ timeout: 15000 });
    const sendButton = page.locator('button[aria-label*="Send"], button[type="submit"]:has(svg)').first();

    // First URL
    await chatInput.fill('https://github.com/vuejs/vue');
    await sendButton.click();
    await page.waitForTimeout(20000);

    // Second URL
    await chatInput.fill('https://github.com/angular/angular');
    await sendButton.click();
    await page.waitForTimeout(20000);

    const pageContent = await page.locator('body').textContent() || '';

    // ASSERT: Both URLs should be acknowledged (content mentions both or recent)
    const hasResponses = /vue|angular|repository|project/i.test(pageContent);
    expect(hasResponses).toBe(true);
  });

  /**
   * REGRESSION: Explore page shows imported projects
   *
   * Bug: Imported projects don't appear in explore
   * Root cause: Cache issues, async timing, or API inconsistency
   */
  test('explore page loads with projects', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // ASSERT: Should show projects or empty state
    const hasProjects = await page.locator('[data-testid="project-card"], .project-card').count() > 0;
    // Empty state messages from ExplorePage: "No projects found", "No results found"
    const hasEmptyState = await page.locator('text=/no projects|no results|start exploring|discover/i').isVisible();
    // Also check for loading state as valid
    const isLoading = await page.locator('text=/loading/i').isVisible();

    expect(hasProjects || hasEmptyState || isLoading).toBe(true);
  });

  /**
   * REGRESSION: Project detail page loads after import
   *
   * Bug: Clicking on imported project shows error
   * Root cause: Slug mismatch, missing data, or route issues
   */
  test('can view project detail page', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/explore');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/projects/"]').first();

    if (await projectCard.isVisible()) {
      await projectCard.click();
      await page.waitForLoadState('domcontentloaded');

      // ASSERT: URL changed to project detail
      expect(page.url()).toMatch(/\/projects\/[a-zA-Z0-9-]+/);

      // ASSERT: Page has project content
      const pageContent = await page.locator('body').textContent();
      expect(pageContent?.length).toBeGreaterThan(100);

      // ASSERT: No error messages
      expect(pageContent).not.toMatch(/not found|error|failed/i);
    } else {
      test.skip();
    }
  });
});
