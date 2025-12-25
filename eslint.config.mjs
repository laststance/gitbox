// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'

import { defineConfig, globalIgnores } from 'eslint/config'
import { fixupConfigRules } from '@eslint/compat'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import laststanceReactNextPlugin from '@laststance/react-next-eslint-plugin'
import tsPrefixer from 'eslint-config-ts-prefixer'

// Helper to merge configs and deduplicate plugins
function mergeConfigs(...configArrays) {
  const merged = []
  const allPlugins = {}

  for (const configArray of configArrays) {
    const fixed = fixupConfigRules(configArray)
    for (const config of fixed) {
      if (config.plugins) {
        // Merge plugins into a single object
        Object.assign(allPlugins, config.plugins)
        // Remove plugins from this config to avoid redefinition
        const { plugins, ...rest } = config
        if (Object.keys(rest).length > 0) {
          merged.push(rest)
        }
      } else {
        merged.push(config)
      }
    }
  }

  // Add all plugins in a single config object if any exist
  if (Object.keys(allPlugins).length > 0) {
    merged.push({ plugins: allPlugins })
  }

  return merged
}

export default defineConfig([
  ...mergeConfigs(nextVitals, nextTs, tsPrefixer),
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
    // Config files not in tsconfig
    'eslint.config.mjs',
    'postcss.config.mjs',
    'tailwind.config.js',
    'playwright.config.ts',
    // Package examples (have their own ESLint configs)
    '**/packages/**/examples/**',
  ]),
  {
    plugins: {
      '@laststance/react-next': laststanceReactNextPlugin,
    },
    rules: {
      'react/jsx-no-useless-fragment': 'error',
      'react/display-name': 'error',
      'react/button-has-type': 'error',
      '@laststance/react-next/no-jsx-without-return': 'error',
      '@laststance/react-next/all-memo': 'error',
      '@laststance/react-next/no-use-reducer': 'error',
      '@laststance/react-next/no-set-state-prop-drilling': [
        'error',
        { depth: 1 },
      ],
      '@laststance/react-next/no-deopt-use-callback': 'error',
      '@laststance/react-next/prefer-stable-context-value': 'error',
      // Disable no-unstable-classname-prop - cn() is necessary for shadcn/ui patterns
      '@laststance/react-next/no-unstable-classname-prop': 'off',
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
])
