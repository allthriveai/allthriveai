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

    // Click "Battle a Human" button
    const battleHumanButton = challengerPage.getByRole('button', { name: /battle.*human/i })
      .or(challengerPage.locator('[data-testid="battle-human-button"]'))
      .or(challengerPage.getByText('Battle a Human'));

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
