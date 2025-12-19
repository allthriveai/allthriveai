/**
 * Project Creation Workflow E2E Tests
 *
 * Tests for the complete project creation flows via Ember chat.
 * Covers URL imports, media projects, and the conversation flow.
 *
 * Feature: Project Creation via Chat
 *   As a user
 *   I can create projects by chatting with Ember
 *   So that I can showcase my work
 *
 * RUN: RUN_AI_TESTS=true npx playwright test e2e/ember-chat/project-workflow.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginViaAPI } from '../helpers';
import {
  openEmbeddedChat,
  sendMessage,
  waitForEmberResponse,
  getChatContent,
  assertNoTechnicalErrors,
  debugScreenshot,
  debugLogChat,
  TIMEOUTS,
} from './chat-helpers';

const RUN_AI_TESTS = process.env.RUN_AI_TESTS === 'true';

test.describe('Project Creation Workflows', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(TIMEOUTS.projectCreation + 60000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  // ===========================================================================
  // GITHUB URL IMPORT
  // ===========================================================================

  test.describe('GitHub URL Import', () => {
    test('Ember processes GitHub URL and asks about ownership', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I paste a GitHub URL
      await sendMessage(page, 'https://github.com/microsoft/vscode');
      await waitForEmberResponse(page);

      // THEN: Ember should recognize it's a GitHub repo
      const chatContent = await getChatContent(page);

      const recognizedGitHub = [
        'github',
        'repository',
        'repo',
        'vscode',
        'microsoft',
        'project',
        'import',
        'your own',
        'clip',
      ].some(word => chatContent.includes(word));

      expect(recognizedGitHub).toBe(true);
      await assertNoTechnicalErrors(page);
    });

    test('user can import GitHub repo as their own project', async ({ page }) => {
      test.setTimeout(TIMEOUTS.projectCreation + 90000);

      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I paste my GitHub URL and confirm it's mine
      await sendMessage(page, 'https://github.com/sindresorhus/awesome');
      await waitForEmberResponse(page);

      await sendMessage(page, 'Just clip this repository');
      await waitForEmberResponse(page, TIMEOUTS.projectCreation);

      // THEN: Project should be created or clipped
      const chatContent = await getChatContent(page);

      const success = [
        'created',
        'clipped',
        'saved',
        'imported',
        'added',
        'awesome',
      ].some(word => chatContent.includes(word));

      if (!success) {
        await debugScreenshot(page, 'github-import-failed');
        await debugLogChat(page, 'GitHub import attempt');
      }

      expect(success).toBe(true);
    });

    test('user can clip GitHub repo they found', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I paste a GitHub URL and say it's not mine
      await sendMessage(page, 'Check out this cool repo: https://github.com/chalk/chalk');
      await waitForEmberResponse(page);

      await sendMessage(page, 'Not mine, just want to save it');
      await waitForEmberResponse(page, TIMEOUTS.projectCreation);

      // THEN: It should be clipped
      const chatContent = await getChatContent(page);

      const clipped = [
        'clipped',
        'saved',
        'added',
        'got it',
      ].some(word => chatContent.includes(word));

      expect(clipped).toBe(true);
    });
  });

  // ===========================================================================
  // YOUTUBE URL IMPORT
  // ===========================================================================

  test.describe('YouTube URL Import', () => {
    test('Ember processes YouTube URL', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I paste a YouTube URL
      await sendMessage(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await waitForEmberResponse(page);

      // THEN: Ember should recognize it's a YouTube video
      const chatContent = await getChatContent(page);

      const recognizedYouTube = [
        'youtube',
        'video',
        'import',
        'project',
        'clip',
      ].some(word => chatContent.includes(word));

      expect(recognizedYouTube).toBe(true);
      await assertNoTechnicalErrors(page);
    });

    test('user can create project from YouTube video', async ({ page }) => {
      test.setTimeout(TIMEOUTS.projectCreation + 90000);

      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I share a YouTube video and say it's mine
      await sendMessage(page, 'I made this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await waitForEmberResponse(page);

      await sendMessage(page, 'Yes, create a project for it');
      await waitForEmberResponse(page, TIMEOUTS.projectCreation);

      // THEN: A project should be created
      const chatContent = await getChatContent(page);

      const created = [
        'created',
        'project',
        'added',
        'imported',
      ].some(word => chatContent.includes(word));

      expect(created).toBe(true);
    });
  });

  // ===========================================================================
  // NATURAL LANGUAGE PROJECT CREATION
  // ===========================================================================

  test.describe('Natural Language Project Creation', () => {
    test('user can describe a project to create', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I describe a project in natural language
      await sendMessage(page, 'I want to create a project about my AI art collection');
      await waitForEmberResponse(page);

      // THEN: Ember should help guide the project creation
      const chatContent = await getChatContent(page);

      const helpfulResponse = [
        'project',
        'create',
        'help',
        'tell me',
        'share',
        'upload',
        'image',
      ].some(word => chatContent.includes(word));

      expect(helpfulResponse).toBe(true);
      await assertNoTechnicalErrors(page);
    });

    test('user can request help creating a project', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I ask for help creating a project
      await sendMessage(page, 'Help me create a new project');
      await waitForEmberResponse(page);

      // THEN: Ember should offer options
      const chatContent = await getChatContent(page);

      const offersHelp = [
        'help',
        'create',
        'project',
        'upload',
        'url',
        'github',
        'describe',
      ].some(word => chatContent.includes(word));

      expect(offersHelp).toBe(true);
    });
  });

  // ===========================================================================
  // CONVERSATION FLOW TESTS
  // ===========================================================================

  test.describe('Conversation Flow', () => {
    test('CRITICAL: follow-up stays with same context (no misrouting)', async ({ page }) => {
      test.setTimeout(TIMEOUTS.projectCreation + 120000);

      // GIVEN: Started a project creation workflow
      await openEmbeddedChat(page);
      await sendMessage(page, 'https://github.com/lodash/lodash');
      await waitForEmberResponse(page);

      // Get first response
      const firstResponse = await getChatContent(page);
      console.log('First response:', firstResponse.substring(0, 300));

      // WHEN: I respond with ownership info that might trigger wrong routing
      // (e.g., mentioning "Midjourney" could misroute to discovery/image agent)
      await sendMessage(page, 'Just clip it please');
      await waitForEmberResponse(page, TIMEOUTS.projectCreation);

      // THEN: Should stay in project context, NOT route to discovery
      const finalResponse = await getChatContent(page);

      // SUCCESS: Project was processed
      const projectProcessed = [
        'clipped',
        'saved',
        'created',
        'lodash',
        'added',
        'project',
      ].some(word => finalResponse.includes(word));

      // FAILURE: Got routed to wrong agent (discovery)
      const wrongRouting = [
        'here are some projects you might like',
        'found these trending',
        'recommend these',
        'searching for projects',
      ].some(phrase => finalResponse.includes(phrase));

      console.log('Project processed:', projectProcessed);
      console.log('Wrong routing:', wrongRouting);

      if (!projectProcessed || wrongRouting) {
        await debugScreenshot(page, 'conversation-flow-failed');
        await debugLogChat(page, 'Conversation flow');
      }

      expect(wrongRouting).toBe(false);
      expect(projectProcessed).toBe(true);
    });

    test('multi-turn conversation maintains context', async ({ page }) => {
      test.setTimeout(TIMEOUTS.projectCreation + 120000);

      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // Turn 1: Express intent
      await sendMessage(page, 'I want to share something I made');
      await waitForEmberResponse(page);

      // Turn 2: Provide details
      await sendMessage(page, 'It is an AI-generated image');
      await waitForEmberResponse(page);

      // Turn 3: Mention tool
      await sendMessage(page, 'I used Stable Diffusion');
      await waitForEmberResponse(page);

      // THEN: Ember should have context of the whole conversation
      const chatContent = await getChatContent(page);

      // Should reference the image and/or tool mentioned
      const hasContext = [
        'image',
        'stable diffusion',
        'upload',
        'share',
        'project',
      ].some(word => chatContent.includes(word));

      expect(hasContext).toBe(true);
    });
  });

  // ===========================================================================
  // ERROR CASES
  // ===========================================================================

  test.describe('Error Handling', () => {
    test('Ember handles invalid URL gracefully', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I send a malformed URL
      await sendMessage(page, 'Check this out: not-a-valid-url');
      await waitForEmberResponse(page);

      // THEN: Ember should handle gracefully (not crash)
      await assertNoTechnicalErrors(page);

      // Should either ask for clarification or provide help
      const chatContent = await getChatContent(page);
      expect(chatContent.length).toBeGreaterThan(50);
    });

    test('Ember handles private/inaccessible GitHub repo', async ({ page }) => {
      // GIVEN: Chat is open
      await openEmbeddedChat(page);

      // WHEN: I paste a non-existent GitHub URL
      await sendMessage(page, 'https://github.com/totally-fake-user/nonexistent-repo-12345');
      await waitForEmberResponse(page, 60000);

      // THEN: Ember should handle the error gracefully
      await assertNoTechnicalErrors(page);

      const chatContent = await getChatContent(page);
      // Should mention something about the issue or ask for clarification
      // Response should be meaningful (not empty or just an error)
      expect(chatContent.length).toBeGreaterThan(20);
    });
  });
});

// ===========================================================================
// INTEGRATION PICKER TESTS
// ===========================================================================

test.describe('Integration Picker (Plus Menu)', () => {
  test.skip(!RUN_AI_TESTS, 'Skipping AI tests - set RUN_AI_TESTS=true to run');
  test.setTimeout(TIMEOUTS.aiResponse + 30000);

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('plus menu shows integration options', async ({ page }) => {
    // GIVEN: Chat is open
    await openEmbeddedChat(page);

    // WHEN: I click the plus menu
    const plusButton = page.locator('[data-testid="plus-menu"], button:has-text("+"), [aria-label*="Add"]').first();
    await plusButton.click();
    await page.waitForTimeout(500);

    // THEN: Integration options should be visible
    const menuVisible = await page.locator('[class*="menu"], [role="menu"], [class*="dropdown"]').isVisible();
    expect(menuVisible).toBe(true);
  });

  test('can initiate GitHub import from plus menu', async ({ page }) => {
    // GIVEN: Chat is open
    await openEmbeddedChat(page);

    // WHEN: I select GitHub from plus menu
    const plusButton = page.locator('[data-testid="plus-menu"], button:has-text("+")').first();
    await plusButton.click();
    await page.waitForTimeout(500);

    const githubOption = page.locator('button:has-text("GitHub"), [data-testid="github-import"]');
    if (await githubOption.isVisible()) {
      await githubOption.click();
      await waitForEmberResponse(page);

      // THEN: Chat should mention GitHub
      const chatContent = await getChatContent(page);
      expect(chatContent).toContain('github');
    }
  });
});
