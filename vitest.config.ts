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
import { defineConfig } from 'vitest/config'
const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon

export default defineConfig({
  plugins: [react()],
  // Pre-bundle dependencies to prevent Vite re-optimization during tests
  optimizeDeps: {
    include: ['superjson', 'lz-string'],
  },
  test: {
    // Shared configuration
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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
      ],
    },
    // Two separate test projects: unit tests (jsdom) and Storybook (browser)
    projects: [
      // Unit tests project (jsdom environment)
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
          exclude: ['tests/e2e/**/*', 'node_modules/**/*', 'dist/**/*'],
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
      // Monorepo package alias for CI compatibility
      '@gitbox/redux-storage-middleware': path.resolve(
        __dirname,
        './packages/redux-storage-middleware/dist',
      ),
    },
  },
})
