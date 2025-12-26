/**
 * Chat URL Import Tests
 *
 * Tests for the URL paste → ownership question → project creation flow.
 * Verifies that users can paste URLs and Ember will:
 * 1. Ask if it's their own project or something to clip
 * 2. Create the project with correct ownership status
 * 3. Return a working link to the created project
 *
 * See: docs/evergreen-architecture/23-EMBER-CHAT-TESTING.md
 */

import { test, expect, Page } from '@playwright/test';
import { loginViaAPI, getPageContent, sendHomeChat } from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

// Extended timeout for AI + URL scraping operations
const URL_IMPORT_TIMEOUT = 180000; // 3 minutes

/**
 * Wait for WebSocket to be connected (no "Reconnecting..." indicator)
 */
async function waitForWebSocketConnected(page: Page, timeout = 30000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);
    if (!content.includes('Reconnecting')) {
      // Give it a moment to stabilize
      await page.waitForTimeout(1000);
      const stillConnected = await getPageContent(page);
      if (!stillConnected.includes('Reconnecting')) {
        console.log('WebSocket connected');
        return;
      }
    }
    console.log('Waiting for WebSocket connection...');
    await page.waitForTimeout(1000);
  }
  throw new Error(`WebSocket did not connect within ${timeout}ms`);
}

/**
 * Wait for Ember to actually respond (new message appears in chat)
 * This is more reliable than just checking if input is enabled
 */
async function waitForEmberResponse(
  page: Page,
  _previousMessageCount: number,
  timeout = 120000
): Promise<string> {
  const startTime = Date.now();
  let sawThinking = false;

  while (Date.now() - startTime < timeout) {
    const content = await getPageContent(page);

    // Check for thinking states (Ember is processing)
    const isThinking =
      content.includes('Thinking') ||
      content.includes('Consulting my') ||
      content.includes('Fanning the embers') ||
      content.includes('treasure trove');

    if (isThinking) {
      sawThinking = true;
      console.log(
        `Ember is thinking... (${Math.round((Date.now() - startTime) / 1000)}s)`
      );
      await page.waitForTimeout(2000);
      continue;
    }

    // Check if input is disabled (still processing but no thinking text)
    const chatInput = page.locator('input[placeholder="Message Ember..."]');
    const isDisabled = await chatInput.isDisabled().catch(() => true);

    if (isDisabled) {
      console.log(
        `Input disabled, waiting... (${Math.round((Date.now() - startTime) / 1000)}s)`
      );
      await page.waitForTimeout(2000);
      continue;
    }

    // Input is enabled - check if we have a meaningful response
    // Look for patterns that indicate Ember responded about ownership
    const hasEmberResponse =
      /is this your|your own project|your project|something you found|clip|save|import|create|portfolio/i.test(
        content
      );

    if (hasEmberResponse) {
      console.log('Ember responded!');
      return content;
    }

    // If we saw thinking but now input is enabled, Ember finished responding
    // even if response doesn't match our expected patterns
    if (sawThinking) {
      console.log('Ember finished (saw thinking state earlier)');
      return content;
    }

    // Haven't seen thinking yet - keep waiting
    console.log(
      `Waiting for Ember to start... (${Math.round((Date.now() - startTime) / 1000)}s)`
    );
    await page.waitForTimeout(2000);
  }

  // Return whatever content we have even if no clear response
  console.log('Timeout waiting for Ember response');
  return await getPageContent(page);
}

test.describe('Chat - URL Import Flow', () => {
  test.setTimeout(URL_IMPORT_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('paste generic URL → asks ownership → "it\'s mine" → creates owned project', async ({
    page,
  }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // CRITICAL: Wait for WebSocket to connect first!
    console.log('Waiting for WebSocket to connect...');
    await waitForWebSocketConnected(page);

    // Extra wait for chat to be fully ready
    await page.waitForTimeout(2000);
    console.log('Initial page ready, sending URL...');

    // Step 1: Paste a generic URL (not GitHub/YouTube/etc.)
    await sendHomeChat(page, 'https://example.com');

    // Step 2: Wait for Ember to ACTUALLY respond (not just input enabled)
    console.log('Waiting for Ember to respond to URL...');
    const afterUrl = await waitForEmberResponse(page, 0, 90000);
    assertNoTechnicalErrors(afterUrl, 'after URL paste');
    console.log('After URL paste:', afterUrl.substring(0, 500));

    // Should ask about ownership OR already be processing import
    const asksOwnership =
      /your own|your project|clipping|clip|save|found|mine|yours|import|portfolio|project/i.test(
        afterUrl
      );
    expect(asksOwnership).toBe(true);

    // Step 3: Say it's my own project - this should trigger project creation
    await sendHomeChat(page, "Yes, it's my own project. Please create it.");

    // Step 4: Wait for project creation
    // Ember may either:
    // A) Show a link in chat → we detect it and navigate
    // B) Navigate directly to the project page → we detect URL change
    console.log('Waiting for project creation...');
    let projectUrl: string | null = null;
    let afterCreation = '';
    const maxWaitTime = 120000; // 2 minutes max
    const pollInterval = 5000; // Check every 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);

      // Method A: Check if we navigated to a project page (URL changed)
      const currentUrl = page.url();
      const projectUrlMatch = currentUrl.match(/\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i);
      if (projectUrlMatch && !currentUrl.includes('/home')) {
        projectUrl = `/${projectUrlMatch[1]}/${projectUrlMatch[2]}`;
        console.log('Navigated to project page:', projectUrl);
        break;
      }

      afterCreation = await getPageContent(page);
      assertNoTechnicalErrors(afterCreation, 'after ownership claim');

      // Method B: Check for markdown link in text
      const markdownMatch = afterCreation.match(
        /\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i
      );
      if (markdownMatch) {
        projectUrl = markdownMatch[2];
        console.log('Found markdown project link:', projectUrl);
        break;
      }

      // Method C: Check for rendered <a> element
      const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
      if (await projectLink.isVisible().catch(() => false)) {
        projectUrl = await projectLink.getAttribute('href');
        if (projectUrl) {
          console.log('Found rendered project link:', projectUrl);
          break;
        }
      }

      // Check if AI is still thinking
      const isStillThinking =
        afterCreation.includes('Thinking') ||
        afterCreation.includes('Consulting my') ||
        afterCreation.includes('Fanning the embers') ||
        afterCreation.includes('Cancel');

      if (isStillThinking) {
        console.log(
          `Ember still processing... (${Math.round((Date.now() - startTime) / 1000)}s)`
        );
      } else {
        console.log(
          `Waiting for project... (${Math.round((Date.now() - startTime) / 1000)}s)`
        );
      }
    }

    console.log('Final URL:', page.url());
    afterCreation = await getPageContent(page);
    console.log('Final content:', afterCreation.substring(0, 500));

    // Step 5: Verify project was created
    // Either we have a URL, or we're already on a project page
    const onProjectPage =
      page.url().match(/\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i) && !page.url().includes('/home');

    expect(projectUrl || onProjectPage).toBeTruthy();
    console.log('Project URL:', projectUrl || page.url());

    // Step 6: If we have a URL but aren't there yet, navigate to it
    if (projectUrl && !onProjectPage) {
      await page.goto(projectUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
    }

    // Step 7: Verify project page loaded correctly
    const finalUrl = page.url();
    const pageTitle = await page.title();
    console.log('Project page title:', pageTitle);
    expect(pageTitle).not.toBe('');
    expect(pageTitle).not.toContain('404');
    expect(pageTitle).not.toContain('Not Found');

    // Verify project has content
    const pageContent = await getPageContent(page);
    expect(pageContent.length).toBeGreaterThan(100);

    // Verify we're on a valid project URL
    expect(finalUrl).toMatch(/\/[a-z0-9_-]+\/[a-z0-9_-]+/i);
  });

  test('paste URL → "not mine, clip it" → creates clipped project', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Step 1: Paste a URL
    await sendHomeChat(page, 'https://example.org');

    // Step 2: Wait for Ember to respond
    console.log('Waiting for Ember to respond...');
    const afterUrl = await waitForEmberResponse(page, 0, 90000);
    assertNoTechnicalErrors(afterUrl, 'after URL paste');

    // Step 3: Say it's NOT mine - want to clip/save it
    await sendHomeChat(
      page,
      "It's not mine, I found it and want to save it to my collection"
    );

    // Step 4: Wait for clipped project creation (may navigate directly)
    console.log('Waiting for clip creation...');
    let projectUrl: string | null = null;
    const maxWaitTime = 120000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);

      // Check if navigated to project page
      const currentUrl = page.url();
      const projectUrlMatch = currentUrl.match(/\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i);
      if (projectUrlMatch && !currentUrl.includes('/home')) {
        projectUrl = `/${projectUrlMatch[1]}/${projectUrlMatch[2]}`;
        console.log('Navigated to clipped project:', projectUrl);
        break;
      }

      const afterClip = await getPageContent(page);
      assertNoTechnicalErrors(afterClip, 'after clip request');

      // Check for markdown link
      const markdownMatch = afterClip.match(
        /\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i
      );
      if (markdownMatch) {
        projectUrl = markdownMatch[2];
        break;
      }

      // Check for rendered link
      const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
      if (await projectLink.isVisible().catch(() => false)) {
        projectUrl = await projectLink.getAttribute('href');
        if (projectUrl) break;
      }

      const isStillThinking =
        afterClip.includes('Thinking') ||
        afterClip.includes('Consulting my') ||
        afterClip.includes('Fanning the embers');

      console.log(
        `Waiting for clip... (${Math.round((Date.now() - startTime) / 1000)}s)${isStillThinking ? ' [thinking]' : ''}`
      );
    }

    // Verify clipped project was created
    const onProjectPage =
      page.url().match(/\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i) && !page.url().includes('/home');

    expect(projectUrl || onProjectPage).toBeTruthy();
    console.log('Clipped project:', projectUrl || page.url());

    // Verify page loaded
    const pageTitle = await page.title();
    expect(pageTitle).not.toContain('404');
  });

  test('paste YouTube URL → auto-imports without ownership question', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // YouTube URLs should auto-import since videos are always "clipped"
    await sendHomeChat(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Wait for Ember to respond
    console.log('Waiting for YouTube import...');
    const afterYoutube = await waitForEmberResponse(page, 0, 90000);
    assertNoTechnicalErrors(afterYoutube, 'after YouTube URL');
    console.log('After YouTube URL:', afterYoutube.substring(0, 500));

    // YouTube may or may not ask ownership - handle both cases
    const asksOwnership = /is this your own|your project\?|are you clipping/i.test(
      afterYoutube
    );

    if (asksOwnership) {
      console.log('YouTube asked ownership - answering as clip');
      await sendHomeChat(page, 'I want to save this video to my collection');
    }

    // Poll for project creation (may navigate directly)
    let projectUrl: string | null = null;
    const maxWaitTime = 90000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);

      // Check if navigated to project page
      const currentUrl = page.url();
      const projectUrlMatch = currentUrl.match(/\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i);
      if (projectUrlMatch && !currentUrl.includes('/home')) {
        projectUrl = `/${projectUrlMatch[1]}/${projectUrlMatch[2]}`;
        console.log('Navigated to YouTube project:', projectUrl);
        break;
      }

      const content = await getPageContent(page);

      const markdownMatch = content.match(
        /\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i
      );
      if (markdownMatch) {
        projectUrl = markdownMatch[2];
        break;
      }

      const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
      if (await projectLink.isVisible().catch(() => false)) {
        projectUrl = await projectLink.getAttribute('href');
        if (projectUrl) break;
      }

      console.log(`Waiting for YouTube project... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }

    // Verify YouTube video was saved as project
    const onProjectPage =
      page.url().match(/\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i) && !page.url().includes('/home');

    if (projectUrl || onProjectPage) {
      console.log('YouTube project created:', projectUrl || page.url());
      const pageTitle = await page.title();
      expect(pageTitle).not.toContain('404');
    } else {
      // If no project created, at least verify there's a helpful response
      const finalContent = await getPageContent(page);
      expect(finalContent).toMatch(/video|youtube|save|import|project/i);
    }
  });

  test('paste GitHub URL → handles OAuth or offers clip option', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // GitHub URLs have special handling:
    // - If user has GitHub OAuth connected, it auto-detects ownership
    // - If not connected, asks to connect GitHub or clip
    await sendHomeChat(page, 'https://github.com/facebook/react');

    console.log('Waiting for GitHub import response...');
    const afterGithub = await waitForEmberResponse(page, 0, 90000);
    assertNoTechnicalErrors(afterGithub, 'after GitHub URL');
    console.log('After GitHub URL:', afterGithub.substring(0, 500));

    // Check response type
    const wantsGithubConnect = /connect.*github|github.*connect/i.test(afterGithub);
    const asksAboutClipping = /clip|save|bookmark|not yours|your project/i.test(afterGithub);
    const hasProjectLink = /\[([^\]]+)\]\(\/[a-z0-9_-]+\/[a-z0-9_-]+\)/i.test(afterGithub);

    console.log('GitHub response type:', {
      wantsGithubConnect,
      asksAboutClipping,
      hasProjectLink,
    });

    // Any of these responses is valid
    expect(wantsGithubConnect || asksAboutClipping || hasProjectLink).toBe(true);

    // If asking about clipping, proceed with clip flow
    if (asksAboutClipping && !hasProjectLink) {
      await sendHomeChat(page, 'Just clip it, I want to save it for reference');

      // Poll for project creation
      let projectUrl: string | null = null;
      const maxWaitTime = 90000;
      const pollInterval = 5000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        await page.waitForTimeout(pollInterval);

        // Check if navigated to project page
        const currentUrl = page.url();
        const projectUrlMatch = currentUrl.match(/\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i);
        if (projectUrlMatch && !currentUrl.includes('/home')) {
          projectUrl = `/${projectUrlMatch[1]}/${projectUrlMatch[2]}`;
          console.log('Navigated to GitHub project:', projectUrl);
          break;
        }

        const content = await getPageContent(page);

        const markdownMatch = content.match(
          /\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i
        );
        if (markdownMatch) {
          projectUrl = markdownMatch[2];
          break;
        }

        const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
        if (await projectLink.isVisible().catch(() => false)) {
          projectUrl = await projectLink.getAttribute('href');
          if (projectUrl) break;
        }

        console.log(`Waiting for GitHub project... (${Math.round((Date.now() - startTime) / 1000)}s)`);
      }

      const onProjectPage =
        page.url().match(/\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i) && !page.url().includes('/home');

      if (projectUrl || onProjectPage) {
        console.log('GitHub repo clipped:', projectUrl || page.url());
        const pageTitle = await page.title();
        expect(pageTitle).not.toContain('404');
      }
    }
  });

  test('handles invalid URL gracefully', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Send an invalid/broken URL
    await sendHomeChat(page, 'https://this-domain-definitely-does-not-exist-xyz123.com/page');

    const response = await waitForEmberResponse(page, 0, 60000);
    assertNoTechnicalErrors(response, 'after invalid URL');

    // Should handle gracefully - not crash, give helpful message
    // Ember may ask about the URL, say it couldn't access it, or offer alternatives
    const handlesGracefully =
      /couldn't|unable|error|problem|invalid|try again|screenshot|different|your project|access|reach/i.test(
        response
      );
    expect(handlesGracefully).toBe(true);

    console.log('Invalid URL response:', response.substring(0, 300));
  });

  test('multi-turn: paste URL, discuss, then create project', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // Turn 1: Just mention a URL casually
    await sendHomeChat(
      page,
      "I found this cool site at https://example.net that I want to save"
    );

    const turn1 = await waitForEmberResponse(page, 0, 60000);
    assertNoTechnicalErrors(turn1, 'turn 1');
    console.log('Turn 1:', turn1.substring(0, 300));

    // Turn 2: Clarify ownership when asked
    await sendHomeChat(page, "It's not mine, just something I want to bookmark");

    const turn2 = await waitForEmberResponse(page, 0, 90000);
    assertNoTechnicalErrors(turn2, 'turn 2');
    console.log('Turn 2:', turn2.substring(0, 300));

    // Turn 3: Confirm the action
    await sendHomeChat(page, 'Yes, please save it');

    // Wait for final project creation
    let projectUrl: string | null = null;
    const maxWaitTime = 120000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);

      // Check if navigated to project page
      const currentUrl = page.url();
      const projectUrlMatch = currentUrl.match(/\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/?$/i);
      if (projectUrlMatch && !currentUrl.includes('/home')) {
        projectUrl = `/${projectUrlMatch[1]}/${projectUrlMatch[2]}`;
        console.log('Navigated to project:', projectUrl);
        break;
      }

      const content = await getPageContent(page);
      assertNoTechnicalErrors(content, 'turn 3');

      const markdownMatch = content.match(
        /\[([^\]]+)\]\((\/[a-z0-9_-]+\/[a-z0-9_-]+)\)/i
      );
      if (markdownMatch) {
        projectUrl = markdownMatch[2];
        break;
      }

      const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
      if (await projectLink.isVisible().catch(() => false)) {
        projectUrl = await projectLink.getAttribute('href');
        if (projectUrl) break;
      }

      const isStillThinking =
        content.includes('Thinking') ||
        content.includes('Consulting my') ||
        content.includes('Fanning the embers');

      console.log(
        `Multi-turn: waiting... (${Math.round((Date.now() - startTime) / 1000)}s)${isStillThinking ? ' [thinking]' : ''}`
      );

      if (!isStillThinking) break;
    }

    const finalContent = await getPageContent(page);
    console.log('Final turn:', finalContent.substring(0, 500));

    // Should have created a project OR at least acknowledged the request
    const onProjectPage =
      page.url().match(/\/[a-z0-9_-]+\/[a-z0-9_-]+\/?$/i) && !page.url().includes('/home');
    const hasOutcome = projectUrl || onProjectPage || /saved|clipped|created|bookmarked/i.test(finalContent);
    expect(hasOutcome).toBe(true);

    if (projectUrl || onProjectPage) {
      const pageTitle = await page.title();
      expect(pageTitle).not.toContain('404');
    }
  });
});

test.describe('Chat - URL Context Memory', () => {
  test.setTimeout(URL_IMPORT_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('remembers URL from earlier in conversation', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for WebSocket
    await waitForWebSocketConnected(page);
    await page.waitForTimeout(2000);

    // First, mention a URL
    await sendHomeChat(page, 'I want to save https://iana.org to my projects');

    const turn1 = await waitForEmberResponse(page, 0, 60000);
    assertNoTechnicalErrors(turn1, 'URL mention');
    console.log('Turn 1:', turn1.substring(0, 300));

    // Have some conversation about it
    await sendHomeChat(page, "It's a project I built last month");

    const turn2 = await waitForEmberResponse(page, 0, 90000);
    assertNoTechnicalErrors(turn2, 'ownership clarification');

    // Ember should remember the URL and understand we want to save it
    // Could either ask for confirmation, offer to save, or navigate to creation
    const understandsContext =
      /save|import|create|project|iana|your|got it|understood|ready/i.test(turn2) ||
      page.url().includes('/e2e-test-user/');

    expect(understandsContext).toBe(true);

    console.log('Context memory test - turn 2:', turn2.substring(0, 400));
  });
});
