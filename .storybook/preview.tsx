import type { Preview } from '@storybook/nextjs-vite'
import React from 'react'

import { initialize, mswLoader } from 'msw-storybook-addon'

import { Provider as ReduxStoreProvider } from 'react-redux'
import { store } from '../lib/redux/store'
import { handlers } from '../mocks/handlers'
import '../styles/globals.css'

// Import theme CSS files
import '../styles/themes/light/sunrise.css'
import '../styles/themes/light/sandstone.css'
import '../styles/themes/light/mint.css'
import '../styles/themes/light/sky.css'
import '../styles/themes/light/lavender.css'
import '../styles/themes/light/rose.css'
import '../styles/themes/dark/midnight.css'
import '../styles/themes/dark/graphite.css'
import '../styles/themes/dark/forest.css'
import '../styles/themes/dark/ocean.css'
import '../styles/themes/dark/plum.css'
import '../styles/themes/dark/rust.css'

// Initialize MSW
initialize()

const preview: Preview = {
  parameters: {
    msw: { handlers: [...handlers] },
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
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
  // MSW loader must be in loaders (not decorators) to ensure
  // service workers are registered before story rendering
  loaders: [mswLoader],
  decorators: [
    (Story) => (
      <ReduxStoreProvider store={store}>
        <Story />
      </ReduxStoreProvider>
    ),
  ],
  tags: ['autodocs'],
}

export default preview
