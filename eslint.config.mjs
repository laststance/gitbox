import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import laststanceReactNextPlugin from '@laststance/react-next-eslint-plugin'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  globalIgnores([
    '**/.vscode/**',
    '**/node_modules/**',
    '**/build/**',
    '**/dist/**',
    '**/.github/**',
    '**/.git/**',
    '**/.idea/**',
    '.next/**',
    'out/**',
    'next-env.d.ts',
    '**/storybook-static/**',
    '**/mockServiceWorker.js',
    '**/tests-examples/**',
    './playwright-report/**',
    './test-results/**',
    './e2e/tablet/**',
    './e2e/tablet-landscape/**',
    '.storybook/**',
    '**/.husky/**',
    'lib/supabase/types.ts',
    'lib/supabase/database.types.ts',
    'lib/github/api.ts',
    'tests/e2e/**',
    '**/*.backup/**',
    '**/.backup/**',
    '**/coverage/**',
    'public/sw.js',
  ]),
  {
    plugins: {
      '@laststance/react-next': laststanceReactNextPlugin,
    },
    rules: {
      '@laststance/react-next/no-jsx-without-return': 'error',
      '@laststance/react-next/all-memo': 'warn', // TODO: Fix and change to 'error'
      '@laststance/react-next/no-use-reducer': 'error',
      '@laststance/react-next/no-set-state-prop-drilling': 'warn', // TODO: Fix and change to 'error'
      '@laststance/react-next/no-deopt-use-callback': 'error',
      '@laststance/react-next/prefer-stable-context-value': 'error',
      '@laststance/react-next/no-unstable-classname-prop': 'warn', // TODO: Fix and change to 'error'
      // Turn Off eslint-config-next/typescript defaults
      'import/no-anonymous-default-export': 'off',
      // Temporarily allow unescaped entities for i18n strings
      'react/no-unescaped-entities': 'warn',
    },
  },
  {
    files: ['**/app/**/page.tsx', '**/app/**/layout.tsx'],
    rules: {
      '@laststance/react-next/all-memo': 'off',
    },
  },
  {
    files: ['next.config.js', 'next.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'tests/**/*',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Disable react-hooks compiler rules for files with complex memoization patterns
    files: [
      'components/CommandPalette/CommandPalette.tsx',
      'components/Sidebar/Sidebar.tsx',
      'components/Modals/ProjectInfoModal.tsx',
    ],
    rules: {
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      '@laststance/react-next/no-deopt-use-callback': 'off',
    },
  },
])
