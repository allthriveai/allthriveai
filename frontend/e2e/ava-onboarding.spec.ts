import { test, expect } from '@playwright/test';
import { loginViaAPI } from './helpers';

/**
 * Ava Onboarding & Avatar Generation E2E Tests
 *
 * Tests the feelings-first home page onboarding flow:
 * 1. Intro message with typewriter effect
 * 2. Avatar creation with templates and photo upload
 * 3. Avatar generation via AI (Gemini)
 * 4. Accept avatar and verify profile update
 *
 * Run locally: npx playwright test ava-onboarding.spec.ts
 */
test.describe('Ava Onboarding Flow', () => {
  // Skip in CI - requires AI API keys (Gemini) for avatar generation
  test.skip(!!process.env.CI, 'Skipping avatar tests in CI - requires GOOGLE_API_KEY');
  test.setTimeout(120000); // 2 minutes for AI generation

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should display onboarding intro on /home', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');

    // Wait for onboarding to load
    await page.waitForTimeout(2000);

    // Should see Ava's intro with typewriter effect or the Create Avatar button
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });

    // Either we see the button directly, or we need to wait for typewriter
    const hasButton = await createAvatarButton.isVisible({ timeout: 20000 }).catch(() => false);

    expect(hasButton).toBe(true);
  });

  test('should show avatar template selector after clicking Create My Avatar', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Should see template options
    const wizardTemplate = page.getByRole('button', { name: /Wizard/i });
    const robotTemplate = page.getByRole('button', { name: /Robot/i });

    const hasWizard = await wizardTemplate.isVisible({ timeout: 10000 }).catch(() => false);
    const hasRobot = await robotTemplate.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasWizard || hasRobot).toBe(true);

    // Should see prompt textarea
    const promptInput = page.locator('textarea');
    await expect(promptInput).toBeVisible({ timeout: 5000 });

    // Should see photo upload section
    const uploadSection = page.getByText(/upload your photo/i);
    const hasUpload = await uploadSection.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasUpload).toBe(true);
  });

  test('should populate prompt when selecting a template', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Click Wizard template
    const wizardTemplate = page.getByRole('button', { name: /Wizard/i });
    await expect(wizardTemplate).toBeVisible({ timeout: 10000 });
    await wizardTemplate.click();
    await page.waitForTimeout(500);

    // Prompt should contain wizard description
    const promptInput = page.locator('textarea');
    const promptValue = await promptInput.inputValue();
    expect(promptValue.toLowerCase()).toContain('wizard');
  });

  test('should generate avatar from template and show preview', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Select Wizard template
    const wizardTemplate = page.getByRole('button', { name: /Wizard/i });
    await expect(wizardTemplate).toBeVisible({ timeout: 10000 });
    await wizardTemplate.click();
    await page.waitForTimeout(500);

    // Click Generate Avatar
    const generateButton = page.getByRole('button', { name: /Generate Avatar/i });
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    // Should show generating state
    const generatingText = page.getByText(/Generating|Connecting/i);
    await expect(generatingText).toBeVisible({ timeout: 10000 });

    // Wait for avatar preview (up to 60 seconds for AI)
    const useThisButton = page.getByRole('button', { name: /Use This Avatar/i });
    await expect(useThisButton).toBeVisible({ timeout: 60000 });

    // Should also see Try Again button
    const tryAgainButton = page.getByRole('button', { name: /Try Again/i });
    await expect(tryAgainButton).toBeVisible({ timeout: 5000 });
  });

  test('should accept avatar and update user profile', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Get initial avatar URL from settings page
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');
    const initialAvatarImg = page.locator('img[alt*="avatar" i], img[alt*="profile" i]').first();
    const initialAvatarSrc = await initialAvatarImg.getAttribute('src').catch(() => null);

    // Go back to home for onboarding
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Select Robot template (different from previous tests)
    const robotTemplate = page.getByRole('button', { name: /Robot/i });
    await expect(robotTemplate).toBeVisible({ timeout: 10000 });
    await robotTemplate.click();
    await page.waitForTimeout(500);

    // Generate avatar
    const generateButton = page.getByRole('button', { name: /Generate Avatar/i });
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();

    // Wait for preview
    const useThisButton = page.getByRole('button', { name: /Use This Avatar/i });
    await expect(useThisButton).toBeVisible({ timeout: 60000 });

    // Accept the avatar
    await useThisButton.click();

    // Wait for save to complete - should transition away from preview
    await page.waitForTimeout(3000);

    // Navigate to settings and verify avatar changed
    await page.goto('/account/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const newAvatarImg = page.locator('img[alt*="avatar" i], img[alt*="profile" i]').first();
    const newAvatarSrc = await newAvatarImg.getAttribute('src').catch(() => null);

    // Avatar should have changed (or exist if there wasn't one before)
    if (initialAvatarSrc) {
      expect(newAvatarSrc).not.toBe(initialAvatarSrc);
    } else {
      expect(newAvatarSrc).toBeTruthy();
    }
  });

  test('should allow skipping avatar creation', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Should see Skip button
    const skipButton = page.getByRole('button', { name: /Skip/i });
    await expect(skipButton).toBeVisible({ timeout: 5000 });
    await skipButton.click();

    // Should transition to main chat (feelings-first)
    await page.waitForTimeout(2000);

    // Should see the feelings input or main chat interface
    const chatInput = page.locator('textarea, input[type="text"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test('should allow trying again after avatar generation', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Select template and generate
    const astronautTemplate = page.getByRole('button', { name: /Astronaut/i });
    await expect(astronautTemplate).toBeVisible({ timeout: 10000 });
    await astronautTemplate.click();
    await page.waitForTimeout(500);

    const generateButton = page.getByRole('button', { name: /Generate Avatar/i });
    await generateButton.click();

    // Wait for preview
    const useThisButton = page.getByRole('button', { name: /Use This Avatar/i });
    await expect(useThisButton).toBeVisible({ timeout: 60000 });

    // Click Try Again
    const tryAgainButton = page.getByRole('button', { name: /Try Again/i });
    await expect(tryAgainButton).toBeVisible();
    await tryAgainButton.click();

    // Should go back to template selector
    await page.waitForTimeout(1000);
    const wizardTemplate = page.getByRole('button', { name: /Wizard/i });
    await expect(wizardTemplate).toBeVisible({ timeout: 10000 });

    // Should be able to generate again
    const generateButton2 = page.getByRole('button', { name: /Generate Avatar/i });
    await expect(generateButton2).toBeVisible({ timeout: 5000 });
  });

  test('should disable generate button with empty prompt', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Clear the prompt
    const promptInput = page.locator('textarea');
    await promptInput.fill('');

    // Generate button should be disabled
    const generateButton = page.getByRole('button', { name: /Generate Avatar/i });
    const isDisabled = await generateButton.isDisabled();
    expect(isDisabled).toBe(true);
  });
});

/**
 * Avatar Generation with Reference Photo Tests
 *
 * Tests the "Make Me" flow where user uploads their photo
 */
test.describe('Avatar with Reference Photo', () => {
  test.skip(!!process.env.CI, 'Skipping avatar tests in CI - requires GOOGLE_API_KEY');
  test.setTimeout(180000); // 3 minutes for photo upload + AI generation

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should upload photo and generate personalized avatar', async ({ page }) => {
    // Track network requests to verify reference image is sent
    const apiRequests: { url: string; body?: string }[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('avatar-sessions/start') || url.includes('upload')) {
        apiRequests.push({
          url,
          body: request.postData() || undefined,
        });
      }
    });

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // Create a test image file
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68,
      0x36, 0x00, 0x00, 0x00, 0x1C, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x62, 0x60, 0x60, 0x60, 0x60,
      0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
      0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
      0x00, 0x00, 0x00, 0x41, 0x00, 0x01, 0x5A, 0xE3,
      0x2B, 0x79, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]);

    // Upload the test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-photo.png',
      mimeType: 'image/png',
      buffer: testImageBuffer,
    });

    // Wait for upload to complete
    await page.waitForTimeout(3000);

    // Should show photo preview
    const photoPreview = page.locator('img[alt*="uploaded" i], img[alt*="preview" i], img[alt*="photo" i]');
    await expect(photoPreview).toBeVisible({ timeout: 10000 });

    // Prompt should be auto-filled with "make me" text
    const promptInput = page.locator('textarea');
    const promptValue = await promptInput.inputValue();
    expect(promptValue.toLowerCase()).toContain('look');

    // Generate button should be enabled
    const generateButton = page.getByRole('button', { name: /Generate Avatar/i });
    await expect(generateButton).toBeEnabled({ timeout: 5000 });

    // Generate the avatar
    await generateButton.click();

    // Wait for avatar to be generated
    const useThisButton = page.getByRole('button', { name: /Use This Avatar/i });
    await expect(useThisButton).toBeVisible({ timeout: 90000 });

    // Verify the session was started with reference image
    const startRequest = apiRequests.find((r) => r.url.includes('avatar-sessions/start'));
    if (startRequest?.body) {
      expect(startRequest.body).toContain('referenceImageUrl');
    }
  });

  test('should combine photo upload with template style', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Create My Avatar
    const createAvatarButton = page.getByRole('button', { name: /Create My Avatar/i });
    await expect(createAvatarButton).toBeVisible({ timeout: 20000 });
    await createAvatarButton.click();
    await page.waitForTimeout(1000);

    // First upload a photo
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68,
      0x36, 0x00, 0x00, 0x00, 0x1C, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x62, 0x60, 0x60, 0x60, 0x60,
      0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
      0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
      0x00, 0x00, 0x00, 0x41, 0x00, 0x01, 0x5A, 0xE3,
      0x2B, 0x79, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'my-photo.png',
      mimeType: 'image/png',
      buffer: testImageBuffer,
    });
    await page.waitForTimeout(2000);

    // Then select a template to apply that style
    const wizardTemplate = page.getByRole('button', { name: /Wizard/i });
    await wizardTemplate.click();
    await page.waitForTimeout(500);

    // Prompt should now combine both
    const promptInput = page.locator('textarea');
    const promptValue = await promptInput.inputValue();

    // Should mention wizard style
    expect(promptValue.toLowerCase()).toContain('wizard');

    // Photo should still be shown
    const photoPreview = page.locator('img[alt*="uploaded" i], img[alt*="preview" i]');
    await expect(photoPreview).toBeVisible({ timeout: 5000 });

    // Generate should work
    const generateButton = page.getByRole('button', { name: /Generate Avatar/i });
    await expect(generateButton).toBeEnabled();
  });
});
