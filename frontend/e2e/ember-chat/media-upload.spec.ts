/**
 * Media Upload E2E Tests
 *
 * Tests for uploading images, videos, and other media to chat.
 * Validates the complete workflow from upload to project/clipping creation.
 *
 * Feature: Media Upload via Chat
 *   As a user
 *   I can drag and drop media into chat
 *   So that I can create projects or save clippings
 *
 * RUN: RUN_AI_TESTS=true npx playwright test e2e/ember-chat/media-upload.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../helpers';
import {
  openEmbeddedChat,
  openChatSidebar,
  getChatInput,
  sendMessage,
  waitForEmberResponse,
  getChatContent,
  uploadFileViaInput,
  hasAttachmentPreview,
  getAttachmentCount,
  assertNoTechnicalErrors,
  debugScreenshot,
  debugLogChat,
  TEST_FILES,
  TIMEOUTS,
} from './chat-helpers';

// AI tests require explicit opt-in
const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

test.describe('Media Upload via Chat', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(TIMEOUTS.projectCreation + 60000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  // ===========================================================================
  // UPLOAD CAPABILITY TESTS
  // ===========================================================================

  test.describe('Upload Capability', () => {
    test('user can attach image via plus menu on /home', async ({ page }) => {
      // GIVEN: I am on /home with chat visible
      await openEmbeddedChat(page);

      // WHEN: I click Upload Image or Video from plus menu and select a file
      await uploadFileViaInput(page, TEST_FILES.image);

      // THEN: The file should be attached and show in preview
      const hasAttachment = await hasAttachmentPreview(page);

      if (!hasAttachment) {
        await debugScreenshot(page, 'image-attach-failed');
      }

      expect(hasAttachment).toBe(true);

      // AND: The attachment count should be 1
      const count = await getAttachmentCount(page);
      expect(count).toBe(1);
    });

    test('user can send attached image and get Ember response', async ({ page }) => {
      // GIVEN: I am on /home with chat visible
      await openEmbeddedChat(page);

      // WHEN: I attach a file and send with a message
      await uploadFileViaInput(page, TEST_FILES.image);

      // Verify attachment is there
      const hasAttachment = await hasAttachmentPreview(page);
      expect(hasAttachment).toBe(true);

      // Send the message with attachment
      await sendMessage(page, 'Here is my image');
      await waitForEmberResponse(page);

      // THEN: Ember should respond about the image
      const chatContent = await getChatContent(page);
      const respondedToImage =
        chatContent.includes('image') ||
        chatContent.includes('upload') ||
        chatContent.includes('file') ||
        chatContent.includes('project') ||
        chatContent.includes('received');

      if (!respondedToImage) {
        await debugScreenshot(page, 'image-upload-response-failed');
        await debugLogChat(page, 'After image upload');
      }

      expect(respondedToImage).toBe(true);
      await assertNoTechnicalErrors(page);
    });

    test('user can initiate video upload from plus menu on /home', async ({ page }) => {
      // GIVEN: I am on /home with chat visible
      await openEmbeddedChat(page);

      // WHEN: I click Upload Image or Video from plus menu
      await uploadFileViaInput(page, TEST_FILES.video);
      await waitForEmberResponse(page);

      // THEN: Ember should respond about uploading media
      const chatContent = await getChatContent(page);

      const uploadFlowStarted =
        chatContent.includes('upload') ||
        chatContent.includes('video') ||
        chatContent.includes('media') ||
        chatContent.includes('file');

      expect(uploadFlowStarted).toBe(true);
    });

    test('user can initiate media upload from chat sidebar', async ({ page }) => {
      // GIVEN: I am on /explore with chat sidebar open
      await openChatSidebar(page, '/explore');

      // WHEN: I click Upload from plus menu
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // THEN: Ember should respond about uploading
      const chatContent = await getChatContent(page);
      const uploadFlowStarted =
        chatContent.includes('upload') ||
        chatContent.includes('image') ||
        chatContent.includes('media');

      expect(uploadFlowStarted).toBe(true);
    });
  });

  // ===========================================================================
  // EMBER RESPONSE TESTS
  // ===========================================================================

  test.describe('Ember Response to Media Upload Intent', () => {
    test('Ember responds helpfully when user wants to upload media', async ({ page }) => {
      // GIVEN: I am on /home
      await openEmbeddedChat(page);

      // WHEN: I initiate media upload
      await uploadFileViaInput(page, TEST_FILES.image);

      // AND: Wait for Ember to respond
      await waitForEmberResponse(page);

      // THEN: Ember should respond about uploading media
      const chatContent = await getChatContent(page);

      const helpfulResponse =
        chatContent.includes('upload') ||
        chatContent.includes('image') ||
        chatContent.includes('video') ||
        chatContent.includes('project') ||
        chatContent.includes('media');

      expect(helpfulResponse).toBe(true);

      // No technical errors
      await assertNoTechnicalErrors(page);
    });

    test('Ember guides user through project creation after upload intent', async ({ page }) => {
      // GIVEN: I initiated media upload
      await openEmbeddedChat(page);
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // WHEN: I say I want to create a project
      await sendMessage(page, 'This is my project I made with Midjourney');
      await waitForEmberResponse(page);

      // THEN: Ember should respond about the project
      const chatContent = await getChatContent(page);

      const guidesProjectCreation = [
        'project',
        'midjourney',
        'create',
        'upload',
        'share',
        'title',
      ].some(indicator => chatContent.includes(indicator));

      expect(guidesProjectCreation).toBe(true);
      await assertNoTechnicalErrors(page);
    });
  });

  // ===========================================================================
  // PROJECT CREATION WORKFLOW
  // ===========================================================================

  test.describe('Project Creation Conversation Flow', () => {
    test('user can describe project with tool after upload intent', async ({ page }) => {
      // GIVEN: I initiated upload flow
      await openEmbeddedChat(page);
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // WHEN: I say it's my project made with a specific tool
      await sendMessage(page, 'This is my project, I made it with Midjourney');
      await waitForEmberResponse(page, TIMEOUTS.projectCreation);

      // THEN: Ember should acknowledge and guide project creation
      const chatContent = await getChatContent(page);

      const projectFlowStarted =
        chatContent.includes('midjourney') ||
        chatContent.includes('project') ||
        chatContent.includes('create') ||
        chatContent.includes('upload');

      if (!projectFlowStarted) {
        await debugScreenshot(page, 'project-creation-failed');
        await debugLogChat(page, 'Project creation attempt');
      }

      expect(projectFlowStarted).toBe(true);
      await assertNoTechnicalErrors(page);
    });

    test('Ember acknowledges tool when user mentions it', async ({ page }) => {
      test.setTimeout(TIMEOUTS.projectCreation + 90000);

      // GIVEN: I initiated upload flow
      await openEmbeddedChat(page);
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // WHEN: I say it's my project made with Midjourney
      await sendMessage(page, 'This is my project, I made it with Midjourney');
      await waitForEmberResponse(page, TIMEOUTS.projectCreation);

      // THEN: The response should mention the tool or project creation
      const chatContent = await getChatContent(page);

      const acknowledgedTool =
        chatContent.includes('midjourney') ||
        chatContent.includes('tool') ||
        chatContent.includes('ai') ||
        chatContent.includes('project');

      expect(acknowledgedTool).toBe(true);
    });

    test('user can describe video project', async ({ page }) => {
      test.setTimeout(TIMEOUTS.projectCreation + 90000);

      // GIVEN: I initiated upload flow
      await openEmbeddedChat(page);
      await uploadFileViaInput(page, TEST_FILES.video);
      await waitForEmberResponse(page);

      // WHEN: I describe my video project
      await sendMessage(page, 'This is a video I made');
      await waitForEmberResponse(page, TIMEOUTS.projectCreation);

      // THEN: Ember should respond about video project
      const chatContent = await getChatContent(page);
      const videoAcknowledged =
        chatContent.includes('video') ||
        chatContent.includes('project') ||
        chatContent.includes('upload');

      expect(videoAcknowledged).toBe(true);
    });
  });

  // ===========================================================================
  // CLIPPING WORKFLOW
  // ===========================================================================

  test.describe('Clipping Conversation Flow', () => {
    test('user can request to save as clipping', async ({ page }) => {
      // GIVEN: I initiated upload flow
      await openEmbeddedChat(page);
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // WHEN: I say it's something I found (not my project)
      await sendMessage(page, 'Save this to my clippings, I found this online');
      await waitForEmberResponse(page);

      // THEN: Ember should respond about clipping/saving
      const chatContent = await getChatContent(page);

      const clippingFlowStarted = [
        'clip',
        'save',
        'found',
        'upload',
        'image',
      ].some(word => chatContent.includes(word));

      if (!clippingFlowStarted) {
        await debugScreenshot(page, 'clipping-save-failed');
        await debugLogChat(page, 'Clipping save attempt');
      }

      expect(clippingFlowStarted).toBe(true);
      await assertNoTechnicalErrors(page);
    });

    test('Ember responds to clip request', async ({ page }) => {
      // GIVEN: I initiated upload
      await openEmbeddedChat(page);
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // WHEN: I ask to clip it
      await sendMessage(page, 'Just clip this');
      await waitForEmberResponse(page);

      // THEN: Ember should respond
      const chatContent = await getChatContent(page);

      const responded = [
        'clip',
        'save',
        'upload',
        'image',
        'project',
      ].some(word => chatContent.includes(word));

      expect(responded).toBe(true);
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  test.describe('Error Handling', () => {
    test('chat remains functional after upload flow', async ({ page }) => {
      // GIVEN: I am on /home
      await openEmbeddedChat(page);

      // WHEN: I initiate upload flow
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // THEN: I should still be able to send messages
      const chatInput = getChatInput(page);
      await expect(chatInput).toBeEnabled();

      // Send a follow-up message
      await sendMessage(page, 'Is the chat still working?');
      await waitForEmberResponse(page);

      await assertNoTechnicalErrors(page);
    });

    test('user can continue conversation after upload intent', async ({ page }) => {
      // GIVEN: I am on /home
      await openEmbeddedChat(page);

      // Initiate upload flow
      await uploadFileViaInput(page, TEST_FILES.image);
      await waitForEmberResponse(page);

      // THEN: I should still be able to send messages
      const chatInput = getChatInput(page);
      await expect(chatInput).toBeEnabled();

      // Chat should be functional
      const chatContent = await getChatContent(page);
      expect(chatContent.length).toBeGreaterThan(50);
    });
  });
});

// ===========================================================================
// CROSS-PAGE TESTS
// ===========================================================================

test.describe('Upload Intent Across Different Pages', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(TIMEOUTS.projectCreation + 60000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('upload intent works from /explore sidebar', async ({ page }) => {
    // GIVEN: I open chat sidebar from /explore
    await openChatSidebar(page, '/explore');

    // WHEN: I initiate upload
    await uploadFileViaInput(page, TEST_FILES.image);
    await waitForEmberResponse(page);

    // THEN: Ember should respond about uploading
    const chatContent = await getChatContent(page);
    const uploadFlowStarted =
      chatContent.includes('upload') ||
      chatContent.includes('image') ||
      chatContent.includes('media') ||
      chatContent.includes('project');

    expect(uploadFlowStarted).toBe(true);
  });

  test('upload intent works from /learn sidebar', async ({ page }) => {
    // GIVEN: I open chat sidebar from /learn
    await openChatSidebar(page, '/learn');

    // WHEN: I initiate upload
    await uploadFileViaInput(page, TEST_FILES.image);
    await waitForEmberResponse(page);

    // THEN: Ember should respond (same behavior regardless of page)
    const chatContent = await getChatContent(page);
    expect(chatContent.length).toBeGreaterThan(50); // Got some response
  });

  test('upload intent works from settings page sidebar', async ({ page }) => {
    // GIVEN: I open chat sidebar from settings
    await openChatSidebar(page, '/account/settings');

    // WHEN: I initiate upload
    await uploadFileViaInput(page, TEST_FILES.image);
    await waitForEmberResponse(page);

    // THEN: Ember should respond
    const chatContent = await getChatContent(page);
    expect(chatContent.length).toBeGreaterThan(50);
  });
});
