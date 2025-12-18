import type { StorybookConfig } from '@storybook/nextjs-vite'
import tailwindcss from '@tailwindcss/vite'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  stories: [
    '../components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../app/**/*.stories.@(js|jsx|mjs|ts|tsx)',
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
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      plugins: [tailwindcss()],
    })
  },
}

export default config
