/**
 * Pricing FAQ Tests
 *
 * Tests for FAQ accordion behavior on the pricing page.
 *
 * Run: npx playwright test e2e/pricing-faq.spec.ts --headed
 */

import { test, expect } from '@playwright/test';

test.describe('Pricing Page FAQ', () => {
  test('clicking FAQ should not scroll to top of page', async ({ page }) => {
    // Go to pricing page
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to fully render
    await page.waitForTimeout(1000);

    // Scroll down to FAQ section
    const faqSection = page.getByRole('heading', { name: /frequently asked/i });
    await faqSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Get initial scroll position
    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Ensure we're scrolled down (not at top)
    expect(scrollBefore).toBeGreaterThan(500);

    // Find and click the FAQ button "What happens to my AI request quota?"
    const faqButton = page.getByRole('button', { name: /what happens to my ai request quota/i });
    await expect(faqButton).toBeVisible();
    await faqButton.click();

    // Wait for any animations/transitions
    await page.waitForTimeout(500);

    // Get scroll position after click
    const scrollAfter = await page.evaluate(() => window.scrollY);

    // The scroll position should NOT have jumped to the top (0)
    // Allow for small adjustments due to accordion expanding (within 200px)
    expect(scrollAfter).toBeGreaterThan(scrollBefore - 200);

    // Verify the FAQ answer is visible
    const faqAnswer = page.getByText(/your monthly ai request quota resets/i);
    await expect(faqAnswer).toBeVisible();
  });

  test('clicking multiple FAQs should maintain scroll position', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Scroll to FAQ section
    const faqSection = page.getByRole('heading', { name: /frequently asked/i });
    await faqSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Click first FAQ
    const faq1 = page.getByRole('button', { name: /can i change plans anytime/i });
    await faq1.click();
    await page.waitForTimeout(300);

    // Get scroll position
    const scrollAfterFirst = await page.evaluate(() => window.scrollY);

    // Click second FAQ
    const faq2 = page.getByRole('button', { name: /what happens to my ai request quota/i });
    await faq2.click();
    await page.waitForTimeout(300);

    // Get scroll position after second click
    const scrollAfterSecond = await page.evaluate(() => window.scrollY);

    // Should not have scrolled significantly (within 200px tolerance)
    expect(Math.abs(scrollAfterSecond - scrollAfterFirst)).toBeLessThan(200);
  });
});
