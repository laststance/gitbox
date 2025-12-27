import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration for GitBox
 *
 * Features:
 * - Auth setup with cookie injection for Supabase + GitHub OAuth
 * - Separate projects for authenticated vs unauthenticated tests
 * - V8 code coverage collection with monocart-reporter
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

  /**
   * Don't fail the test run if tests are flaky (passed after retry).
   * This allows CI to pass when tests eventually succeed.
   */
  failOnFlakyTests: false,

  /**
   * Reporters: list for console output + monocart for coverage
   */
  reporter: [
    ['list'],
    [
      'monocart-reporter',
      {
        name: 'GitBox E2E Coverage Report',
        outputFile: './coverage-e2e/index.html',
        coverage: {
          reports: [
            ['v8'],
            ['html', { subdir: 'istanbul' }],
            ['lcovonly', { file: 'lcov.info' }],
            ['text-summary'],
            ['json-summary', { file: 'coverage-summary.json' }],
          ],
          entryFilter: {
            '**/node_modules/**': false,
            '**/_next/static/chunks/webpack*': false,
            '**/_next/static/chunks/polyfills*': false,
            '**/_next/static/**': true,
          },
          sourceFilter: {
            // Exclude: Server-side only code (E2E cannot trigger)
            '**/lib/actions/**': false,
            '**/lib/supabase/**': false,
            '**/app/auth/callback/**': false,
            '**/instrumentation*.ts': false,
            '**/sentry.*.config.ts': false,
            // Exclude: Test/dev infrastructure
            '**/tests/**': false,
            '**/mocks/**': false,
            '**/*.spec.ts': false,
            '**/*.test.ts': false,
            '**/*.test.tsx': false,
            '**/*.stories.tsx': false,
            '**/.storybook/**': false,
            // Exclude: Config & build
            '**/*.config.ts': false,
            '**/*.config.js': false,
            '**/*.config.mjs': false,
            '**/node_modules/**': false,
            '**/.next/**': false,
            // Include: Client code
            '**/app/**': true,
            '**/components/**': true,
            '**/lib/**': true,
            '**/packages/**': true,
          },
          sourcePath: (filePath: string) => {
            return filePath
              .replace(/^webpack:\/\/gitbox\//, '')
              .replace(/^\.\//g, '')
          },
        },
      },
    ],
  ],

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
     * Runs before authenticated tests.
     */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    /**
     * Unauthenticated tests: Landing page, login page, etc.
     * These don't require authentication state.
     */
    {
      name: 'unauthenticated',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /landing\.spec\.ts|login\.spec\.ts/,
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
      testMatch:
        /boards\.spec\.ts|kanban\.spec\.ts|settings\.spec\.ts|board-settings\.spec\.ts|add-repository-combobox\.spec\.ts|create-board\.spec\.ts|favorites\.spec\.ts/,
    },
  ],

  webServer: {
    /**
     * Build and start with test environment variables.
     *
     * CRITICAL: NEXT_PUBLIC_* vars must be set at BUILD time because Next.js
     * inlines them during the build process. Setting them only at runtime
     * (via env property below) is NOT sufficient.
     *
     * The env vars are explicitly set in the command to ensure they're
     * available during both build and start phases.
     *
     * NOTE: reuseExistingServer is set to false to ALWAYS use a fresh server
     * with correct test environment variables. If set to true and a dev server
     * (pnpm dev) is already running, it would be reused WITHOUT the test env vars,
     * causing isTestMode() to return false and auth bypass to fail.
     */
    command:
      'NEXT_PUBLIC_ENABLE_MSW_MOCK=true APP_ENV=test pnpm build && pnpm start',
    url: 'http://localhost:3008',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_ENABLE_MSW_MOCK: 'true',
      APP_ENV: 'test',
    },
  },
})
