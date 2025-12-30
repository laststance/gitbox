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
      // Ban global fetch - use axios instead for MSW compatibility
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use axios instead of fetch for MSW compatibility. Import from lib/axios.ts.',
        },
      ],
      // Ban console usage - use logger (server) or Sentry (client) instead
      'no-console': 'error',
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
    'e2e/**',
    '**/*.backup/**',
    '**/.backup/**',
    '**/coverage/**',
    '**/coverage-e2e/**',
    'public/sw.js',
    // Config files not in tsconfig
    'eslint.config.mjs',
    'postcss.config.mjs',
    'tailwind.config.js',
    'playwright.config.ts',
    // Package examples (have their own ESLint configs)
    '**/packages/**/examples/**',
    // Package benchmarks use console.log for output
    '**/packages/**/benchmarks/**',
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
      // Allow console in tests for debugging and performance metrics
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.stories.tsx', '**/*.stories.ts'],
    rules: {
      // Allow console in Storybook stories for demo callbacks
      'no-console': 'off',
    },
  },
  // Plate UI components from registry - relax rules for auto-generated code
  {
    files: [
      'components/ui/*-node.tsx',
      'components/ui/*-node-static.tsx',
      'components/ui/*-toolbar-button.tsx',
      'components/ui/*-toolbar.tsx',
      'components/ui/toolbar.tsx',
      'components/ui/comment.tsx',
      'components/ui/caption.tsx',
      'components/ui/calendar.tsx',
      'components/ui/command.tsx',
      'components/ui/resize-handle.tsx',
      'components/ui/inline-combobox.tsx',
      'components/ui/block-*.tsx',
      'components/ui/dropdown-menu.tsx',
      'components/ui/table-icons.tsx',
      'components/ui/alert-dialog.tsx',
      'components/ui/suggestion-*.tsx',
      'components/ui/editor.tsx',
      'components/ui/editor-static.tsx',
      'components/ui/media-*.tsx',
      'components/ui/fixed-toolbar*.tsx',
      'components/ui/floating-toolbar*.tsx',
      'components/editor/plugins/*.tsx',
      'components/editor/transforms.ts',
    ],
    rules: {
      '@laststance/react-next/all-memo': 'off',
      'react/display-name': 'off',
      'react/jsx-no-useless-fragment': 'off',
      'import/no-cycle': 'off',
      'import/order': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/promise-function-async': 'off',
      '@next/next/no-img-element': 'off',
      // Allow console.warn in Plate editor transforms (external library pattern)
      'no-console': 'off',
    },
  },
  // Package internal code - allow structured logging for library consumers
  {
    files: ['packages/**/src/**/*.ts'],
    rules: {
      // Library code uses console.error for consumer-facing error messages
      'no-console': ['error', { allow: ['error'] }],
    },
  },
])
