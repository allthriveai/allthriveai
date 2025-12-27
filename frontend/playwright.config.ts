import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load e2e environment variables
dotenv.config({ path: path.resolve(__dirname, 'e2e/.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on failure to handle transient DB connection issues */
  retries: process.env.CI ? 2 : 1,
  /* Limit workers to avoid DB connection exhaustion */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  /* Global timeout for each test - increased for CI environment */
  timeout: 120 * 1000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /* Video recording on failure */
    video: process.env.CI ? 'on-first-retry' : 'off',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Critical E2E tests - run on every PR to catch real-time regressions
    {
      name: 'critical',
      testMatch: '**/critical/**/*.spec.ts',
      timeout: 120 * 1000,
      retries: 2,
      use: {
        ...devices['Desktop Chrome'],
        trace: 'on-first-retry',
      },
    },
    // Regression tests - run on every PR to catch breaking changes
    // These test critical user flows and common failure points
    {
      name: 'regression',
      testMatch: '**/regression/**/*.spec.ts',
      timeout: 90 * 1000, // 90 seconds per test (includes AI quality checks)
      retries: 2,
      use: {
        ...devices['Desktop Chrome'],
        trace: 'on-first-retry',
      },
    },
    // Deep E2E tests - run nightly with extended timeouts for real AI calls
    // Reduced workers to avoid DB connection pool exhaustion
    {
      name: 'deep',
      testMatch: '**/deep/**/*.spec.ts',
      timeout: 300 * 1000, // 5 minutes per test
      retries: 1,
      workers: 2, // Reduced from default 4 to prevent DB connection exhaustion
      use: {
        ...devices['Desktop Chrome'],
        video: 'on',
        trace: 'on',
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      VITE_API_PROXY_TARGET: 'http://127.0.0.1:8000',
      VITE_WS_URL: 'ws://127.0.0.1:8000',
    },
  },
});
