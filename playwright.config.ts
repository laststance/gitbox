import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration for GitBox
 *
 * Configures auth setup with cookie injection for Supabase + GitHub OAuth,
 * and logged-in test projects that depend on the auth state.
 */

/** Path to store authenticated state for reuse across tests */
const AUTH_FILE = 'tests/e2e/.auth/user.json'

export default defineConfig({
  testDir: './tests/e2e',

  /**
   * Disable parallel execution for MSW compatibility.
   * MSW handlers need consistent state across tests.
   */
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,

  reporter: [['html', { outputFolder: 'playwright-report' }]],

  timeout: 60000,

  use: {
    baseURL: 'http://localhost:3008',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    /**
     * Setup project: Injects auth cookies to bypass OAuth flow.
     * Runs before all other projects that need authentication.
     */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    /**
     * Logged-in tests: Tests that require authenticated state.
     * Depends on 'setup' project and uses its stored auth state.
     */
    {
      name: 'logged-in',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3008',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_ENABLE_MSW_MOCK: 'true',
      APP_ENV: 'test',
    },
  },
})
