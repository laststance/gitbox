// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'

import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import laststanceReactNextPlugin from '@laststance/react-next-eslint-plugin'
import tsPrefixer from 'eslint-config-ts-prefixer'
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect'

/**
 * Merge multiple config arrays and deduplicate plugins.
 * Required because eslint-config-next and eslint-config-ts-prefixer
 * both define 'import' and '@typescript-eslint' plugins.
 */
function dedupePlugins(...configArrays) {
  const merged = []
  const plugins = {}

  for (const configs of configArrays) {
    for (const config of configs) {
      if (config.plugins) {
        Object.assign(plugins, config.plugins)
        const { plugins: _, ...rest } = config
        if (Object.keys(rest).length > 0) merged.push(rest)
      } else {
        merged.push(config)
      }
    }
  }

  if (Object.keys(plugins).length > 0) {
    merged.unshift({ plugins })
  }

  return merged
}

export default defineConfig([
  // Core configs - dedupePlugins merges duplicate plugins (import, @typescript-eslint)
  ...dedupePlugins(nextVitals, nextTs, tsPrefixer),

  // React "You Might Not Need an Effect" rules
  reactYouMightNotNeedAnEffect.configs.recommended,

  // Global ignores
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

  // Project-specific rules
  {
    rules: {
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

  // @laststance/react-next-eslint-plugin rules
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

  // Page/Layout components don't need memo
  {
    files: ['**/app/**/page.tsx', '**/app/**/layout.tsx'],
    rules: {
      '@laststance/react-next/all-memo': 'off',
    },
  },

  // next.config allows require imports
  {
    files: ['next.config.js', 'next.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Test files - relaxed rules
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

  // Storybook files
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
      // Plate UI components use patterns that trigger these rules
      'react-you-might-not-need-an-effect/no-derived-state': 'off',
      'react-you-might-not-need-an-effect/no-pass-data-to-parent': 'off',
      'react-you-might-not-need-an-effect/no-initialize-state': 'off',
    },
  },

  // SSR hydration hooks - useMounted pattern is intentional for SSR safety
  {
    files: [
      'hooks/use-mounted.ts',
      // KanbanBoard.tsx uses isMounted pattern for SSR-safe grid styles
      'components/Board/KanbanBoard.tsx',
      // FeaturesSection uses random subtitle selection that must be client-side only
      'app/page.tsx',
    ],
    rules: {
      'react-you-might-not-need-an-effect/no-initialize-state': 'off',
    },
  },

  // KanbanBoard data fetching pattern - fetch on mount with dispatch is intentional
  {
    files: ['components/Board/KanbanBoard.tsx'],
    rules: {
      // Data fetching on mount with dispatch to parent store is the standard Redux pattern
      'react-you-might-not-need-an-effect/no-pass-data-to-parent': 'off',
    },
  },

  // BoardPageClient - theme application and state initialization patterns
  {
    files: ['**/app/board/*/BoardPageClient.tsx'],
    rules: {
      // Theme application on mount/change is an intentional side effect
      // State initialization when data loads is also intentional
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
      'react-you-might-not-need-an-effect/no-chain-state-updates': 'off',
    },
  },

  // Combobox/Dialog patterns - useEffect for data fetching on open is intentional
  {
    files: [
      'components/Board/AddRepositoryCombobox.tsx',
      'app/maintenance/MaintenanceClient.tsx',
    ],
    rules: {
      // Data fetching when dialog opens is a valid pattern
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
      'react-you-might-not-need-an-effect/no-derived-state': 'off',
    },
  },

  // Command palette - keyboard focus and scroll-into-view are intentional
  {
    files: ['components/CommandPalette/CommandPalette.tsx'],
    rules: {
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
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
