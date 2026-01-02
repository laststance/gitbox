/**
 * Sidebar Component Stories
 *
 * A collapsible navigation sidebar component for authenticated users.
 * Displays GitBox logo, navigation links (Boards, Favorites, Maintenance Mode, Settings),
 * theme toggle, shortcuts help, and user profile with sign out option.
 *
 * Features:
 * - Collapsible to icon-only mode (64px) with tooltips
 * - Expanded mode with full labels (256px)
 * - State persistence via Redux Storage Middleware
 * - Smooth CSS transition (300ms ease-out)
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { setSidebarCollapsed } from '@/lib/redux/slices/settingsSlice'
import { store } from '@/lib/redux/store'

import { Sidebar } from './Sidebar'

const meta = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default expanded sidebar with user avatar
 */
export const Default: Story = {
  args: {
    userName: 'octocat',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(false))
      return <Story />
    },
  ],
}

/**
 * Expanded sidebar without user avatar (shows fallback icon)
 */
export const WithoutAvatar: Story = {
  args: {
    userName: 'Test User',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(false))
      return <Story />
    },
  ],
}

/**
 * Expanded sidebar with long user name (tests truncation)
 */
export const LongUserName: Story = {
  args: {
    userName: 'Very Long User Name That Might Overflow',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(false))
      return <Story />
    },
  ],
}

/**
 * Collapsed sidebar (icon-only mode, 64px width)
 * Hover over items to see tooltips with labels
 */
export const Collapsed: Story = {
  args: {
    userName: 'octocat',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(true))
      return <Story />
    },
  ],
}

/**
 * Collapsed sidebar without user avatar
 */
export const CollapsedWithoutAvatar: Story = {
  args: {
    userName: 'Test User',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(true))
      return <Story />
    },
  ],
}
