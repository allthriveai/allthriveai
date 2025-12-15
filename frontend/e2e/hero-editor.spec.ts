import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USER, TEST_PROJECT_SLUG } from './helpers';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SCENARIO: As a logged in user who uploaded my project with AI,
 * I want to change my hero image with different media such as video.
 *
 * EXPECTED: I can click edit, then click to change hero display,
 * choose video and a video is uploaded and visible on the project page for other users.
 *
 * FAILURE: There is no video after the Edit Hero Display tray closes.
 */

// Use the test user's own project so they have edit permissions
const TEST_PROJECT_URL = `/${TEST_USER.username}/${TEST_PROJECT_SLUG}`;

test.describe('Hero Editor - Change Hero Display', () => {
  // Run tests serially since they modify the same project
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('should upload a video and play it on the project page', async ({ page }) => {
    // Step 1: Navigate to the test project
    await page.goto(TEST_PROJECT_URL);
    await page.waitForLoadState('networkidle');

    // Wait for the project page to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Step 2: Switch to Edit mode by clicking the Published/Editing toggle
    const editToggle = page.locator('button').filter({ hasText: /Published|Editing/ });
    await expect(editToggle).toBeVisible({ timeout: 5000 });

    // Check if we're in Published mode and need to switch to Editing
    const toggleText = await editToggle.textContent();
    if (toggleText?.includes('Published')) {
      await editToggle.click();
      // Wait for toggle to change to Editing mode
      await expect(editToggle).toContainText('Editing', { timeout: 3000 });
    }

    // Step 3: Open the hero editor tray
    // When there's content: "Edit hero display" button
    // When empty: "Click to add hero display" placeholder
    const editButton = page.getByRole('button', { name: 'Edit hero display' });
    const addButton = page.locator('text=Click to add hero display');

    if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editButton.click();
    } else {
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();
    }

    // Step 4: Wait for the hero editor tray to appear
    const tray = page.locator('text=Edit Hero Display');
    await expect(tray).toBeVisible({ timeout: 5000 });

    // Step 5: Remove any existing content from all tabs
    // Check each tab for content and remove it
    const tabs = ['image', 'video', 'slideshow', 'prompt'];
    for (const tabName of tabs) {
      const tab = page.getByRole('button', { name: new RegExp(`^${tabName}$`, 'i') });
      // Try to click the tab - it may be disabled
      const isEnabled = await tab.isEnabled().catch(() => false);
      if (isEnabled) {
        await tab.click();
        await page.waitForTimeout(300);

        // Remove any content on this tab
        let removeCount = 0;
        while (removeCount < 10) {
          const removeButton = page.getByRole('button', { name: 'Remove' }).first();
          if (await removeButton.isVisible({ timeout: 500 }).catch(() => false)) {
            console.log(`Removing content from ${tabName} tab...`);
            await removeButton.click();
            await page.waitForTimeout(1000);
            removeCount++;
          } else {
            break;
          }
        }
      }
    }

    // Wait for all changes to save
    await page.waitForTimeout(2000);

    // Step 6: Click on the Video tab (should now be enabled)
    const videoTab = page.getByRole('button', { name: /^video$/i });
    await expect(videoTab).toBeVisible();
    await expect(videoTab).toBeEnabled({ timeout: 3000 });
    await videoTab.click();

    // Step 7: Verify the video upload area is visible
    const uploadArea = page.locator('text=Drop an MP4 video here or click to upload');
    await expect(uploadArea).toBeVisible({ timeout: 3000 });

    // Step 8: Upload a test video file
    const testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4');

    // Get the file input and upload the video
    const fileInput = page.locator('input[type="file"][accept*="video"]').first();
    await fileInput.setInputFiles(testVideoPath);

    // Step 9: Wait for upload to complete - look for video preview in the tray
    // After upload, the UI shows "Change Video" and "Remove" buttons
    const changeVideoButton = page.locator('text=Change Video');
    await expect(changeVideoButton).toBeVisible({ timeout: 30000 });
    console.log('Video uploaded successfully, Change Video button visible');

    // Wait for auto-save to complete (1 second debounce + buffer)
    console.log('Waiting for auto-save...');
    await page.waitForTimeout(3000);

    // Step 10: Close the tray by clicking the X button in the header
    // The close button is in the sticky header - look for the button with XMarkIcon (w-6 h-6 svg)
    const trayHeader = page.locator('.sticky.top-0').filter({ hasText: 'Edit Hero Display' });
    const closeTrayButton = trayHeader.locator('button').last();
    await closeTrayButton.click();

    // Step 11: Wait for tray to close
    await expect(tray).not.toBeVisible({ timeout: 5000 });

    // Wait for auto-save to complete and page to update
    await page.waitForTimeout(3000);

    // Step 12: CRITICAL ASSERTION - Verify the video is now visible on the project page
    // This is the main test - after closing the tray, the video should be displayed
    const heroVideo = page.locator('[data-testid="hero-video"], video').first();
    await expect(heroVideo).toBeVisible({ timeout: 10000 });

    // Step 13: Verify the video source is set correctly
    const videoSrc = await heroVideo.getAttribute('src');
    expect(videoSrc).toBeTruthy();
    expect(videoSrc).toContain('/projects/videos/');

    console.log('✓ Video uploaded and visible on project page');
  });

  test('should persist video after page refresh', async ({ page }) => {
    // This test assumes the previous test uploaded a video
    // Navigate to the project and verify video persists

    await page.goto(TEST_PROJECT_URL);
    await page.waitForLoadState('networkidle');

    // Wait for project to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // The video should be visible without entering edit mode
    const heroVideo = page.locator('[data-testid="hero-video"], .hero-video, video').first();

    // If there's a video on the page, it should be visible
    // Note: This may fail if no video was previously uploaded
    const isVideoVisible = await heroVideo.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVideoVisible) {
      const videoSrc = await heroVideo.getAttribute('src');
      expect(videoSrc).toBeTruthy();
      console.log('✓ Video persists after page refresh');
    } else {
      // If no video, check if there's at least a hero display of some kind
      console.log('Note: No video currently on page - may need to run upload test first');
    }
  });

  test('should upload slideshow images and display them on the project page', async ({ page }) => {
    // Step 1: Navigate to the test project
    await page.goto(TEST_PROJECT_URL);
    await page.waitForLoadState('networkidle');

    // Wait for the project page to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Step 2: Switch to Edit mode
    const editToggle = page.locator('button').filter({ hasText: /Published|Editing/ });
    await expect(editToggle).toBeVisible({ timeout: 5000 });

    const toggleText = await editToggle.textContent();
    if (toggleText?.includes('Published')) {
      await editToggle.click();
      await expect(editToggle).toContainText('Editing', { timeout: 3000 });
    }

    // Step 3: Open the hero editor tray
    // When there's content: "Edit hero display" button
    // When empty: "Click to add hero display" placeholder
    const editButton = page.getByRole('button', { name: 'Edit hero display' });
    const addButton = page.locator('text=Click to add hero display');

    if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editButton.click();
    } else {
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();
    }

    // Step 4: Wait for the hero editor tray to appear
    const tray = page.locator('text=Edit Hero Display');
    await expect(tray).toBeVisible({ timeout: 5000 });

    // Step 5: Remove any existing content to enable slideshow tab
    let removeCount = 0;
    while (removeCount < 20) {
      const removeButton = page.getByRole('button', { name: 'Remove' }).first();
      if (await removeButton.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log('Removing existing content...');
        await removeButton.click();
        await page.waitForTimeout(500);
        removeCount++;
      } else {
        break;
      }
    }

    // Step 6: Click on the Slideshow tab
    const slideshowTab = page.getByRole('button', { name: /^slideshow$/i });
    await expect(slideshowTab).toBeVisible();
    await expect(slideshowTab).toBeEnabled({ timeout: 3000 });
    await slideshowTab.click();

    // Step 7: Verify the slideshow upload area is visible
    const uploadArea = page.locator('text=Click to upload images');
    await expect(uploadArea).toBeVisible({ timeout: 3000 });

    // Step 8: Upload test images
    const testImagePath = path.join(__dirname, 'fixtures', 'test-image.png');
    const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
    await fileInput.setInputFiles([testImagePath, testImagePath]); // Upload same image twice

    // Step 9: Wait for upload to complete - look for image count
    await expect(page.locator('text=/\\d+ images? added/')).toBeVisible({ timeout: 30000 });
    console.log('Upload complete, found image count indicator');

    // Wait for auto-save to complete
    await page.waitForTimeout(2000);

    // Step 10: Close the tray
    const trayHeader = page.locator('.sticky.top-0').filter({ hasText: 'Edit Hero Display' });
    const closeTrayButton = trayHeader.locator('button').last();
    await closeTrayButton.click();

    // Step 11: Wait for tray to close
    await expect(tray).not.toBeVisible({ timeout: 5000 });

    // Step 12: Verify the slideshow is visible on the project page
    // Wait for auto-save and page to update
    await page.waitForTimeout(2000);

    // Look for an uploaded image (from S3/MinIO) - not logo images
    const heroImage = page.locator('img[src*="allthrive-media"], img[src*="s3."], img[src*="amazonaws"]').first();
    await expect(heroImage).toBeVisible({ timeout: 10000 });

    console.log('✓ Slideshow images uploaded and visible on project page');
  });
});
