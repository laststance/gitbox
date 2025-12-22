/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Vitest Configuration for redux-storage-middleware
 *
 * Uses Vitest 4.x browser mode with Playwright provider for real browser testing.
 * LocalStorage tests run in actual browser environment instead of jsdom mock.
 * Goal: 100% coverage
 *
 * Note: @ts-nocheck is required due to @types/node version mismatch in monorepo
 * causing incompatible vitest types between root and package.
 */

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          // Run headless in CI
        },
      }),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**/*', 'dist/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', 'tests/', 'dist/', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 78, // Lowered due to browser mode (SSR detection branches never hit)
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 15000,
  },
})
