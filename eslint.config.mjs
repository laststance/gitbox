// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
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
    '_trials/**',
    'src/lib/supabase/types.ts',
    'src/lib/supabase/database.types.ts',
    'src/lib/github/api.ts',
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
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Do not use localStorage directly. Use redux-storage-middleware.',
        },
        {
          name: 'fetch',
          message:
            'Use axios instead of fetch for MSW compatibility. Import from lib/axios.ts.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message:
            'Do not use window.localStorage directly. Use redux-storage-middleware.',
        },
        {
          object: 'globalThis',
          property: 'localStorage',
          message:
            'Do not use globalThis.localStorage directly. Use redux-storage-middleware.',
        },
      ],
      // Ban revalidatePath/revalidateTag - Supabase SDK doesn't use Next.js cache
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/cache',
              importNames: ['revalidatePath', 'revalidateTag'],
              message:
                'Supabase SDK does not use Next.js cache. Use Redux optimistic updates instead.',
            },
          ],
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
      '@laststance/react-next/no-forward-ref': 'error',
      '@laststance/react-next/no-context-provider': 'error',
      '@laststance/react-next/no-missing-key': 'error',
      '@laststance/react-next/no-duplicate-key': 'error',
      '@laststance/react-next/no-jsx-without-return': 'error',
      '@laststance/react-next/all-memo': 'error',
      '@laststance/react-next/no-use-reducer': 'error',
      '@laststance/react-next/no-set-state-prop-drilling': [
        'error',
        { depth: 1 },
      ],
      '@laststance/react-next/no-deopt-use-callback': 'error',
      '@laststance/react-next/prefer-stable-context-value': 'error',
      // Turn Off eslint-config-next/typescript defaults
      'import/no-anonymous-default-export': 'off',
    },
  },

  // Page components don't need memo
  {
    files: ['**/src/app/**/page.tsx'],
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
      // localStorage checks in tests are acceptable for verification.
      // Keep fetch banned for axios/MSW consistency.
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use axios instead of fetch for MSW compatibility. Import from lib/axios.ts.',
        },
      ],
      'no-restricted-properties': 'off',
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
      'src/components/ui/*-node.tsx',
      'src/components/ui/*-node-static.tsx',
      'src/components/ui/*-toolbar-button.tsx',
      'src/components/ui/*-toolbar.tsx',
      'src/components/ui/toolbar.tsx',
      'src/components/ui/comment.tsx',
      'src/components/ui/caption.tsx',
      'src/components/ui/calendar.tsx',
      'src/components/ui/command.tsx',
      'src/components/ui/resize-handle.tsx',
      'src/components/ui/inline-combobox.tsx',
      'src/components/ui/block-*.tsx',
      'src/components/ui/dropdown-menu.tsx',
      'src/components/ui/table-icons.tsx',
      'src/components/ui/alert-dialog.tsx',
      'src/components/ui/suggestion-*.tsx',
      'src/components/ui/editor.tsx',
      'src/components/ui/editor-static.tsx',
      'src/components/ui/media-*.tsx',
      'src/components/ui/fixed-toolbar*.tsx',
      'src/components/ui/floating-toolbar*.tsx',
      'src/components/editor/plugins/*.tsx',
      'src/components/editor/transforms.ts',
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

  // SSR hydration hooks - PHASE 1 COMPLETE (2025-12-31)
  // The following files were refactored to use useSyncExternalStore pattern:
  // - hooks/use-mounted.ts → useSyncExternalStore (server: false, client: true)
  // - components/Board/KanbanBoard.tsx → uses useMounted() hook
  // - app/page.tsx FeaturesSection → useSyncExternalStore for random subtitle
  // The no-initialize-state rule is now ENABLED for these files to enforce the pattern.

  // Phase 4 COMPLETE (2025-12-31): KanbanBoard data fetching exception REMOVED
  // Data is now fetched in Server Component (BoardPage) and passed to
  // BoardPageClient via props, eliminating the child-to-parent data flow.

  // BoardPageClient - PHASE 3 COMPLETE (2025-12-31)
  // Refactored: useLayoutEffect for theme, useMemo for derived addRepoStatusId
  // Remaining exception: theme application on change is still a side effect
  {
    files: ['**/src/app/board/*/BoardPageClient.tsx'],
    rules: {
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
      'react-you-might-not-need-an-effect/no-chain-state-updates': 'off',
    },
  },

  // Combobox/Dialog patterns - PHASE 2 & 3 COMPLETE (2025-12-31)
  // AddRepositoryCombobox: useEffectEvent for data fetching separation (Phase 2)
  // MaintenanceClient: event-driven data fetching in handleRestore (Phase 3)
  {
    files: [
      'src/components/Board/AddRepositoryCombobox.tsx',
      'src/app/maintenance/MaintenanceClient.tsx',
    ],
    rules: {
      // AddRepositoryCombobox: useEffect for isOpen triggers data fetching
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
      'react-you-might-not-need-an-effect/no-derived-state': 'off',
      // Chain pattern: fetch orgs first, then repos (intentional dependency)
      'react-you-might-not-need-an-effect/no-chain-state-updates': 'off',
    },
  },

  // Command palette - PHASE 3 COMPLETE (2025-12-31)
  // Refactored: autoFocus replaces focus useEffect, useLayoutEffect for scroll-into-view
  // Remaining exception: global ⌘K keyboard handler useEffect is intentional
  {
    files: ['src/components/CommandPalette/CommandPalette.tsx'],
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
