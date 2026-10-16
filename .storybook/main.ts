import path from 'node:path'

import type { StorybookConfig } from '@storybook/nextjs-vite'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { mergeConfig } from 'vite'

import { after as storybookAfter } from './stubs/next-server.ts'

const dirname = import.meta.dirname

/**
 * Resolves `next/server` to the preview stub.
 *
 * The real module reads `__dirname` as it loads. Storybook's browser bundle
 * has no `__dirname`, so a story that reaches {@link getUserRepoPlacements}
 * fails while the file is imported. Vite calls this before other resolvers.
 *
 * @returns The Vite plugin that performs the rewrite.
 */
function stubNextServerForPreview(): Plugin {
  const stubId = path.resolve(dirname, 'stubs/next-server.ts')
  // The import keeps the stub in the Storybook program (knip follows it).
  void storybookAfter

  return {
    name: 'stub-next-server-for-preview',
    enforce: 'pre',
    resolveId(source) {
      // Bare specifier only. A package that already resolved the real file
      // is left alone.
      if (source !== 'next/server') return null
      return stubId
    },
  }
}

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../src/app/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    'msw-storybook-addon',
    {
      name: '@storybook/addon-mcp',
      options: {
        toolsets: {
          dev: true,
          docs: true,
        },
        experimentalFormat: 'markdown',
      },
    },
  ],
  features: {
    experimentalComponentsManifest: true,
  },
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tailwindcss(), stubNextServerForPreview()],
    })
  },
}

export default config
