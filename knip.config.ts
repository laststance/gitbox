import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  // Entry points for the project (beyond what plugins auto-detect)
  entry: [
    // MSW setup (dynamically required in layout.tsx)
    'app/msw-provider.tsx',
    'mocks/server.ts',

    // Custom hooks
    'hooks/**/*.ts',

    // Redux store
    'lib/redux/providers.tsx',
    'lib/redux/store.ts',
  ],

  project: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'],

  // Ignore generated/build outputs
  ignore: [
    '.next/**',
    'storybook-static/**',
    'coverage/**',
    'coverage-e2e/**',
    'playwright-report/**',
    'blob-report/**',
    'public/mockServiceWorker.js',
    'next-env.d.ts',
    'lib/supabase/database.types.ts',
  ],

  // Dynamic dependencies (CSS-only - not detectable by Knip)
  // - tw-animate-css: @import 'tw-animate-css' in globals.css
  // - tailwindcss-animate: @plugin "tailwindcss-animate" in globals.css
  // - tailwind-scrollbar-hide: @plugin "tailwind-scrollbar-hide" in globals.css
  ignoreDependencies: [
    'tw-animate-css',
    'tailwindcss-animate',
    'tailwind-scrollbar-hide',
  ],

  // Plugin configurations (plugins auto-detect their dependencies)
  next: {
    entry: ['next.config.ts'],
  },

  storybook: {
    entry: [
      '.storybook/main.ts',
      '.storybook/preview.tsx',
      '.storybook/vitest.setup.ts',
    ],
    project: ['**/*.stories.tsx', '**/*.stories.ts'],
  },

  vitest: {
    entry: ['vitest.config.ts'],
    project: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/setup.ts'],
  },

  playwright: {
    entry: ['playwright.config.ts'],
    project: ['e2e/**/*.spec.ts', 'e2e/auth.setup.ts', 'e2e/helpers/**/*.ts'],
  },

  eslint: {
    entry: ['eslint.config.mjs'],
  },

  postcss: {
    entry: ['postcss.config.mjs'],
  },

  // Rules
  rules: {
    files: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    unlisted: 'error',
    exports: 'warn',
    types: 'warn',
    duplicates: 'error',
    enumMembers: 'off',
    classMembers: 'warn',
  },

  ignoreExportsUsedInFile: true,
}

export default config
