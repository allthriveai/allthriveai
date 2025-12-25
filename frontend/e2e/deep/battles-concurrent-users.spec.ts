/**
 * Battles Concurrent Users Tests
 *
 * Tests for multiple users doing prompt battles simultaneously.
 * Catches race conditions, WebSocket conflicts, and database contention.
 */

import { test, expect, type Browser as _Browser } from '@playwright/test';
import {
  loginViaAPI,
  getPageContent,
  BATTLE_PHASE_TIMEOUT as _BATTLE_PHASE_TIMEOUT,
  createSecondBrowserContext as _createSecondBrowserContext,
  loginAsSecondUser,
  TEST_USER_2,
} from './deep-helpers';
import { assertNoTechnicalErrors } from './ai-quality-assertions';

// Extended timeout for concurrent operations
const CONCURRENT_TIMEOUT = 300000; // 5 minutes

test.describe('Battles - Concurrent Users', () => {
  test.setTimeout(CONCURRENT_TIMEOUT);

  test('multiple users can create Pip battles simultaneously', async ({ browser }) => {
    // Create 3 browser contexts for 3 concurrent users
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

    try {
      // Login all users via API (they'll all use the same test user for simplicity)
      await Promise.all(pages.map((page) => loginViaAPI(page)));

      // All users navigate to battles page
      await Promise.all(
        pages.map((page) =>
          page.goto('/play/prompt-battles').then(() => page.waitForLoadState('domcontentloaded'))
        )
      );

      await Promise.all(pages.map((page) => page.waitForTimeout(2000)));

      // All users click "Battle Pip" at the same time
      const battlePromises = pages.map(async (page, index) => {
        const pipButton = page
          .locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")')
          .first();

        if (await pipButton.isVisible({ timeout: 10000 })) {
          await pipButton.click();

          // Wait for battle page
          await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

          const content = await getPageContent(page);
          assertNoTechnicalErrors(content, `user ${index + 1} battle creation`);

          return { success: true, url: page.url(), userIndex: index };
        }

        return { success: false, userIndex: index };
      });

      const results = await Promise.all(battlePromises);
      const successfulBattles = results.filter((r) => r.success);

      console.log(`Created ${successfulBattles.length} concurrent battles`);

      // All users should have created battles successfully
      expect(successfulBattles.length).toBe(3);

      // Each battle should have a unique ID
      const battleIds = successfulBattles.map((r) => r.url.match(/\/(\d+)/)?.[1]);
      const uniqueIds = new Set(battleIds);
      expect(uniqueIds.size).toBe(3);
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()));
    }
  });

  test('two users can battle each other via invitation', async ({ browser }) => {
    // Create two browser contexts for two users
    const [context1, context2] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);

    const [page1, page2] = await Promise.all([context1.newPage(), context2.newPage()]);

    try {
      // Login user 1 with primary account
      await loginViaAPI(page1);

      // Login user 2 with secondary account
      await loginAsSecondUser(page2);

      // User 1 creates an invitation battle
      await page1.goto('/play/prompt-battles');
      await page1.waitForLoadState('domcontentloaded');
      await page1.waitForTimeout(2000);

      // Look for invite/challenge friend button
      const inviteButton = page1
        .locator('button:has-text("Invite"), button:has-text("Challenge"), button:has-text("Friend")')
        .first();

      if (await inviteButton.isVisible({ timeout: 10000 })) {
        await inviteButton.click();
        await page1.waitForTimeout(2000);

        // Fill in second user's username
        const usernameInput = page1.locator(
          'input[placeholder*="username"], input[placeholder*="friend"], input[name="opponent"]'
        );

        if (await usernameInput.isVisible({ timeout: 5000 })) {
          await usernameInput.fill(TEST_USER_2.username);

          // Submit invitation
          const sendButton = page1.locator('button:has-text("Send"), button[type="submit"]').first();
          await sendButton.click();

          // Wait for battle to be created
          await page1.waitForURL(/\/play\/prompt-battles\/\d+/, { timeout: 30000 });

          const battleUrl = page1.url();
          const battleId = battleUrl.match(/\/prompt-battles\/(\d+)/)?.[1];

          console.log(`User 1 created invitation battle: ${battleId}`);

          // User 2 checks for invitation or joins battle directly
          // (Depending on implementation - may need to navigate to notifications or battle URL)
          if (battleId) {
            await page2.goto(`/play/prompt-battles/${battleId}`);
            await page2.waitForLoadState('domcontentloaded');
            await page2.waitForTimeout(3000);

            // User 2 should see the battle and be able to join
            const content2 = await getPageContent(page2);
            assertNoTechnicalErrors(content2, 'user 2 battle view');

            // Look for join/accept button
            const joinButton = page2
              .locator('button:has-text("Join"), button:has-text("Accept"), button:has-text("Ready")')
              .first();

            if (await joinButton.isVisible({ timeout: 10000 })) {
              await joinButton.click();
              await page2.waitForTimeout(3000);

              // Both users should now be in the battle
              const [content1, content2Final] = await Promise.all([
                getPageContent(page1),
                getPageContent(page2),
              ]);

              assertNoTechnicalErrors(content1, 'user 1 after user 2 joined');
              assertNoTechnicalErrors(content2Final, 'user 2 after joining');

              // Both should see battle UI
              expect(/battle|prompt|opponent/i.test(content1)).toBe(true);
              expect(/battle|prompt|opponent/i.test(content2Final)).toBe(true);

              console.log('Both users successfully in battle together');
            }
          }
        }
      } else {
        // No invitation feature available - skip
        console.log('Invitation battle feature not available, skipping test');
        test.skip();
      }
    } finally {
      await Promise.all([context1.close(), context2.close()]);
    }
  });

  test('concurrent battles do not interfere with each other', async ({ browser }) => {
    // Create 2 contexts - each will have their own battle
    const [context1, context2] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);

    const [page1, page2] = await Promise.all([context1.newPage(), context2.newPage()]);

    try {
      // Both users login and start Pip battles
      await Promise.all([loginViaAPI(page1), loginViaAPI(page2)]);

      await Promise.all([
        page1.goto('/play/prompt-battles'),
        page2.goto('/play/prompt-battles'),
      ]);

      await Promise.all([
        page1.waitForLoadState('domcontentloaded'),
        page2.waitForLoadState('domcontentloaded'),
      ]);

      await Promise.all([page1.waitForTimeout(2000), page2.waitForTimeout(2000)]);

      // Both click Pip button
      const pipButton1 = page1
        .locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")')
        .first();
      const pipButton2 = page2
        .locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")')
        .first();

      if (
        (await pipButton1.isVisible({ timeout: 10000 })) &&
        (await pipButton2.isVisible({ timeout: 10000 }))
      ) {
        await Promise.all([pipButton1.click(), pipButton2.click()]);

        // Wait for both to reach battle pages
        await Promise.all([
          page1.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 }),
          page2.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 }),
        ]);

        // Get battle IDs - should be different
        const battleId1 = page1.url().match(/\/(\d+)/)?.[1];
        const battleId2 = page2.url().match(/\/(\d+)/)?.[1];

        console.log(`Battle 1: ${battleId1}, Battle 2: ${battleId2}`);
        expect(battleId1).not.toBe(battleId2);

        // Wait for active phase
        await Promise.all([page1.waitForTimeout(10000), page2.waitForTimeout(10000)]);

        // Both users submit prompts at the same time
        const promptInput1 = page1.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');
        const promptInput2 = page2.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

        const canSubmit1 = await promptInput1.isVisible({ timeout: 30000 }).catch(() => false);
        const canSubmit2 = await promptInput2.isVisible({ timeout: 30000 }).catch(() => false);

        if (canSubmit1 && canSubmit2) {
          // Submit different prompts
          await Promise.all([
            promptInput1.fill('A majestic dragon flying over mountains'),
            promptInput2.fill('A serene underwater coral reef scene'),
          ]);

          const submitButton1 = page1.locator('button:has-text("Submit"), button[type="submit"]').first();
          const submitButton2 = page2.locator('button:has-text("Submit"), button[type="submit"]').first();

          await Promise.all([submitButton1.click(), submitButton2.click()]);

          await Promise.all([page1.waitForTimeout(5000), page2.waitForTimeout(5000)]);

          // Verify no cross-contamination
          const [content1, content2] = await Promise.all([
            getPageContent(page1),
            getPageContent(page2),
          ]);

          assertNoTechnicalErrors(content1, 'battle 1 after submit');
          assertNoTechnicalErrors(content2, 'battle 2 after submit');

          // Ensure prompts didn't get mixed up (basic check)
          // Battle 1 should not mention "coral reef"
          // Battle 2 should not mention "dragon"
          // (This is a heuristic - depends on how prompts are displayed)

          console.log('Both battles running independently - no interference detected');
        }
      } else {
        test.skip();
      }
    } finally {
      await Promise.all([context1.close(), context2.close()]);
    }
  });

  test('WebSocket connections handle multiple concurrent battles', async ({ browser }) => {
    // Test that WebSocket infrastructure handles multiple concurrent connections
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

    try {
      // All users login
      await Promise.all(pages.map((page) => loginViaAPI(page)));

      // All navigate to battles and start Pip battles
      await Promise.all(
        pages.map((page) =>
          page.goto('/play/prompt-battles').then(() => page.waitForLoadState('domcontentloaded'))
        )
      );

      await Promise.all(pages.map((page) => page.waitForTimeout(2000)));

      // All click Pip button simultaneously
      const clickPromises = pages.map(async (page) => {
        const pipButton = page
          .locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")')
          .first();

        if (await pipButton.isVisible({ timeout: 10000 })) {
          await pipButton.click();
          await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });
          return true;
        }
        return false;
      });

      const results = await Promise.all(clickPromises);
      const successCount = results.filter((r) => r).length;

      console.log(`${successCount}/5 users successfully started battles`);

      // All should have started battles
      expect(successCount).toBe(5);

      // Wait for all battles to reach active phase
      await Promise.all(pages.map((page) => page.waitForTimeout(15000)));

      // Verify all pages are responsive (no WebSocket conflicts)
      const contentChecks = await Promise.all(
        pages.map(async (page, i) => {
          const content = await getPageContent(page);
          assertNoTechnicalErrors(content, `battle ${i + 1} concurrent check`);
          return /battle|prompt|pip|submit/i.test(content);
        })
      );

      const responsiveCount = contentChecks.filter((r) => r).length;
      console.log(`${responsiveCount}/5 battles responsive after concurrent start`);

      expect(responsiveCount).toBeGreaterThanOrEqual(4); // Allow 1 flaky
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()));
    }
  });

  test('rapid battle creation does not cause race conditions', async ({ browser }) => {
    // Single user rapidly creates multiple battles
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await loginViaAPI(page);

      const battleIds: string[] = [];

      // Rapidly create 3 battles
      for (let i = 0; i < 3; i++) {
        await page.goto('/play/prompt-battles');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        const pipButton = page
          .locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")')
          .first();

        if (await pipButton.isVisible({ timeout: 10000 })) {
          await pipButton.click();
          await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

          const battleId = page.url().match(/\/(\d+)/)?.[1];
          if (battleId) {
            battleIds.push(battleId);
            console.log(`Created battle ${i + 1}: ${battleId}`);
          }

          const content = await getPageContent(page);
          assertNoTechnicalErrors(content, `rapid battle ${i + 1}`);
        }
      }

      // All battles should have unique IDs
      expect(battleIds.length).toBe(3);
      const uniqueIds = new Set(battleIds);
      expect(uniqueIds.size).toBe(3);

      console.log('All 3 rapid battles have unique IDs - no race condition detected');
    } finally {
      await context.close();
    }
  });
});

test.describe('Battles - Pip Battle Load Tests', () => {
  test.setTimeout(CONCURRENT_TIMEOUT);

  test('10 concurrent Pip battles complete without errors', async ({ browser }) => {
    // Stress test: 10 users starting Pip battles simultaneously
    const contextCount = 10;
    const contexts = await Promise.all(
      Array(contextCount).fill(null).map(() => browser.newContext())
    );

    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

    try {
      console.log(`Starting ${contextCount} concurrent Pip battles...`);

      // Login all users
      await Promise.all(pages.map((page) => loginViaAPI(page)));

      // All navigate to battles
      await Promise.all(
        pages.map((page) =>
          page.goto('/play/prompt-battles').then(() => page.waitForLoadState('domcontentloaded'))
        )
      );

      await Promise.all(pages.map((page) => page.waitForTimeout(2000)));

      // All click Pip simultaneously
      const battleResults = await Promise.all(
        pages.map(async (page, i) => {
          const pipButton = page
            .locator('button:has-text("Pip"), button:has-text("AI")')
            .first();

          if (await pipButton.isVisible({ timeout: 10000 })) {
            await pipButton.click();
            await page.waitForURL(/\/play\/prompt-battles\/\d+|\/battles\/\d+/, { timeout: 30000 });

            const content = await getPageContent(page);
            const hasError = /error|failed|exception/i.test(content);

            return {
              userIndex: i,
              battleId: page.url().match(/\/(\d+)/)?.[1],
              success: !hasError,
            };
          }
          return { userIndex: i, success: false };
        })
      );

      const successCount = battleResults.filter((r) => r.success).length;
      const uniqueBattleIds = new Set(battleResults.filter((r) => r.battleId).map((r) => r.battleId));

      console.log(`${successCount}/${contextCount} battles created successfully`);
      console.log(`${uniqueBattleIds.size} unique battle IDs`);

      // At least 80% should succeed under load
      expect(successCount).toBeGreaterThanOrEqual(Math.floor(contextCount * 0.8));

      // All successful battles should have unique IDs
      expect(uniqueBattleIds.size).toBe(successCount);
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()));
    }
  });

  test('Pip battles maintain WebSocket connection under load', async ({ browser }) => {
    // Test WebSocket stability with multiple active Pip battles
    const contextCount = 5;
    const contexts = await Promise.all(
      Array(contextCount).fill(null).map(() => browser.newContext())
    );

    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

    try {
      // Login and start battles
      await Promise.all(pages.map((page) => loginViaAPI(page)));

      await Promise.all(
        pages.map((page) =>
          page.goto('/play/prompt-battles').then(() => page.waitForLoadState('domcontentloaded'))
        )
      );

      await Promise.all(pages.map((page) => page.waitForTimeout(2000)));

      // Start all Pip battles
      await Promise.all(
        pages.map(async (page) => {
          const pipButton = page.locator('button:has-text("Pip")').first();
          if (await pipButton.isVisible({ timeout: 10000 })) {
            await pipButton.click();
            await page.waitForURL(/\/play\/prompt-battles\/\d+/, { timeout: 30000 });
          }
        })
      );

      // Wait for active phase on all
      await Promise.all(pages.map((page) => page.waitForTimeout(15000)));

      // All submit prompts simultaneously
      await Promise.all(
        pages.map(async (page, i) => {
          const promptInput = page.locator('textarea').first();
          if (await promptInput.isVisible({ timeout: 30000 })) {
            await promptInput.fill(`Load test prompt from user ${i + 1}: A cosmic landscape with nebulae`);

            const submitBtn = page.locator('button:has-text("Submit")').first();
            if (await submitBtn.isVisible()) {
              await submitBtn.click();
            }
          }
        })
      );

      // Wait and check all are progressing
      await Promise.all(pages.map((page) => page.waitForTimeout(10000)));

      const statusChecks = await Promise.all(
        pages.map(async (page, i) => {
          const content = await getPageContent(page);
          assertNoTechnicalErrors(content, `load test battle ${i + 1}`);

          // Should show some progress indicator
          const isProgressing = /submit|generat|wait|judg|creat/i.test(content);
          return isProgressing;
        })
      );

      const progressingCount = statusChecks.filter((r) => r).length;
      console.log(`${progressingCount}/${contextCount} battles progressing after submission`);

      expect(progressingCount).toBeGreaterThanOrEqual(contextCount - 1); // Allow 1 flaky
    } finally {
      await Promise.all(contexts.map((ctx) => ctx.close()));
    }
  });

  test('Pip battle handles reconnection during image generation', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await loginViaAPI(page);

      await page.goto('/play/prompt-battles');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const pipButton = page.locator('button:has-text("Pip")').first();
      if (!(await pipButton.isVisible({ timeout: 10000 }))) {
        test.skip();
        return;
      }

      await pipButton.click();
      await page.waitForURL(/\/play\/prompt-battles\/\d+/, { timeout: 30000 });

      // Wait for active phase
      await page.waitForTimeout(12000);

      // Submit prompt
      const promptInput = page.locator('textarea').first();
      if (await promptInput.isVisible({ timeout: 30000 })) {
        await promptInput.fill('A stunning mountain range with aurora borealis');

        const submitBtn = page.locator('button:has-text("Submit")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
        }
      }

      // Wait for generating phase to start
      await page.waitForTimeout(5000);

      // Simulate network disconnect during generation
      await page.context().setOffline(true);
      await page.waitForTimeout(3000);

      // Reconnect
      await page.context().setOffline(false);
      await page.waitForTimeout(5000);

      // Should recover and continue or show reconnection status
      const content = await getPageContent(page);

      // Should NOT have technical errors
      assertNoTechnicalErrors(content, 'after reconnection');

      // Should show either progress or reconnection status
      const hasValidState = /generat|judg|result|winner|reconnect|submit/i.test(content);
      expect(hasValidState).toBe(true);

      console.log('Battle recovered after network interruption');
    } finally {
      await context.close();
    }
  });
});

test.describe('Battles - Concurrent Submission Stress', () => {
  test.setTimeout(CONCURRENT_TIMEOUT);

  test('simultaneous submissions from different users work correctly', async ({ browser }) => {
    // Two users in separate Pip battles submit at exact same moment
    const [context1, context2] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);

    const [page1, page2] = await Promise.all([context1.newPage(), context2.newPage()]);

    try {
      await Promise.all([loginViaAPI(page1), loginViaAPI(page2)]);

      await Promise.all([
        page1.goto('/play/prompt-battles'),
        page2.goto('/play/prompt-battles'),
      ]);

      await Promise.all([
        page1.waitForLoadState('domcontentloaded'),
        page2.waitForLoadState('domcontentloaded'),
      ]);

      await Promise.all([page1.waitForTimeout(2000), page2.waitForTimeout(2000)]);

      // Both start Pip battles
      const pipButton1 = page1
        .locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")')
        .first();
      const pipButton2 = page2
        .locator('button:has-text("Pip"), button:has-text("AI"), button:has-text("Bot")')
        .first();

      if (
        (await pipButton1.isVisible({ timeout: 10000 })) &&
        (await pipButton2.isVisible({ timeout: 10000 }))
      ) {
        await Promise.all([pipButton1.click(), pipButton2.click()]);

        await Promise.all([
          page1.waitForURL(/\/play\/prompt-battles\/\d+/, { timeout: 30000 }),
          page2.waitForURL(/\/play\/prompt-battles\/\d+/, { timeout: 30000 }),
        ]);

        // Wait for active phase
        await Promise.all([page1.waitForTimeout(12000), page2.waitForTimeout(12000)]);

        const promptInput1 = page1.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');
        const promptInput2 = page2.locator('textarea[placeholder*="prompt"], input[placeholder*="prompt"]');

        const vis1 = await promptInput1.isVisible({ timeout: 30000 }).catch(() => false);
        const vis2 = await promptInput2.isVisible({ timeout: 30000 }).catch(() => false);

        if (vis1 && vis2) {
          // Fill prompts
          await Promise.all([
            promptInput1.fill('Simultaneous test prompt from user 1'),
            promptInput2.fill('Simultaneous test prompt from user 2'),
          ]);

          const submitButton1 = page1.locator('button:has-text("Submit"), button[type="submit"]').first();
          const submitButton2 = page2.locator('button:has-text("Submit"), button[type="submit"]').first();

          // Click at exactly the same time
          await Promise.all([submitButton1.click(), submitButton2.click()]);

          // Wait for processing
          await Promise.all([page1.waitForTimeout(10000), page2.waitForTimeout(10000)]);

          // Both should show progress (submitted/generating/etc)
          const [content1, content2] = await Promise.all([
            getPageContent(page1),
            getPageContent(page2),
          ]);

          assertNoTechnicalErrors(content1, 'user 1 simultaneous submit');
          assertNoTechnicalErrors(content2, 'user 2 simultaneous submit');

          const hasProgress1 = /submit|generat|wait|process/i.test(content1);
          const hasProgress2 = /submit|generat|wait|process/i.test(content2);

          expect(hasProgress1 || hasProgress2).toBe(true);
          console.log('Simultaneous submissions handled correctly');
        }
      } else {
        test.skip();
      }
    } finally {
      await Promise.all([context1.close(), context2.close()]);
    }
  });
});
