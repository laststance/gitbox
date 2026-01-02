/**
 * Vitest Configuration
 *
 * Unit test configuration
 * - React component tests
 * - Redux slice tests
 * - Utility function tests
 */

import { fileURLToPath } from 'node:url'
import path from 'path'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Pre-bundle dependencies to prevent Vite re-optimization during tests
  optimizeDeps: {
    include: ['superjson', 'lz-string'],
  },
  test: {
    // Load environment variables from .env.test (mode defaults to 'test' in vitest)
    // Empty prefix '' loads ALL env vars, not just VITE_* prefixed ones
    env: loadEnv(mode, process.cwd(), ''),
    // Shared configuration
    globals: true,
    coverage: {
      // V8 is stable for CI, Istanbul supports browser mode (Storybook) but has CI issues
      // Use VITEST_COVERAGE_PROVIDER=istanbul locally to include Storybook coverage
      provider:
        (process.env.VITEST_COVERAGE_PROVIDER as 'v8' | 'istanbul') || 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        '*.config.js',
        '.next/',
        'dist/',
        // Supabase-related files (DB communication - tested via integration tests)
        'lib/actions/**',
        'lib/supabase/**',
        // CSS files (not testable via code coverage)
        'styles/**',
        // MSW mock handlers (test utilities, not production code)
        'mocks/**',
        // SVG icon definitions (no logic to test)
        'components/ui/table-icons.tsx',
        // App router pages (Server Components - tested via E2E)
        'app/**/page.tsx',
        'app/**/layout.tsx',
        'app/**/route.ts',
        'app/**/error.tsx',
        'app/**/loading.tsx',
        // MSW provider (test utility)
        'app/msw-provider.tsx',
        // Next.js proxy/middleware (tested via E2E)
        'proxy.ts',
      ],
    },
    // Two separate test projects: unit tests (happy-dom) and Storybook (browser)
    projects: [
      // Unit tests project (happy-dom environment - faster than jsdom)
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
          exclude: ['e2e/**/*', 'node_modules/**/*', 'dist/**/*'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
      // Storybook tests project (browser environment with Playwright)
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
            // Script to start Storybook (--no-open prevents browser opening)
            storybookScript: 'pnpm storybook --no-open',
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/components': path.resolve(__dirname, './components'),
      '@/app': path.resolve(__dirname, './app'),
      '@/styles': path.resolve(__dirname, './styles'),
    },
  },
}))
