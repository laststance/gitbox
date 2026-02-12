import type { Preview, StoryContext } from '@storybook/nextjs-vite'
import React, { useEffect } from 'react'

import { initialize, mswLoader } from 'msw-storybook-addon'

import { Provider as ReduxStoreProvider } from 'react-redux'
import { store } from '@/lib/redux/store'
import { storybookHandlers } from '../mocks/handlers/index'
import '@/styles/globals.css'

// Theme constants (duplicated from lib/constants/themes.ts to avoid bundling issues)
const DARK_THEME_IDS = [
  'dark',
  'midnight',
  'graphite',
  'forest',
  'ocean',
  'plum',
  'rust',
] as const

/**
 * Check if a theme is a dark theme.
 */
function isDarkTheme(theme: string): boolean {
  return DARK_THEME_IDS.includes(theme as (typeof DARK_THEME_IDS)[number])
}

/**
 * Theme Decorator - Applies selected global theme to Storybook canvas
 */
function ThemeDecorator(Story: React.ComponentType, context: StoryContext) {
  const theme = context.globals.theme || 'default'

  useEffect(() => {
    const root = document.documentElement

    // Remove previous theme
    root.removeAttribute('data-theme')
    root.classList.remove('dark')

    // Apply theme (default uses :root, others use data-theme selector)
    if (theme !== 'default') {
      root.setAttribute('data-theme', theme)
    }

    // Add dark class for dark themes
    if (isDarkTheme(theme)) {
      root.classList.add('dark')
    }
  }, [theme])

  return <Story />
}

// Initialize MSW
initialize()

const preview: Preview = {
  parameters: {
    msw: { handlers: [...storybookHandlers] },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Default Next.js navigation mocking for components using usePathname/useRouter
    nextjs: {
      navigation: {
        pathname: '/boards',
      },
      appDirectory: true,
    },
    a11y: {
      // 'error' - fail tests on a11y violations (enforces accessibility)
      // 'todo' - show a11y violations without failing tests
      // 'off' - skip a11y checks entirely
      test: 'error',
    },
  },
  // Global types for Storybook toolbar
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'default',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Default (Light)', left: '⬜' },
          { value: 'sunrise', title: 'Sunrise', left: '🌅' },
          { value: 'sandstone', title: 'Sandstone', left: '🏜️' },
          { value: 'mint', title: 'Mint', left: '🌿' },
          { value: 'sky', title: 'Sky', left: '🌤️' },
          { value: 'lavender', title: 'Lavender', left: '💜' },
          { value: 'rose', title: 'Rose', left: '🌹' },
          { value: 'dark', title: 'Dark', left: '⬛' },
          { value: 'midnight', title: 'Midnight', left: '🌙' },
          { value: 'graphite', title: 'Graphite', left: '⚫' },
          { value: 'forest', title: 'Forest', left: '🌲' },
          { value: 'ocean', title: 'Ocean', left: '🌊' },
          { value: 'plum', title: 'Plum', left: '🍇' },
          { value: 'rust', title: 'Rust', left: '🔶' },
        ],
        dynamicTitle: true,
      },
    },
  },
  // MSW loader must be in loaders (not decorators) to ensure
  // service workers are registered before story rendering
  loaders: [mswLoader],
  decorators: [
    // Theme decorator must come first to apply theme before component renders
    ThemeDecorator,
    (Story) => (
      <ReduxStoreProvider store={store}>
        <Story />
      </ReduxStoreProvider>
    ),
  ],
  tags: ['autodocs'],
}

export default preview
