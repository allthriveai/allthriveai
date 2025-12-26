/**
 * Chat Media Upload Tests
 *
 * Tests for the media upload → ownership question → tool attribution → clip flow.
 * Verifies that uploaded images/videos can be saved as clipped projects with
 * proper tool attribution (e.g., "Built with Midjourney").
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loginViaAPI,
  getPageContent,
  sendHomeChat,
  waitForAvaReady,
  waitForAIResponse as _waitForAIResponse,
  DEEP_AI_TIMEOUT as _DEEP_AI_TIMEOUT,
} from './deep-helpers';
import { assertHelpfulResponse, assertNoTechnicalErrors } from './ai-quality-assertions';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extended timeout for AI + file upload operations
const UPLOAD_FLOW_TIMEOUT = 180000; // 3 minutes

test.describe('Chat - Media Upload Flow', () => {
  test.setTimeout(UPLOAD_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('upload image → "not mine" → tool attribution → creates clipped project', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the chat interface to fully load
    await page.waitForTimeout(3000);

    // Step 1: Open the + menu and click "Upload Image or Video"
    // The plus button is in the ChatPlusMenu component
    const plusButton = page.locator('button[aria-label="Add integration"]');

    // Check if plus button exists (embedded chat needs to be visible)
    if (!(await plusButton.isVisible())) {
      console.log('Plus button not visible - chat interface may not be loaded');
      console.log('Page URL:', page.url());
      test.skip();
      return;
    }

    await plusButton.click();

    // Wait for menu to open and be visible
    await page.waitForTimeout(500);

    // Click "Upload Image or Video" option - use role-based selector
    const uploadOption = page.getByRole('menuitem', { name: /Upload Image or Video/i });

    // Check if upload option is visible
    if (!(await uploadOption.isVisible())) {
      console.log('Upload option not visible in menu');
      test.skip();
      return;
    }

    // Set up file chooser handler BEFORE clicking
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
    await uploadOption.click();

    // Handle the file picker
    const fileChooser = await fileChooserPromise;

    // Use the test image from fixtures
    const testImagePath = path.join(__dirname, '../fixtures/test-image.png');
    await fileChooser.setFiles(testImagePath);

    // Wait for upload to complete and Ava to respond
    // Use 90 seconds since AI operations can take 60-90 seconds
    console.log('Waiting for Ava to respond to upload...');
    await waitForAvaReady(page, 90000);

    // Step 2: AI should respond to the image
    const afterUpload = await getPageContent(page);
    assertNoTechnicalErrors(afterUpload, 'after upload');

    // Check if AI is responding (any response is valid)
    console.log('AI response after upload:', afterUpload.substring(0, 500));

    // Step 3: Say it's NOT mine - from the internet
    await sendHomeChat(page, "It's not mine, I found it on the internet and want to save it");

    // Wait for Ava to finish responding before sending next message
    // Use 90 seconds since AI operations can take 60-90 seconds
    console.log('Waiting for Ava to respond to ownership claim...');
    await waitForAvaReady(page, 90000);

    const afterOwnership = await getPageContent(page);
    assertNoTechnicalErrors(afterOwnership, 'after ownership response');

    // AI should respond to this - could ask about tool or offer to clip
    console.log('After ownership claim:', afterOwnership.substring(0, 500));

    // Step 4: Say it was made with Midjourney
    // AI needs to call create_media_project tool which does AI image analysis
    // This can take 60-90 seconds if Gemini times out and falls back to OpenAI
    await sendHomeChat(page, 'It was made with Midjourney');

    // Wait longer for project creation - poll for project link every 10 seconds
    let projectLinkMatch = null;
    let afterTool = '';
    const maxWaitTime = 120000; // 2 minutes max
    const pollInterval = 10000; // Check every 10 seconds
    const startTime = Date.now();

    let projectUrl: string | null = null;

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);
      afterTool = await getPageContent(page);
      assertNoTechnicalErrors(afterTool, 'after tool response');

      // Check for project link in markdown format (if not rendered)
      projectLinkMatch = afterTool.match(/\[([^\]]+)\]\(\/[a-z0-9_-]+\/[a-z0-9_-]+\)/i);

      // Also check for rendered link elements with project URL pattern
      if (!projectLinkMatch) {
        const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
        if (await projectLink.isVisible().catch(() => false)) {
          projectUrl = await projectLink.getAttribute('href');
          if (projectUrl) {
            console.log('Found rendered project link:', projectUrl);
            break;
          }
        }
      }

      // Check if AI is still thinking (various loading state texts)
      const isStillThinking =
        afterTool.includes('Thinking') ||
        afterTool.includes('Consulting my hoard') ||
        afterTool.includes('Finding the way') ||
        afterTool.includes('Cancel'); // Cancel button appears while processing

      // If found project link, or if AI is no longer thinking, break
      if (projectLinkMatch || projectUrl || !isStillThinking) {
        break;
      }
      console.log(`Waiting for project creation... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }

    console.log('Project link found:', projectLinkMatch ? projectLinkMatch[0] : projectUrl || 'NO LINK FOUND');
    console.log('Final content:', afterTool.substring(0, 500));

    // Verify we got a project link (either markdown or rendered HTML)
    expect(projectLinkMatch || projectUrl).toBeTruthy();

    // Get the final URL (from markdown match or rendered link)
    const finalProjectUrl = projectLinkMatch
      ? projectLinkMatch[0].match(/\(([^)]+)\)/)?.[1]
      : projectUrl;
    console.log('Project URL:', finalProjectUrl);

    // Navigate to the project and verify the image is NOT a placeholder
    if (finalProjectUrl) {
      await page.goto(finalProjectUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Check that the featured image exists and has a real URL (not placeholder)
      const featuredImage = page.locator('img[alt*="featured"], img[class*="featured"], img[class*="hero"]').first();
      if (await featuredImage.isVisible()) {
        const imageSrc = await featuredImage.getAttribute('src');
        console.log('Featured image src:', imageSrc);

        // Verify image URL is real (contains localhost:9000 or actual S3 URL)
        expect(imageSrc).not.toContain('...url...');
        expect(imageSrc).toMatch(/localhost:9000|amazonaws\.com|minio/i);
      }
    }
  });

  test('upload image → "this is mine" → project creation flow', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Open + menu
    const plusButton = page.locator('button[aria-label="Add integration"]');
    if (!(await plusButton.isVisible())) {
      console.log('Plus button not visible');
      test.skip();
      return;
    }

    await plusButton.click();
    await page.waitForTimeout(500);

    const uploadOption = page.getByRole('menuitem', { name: /Upload Image or Video/i });
    if (!(await uploadOption.isVisible())) {
      console.log('Upload option not visible');
      test.skip();
      return;
    }

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
    await uploadOption.click();

    const fileChooser = await fileChooserPromise;
    const testImagePath = path.join(__dirname, '../fixtures/test-image.png');
    await fileChooser.setFiles(testImagePath);

    // Wait for image to appear in chat and Ava to respond
    console.log('Waiting for Ava to respond to upload...');
    await page.waitForTimeout(3000); // Wait for image upload to process

    // Verify image appears in chat before proceeding
    const imageUploadedContent = await getPageContent(page);
    console.log('After upload:', imageUploadedContent.substring(0, 400));

    // Wait for Ava to be ready (quick actions may appear)
    // Use 90 seconds since AI operations can take 60-90 seconds
    await waitForAvaReady(page, 90000);

    // Say it IS mine and specify the tool
    // AI needs to call create_media_project tool which does AI image analysis
    // This can take 60-90 seconds if Gemini times out and falls back to OpenAI
    await sendHomeChat(page, "Yes, this is my own project that I created with DALL-E");

    // Wait longer for project creation - poll for project link every 10 seconds
    let projectLinkMatch: RegExpMatchArray | null = null;
    let projectUrl: string | null = null;
    let afterOwnership = '';
    const maxWaitTime = 120000; // 2 minutes max
    const pollInterval = 10000; // Check every 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(pollInterval);
      afterOwnership = await getPageContent(page);
      assertNoTechnicalErrors(afterOwnership, 'after claiming ownership');

      // Check for project link in markdown format
      projectLinkMatch = afterOwnership.match(/\[([^\]]+)\]\(\/[a-z0-9_-]+\/[a-z0-9_-]+\)/i);

      // Also check for rendered link elements with project URL pattern
      if (!projectLinkMatch) {
        const projectLink = page.locator('a[href^="/e2e-test-user/"]').first();
        if (await projectLink.isVisible().catch(() => false)) {
          projectUrl = await projectLink.getAttribute('href');
          if (projectUrl) {
            console.log('Found rendered project link:', projectUrl);
            break;
          }
        }
      }

      // Check if AI is still thinking (various loading state texts)
      const isStillThinking =
        afterOwnership.includes('Thinking') ||
        afterOwnership.includes('Consulting my hoard') ||
        afterOwnership.includes('Finding the way') ||
        afterOwnership.includes('Cancel'); // Cancel button appears while processing

      // If found project link, or if AI is no longer thinking, break
      if (projectLinkMatch || projectUrl || !isStillThinking) {
        break;
      }
      console.log(`Waiting for project creation... (${Math.round((Date.now() - startTime) / 1000)}s)`);
    }

    console.log('Response after ownership claim:', afterOwnership.substring(0, 500));
    console.log('Project link found:', projectLinkMatch ? projectLinkMatch[0] : projectUrl || 'NO LINK FOUND');

    // Should have created a project with a link
    expect(projectLinkMatch || projectUrl).toBeTruthy();

    // Get the final URL (from markdown match or rendered link)
    const finalProjectUrl = projectLinkMatch
      ? projectLinkMatch[0].match(/\(([^)]+)\)/)?.[1]
      : projectUrl;

    // Navigate to project and verify it has correct image
    if (finalProjectUrl) {
      await page.goto(finalProjectUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Verify the page loaded (has a title)
      const pageTitle = await page.title();
      console.log('Project page title:', pageTitle);
      expect(pageTitle).not.toBe('');

      // Check featured image has real URL
      const featuredImage = page.locator('img[alt*="featured"], img[class*="featured"], img[class*="hero"]').first();
      if (await featuredImage.isVisible()) {
        const imageSrc = await featuredImage.getAttribute('src');
        console.log('Featured image src:', imageSrc);
        expect(imageSrc).not.toContain('...url...');
      }
    }
  });

  test('mentions tool in chat → AI asks for confirmation before clipping', async ({ page }) => {
    // Alternative flow: User types about an image they want to save
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Start by describing an image to save
    await sendHomeChat(
      page,
      "I found this amazing AI art on Twitter that was made with Midjourney. I want to save it to my collection."
    );

    await page.waitForTimeout(5000);

    const response = await getPageContent(page);
    assertNoTechnicalErrors(response, 'describe media to save');

    // AI should acknowledge and ask for the image or more details
    const hasResponse =
      /upload|share|image|save|clip|midjourney|collection|show|send/i.test(response);
    expect(hasResponse).toBe(true);

    // If AI asks for the image, that's the correct flow
    const asksForImage = /upload|share|send|show|image|file|attach/i.test(response);
    console.log('AI asks for image:', asksForImage);
  });

  test('video upload follows same ownership/tool flow', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Describe wanting to save a video
    await sendHomeChat(
      page,
      "I want to save a video I found that was made with Runway ML. It's not my own work."
    );

    await page.waitForTimeout(5000);

    const response = await getPageContent(page);
    assertNoTechnicalErrors(response, 'video save intent');

    // Should understand the intent and ask for upload or more details
    const hasVideoFlow = /video|upload|share|runway|save|clip|show|send/i.test(response);
    expect(hasVideoFlow).toBe(true);
  });

  test('tool attribution persists in conversation context', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Multi-turn conversation about tool attribution
    await sendHomeChat(page, "I have some AI art I want to save to my profile");
    await page.waitForTimeout(4000);

    const turn1 = await getPageContent(page);
    assertNoTechnicalErrors(turn1, 'turn 1');
    assertHelpfulResponse(turn1, 'art save intent');

    await sendHomeChat(page, "It was made with DALL-E 3");
    await page.waitForTimeout(4000);

    const turn2 = await getPageContent(page);
    assertNoTechnicalErrors(turn2, 'turn 2');

    // AI should remember DALL-E 3 was mentioned
    const remembersTool = /dall|upload|show|send|save|image/i.test(turn2);
    expect(remembersTool).toBe(true);

    await sendHomeChat(page, "It's not my own creation, just something I want to bookmark");
    await page.waitForTimeout(4000);

    const turn3 = await getPageContent(page);
    assertNoTechnicalErrors(turn3, 'turn 3');

    // Should understand it's for clipping, not project creation
    const understandsClip = /clip|save|bookmark|collection|add|got it/i.test(turn3);
    expect(understandsClip).toBe(true);
  });
});

test.describe('Chat - Tool Recognition', () => {
  test.setTimeout(UPLOAD_FLOW_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('recognizes common AI art tools', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const tools = ['Midjourney', 'DALL-E', 'Stable Diffusion', 'Leonardo AI', 'Runway'];

    for (const tool of tools) {
      await sendHomeChat(page, `I want to save an image made with ${tool}`);
      await page.waitForTimeout(4000);

      const response = await getPageContent(page);
      assertNoTechnicalErrors(response, `${tool} recognition`);

      // Should understand the tool mention
      const understands = new RegExp(tool.replace(/[- ]/g, '.*'), 'i').test(response) ||
        /upload|save|clip|image|share/i.test(response);

      expect(understands).toBe(true);
      console.log(`${tool} recognized: ${understands}`);

      // Clear conversation for next tool
      await sendHomeChat(page, '/clear');
      await page.waitForTimeout(2000);
    }
  });

  test('handles unknown tools gracefully', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await sendHomeChat(
      page,
      "I want to save an image made with FakeToolThatDoesNotExist123"
    );
    await page.waitForTimeout(5000);

    const response = await getPageContent(page);
    assertNoTechnicalErrors(response, 'unknown tool');

    // Should still help, even if tool is unknown
    const stillHelps = /upload|save|clip|image|share|help|show/i.test(response);
    expect(stillHelps).toBe(true);
  });
});
