// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { defineConfig, globalIgnores } from 'eslint/config'
import nextPlugin from '@next/eslint-plugin-next'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'
import laststanceReactNextPlugin from '@laststance/react-next-eslint-plugin'
import tsPrefixer from 'eslint-config-ts-prefixer'
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import browserSecurity from 'eslint-plugin-browser-security'

export default defineConfig([
  // ts-prefixer: @typescript-eslint + import-x + parser
  ...tsPrefixer,

  // Override ts-prefixer legacy resolver with new import-x/resolver-next format
  {
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
        }),
      ],
    },
  },

  // React "You Might Not Need an Effect" rules (explicit instead of configs.recommended)
  {
    plugins: {
      'react-you-might-not-need-an-effect': reactYouMightNotNeedAnEffect,
    },
    rules: {
      'react-you-might-not-need-an-effect/no-adjust-state-on-prop-change':
        'error',
      'react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change':
        'error',
      'react-you-might-not-need-an-effect/no-event-handler': 'error',
      'react-you-might-not-need-an-effect/no-pass-live-state-to-parent':
        'error',
      'react-you-might-not-need-an-effect/no-pass-data-to-parent': 'error',
      'react-you-might-not-need-an-effect/no-initialize-state': 'error',
      'react-you-might-not-need-an-effect/no-chain-state-updates': 'error',
      'react-you-might-not-need-an-effect/no-derived-state': 'error',
    },
  },

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
    // supabase start drops transient edge-runtime sources here while local Supabase runs
    'supabase/.temp/**',
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

  // react-hooks + @next/next plugins
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // ── react-hooks (individual, no recommended) ──
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // ── jsx-a11y (individual, no recommended) ──
      'jsx-a11y/alt-text': [
        'error',
        {
          elements: ['img'],
          img: ['Image'],
        },
      ],
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',

      // ── @next/next (ALL 21 rules as error) ──
      '@next/next/google-font-display': 'error',
      '@next/next/google-font-preconnect': 'error',
      '@next/next/inline-script-id': 'error',
      '@next/next/next-script-for-ga': 'error',
      '@next/next/no-assign-module-variable': 'error',
      '@next/next/no-async-client-component': 'error',
      '@next/next/no-before-interactive-script-outside-document': 'error',
      '@next/next/no-css-tags': 'error',
      '@next/next/no-document-import-in-page': 'error',
      '@next/next/no-duplicate-head': 'error',
      '@next/next/no-head-element': 'error',
      '@next/next/no-head-import-in-document': 'error',
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'error',
      '@next/next/no-page-custom-font': 'error',
      '@next/next/no-script-component-in-head': 'error',
      '@next/next/no-styled-jsx-in-document': 'error',
      '@next/next/no-sync-scripts': 'error',
      '@next/next/no-title-in-document-head': 'error',
      '@next/next/no-typos': 'error',
      '@next/next/no-unwanted-polyfillio': 'error',
    },
  },

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
        {
          object: 'JSON',
          property: 'parse',
          message:
            "Use destr() from 'destr' instead of JSON.parse for safe parsing.",
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

  // ── Browser security — eight runtime XSS / token-storage rules ──
  // Mirrors eslint-config-ts-prefixer#636. Added directly because that PR is
  // not yet released; delete this block once gitbox's eslint-config-ts-prefixer
  // is bumped to a version that already ships these rules.
  // https://github.com/laststance/eslint-config-ts-prefixer/pull/636
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: {
      'browser-security': browserSecurity,
    },
    rules: {
      // Disallow assigning to innerHTML/outerHTML — the most common XSS sink in
      // browser code, and not something a type checker can catch.
      'browser-security/no-innerhtml': 'error',

      // Disallow eval() and its string-compiling relatives.
      'browser-security/no-eval': 'error',

      // Disallow storing a JWT in localStorage/sessionStorage: any XSS on the
      // page can read it, unlike an HttpOnly cookie.
      'browser-security/no-jwt-in-storage': 'error',

      // Same reasoning for other secrets kept in Web Storage.
      'browser-security/no-sensitive-localstorage': 'error',

      // Disallow credentials in query strings — they land in browser history,
      // Referer headers, and server access logs.
      'browser-security/no-credentials-in-query-params': 'error',

      // Require Secure and SameSite when setting cookies from JS. (HttpOnly is
      // deliberately absent — a cookie set through document.cookie cannot be
      // HttpOnly, by definition.)
      'browser-security/require-cookie-secure-attrs': 'error',

      // Disallow postMessage(..., '*') — an origin wildcard leaks the payload
      // to whatever happens to be framed.
      'browser-security/no-postmessage-wildcard-origin': 'error',

      // Disallow redirects built from unvalidated input (open redirect).
      'browser-security/no-insecure-redirects': 'error',
    },
  },

  // @laststance/react-next-eslint-plugin rules
  {
    plugins: {
      '@laststance/react-next': laststanceReactNextPlugin,
    },
    rules: {
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
      // localStorage and JSON.parse checks in tests are acceptable for verification.
      // Keep fetch banned for axios/MSW consistency.
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use axios instead of fetch for MSW compatibility. Import from lib/axios.ts.',
        },
      ],
      // Allow localStorage and JSON.parse in tests (E2E page.evaluate can't import destr).
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

  // BoardPageClient - theme application exception
  {
    files: ['**/src/app/board/*/BoardPageClient.tsx'],
    rules: {
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
      'react-you-might-not-need-an-effect/no-chain-state-updates': 'off',
    },
  },

  // Combobox/Dialog patterns
  {
    files: [
      'src/components/Board/AddRepositoryCombobox.tsx',
      'src/app/maintenance/MaintenanceClient.tsx',
    ],
    rules: {
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
      'react-you-might-not-need-an-effect/no-derived-state': 'off',
      'react-you-might-not-need-an-effect/no-chain-state-updates': 'off',
    },
  },

  // Command palette - global keyboard handler exception
  {
    files: ['src/components/CommandPalette/CommandPalette.tsx'],
    rules: {
      'react-you-might-not-need-an-effect/no-event-handler': 'off',
    },
  },
])
