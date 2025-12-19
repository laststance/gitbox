/**
 * Playwright Configuration
 *
 * E2E test configuration
 * - Browsers: Chrome, Firefox, Safari
 * - Screenshots: Captured for all User Stories
 * - Accessibility: Validated with @axe-core/playwright
 */

import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Timeout settings to prevent test hanging */
  globalTimeout: 5 * 60 * 1000, // 5 minutes - maximum time for entire test suite
  timeout: 60 * 1000, // 60 seconds - maximum time per test
  expect: {
    timeout: 10 * 1000, // 10 seconds - maximum time for expect() assertions
  },

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3008',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3008/login', // Use public login page for startup check
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 120 seconds - time to wait for server startup
    stdout: 'pipe', // Pipe server stdout for debugging
    stderr: 'pipe', // Pipe server stderr for debugging
  },
})
