/**
 * Vitest Configuration
 *
 * Unit テスト設定
 * - React コンポーネントテスト
 * - Redux スライステスト
 * - ユーティリティ関数テスト
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    exclude: ['tests/e2e/**/*', 'node_modules/**/*', 'dist/**/*'],
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
      ],
    },
    alias: {
      '@gitbox/redux-storage-middleware':
        '/Users/ryotamurakami/laststance/gitbox/tests/__mocks__/@gitbox/redux-storage-middleware.ts',
    },
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
})
