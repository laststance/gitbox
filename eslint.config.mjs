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
    'lib/github/api.ts',
    'tests/e2e/**',
  ]),
  {
    plugins: {
      '@laststance/react-next': laststanceReactNextPlugin,
    },
    rules: {
      '@laststance/react-next/no-jsx-without-return': 'error',
      '@laststance/react-next/all-memo': 'error',
      '@laststance/react-next/no-use-reducer': 'error',
      '@laststance/react-next/no-set-state-prop-drilling': 'error',
      '@laststance/react-next/no-deopt-use-callback': 'error',
      '@laststance/react-next/prefer-stable-context-value': 'error',
      '@laststance/react-next/no-unstable-classname-prop': 'error',
      // Turn Off eslint-config-next/typescript defaults
      'import/no-anonymous-default-export': 'off',
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
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'tests/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
