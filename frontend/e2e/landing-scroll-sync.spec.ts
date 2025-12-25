/**
 * Landing Page Scroll Sync Debug Test
 *
 * This test helps debug the synchronization between left section content
 * and right chat panel during scroll.
 *
 * Run: npx playwright test e2e/landing-scroll-sync.spec.ts --headed
 */

import { test } from '@playwright/test';

test.describe('Landing Page Scroll Sync', () => {
  test('debug scroll positions and content visibility', async ({ page }) => {
    // Set viewport to desktop size (chat panel is hidden on mobile)
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the landing page to fully render
    await page.waitForSelector('text=Explore AI together', { timeout: 10000 });

    // Get the total scrollable height
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const maxScroll = scrollHeight - viewportHeight;

    console.log('\n=== LANDING PAGE SCROLL DEBUG ===');
    console.log(`Total scroll height: ${scrollHeight}px`);
    console.log(`Viewport height: ${viewportHeight}px`);
    console.log(`Max scroll position: ${maxScroll}px`);
    console.log(`Container height should be: 400vh = ${4 * viewportHeight}px`);

    // Test different scroll positions (0%, 25%, 33%, 50%, 58%, 75%, 83%, 100%)
    const scrollPositions = [0, 0.15, 0.25, 0.33, 0.45, 0.58, 0.70, 0.83, 0.95, 0.99];

    for (const progress of scrollPositions) {
      const scrollY = Math.floor(maxScroll * progress);
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);

      // Wait for animations to settle (50ms initial + 300ms per message)
      await page.waitForTimeout(1200);

      // Capture what's visible on the left side
      const leftContent = await page.evaluate(() => {
        const sections = [
          { id: 'hero', text: 'Explore AI together' },
          { id: 'learn', text: 'Learn through games' },
          { id: 'share', text: 'Share your work in progress' },
          { id: 'see', text: 'See what others are creating' },
        ];

        const viewport = window.innerHeight;
        const visibleSections: string[] = [];

        for (const section of sections) {
          const el = Array.from(document.querySelectorAll('h1, h2')).find(
            (h) => h.textContent?.includes(section.text)
          );
          if (el) {
            const rect = el.getBoundingClientRect();
            // Check if element is in the viewport (with some tolerance)
            if (rect.top >= -100 && rect.top < viewport * 0.7) {
              visibleSections.push(`${section.id} (top: ${Math.round(rect.top)}px)`);
            }
          }
        }

        return visibleSections;
      });

      // Capture what's visible on the right side (chat messages)
      const rightContent = await page.evaluate(() => {
        const chatPanel = document.querySelector('.glass-card');
        if (!chatPanel) return ['No chat panel found'];

        const activeSection = chatPanel.getAttribute('data-active-section') || 'unknown';
        const messageCount = chatPanel.getAttribute('data-message-count') || '0';
        const chatContent = chatPanel.querySelector('[data-visible-count]');
        const visibleCount = chatContent?.getAttribute('data-visible-count') || 'N/A';
        const prevSection = chatContent?.getAttribute('data-prev-section') || 'N/A';
        const messages: string[] = [`[section: ${activeSection}, msgs: ${messageCount}, visible: ${visibleCount}, prev: ${prevSection}]`];

        // Check for "Scroll down to start" placeholder
        const placeholder = chatPanel.querySelector('p');
        if (placeholder?.textContent?.includes('Scroll down')) {
          messages.push('placeholder: "Scroll down to start chatting"');
        }

        // Get all chat bubbles
        const bubbles = chatPanel.querySelectorAll('.rounded-2xl');
        bubbles.forEach((bubble) => {
          const text = bubble.textContent?.slice(0, 50);
          if (text) {
            messages.push(text.trim() + (text.length >= 50 ? '...' : ''));
          }
        });

        // Check for special elements
        if (chatPanel.querySelector('[class*="Context Snake"]') || chatPanel.textContent?.includes('Context Snake')) {
          messages.push('[Game Card: Context Snake]');
        }
        if (chatPanel.textContent?.includes('github.com/sarah')) {
          messages.push('[URL Input: github link]');
        }
        if (chatPanel.textContent?.includes('My First Chatbot')) {
          messages.push('[Project Preview: My First Chatbot]');
        }
        if (chatPanel.querySelectorAll('.grid img').length > 0) {
          messages.push('[Projects Grid]');
        }

        return messages.length > 0 ? messages : ['No messages visible'];
      });

      // Take a screenshot
      await page.screenshot({
        path: `test-results/scroll-${Math.round(progress * 100)}.png`,
        fullPage: false,
      });

      console.log(`\n--- Scroll ${Math.round(progress * 100)}% (${scrollY}px) ---`);
      console.log('LEFT (visible sections):', leftContent.join(', ') || 'none');
      console.log('RIGHT (chat content):', rightContent.slice(0, 5).join(' | '));
    }

    console.log('\n=== END DEBUG ===\n');
  });

  test('verify section thresholds match content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Explore AI together', { timeout: 10000 });

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const maxScroll = scrollHeight - viewportHeight;

    // Expected thresholds from the code:
    // hero: 0 - 0.28
    // learn: 0.28 - 0.55
    // share: 0.55 - 0.88
    // see: 0.88 - 1.0

    const tests = [
      { progress: 0.1, expectedLeft: 'Explore AI together', expectedRight: 'Scroll down' },
      { progress: 0.38, expectedLeft: 'Learn through games', expectedRight: 'context window' },
      { progress: 0.72, expectedLeft: 'Share your work in progress', expectedRight: 'chatbot' },
      { progress: 0.99, expectedLeft: 'See what others are creating', expectedRight: 'vector databases' },
    ];

    for (const { progress, expectedLeft, expectedRight } of tests) {
      const scrollY = Math.floor(maxScroll * progress);
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(1500); // Wait for animations (50ms + 300ms * ~3 messages)

      // Check left content
      const leftVisible = await page.evaluate((expected) => {
        const headings = document.querySelectorAll('h1, h2');
        for (const h of headings) {
          const rect = h.getBoundingClientRect();
          if (rect.top >= 0 && rect.top < window.innerHeight * 0.6) {
            if (h.textContent?.includes(expected)) {
              return { found: true, text: h.textContent };
            }
          }
        }
        // Return what we actually found
        for (const h of headings) {
          const rect = h.getBoundingClientRect();
          if (rect.top >= 0 && rect.top < window.innerHeight * 0.6) {
            return { found: false, text: h.textContent };
          }
        }
        return { found: false, text: 'none visible' };
      }, expectedLeft);

      // Check right content
      const rightVisible = await page.evaluate((expected) => {
        const chatPanel = document.querySelector('.glass-card');
        const text = chatPanel?.textContent || '';
        return {
          found: text.toLowerCase().includes(expected.toLowerCase()),
          hasContent: text.length > 100,
          snippet: text.slice(0, 200),
        };
      }, expectedRight);

      console.log(`\n--- Progress ${Math.round(progress * 100)}% ---`);
      console.log(`Expected LEFT: "${expectedLeft}" -> Found: ${leftVisible.found} (actual: "${leftVisible.text?.slice(0, 40)}")`);
      console.log(`Expected RIGHT: "${expectedRight}" -> Found: ${rightVisible.found}`);

      if (!leftVisible.found || !rightVisible.found) {
        console.log('MISMATCH DETECTED!');
        await page.screenshot({
          path: `test-results/mismatch-${Math.round(progress * 100)}.png`,
        });
      }
    }
  });

  test('measure left content scroll positions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('text=Explore AI together', { timeout: 10000 });

    // Get positions of all section headings relative to the document
    const sectionPositions = await page.evaluate(() => {
      const sections = [
        'Explore AI together',
        'Learn through games',
        'Share your work in progress',
        'See what others are creating',
      ];

      const positions: { section: string; top: number; progress: number }[] = [];
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const maxScroll = scrollHeight - viewportHeight;

      for (const text of sections) {
        const el = Array.from(document.querySelectorAll('h1, h2')).find(
          (h) => h.textContent?.includes(text)
        );
        if (el) {
          const rect = el.getBoundingClientRect();
          const absoluteTop = rect.top + window.scrollY;
          // Calculate what scroll progress would put this at top of viewport
          const scrollToShow = absoluteTop - viewportHeight * 0.3; // Account for where we want it
          const progress = scrollToShow / maxScroll;
          positions.push({
            section: text,
            top: absoluteTop,
            progress: Math.round(progress * 100) / 100,
          });
        }
      }

      return { positions, maxScroll, viewportHeight };
    });

    console.log('\n=== SECTION POSITIONS ===');
    console.log(`Max scroll: ${sectionPositions.maxScroll}px`);
    console.log(`Viewport: ${sectionPositions.viewportHeight}px`);
    console.log('\nTo show each section in viewport center:');
    for (const pos of sectionPositions.positions) {
      console.log(`  ${pos.section}: ~${pos.progress * 100}% scroll (absolute top: ${pos.top}px)`);
    }

    console.log('\nCurrent code thresholds:');
    console.log('  hero: 0 - 33%');
    console.log('  learn: 33% - 58%');
    console.log('  share: 58% - 83%');
    console.log('  see: 83% - 100%');
  });
});
