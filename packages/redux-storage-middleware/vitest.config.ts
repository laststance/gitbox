/**
 * Vitest Configuration for redux-storage-middleware
 *
 * パッケージ固有のテスト設定
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**/*', 'dist/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'dist/'],
    },
  },
})
