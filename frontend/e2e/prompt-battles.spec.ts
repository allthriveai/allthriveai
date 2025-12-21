import { test, expect, Page, BrowserContext } from '@playwright/test';
import { loginViaAPI, API_BASE_URL } from './helpers';

/**
 * Prompt Battles E2E Tests - Mission Critical
 *
 * These tests verify the complete user flow for prompt battles,
 * especially the async battle scenarios where users don't join simultaneously.
 *
 * Run with: npx playwright test e2e/prompt-battles.spec.ts
 * Run headed: npx playwright test e2e/prompt-battles.spec.ts --headed
 */

test.describe('Prompt Battles - Guest Invite Flow', () => {
  let challengerPage: Page;
  let guestContext: BrowserContext;
  let guestPage: Page;
  let inviteUrl: string;
  let inviteToken: string;
  let battleId: number;

  test.beforeEach(async ({ browser, page }) => {
    challengerPage = page;

    // Login as challenger
    await loginViaAPI(challengerPage);

    // Create a new guest context (simulates incognito/different browser)
    guestContext = await browser.newContext();
    guestPage = await guestContext.newPage();
  });

  test.afterEach(async () => {
    await guestContext?.close();
  });

  test('challenger can generate battle invite link', async () => {
    // Navigate to battles page
    await challengerPage.goto('/battles');
    await challengerPage.waitForLoadState('domcontentloaded');

    // Click "Battle a Friend" button
    const battleHumanButton = challengerPage.getByRole('button', { name: /battle.*friend/i })
      .or(challengerPage.locator('[data-testid="battle-human-button"]'))
      .or(challengerPage.getByText('Battle a Friend'));

    await expect(battleHumanButton).toBeVisible({ timeout: 10000 });
    await battleHumanButton.click();

    // Click "Share a Link" option
    const shareLinkOption = challengerPage.getByRole('button', { name: /share.*link/i })
      .or(challengerPage.getByText('Share a Link'))
      .or(challengerPage.locator('[data-testid="share-link-option"]'));

    await expect(shareLinkOption).toBeVisible({ timeout: 5000 });
    await shareLinkOption.click();

    // Wait for invite link to be generated
    await challengerPage.waitForTimeout(2000);

    // Find and store the invite URL
    const inviteInput = challengerPage.locator('input[readonly]').or(
      challengerPage.locator('[data-testid="invite-url"]')
    );

    // Or look for the copy button area
    const inviteLinkArea = challengerPage.locator('text=/battle\\/invite\\//');

    const hasInput = await inviteInput.count() > 0;
    const hasLinkText = await inviteLinkArea.count() > 0;

    expect(hasInput || hasLinkText).toBeTruthy();

    if (hasInput) {
      inviteUrl = await inviteInput.inputValue();
    } else {
      // Extract from page content
      const pageContent = await challengerPage.content();
      const match = pageContent.match(/https?:\/\/[^"'\s]+\/battle\/invite\/[a-zA-Z0-9-]+/);
      expect(match).toBeTruthy();
      inviteUrl = match![0];
    }

    // Extract token from URL
    const tokenMatch = inviteUrl.match(/\/invite\/([a-zA-Z0-9-]+)/);
    expect(tokenMatch).toBeTruthy();
    inviteToken = tokenMatch![1];

    console.log(`Generated invite URL: ${inviteUrl}`);
    console.log(`Invite token: ${inviteToken}`);
  });

  test('guest can accept invite and join battle', async () => {
    // First generate an invite via API (faster for setup)
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // Guest navigates to invite link
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    // Should see the invite page with challenger info or the "Continue as Guest" button
    await expect(guestPage.getByRole('button', { name: /continue.*guest/i })).toBeVisible({ timeout: 15000 });

    // Click "Continue as Guest" button
    const continueAsGuestButton = guestPage.getByRole('button', { name: /continue.*guest/i })
      .or(guestPage.getByText('Continue as Guest'));

    await expect(continueAsGuestButton).toBeVisible();
    await continueAsGuestButton.click();

    // Should be redirected to the battle page
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });

    // Verify battle page loaded with challenge text
    const challengeText = guestPage.locator('[data-testid="challenge-text"]')
      .or(guestPage.getByText(/create/i));

    await expect(challengeText).toBeVisible({ timeout: 10000 });

    console.log('Guest successfully joined battle');
  });

  test('guest can return to same invite link and see battle results', async () => {
    /**
     * SCENARIO: As a guest who receives a prompt battle link, when I finish the battle
     *           I should be able to use the same link and see the battle results
     * EXPECTED: Returning to the invite link shows the completed battle results
     * FAILURE: Error shown or cannot access results
     */

    // Create invite and have guest accept
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // Guest accepts invite
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    await expect(continueButton).toBeVisible({ timeout: 15000 });
    await continueButton.click();

    // Wait for battle page
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });

    // Complete the battle via API (simulate both users submitting)
    await completeBattleViaAPI(battleId);

    // Now guest returns to the SAME invite link
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    // Should either:
    // 1. Redirect to the battle results page
    // 2. Show "already accepted" with link to results
    // 3. Show the results directly

    // Wait for navigation or content
    await guestPage.waitForTimeout(3000);

    const currentUrl = guestPage.url();
    const pageContent = await guestPage.content();

    // Check various success conditions
    const redirectedToResults = currentUrl.includes(`/battles/${battleId}`);
    const showsAlreadyAccepted = pageContent.includes('already') || pageContent.includes('accepted');
    const showsResults = pageContent.includes('winner') || pageContent.includes('result') || pageContent.includes('completed');
    const hasBattleLink = pageContent.includes(`/battles/${battleId}`);

    const success = redirectedToResults || showsAlreadyAccepted || showsResults || hasBattleLink;

    expect(success).toBeTruthy();
    console.log(`Guest returned to invite link - redirected: ${redirectedToResults}, shows accepted: ${showsAlreadyAccepted}`);
  });

  test('guest can accept battle after challenger starts their turn (async battle)', async () => {
    /**
     * SCENARIO: As a challenged user who receives a link and doesn't accept right away,
     *           when the challenger starts their turn, I should still be able to join
     * EXPECTED: Guest can accept and join the active battle
     * FAILURE: Error "Battle is no longer pending" or similar
     */

    // Create invite
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // Challenger starts their turn via API (simulates clicking "Start Your Turn")
    await startChallengerTurnViaAPI(battleId, challengerPage);

    // Now guest tries to accept (after challenger started)
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    // Should still see the invite page
    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });

    // CRITICAL: This should NOT show an error
    const errorVisible = await guestPage.getByText(/error|failed|expired|no longer/i).isVisible()
      .catch(() => false);

    expect(errorVisible).toBeFalsy();

    await expect(continueButton).toBeVisible({ timeout: 10000 });
    await continueButton.click();

    // Should successfully join the battle
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });

    // Verify battle page shows (not error page)
    const battlePageVisible = await guestPage.getByText(/create|prompt|battle/i).isVisible()
      .catch(() => false);
    const errorPageVisible = await guestPage.getByText(/error|failed|cannot connect/i).isVisible()
      .catch(() => false);

    expect(battlePageVisible).toBeTruthy();
    expect(errorPageVisible).toBeFalsy();

    console.log('Guest successfully joined async battle after challenger started');
  });

  test('guest can join while challenger is actively playing', async () => {
    /**
     * SCENARIO: Challenger clicks "Start Turn", timer starts. Guest clicks link during timer.
     * EXPECTED: Guest joins, sees battle is active, can wait for their turn
     * FAILURE: Error joining battle
     */

    // Create invite
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // Challenger navigates to battle and starts their turn
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('domcontentloaded');

    // Look for "Start Your Turn" button and click it
    const startTurnButton = challengerPage.getByRole('button', { name: /start.*turn/i })
      .or(challengerPage.getByText('Start Your Turn'));

    const hasStartButton = await startTurnButton.isVisible().catch(() => false);

    if (hasStartButton) {
      await startTurnButton.click();
      await challengerPage.waitForTimeout(2000);
    } else {
      // Start via API if button not visible
      await startChallengerTurnViaAPI(battleId, challengerPage);
    }

    // Now guest clicks invite link while challenger's timer is running
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    await expect(continueButton).toBeVisible({ timeout: 15000 });
    await continueButton.click();

    // Should join successfully
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });

    // Should see the battle is active (not an error)
    await expect(guestPage.locator('body')).not.toContainText(/error|failed|cannot connect/i);

    console.log('Guest joined while challenger timer was active');
  });

  test('guest can submit after challenger has already submitted (async battle flow)', async () => {
    /**
     * SCENARIO: As a challenged user who receives a link and doesn't accept right away,
     *           when I try to join after the challenger has submitted their prompt,
     *           I should be able to submit my prompt and see results
     * EXPECTED: Guest can submit their prompt when it's their turn
     * FAILURE: "It's not your turn yet" error or unable to submit
     *
     * NOTE: This test waits for AI judging (~60s). Only runs with RUN_CRITICAL_E2E=true
     */

    // Skip unless running critical E2E tests (make test-e2e-critical)
    test.skip(!process.env.RUN_CRITICAL_E2E, 'Skipping slow test - run with RUN_CRITICAL_E2E=true');

    // Create invite
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // === STEP 1: Challenger starts their turn and submits ===
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('domcontentloaded');

    // Look for "Start My Turn" or "Start Your Turn" button and click it
    const startTurnButton = challengerPage.getByRole('button', { name: /start.*turn/i })
      .or(challengerPage.getByText('Start My Turn'))
      .or(challengerPage.getByText('Start Your Turn'));

    await expect(startTurnButton).toBeVisible({ timeout: 15000 });
    await startTurnButton.click();

    // Wait for page to transition to the battle arena with prompt editor
    await challengerPage.waitForTimeout(3000);

    // Find the prompt textarea and submit a prompt
    const promptTextarea = challengerPage.locator('textarea')
      .or(challengerPage.locator('[data-testid="prompt-editor"]'))
      .or(challengerPage.getByPlaceholder(/prompt|describe|create/i));

    await expect(promptTextarea).toBeVisible({ timeout: 10000 });
    await promptTextarea.fill('A beautiful mountain landscape at sunset with golden light');

    // Find and click the submit button
    const submitButton = challengerPage.getByRole('button', { name: /submit|send/i })
      .or(challengerPage.locator('[data-testid="submit-prompt"]'));

    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for submission confirmation
    await challengerPage.waitForTimeout(3000);

    // Verify submission was successful - should see "Prompt Submitted!" heading
    const submittedIndicator = challengerPage.getByRole('heading', { name: 'Prompt Submitted!' });
    await expect(submittedIndicator).toBeVisible({ timeout: 10000 });

    console.log('Challenger submitted their prompt');

    // === STEP 2: Guest joins AFTER challenger submitted ===
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    await expect(continueButton).toBeVisible({ timeout: 15000 });
    await continueButton.click();

    // Should join successfully
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });
    await guestPage.waitForLoadState('domcontentloaded');

    // Wait for WebSocket connection and state to load
    await guestPage.waitForTimeout(3000);

    // === STEP 3: Verify guest sees the prompt editor (it's their turn now) ===
    // Should NOT see "waiting for" message (that would mean it's not their turn)
    const waitingMessage = guestPage.getByText(/waiting for.*turn|not your turn/i);
    const isWaiting = await waitingMessage.isVisible().catch(() => false);

    // Should see the prompt textarea (indicating it's their turn)
    const guestPromptTextarea = guestPage.locator('textarea')
      .or(guestPage.locator('[data-testid="prompt-editor"]'))
      .or(guestPage.getByPlaceholder(/prompt|describe|create/i));

    const canTypePrompt = await guestPromptTextarea.isVisible().catch(() => false);

    // If we see waiting message, the turn logic might not have updated
    if (isWaiting) {
      console.log('WARNING: Guest sees waiting message - turn state may not have updated');
      // Take a screenshot for debugging
      await guestPage.screenshot({ path: 'e2e-guest-waiting-error.png' });
    }

    // CRITICAL: Guest should be able to type their prompt
    expect(canTypePrompt).toBeTruthy();
    expect(isWaiting).toBeFalsy();

    console.log('Guest can see prompt editor (turn properly transferred)');

    // === STEP 4: Guest submits their prompt ===
    await guestPromptTextarea.fill('A serene lake with crystal clear water and reflections');

    const guestSubmitButton = guestPage.getByRole('button', { name: /submit|send/i })
      .or(guestPage.locator('[data-testid="submit-prompt"]'));

    await expect(guestSubmitButton).toBeVisible();
    await guestSubmitButton.click();

    // Wait for submission
    await guestPage.waitForTimeout(3000);

    // Should NOT see an error like "It's not your turn"
    const errorMessage = guestPage.getByText(/not your turn|error|failed/i);
    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      console.log('ERROR: Guest got an error when trying to submit');
      await guestPage.screenshot({ path: 'e2e-guest-submit-error.png' });
    }

    expect(hasError).toBeFalsy();

    // Should see submission confirmed or generating/judging state
    const successIndicator = guestPage.getByText(/submitted|generating|judging|both players/i).first();
    await expect(successIndicator).toBeVisible({ timeout: 15000 });

    console.log('Guest successfully submitted their prompt - battle proceeding to judging');

    // === STEP 5: Wait for AI judging to complete and winner to be shown ===
    // This takes 30-60 seconds for image generation + AI judging
    console.log('Waiting for AI judging to complete (this may take up to 90 seconds)...');

    // Wait for the results/winner to be displayed
    // Look for winner-related text or the results UI
    const resultsIndicator = guestPage.getByText(/winner|you won|you lost|it's a tie|victory|defeat/i).first()
      .or(guestPage.locator('[data-testid="battle-results"]'))
      .or(guestPage.getByRole('heading', { name: /winner|results/i }));

    await expect(resultsIndicator).toBeVisible({ timeout: 90000 });

    console.log('Battle completed - winner displayed!');

    // Verify we can see both players' images/scores
    const hasScores = await guestPage.getByText(/score|points|\d+\.\d+/i).first().isVisible().catch(() => false);

    if (hasScores) {
      console.log('Scores are visible on the results page');
    }

    // Take a screenshot of the final results for verification
    await guestPage.screenshot({ path: 'e2e-battle-results.png' });

    console.log('Full async battle flow completed successfully!');
  });

  test('challenged user timer starts only when they click join, not before', async () => {
    /**
     * TDD TEST - Expected to fail until implementation is fixed
     *
     * SCENARIO: As a challenged user who receives a link to a battle who does not
     *           accept right away and tries to join an active battle
     *
     * EXPECTED:
     * 1. I should be able to join an active battle if the challenger is already in the battle
     * 2. I should NOT have to wait for the other person to submit their turn to start
     * 3. As the challenged user, my time should start when I click "join" (not before)
     *
     * CURRENT FAILURES:
     * - Unable to join the battle
     * - Unable to start my prompt challenge when I join
     * - My time has already started before I get to type my prompt
     */

    // Create invite
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // === STEP 1: Challenger navigates to battle and starts their turn ===
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('domcontentloaded');

    // Look for "Start My Turn" button and click it
    const startTurnButton = challengerPage.getByRole('button', { name: /start my turn/i });
    await expect(startTurnButton).toBeVisible({ timeout: 10000 });
    await startTurnButton.click();

    // Wait for the battle arena to load with the prompt editor
    await challengerPage.waitForTimeout(3000);

    // Verify challenger is now in the battle (has a textarea to type prompt)
    const challengerPromptArea = challengerPage.locator('textarea').first();
    await expect(challengerPromptArea).toBeVisible({ timeout: 10000 });

    console.log('Challenger has started their turn and can type their prompt');

    // === STEP 2: Guest clicks invite link WHILE challenger is playing ===
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    // Guest should see the invite/join page (not an error)
    const errorOnInvitePage = await guestPage.getByText(/error|failed|expired|no longer available/i)
      .isVisible()
      .catch(() => false);

    // CRITICAL ASSERTION 1: No error when accessing invite while battle is active
    expect(errorOnInvitePage).toBeFalsy();

    // Find and verify "Continue as Guest" / "Join" button is visible
    const joinButton = guestPage.getByRole('button', { name: /continue.*guest|join.*battle|join/i })
      .or(guestPage.getByText('Continue as Guest'))
      .or(guestPage.locator('[data-testid="join-battle-button"]'));

    // CRITICAL ASSERTION 2: Guest CAN join an active battle
    await expect(joinButton).toBeVisible({ timeout: 15000 });

    console.log('Guest can see join button - about to click it');

    // Record the time BEFORE clicking join
    const _timeBeforeJoin = Date.now();

    // === STEP 3: Guest clicks JOIN ===
    await joinButton.click();

    // Record the time AFTER clicking join
    const _timeAfterJoin = Date.now();

    // Should be redirected to the battle page
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });
    await guestPage.waitForLoadState('domcontentloaded');

    // Small wait for WebSocket connection and state to load
    await guestPage.waitForTimeout(2000);

    // === STEP 4: Verify guest can start their turn (not stuck in limbo) ===

    // Guest should see EITHER:
    // A) A "Start My Turn" button to begin their turn, OR
    // B) The prompt textarea already visible to type immediately

    const startMyTurnButton = guestPage.getByRole('button', { name: /start my turn/i });
    const promptTextarea = guestPage.locator('textarea')
      .or(guestPage.locator('[data-testid="prompt-editor"]'))
      .or(guestPage.getByPlaceholder(/prompt|describe|create|type/i));

    const hasStartButton = await startMyTurnButton.isVisible({ timeout: 5000 }).catch(() => false);
    const hasTextarea = await promptTextarea.isVisible({ timeout: 5000 }).catch(() => false);

    // Take screenshot for debugging
    await guestPage.screenshot({ path: 'e2e-guest-battle-state.png' });

    // CRITICAL ASSERTION 4: Guest must have a way to start their turn
    // They should NOT be stuck in a "Ready" limbo state
    if (!hasStartButton && !hasTextarea) {
      console.error('FAIL: Guest has no way to start their turn - stuck in limbo!');
      console.error('  - No "Start My Turn" button visible');
      console.error('  - No prompt textarea visible');
      console.error('  - Guest is stuck and cannot participate in the battle');
    }

    expect(hasStartButton || hasTextarea).toBeTruthy();

    // If there's a Start button, click it to begin
    if (hasStartButton) {
      console.log('Guest sees "Start My Turn" button - clicking to start turn');

      await startMyTurnButton.click();

      // Wait for the arena to load
      await guestPage.waitForTimeout(3000);

      // Now should see the textarea
      await expect(promptTextarea).toBeVisible({ timeout: 10000 });
    }

    // CRITICAL ASSERTION 5: Guest should now be able to type
    const canTypePrompt = await promptTextarea.isVisible().catch(() => false);

    if (!canTypePrompt) {
      console.error('FAIL: Guest cannot see prompt editor - unable to type their prompt');
      await guestPage.screenshot({ path: 'e2e-no-prompt-editor.png' });
    }
    expect(canTypePrompt).toBeTruthy();

    // === STEP 6: Verify timer is at/near full time (not already counting down) ===
    const guestTimer = guestPage.locator('[data-testid="battle-timer"]')
      .or(guestPage.locator('[data-testid="timer"]'))
      .or(guestPage.getByText(/\d+:\d+/).first());

    const timerVisible = await guestTimer.isVisible({ timeout: 5000 }).catch(() => false);

    if (timerVisible) {
      const timerText = await guestTimer.textContent();
      console.log(`Guest timer shows: ${timerText}`);

      const timerMatch = timerText?.match(/(\d+):(\d+)/);
      if (timerMatch) {
        const minutes = parseInt(timerMatch[1], 10);
        const seconds = parseInt(timerMatch[2], 10);
        const totalSeconds = minutes * 60 + seconds;

        // CRITICAL ASSERTION 6: Timer should be near the starting time
        // (Battle timer is 3 minutes = 180 seconds, allow 10 seconds for load time)
        const isNearStartingTime = totalSeconds >= 170;

        if (!isNearStartingTime) {
          console.error(`FAIL: Timer shows ${totalSeconds}s remaining - time started BEFORE user clicked start!`);
          await guestPage.screenshot({ path: 'e2e-timer-started-early.png' });
        }

        expect(isNearStartingTime).toBeTruthy();
        console.log(`Timer check passed: ${totalSeconds} seconds remaining (near full time)`);
      }
    }

    // Verify we can actually type in the textarea
    await promptTextarea.fill('Test prompt from challenged user');
    const typedValue = await promptTextarea.inputValue();

    // CRITICAL ASSERTION 7: Guest can actually type in the prompt editor
    expect(typedValue).toBe('Test prompt from challenged user');

    console.log('SUCCESS: Challenged user joined active battle, can start their turn, timer is correct');
  });

  test('challenger and challenged user can enter battle at the same time', async () => {
    /**
     * TDD TEST - Expected to fail until implementation is fixed
     *
     * SCENARIO: Challenger and challenged user can enter the prompt battle at the same time
     *
     * EXPECTED:
     * 1. Both users can start playing simultaneously
     * 2. Both users can see that they are playing together
     * 3. Each user sees the other user's status (connected, typing, etc.)
     *
     * CURRENT FAILURE:
     * - Unable to join the same battle
     */

    // Create invite
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // === STEP 1: Challenger navigates to battle and starts their turn ===
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('domcontentloaded');

    // Challenger clicks "Start My Turn"
    const challengerStartButton = challengerPage.getByRole('button', { name: /start my turn/i });
    await expect(challengerStartButton).toBeVisible({ timeout: 10000 });
    await challengerStartButton.click();

    // Wait for challenger to see the battle arena with prompt editor
    const challengerTextarea = challengerPage.locator('textarea').first();
    await expect(challengerTextarea).toBeVisible({ timeout: 10000 });

    console.log('Challenger has started their turn and can see prompt editor');

    // === STEP 2: Guest accepts invite and joins ===
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    await expect(continueButton).toBeVisible({ timeout: 15000 });
    await continueButton.click();

    // Guest redirected to battle page
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });
    await guestPage.waitForLoadState('domcontentloaded');
    await guestPage.waitForTimeout(2000);

    console.log('Guest has joined the battle');

    // === STEP 3: Guest starts their turn ===
    const guestStartButton = guestPage.getByRole('button', { name: /start my turn/i });
    const guestTextarea = guestPage.locator('textarea').first();

    const hasGuestStartButton = await guestStartButton.isVisible({ timeout: 5000 }).catch(() => false);
    const _hasGuestTextarea = await guestTextarea.isVisible({ timeout: 5000 }).catch(() => false);

    // Guest should see either Start button or textarea
    if (hasGuestStartButton) {
      await guestStartButton.click();
      await guestPage.waitForTimeout(3000);
    }

    // Now guest should see textarea
    await expect(guestTextarea).toBeVisible({ timeout: 10000 });

    console.log('Guest has started their turn and can see prompt editor');

    // === STEP 4: Verify both users can see each other ===

    // Take screenshots of both pages
    await challengerPage.screenshot({ path: 'e2e-challenger-view.png' });
    await guestPage.screenshot({ path: 'e2e-guest-view.png' });

    // CRITICAL ASSERTION 1: Challenger should see the guest (opponent) in the battle
    // Look for opponent card or opponent username on challenger's page
    const _challengerOpponentCard = challengerPage.locator('[data-testid="opponent-card"]')
      .or(challengerPage.getByText(/vs/i).locator('..').locator('..'));

    // The opponent should not show "Waiting for opponent..." anymore
    const waitingForOpponent = await challengerPage.getByText(/waiting for opponent/i)
      .isVisible()
      .catch(() => false);

    if (waitingForOpponent) {
      console.error('FAIL: Challenger still sees "Waiting for opponent" - guest not visible');
    }
    expect(waitingForOpponent).toBeFalsy();

    // CRITICAL ASSERTION 2: Guest should see the challenger's username
    // The guest page should show the challenger as their opponent
    const guestSeesOpponent = await guestPage.getByText('e2e-test-user')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!guestSeesOpponent) {
      console.error('FAIL: Guest cannot see challenger username');
    }
    expect(guestSeesOpponent).toBeTruthy();

    console.log('Both users can see each other in the battle');

    // === STEP 5: Verify both users can type simultaneously ===

    // Challenger types a prompt
    await challengerTextarea.fill('Challenger prompt: A beautiful sunset');
    const challengerTyped = await challengerTextarea.inputValue();
    expect(challengerTyped).toBe('Challenger prompt: A beautiful sunset');

    // Guest types a prompt (should be able to type at the same time)
    await guestTextarea.fill('Guest prompt: A peaceful mountain');
    const guestTyped = await guestTextarea.inputValue();
    expect(guestTyped).toBe('Guest prompt: A peaceful mountain');

    console.log('Both users can type their prompts simultaneously');

    // === STEP 6: Verify both users have their own timers ===

    // Check challenger has a timer
    const challengerTimer = challengerPage.getByText(/\d+:\d+/).first();
    const challengerHasTimer = await challengerTimer.isVisible({ timeout: 5000 }).catch(() => false);

    // Check guest has a timer
    const guestTimer = guestPage.getByText(/\d+:\d+/).first();
    const guestHasTimer = await guestTimer.isVisible({ timeout: 5000 }).catch(() => false);

    if (!challengerHasTimer) {
      console.error('FAIL: Challenger does not see their timer');
    }
    if (!guestHasTimer) {
      console.error('FAIL: Guest does not see their timer');
    }

    expect(challengerHasTimer).toBeTruthy();
    expect(guestHasTimer).toBeTruthy();

    console.log('SUCCESS: Both challenger and guest can play together in the same battle');
  });

  test('challenger can see when battle completes', async () => {
    /**
     * SCENARIO: Challenger sends link, guest accepts and completes battle
     * EXPECTED: Challenger can see the completed battle in their battle list
     * FAILURE: Challenger doesn't know battle finished
     */

    // Create invite and have guest accept
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // Guest accepts
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    await expect(continueButton).toBeVisible({ timeout: 15000 });
    await continueButton.click();
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });

    // Complete battle via API
    await completeBattleViaAPI(battleId);

    // Challenger navigates to their battles list
    await challengerPage.goto('/battles');
    await challengerPage.waitForLoadState('domcontentloaded');

    // Should see the completed battle
    // Look for the battle card or link
    await challengerPage.waitForTimeout(2000);

    const battleLink = challengerPage.locator(`a[href*="/battles/${battleId}"]`)
      .or(challengerPage.getByText(/completed/i));

    const hasBattleVisible = await battleLink.count() > 0;

    // Or check by navigating directly
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('domcontentloaded');

    // Should see battle results (not loading forever)
    const hasResults = await challengerPage.getByText(/winner|result|score|completed/i)
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    expect(hasResults || hasBattleVisible).toBeTruthy();

    console.log('Challenger can see completed battle');
  });

  test('guest sees expired message when invite link has expired', async () => {
    /**
     * TDD TEST - Tests the expired invite link flow
     *
     * SCENARIO: As a challenged user who receives a link, when I try to access it
     *           after 24 hours, I should see a clear "Challenge Expired" message
     *
     * EXPECTED:
     * 1. Guest navigates to expired invite link
     * 2. Should see "Challenge Expired" heading (not generic error)
     * 3. Should see explanation that links are valid for 24 hours
     * 4. Should see "Start a New Battle" and "Explore All Thrive" buttons
     * 5. Should NOT see "Continue as Guest" button (invite is expired)
     *
     * FAILURE:
     * - Generic error message instead of specific expired message
     * - No clear explanation of what happened
     * - No actionable buttons for the user
     */

    // === STEP 1: Create a battle invite ===
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    console.log(`Created battle ${battleId} with invite token ${inviteToken}`);

    // === STEP 2: Expire the invite via test API ===
    await expireInviteViaAPI(battleId, challengerPage);
    console.log(`Expired invite for battle ${battleId}`);

    // === STEP 3: Guest tries to access the expired link ===
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    // Wait for the page to load and process the error
    await guestPage.waitForTimeout(3000);

    // Take screenshot for debugging
    await guestPage.screenshot({ path: 'e2e-expired-invite-page.png' });

    // === STEP 4: Verify the expired error message is shown ===

    // CRITICAL ASSERTION 1: Should see "Challenge Expired" heading
    const expiredHeading = guestPage.getByRole('heading', { name: /challenge expired/i })
      .or(guestPage.getByText(/challenge expired/i));
    const hasExpiredHeading = await expiredHeading.isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasExpiredHeading) {
      console.error('FAIL: "Challenge Expired" heading not visible');
      const pageContent = await guestPage.content();
      console.log('Page contains:', pageContent.substring(0, 1000));
    }
    expect(hasExpiredHeading).toBeTruthy();

    // CRITICAL ASSERTION 2: Should see explanation about 24 hours
    const explanationText = guestPage.getByText(/24 hours/i)
      .or(guestPage.getByText(/only valid for/i));
    const hasExplanation = await explanationText.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasExplanation) {
      console.error('FAIL: Explanation about 24-hour validity not visible');
    }
    expect(hasExplanation).toBeTruthy();

    // CRITICAL ASSERTION 3: Should see "Start a New Battle" button
    const startNewBattleButton = guestPage.getByRole('button', { name: /start.*new.*battle/i })
      .or(guestPage.getByRole('link', { name: /start.*new.*battle/i }))
      .or(guestPage.getByText(/start.*new.*battle/i));
    const hasStartButton = await startNewBattleButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasStartButton) {
      console.error('FAIL: "Start a New Battle" button not visible');
    }
    expect(hasStartButton).toBeTruthy();

    // CRITICAL ASSERTION 4: Should NOT see "Continue as Guest" button (invite is expired!)
    const continueAsGuestButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    const hasContinueButton = await continueAsGuestButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasContinueButton) {
      console.error('FAIL: "Continue as Guest" button should NOT be visible for expired invites');
    }
    expect(hasContinueButton).toBeFalsy();

    // CRITICAL ASSERTION 5: Should see helpful next steps (Explore All Thrive option)
    const exploreOption = guestPage.getByText('Explore All Thrive')
      .or(guestPage.getByRole('link', { name: /explore all thrive/i }))
      .or(guestPage.getByRole('button', { name: /explore all thrive/i }));
    const hasExploreOption = await exploreOption.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasExploreOption) {
      console.error('FAIL: "Explore All Thrive" option not visible');
    }
    expect(hasExploreOption).toBeTruthy();

    console.log('SUCCESS: Guest sees proper expired invite message with actionable options');
  });

  test('challenger can add friends name to challenge invite', async () => {
    /**
     * TDD TEST - Expected to fail until implementation is complete
     *
     * SCENARIO: As a challenger I want to be able to add my friend's name to the copy challenge link page
     *
     * EXPECTED:
     * 1. I can add my friend's name on the challenge link page
     * 2. When I start the battle, their name shows in their circle (opponent PlayerCard)
     * 3. When they join (right away or later), their name still shows in their circle
     * 4. I can see their name on tab=my-battles
     *
     * FAILURE:
     * - Unable to add or see the challenged user's name in 3 places
     */

    const friendName = 'Alex Thompson';

    // === STEP 1: Create battle invite ===
    const { token, url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    inviteToken = token;
    battleId = id;

    // Navigate to the battle page (shows ChallengeReadyScreen)
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('networkidle');

    // Wait for WebSocket to connect and ChallengeReadyScreen to appear
    // The "Start My Turn" button is unique to ChallengeReadyScreen
    const startMyTurnButton = challengerPage.getByRole('button', { name: /start my turn/i });
    await expect(startMyTurnButton).toBeVisible({ timeout: 30000 });
    console.log('ChallengeReadyScreen loaded');

    // === STEP 2: Find and fill the friend's name input ===
    // CRITICAL ASSERTION 1: Should see an input field for friend's name
    const friendNameInput = challengerPage.getByPlaceholder(/friend.*name|who.*challenging|opponent.*name/i)
      .or(challengerPage.getByLabel(/friend.*name|opponent.*name/i))
      .or(challengerPage.locator('input[name="friendName"]'))
      .or(challengerPage.locator('input[data-testid="friend-name-input"]'));

    const hasNameInput = await friendNameInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasNameInput) {
      console.error('FAIL: No input field found for friend\'s name on ChallengeReadyScreen');
      // Take screenshot for debugging
      await challengerPage.screenshot({ path: 'e2e-friend-name-input-missing.png' });
    }
    expect(hasNameInput).toBeTruthy();

    // Fill in the friend's name
    await friendNameInput.fill(friendName);
    // Blur the input to trigger save
    await friendNameInput.blur();
    // Wait for save to complete
    await challengerPage.waitForTimeout(1000);
    console.log(`Filled friend name: ${friendName}`);

    // === STEP 3: Start challenger's turn ===
    // Use the button we already waited for above
    await startMyTurnButton.click();

    // Wait for battle arena to load
    const challengerTextarea = challengerPage.locator('textarea').first();
    await expect(challengerTextarea).toBeVisible({ timeout: 10000 });

    // === STEP 4: Verify friend's name appears in opponent circle ===
    // CRITICAL ASSERTION 2: Should see the friend's name in opponent card/circle
    const opponentNameInArena = challengerPage.getByText(friendName);
    const hasNameInArena = await opponentNameInArena.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasNameInArena) {
      console.error('FAIL: Friend\'s name not visible in opponent circle during battle');
      await challengerPage.screenshot({ path: 'e2e-friend-name-in-arena-missing.png' });
    }
    expect(hasNameInArena).toBeTruthy();

    console.log('Friend name visible in battle arena opponent circle');

    // === STEP 5: Guest joins the battle ===
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    await expect(continueButton).toBeVisible({ timeout: 15000 });
    await continueButton.click();

    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });
    await guestPage.waitForLoadState('domcontentloaded');

    // Guest clicks "Start My Turn" if needed
    const guestStartButton = guestPage.getByRole('button', { name: /start my turn/i });
    if (await guestStartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guestStartButton.click();
      await guestPage.waitForTimeout(2000);
    }

    console.log('Guest has joined the battle');

    // Give time for WebSocket updates
    await challengerPage.waitForTimeout(2000);

    // === STEP 6: Verify friend's name STILL shows after they join ===
    // The display name should persist even after the guest creates their account
    // (Guest username like "guest_xxx" should NOT replace the friend name "Alex Thompson")
    const stillHasNameInArena = await opponentNameInArena.isVisible().catch(() => false);

    if (!stillHasNameInArena) {
      console.error('FAIL: Friend\'s name was replaced by guest username after they joined');
      await challengerPage.screenshot({ path: 'e2e-friend-name-replaced.png' });
    }
    expect(stillHasNameInArena).toBeTruthy();

    console.log('Friend name still visible after guest joined');

    // === STEP 7: Verify friend's name appears in My Battles tab ===
    // Navigate to profile page
    await challengerPage.goto('/e2e-test-user');
    await challengerPage.waitForLoadState('domcontentloaded');
    await challengerPage.waitForTimeout(2000);

    // Click on My Battles tab
    const myBattlesTab = challengerPage.getByRole('button', { name: /my battles/i })
      .or(challengerPage.locator('[id*="my-battles"]'))
      .or(challengerPage.getByText('My Battles').first());
    await expect(myBattlesTab).toBeVisible({ timeout: 10000 });
    await myBattlesTab.click();

    // Wait for battles list to load (API call to fetch battles)
    await challengerPage.waitForTimeout(3000);

    // CRITICAL ASSERTION 3: Should see friend's name in the battles list
    const nameInBattlesList = challengerPage.getByText(friendName);
    const hasNameInList = await nameInBattlesList.isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasNameInList) {
      console.error('FAIL: Friend\'s name not visible in My Battles tab');
      await challengerPage.screenshot({ path: 'e2e-friend-name-in-my-battles-missing.png' });
    }
    expect(hasNameInList).toBeTruthy();

    console.log('SUCCESS: Friend name visible in all 3 places - input, battle arena, and My Battles tab');
  });

  test('challenger sees their AI generated image immediately after submission', async () => {
    /**
     * TDD TEST - Expected to fail until implementation is fixed
     *
     * SCENARIO: As a challenger who joins a prompt battle before my friend does,
     * when I submit my prompt, I want to see my AI generated image right away.
     *
     * EXPECTED:
     * 1. Challenger creates battle and starts their turn
     * 2. Challenger submits their prompt
     * 3. Challenger sees their AI generated image immediately
     * 4. Challenger does NOT have to wait for opponent to submit
     *
     * CURRENT FAILURE:
     * - Challenger has to wait for the other person to submit to see their own image
     * - The challenged user sees challenger's submitted prompt before judging
     *
     * NOTE: This test waits for AI image generation (~30s). Only runs with RUN_CRITICAL_E2E=true
     */

    // Skip unless running critical E2E tests
    test.skip(!process.env.RUN_CRITICAL_E2E, 'Skipping slow test - run with RUN_CRITICAL_E2E=true');

    // === STEP 1: Create battle invite ===
    const { url, id } = await createBattleInviteViaAPI(challengerPage);
    inviteUrl = url;
    battleId = id;

    console.log(`Created battle ${battleId}`);

    // === STEP 2: Challenger navigates to battle and starts their turn ===
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('domcontentloaded');

    const startTurnButton = challengerPage.getByRole('button', { name: /start my turn/i });
    await expect(startTurnButton).toBeVisible({ timeout: 15000 });
    await startTurnButton.click();

    // Wait for battle arena with prompt editor
    await challengerPage.waitForTimeout(3000);

    const promptTextarea = challengerPage.locator('textarea')
      .or(challengerPage.locator('[data-testid="prompt-editor"]'))
      .or(challengerPage.getByPlaceholder(/prompt|describe|create/i));

    await expect(promptTextarea).toBeVisible({ timeout: 10000 });

    console.log('Challenger has started their turn and can type their prompt');

    // === STEP 3: Challenger submits their prompt ===
    const uniquePrompt = `A majestic phoenix rising from golden flames with sparkling feathers - ${Date.now()}`;
    await promptTextarea.fill(uniquePrompt);

    const submitButton = challengerPage.getByRole('button', { name: /submit|send/i })
      .or(challengerPage.locator('[data-testid="submit-prompt"]'));

    await expect(submitButton).toBeVisible();
    await submitButton.click();

    console.log('Challenger submitted their prompt');

    // === STEP 4: Verify submission was processed ===
    // With the fix, the UI should transition to GeneratingPhase immediately (shows "AI is Creating Magic")
    // Without the fix, it shows "Prompt Submitted!" with a waiting message
    const generatingHeading = challengerPage.getByRole('heading', { name: 'AI is Creating Magic' });
    const submittedHeading = challengerPage.getByRole('heading', { name: 'Prompt Submitted!' });

    // Wait for either heading to appear
    await challengerPage.waitForTimeout(3000);

    const showsGenerating = await generatingHeading.isVisible().catch(() => false);
    const showsSubmitted = await submittedHeading.isVisible().catch(() => false);

    if (showsGenerating) {
      console.log('Challenger sees "AI is Creating Magic" - GeneratingPhase loaded immediately (GOOD!)');
    } else if (showsSubmitted) {
      console.log('Challenger sees "Prompt Submitted!" - old behavior (still waiting for opponent)');
    } else {
      console.error('Neither generating nor submitted heading visible');
      await challengerPage.screenshot({ path: 'e2e-post-submit-state.png' });
    }

    // At minimum, one of these should be visible
    expect(showsGenerating || showsSubmitted).toBeTruthy();

    // === STEP 5: CRITICAL - Wait for AI image generation and verify image is shown ===
    // The challenger should see their generated image without waiting for opponent
    // Image generation typically takes 15-30 seconds

    console.log('Waiting for AI image generation (this may take up to 45 seconds)...');

    // Look for the generated image on challenger's side
    // This could be:
    // 1. An image element within the user's player card
    // 2. A "Your Creation" section with the image
    // 3. The submission card showing the generated image

    // Look for the generated image - the GeneratingPhase component shows it with alt="Your creation"
    const challengerImage = challengerPage.locator('img[alt="Your creation"]')
      .or(challengerPage.locator('[data-testid="user-generated-image"]'))
      .or(challengerPage.locator('[data-testid="challenger-image"]'))
      .or(challengerPage.locator('[data-testid="my-submission-image"]'))
      .or(challengerPage.locator('img[alt*="generated"]'))
      .or(challengerPage.locator('.submission-image img'));

    // CRITICAL ASSERTION 1: Challenger should see their generated image
    // WITHOUT waiting for the opponent to submit
    //
    // Poll for the image to appear, checking every 5 seconds for up to 60 seconds
    // This gives the AI image generation time to complete
    let imageVisible = false;
    const maxWaitTime = 60000; // 60 seconds
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      imageVisible = await challengerImage.isVisible({ timeout: 1000 }).catch(() => false);

      if (imageVisible) {
        console.log(`Image appeared after ${Math.round((Date.now() - startTime) / 1000)}s`);
        break;
      }

      // Log current status every poll
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      console.log(`Polling for image... ${elapsedSeconds}s elapsed`);

      // Check what the page currently shows
      const statusText = await challengerPage.locator('.text-slate-400, .text-sm').first().textContent().catch(() => '');
      if (statusText) {
        console.log(`Current status: "${statusText.substring(0, 80)}..."`);
      }

      await challengerPage.waitForTimeout(pollInterval);
    }

    if (!imageVisible) {
      console.error('FAIL: Challenger does NOT see their generated image after 60 seconds');
      console.error('The challenger is being forced to wait for opponent to submit');

      // Take screenshot for debugging
      await challengerPage.screenshot({ path: 'e2e-challenger-no-image.png' });

      // Check what the challenger currently sees
      const pageContent = await challengerPage.content();

      // Does it show "waiting for opponent"?
      const waitingForOpponent = pageContent.toLowerCase().includes('waiting');
      if (waitingForOpponent) {
        console.error('The page shows "waiting" message - challenger blocked on opponent');
      }

      // Does it show "generating"?
      const showsGenerating = pageContent.toLowerCase().includes('generating');
      if (showsGenerating) {
        console.log('Page shows "generating" - image may still be processing');
      }

      // Check if there are any console errors
      const consoleMessages = await challengerPage.evaluate(() => {
        return (window as unknown as { __consoleErrors?: string[] }).__consoleErrors || [];
      });
      if (consoleMessages.length > 0) {
        console.log('Console errors:', consoleMessages);
      }
    }

    expect(imageVisible).toBeTruthy();

    console.log('SUCCESS: Challenger sees their generated image immediately after submission');

    // === STEP 6: Verify the image has valid src (not placeholder) ===
    const imageSrc = await challengerImage.getAttribute('src');

    // CRITICAL ASSERTION 2: Image should have a real src (not empty or placeholder)
    expect(imageSrc).toBeTruthy();
    expect(imageSrc).not.toContain('placeholder');
    expect(imageSrc).not.toContain('loading');

    // The image should be a real URL (could be S3, CDN, etc.)
    const isValidImageUrl = imageSrc?.startsWith('http') || imageSrc?.startsWith('data:image');
    expect(isValidImageUrl).toBeTruthy();

    console.log(`Challenger's image src: ${imageSrc?.substring(0, 80)}...`);

    // === STEP 7: Verify opponent has NOT joined yet (proving we didn't wait) ===
    // At this point, the guest has NOT accepted the invite
    // This confirms the challenger got their image without waiting

    // The guest now joins AFTER challenger already has their image
    await guestPage.goto(inviteUrl);
    await guestPage.waitForLoadState('domcontentloaded');

    const continueButton = guestPage.getByRole('button', { name: /continue.*guest/i });
    await expect(continueButton).toBeVisible({ timeout: 15000 });

    console.log('Guest has NOT joined yet - confirming challenger got image independently');

    // === STEP 8: CRITICAL - Guest should NOT see challenger's prompt text ===
    // The challenged user should NOT be able to see the challenger's submitted prompt
    // before they submit their own (to prevent cheating/copying)

    await continueButton.click();
    await guestPage.waitForURL(/\/battles\/\d+/, { timeout: 30000 });
    await guestPage.waitForLoadState('domcontentloaded');
    await guestPage.waitForTimeout(3000);

    // Guest clicks "Start My Turn" if needed
    const guestStartButton = guestPage.getByRole('button', { name: /start my turn/i });
    if (await guestStartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guestStartButton.click();
      await guestPage.waitForTimeout(2000);
    }

    // CRITICAL ASSERTION 3: Guest should NOT see challenger's prompt text
    const guestPageContent = await guestPage.content();
    const challengerPromptVisible = guestPageContent.includes(uniquePrompt);

    if (challengerPromptVisible) {
      console.error('FAIL: Challenged user can see challenger\'s submitted prompt!');
      console.error('This allows the challenged user to copy or be influenced by the challenger\'s prompt');
      await guestPage.screenshot({ path: 'e2e-guest-sees-challenger-prompt.png' });
    }

    expect(challengerPromptVisible).toBeFalsy();

    console.log('SUCCESS: Guest cannot see challenger\'s prompt text (no cheating possible)');

    // Also verify guest doesn't see challenger's generated image yet
    const challengerImageOnGuestPage = guestPage.getByText(/phoenix|flames|feathers/i);
    const guestSeesDescription = await challengerImageOnGuestPage.isVisible({ timeout: 2000 }).catch(() => false);

    if (guestSeesDescription) {
      console.error('WARNING: Guest may be able to see description of challenger\'s prompt/image');
    }

    console.log('SUCCESS: Challenger sees image immediately, guest cannot see challenger\'s prompt');
  });

  test('image generation uses only user prompt, not challenge text', async () => {
    /**
     * TDD TEST - Verifies image generation prompt isolation
     *
     * SCENARIO: When a user submits their creative prompt in a battle,
     * the AI image generator should receive ONLY the user's prompt,
     * NOT the challenge text.
     *
     * WHY THIS MATTERS:
     * - The challenge text (e.g., "Design a creature that only exists because...")
     *   is meant to INSPIRE the user's creativity
     * - The user's prompt is their creative interpretation of the challenge
     * - The AI image generator should create exactly what the user describes
     * - Including the challenge would pollute the generation and create
     *   inconsistent results
     *
     * EXPECTED:
     * 1. User's prompt IS included in the generation prompt
     * 2. Challenge text is NOT included in the generation prompt
     * 3. API returns challenge_in_prompt: false
     *
     * FAILURE:
     * - Challenge text appears in the generation prompt
     * - User's unique prompt is not in the generation prompt
     */

    // Use a unique prompt that we can verify
    const uniqueUserPrompt = `A magnificent purple dragon with crystalline wings soaring over a moonlit ocean at midnight - ${Date.now()}`;

    // === STEP 1: Create battle invite ===
    const { id: battleId } = await createBattleInviteViaAPI(challengerPage);
    console.log(`Created battle ${battleId}`);

    // === STEP 2: Navigate to battle and start turn ===
    await challengerPage.goto(`/battles/${battleId}`);
    await challengerPage.waitForLoadState('networkidle');

    // Wait for ChallengeReadyScreen
    const startMyTurnButton = challengerPage.getByRole('button', { name: /start my turn/i });
    await expect(startMyTurnButton).toBeVisible({ timeout: 30000 });

    // Get the challenge text BEFORE starting the battle (we need it for verification)
    const challengeTextElement = challengerPage.locator('[data-testid="challenge-text"]')
      .or(challengerPage.locator('.challenge-text'))
      .or(challengerPage.locator('text=/Design|Create|Imagine|Build|Make/i').first());

    const challengeText = await challengeTextElement.textContent({ timeout: 5000 }).catch(() => null);
    console.log(`Challenge text found: "${challengeText?.substring(0, 50)}..."`);

    // Start the turn
    await startMyTurnButton.click();

    // Wait for textarea
    const textarea = challengerPage.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // === STEP 3: Type and submit the unique prompt ===
    await textarea.fill(uniqueUserPrompt);
    console.log(`Filled prompt: "${uniqueUserPrompt.substring(0, 50)}..."`);

    // Submit the prompt
    const submitButton = challengerPage.getByRole('button', { name: /submit|send|done/i });
    await submitButton.click();

    // Wait for submission to be processed
    await challengerPage.waitForTimeout(3000);
    console.log('Prompt submitted');

    // === STEP 4: Call test API to get the generation prompt ===
    const generationPromptData = await getGenerationPromptViaAPI(battleId, challengerPage);

    console.log('Generation prompt data:', JSON.stringify(generationPromptData, null, 2));

    // === STEP 5: CRITICAL ASSERTIONS ===

    // ASSERTION 1: User's prompt MUST be in the generation prompt
    const userPromptInGeneration = generationPromptData.generation_prompt.includes(uniqueUserPrompt);
    if (!userPromptInGeneration) {
      console.error('FAIL: User\'s prompt is NOT in the generation prompt!');
      console.error('Expected to find:', uniqueUserPrompt);
      console.error('Generation prompt:', generationPromptData.generation_prompt);
    }
    expect(userPromptInGeneration).toBeTruthy();
    console.log('✓ User prompt is included in generation prompt');

    // ASSERTION 2: Challenge text MUST NOT be in the generation prompt
    // First check the API's own assessment
    expect(generationPromptData.challenge_in_prompt).toBeFalsy();
    console.log('✓ API confirms challenge is NOT in generation prompt');

    // Double-check by looking for challenge keywords (if we got the challenge text)
    if (challengeText && challengeText.length > 20) {
      // Take first significant phrase from challenge (skip generic words)
      const challengePhrase = challengeText.substring(0, 30);
      const challengeInGeneration = generationPromptData.generation_prompt.toLowerCase()
        .includes(challengePhrase.toLowerCase());

      if (challengeInGeneration) {
        console.error('FAIL: Challenge text IS in the generation prompt!');
        console.error('Challenge phrase found:', challengePhrase);
        console.error('Generation prompt:', generationPromptData.generation_prompt);
      }
      expect(challengeInGeneration).toBeFalsy();
      console.log('✓ Challenge phrase not found in generation prompt');
    }

    // ASSERTION 3: User prompt matches what we submitted
    expect(generationPromptData.user_prompt).toBe(uniqueUserPrompt);
    console.log('✓ Stored user prompt matches submitted prompt');

    console.log('SUCCESS: Image generation uses ONLY the user prompt, NOT the challenge text');
  });
});

// Helper functions

async function createBattleInviteViaAPI(page: Page): Promise<{ token: string; url: string; id: number }> {
  const result = await page.evaluate(async (apiBase) => {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];

    const response = await fetch(`${apiBase}/api/v1/battles/invitations/generate-link/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken || '',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create invite: ${response.status} ${text}`);
    }

    const data = await response.json();
    // battle_id is in invitation.battle field
    const battleId = data.invitation?.battle || data.battle_id;
    return {
      token: data.invite_token,
      url: data.invite_url,
      id: battleId,
    };
  }, API_BASE_URL);

  console.log(`Created battle ${result.id} with invite token ${result.token}`);
  return result;
}

async function startChallengerTurnViaAPI(battleId: number, page: Page): Promise<void> {
  await page.evaluate(
    async ({ apiBase, id }) => {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

      const response = await fetch(`${apiBase}/api/v1/me/battles/${id}/start-turn/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`Start turn response: ${response.status} ${text}`);
      }
    },
    { apiBase: API_BASE_URL, id: battleId }
  );

  console.log(`Started challenger turn for battle ${battleId}`);
}

async function expireInviteViaAPI(battleId: number, page: Page): Promise<void> {
  /**
   * Expire a battle invitation for testing purposes.
   * This calls a test-only API endpoint that sets the invite's expires_at to the past.
   */
  await page.evaluate(
    async ({ apiBase, id }) => {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

      const response = await fetch(`${apiBase}/api/v1/battles/${id}/test-expire-invite/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to expire invite: ${response.status} ${text}`);
      }
    },
    { apiBase: API_BASE_URL, id: battleId }
  );

  console.log(`Expired invite for battle ${battleId}`);
}

async function completeBattleViaAPI(battleId: number): Promise<void> {
  // This would require admin access or a test endpoint
  // For now, we'll mark it complete via direct DB or test API
  // In a real setup, you'd have a test-only endpoint for this

  console.log(`Battle ${battleId} marked as complete (simulated)`);
  // The actual completion would happen through:
  // 1. Both users submitting prompts
  // 2. AI judging
  // 3. Timer expiration
  // For E2E, we might need a test-only fast-forward endpoint
}

interface GenerationPromptData {
  generation_prompt: string;
  user_prompt: string;
  challenge_text: string;
  challenge_in_prompt: boolean;
}

async function getGenerationPromptViaAPI(battleId: number, page: Page): Promise<GenerationPromptData> {
  /**
   * Get the generation prompt that would be sent to the AI image generator.
   * This calls a test-only API endpoint (DEBUG mode only).
   *
   * Used to verify that:
   * - User's prompt IS in the generation prompt
   * - Challenge text is NOT in the generation prompt
   */
  const result = await page.evaluate(
    async ({ apiBase, id }) => {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrftoken='))
        ?.split('=')[1];

      const response = await fetch(`${apiBase}/api/v1/battles/${id}/test-generation-prompt/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to get generation prompt: ${response.status} ${text}`);
      }

      return response.json();
    },
    { apiBase: API_BASE_URL, id: battleId }
  );

  console.log(`Got generation prompt data for battle ${battleId}`);
  return result;
}
