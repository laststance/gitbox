// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import nextNext from '@next/eslint-plugin-next'
import { defineConfig } from 'eslint/config'
import tsPreFixer from 'eslint-config-ts-prefixer'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import storybook from 'eslint-plugin-storybook'
import laststanceReactNextPlugin from '@laststance/react-next-eslint-plugin'

export default defineConfig([
  ...tsPreFixer,
  {
    ignores: [
      '**/.vscode/**',
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/.github/**',
      '**/.git/**',
      '**/.idea/**',
      '.next/**',
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
    ],
  },
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
      '@next/next/google-font-display': 'error',
      '@next/next/google-font-preconnect': 'error',
      '@next/next/inline-script-id': 'error',
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
      '@next/next/no-sync-scripts': 'warn',
      '@next/next/no-title-in-document-head': 'error',
      '@next/next/no-typos': 'error',
      '@next/next/no-unwanted-polyfillio': 'error',
    },
  },
  ...storybook.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,
])
