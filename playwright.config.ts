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
const AUTH_FILE = 'e2e/.auth/user.json'

export default defineConfig({
  testDir: './e2e',

  /**
   * Disable full parallel execution for MSW compatibility.
   * MSW handlers share state within a process, so tests must run
   * sequentially within each worker to avoid state conflicts.
   */
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  /**
   * Worker configuration:
   * - CI: 1 worker for consistent, reproducible results
   * - Local: 4 workers (stable parallelization)
   *
   * Rationale: Testing showed workers=4 is reliably stable. Workers=6+ can
   * cause intermittent failures due to race conditions in MSW's shared mock
   * state (mockBoards in mocks/handlers.ts). Workers=4 provides good balance
   * between speed (~45s) and reliability.
   *
   * Performance improvement: 1 worker (2m+) → 4 workers (~45s) = ~60% faster
   */
  workers: process.env.CI ? 1 : undefined,

  /**
   * Don't fail the test run if tests are flaky (passed after retry).
   * This allows CI to pass when tests eventually succeed.
   */
  failOnFlakyTests: false,

  /**
   * Reporters:
   * - CI: blob (for shard merging) + monocart (for coverage)
   * - Local: list + monocart (for coverage)
   *
   * NOTE: blob reporter is required for CI sharding. It generates
   * `blob-report/` directory with test results that are merged by
   * `playwright merge-reports` in the merge-reports job.
   */
  reporter: process.env.CI
    ? [
        ['blob'],
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
      ]
    : [
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
      testMatch: 'auth.setup.ts',
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
      testMatch: /unauthenticated\/.*[.]spec.ts/,
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
      testMatch: /logged-in\/.*[.]spec.ts/,
    },
  ],

  /**
   * webServer: Build and start a local Next.js server.
   *
   * CRITICAL: NEXT_PUBLIC_* vars must be set at BUILD time because Next.js
   * inlines them during the build process.
   *
   * NOTE: reuseExistingServer is set to false to ALWAYS use a fresh server
   * with correct test environment variables. If set to true and a dev server
   * (pnpm dev) is already running, it would be reused WITHOUT the test env vars,
   * causing isTestMode() to return false and auth bypass to fail.
   */
  webServer: {
    command:
      'NEXT_PUBLIC_ENABLE_MSW_MOCK=true APP_ENV=test NEXT_PUBLIC_SUPABASE_URL=https://jqtxjzdxczqwsrvevmyk.supabase.co pnpm build && pnpm start',
    url: 'http://localhost:3008',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_ENABLE_MSW_MOCK: 'true',
      APP_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://jqtxjzdxczqwsrvevmyk.supabase.co',
    },
  },
})
