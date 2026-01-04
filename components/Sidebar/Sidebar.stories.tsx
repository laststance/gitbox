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
import { expect, userEvent, waitFor } from 'storybook/test'

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

/**
 * Tests sidebar renders with navigation links
 */
export const NavigationLinksRender: Story = {
  args: {
    userName: 'Test User',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(false))
      return <Story />
    },
  ],
  play: async ({ canvasElement }) => {
    // Wait for sidebar to render
    await waitFor(() => {
      expect(canvasElement).toHaveTextContent('Boards')
    })

    // Check navigation links exist
    expect(canvasElement).toHaveTextContent('Favorites')
    expect(canvasElement).toHaveTextContent('Maintenance')
    expect(canvasElement).toHaveTextContent('Settings')
  },
}

/**
 * Tests sidebar toggle button
 */
export const ToggleSidebar: Story = {
  args: {
    userName: 'Test User',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(false))
      return <Story />
    },
  ],
  play: async ({ canvasElement }) => {
    // Wait for sidebar to render
    await waitFor(() => {
      const toggleButton = canvasElement.querySelector(
        'button[aria-label*="Collapse"]',
      )
      expect(toggleButton).toBeInTheDocument()
    })

    // Click the toggle button
    const toggleButton = canvasElement.querySelector(
      'button[aria-label*="Collapse"]',
    ) as HTMLButtonElement
    if (toggleButton) {
      await userEvent.click(toggleButton)
    }
  },
}

/**
 * Tests user menu opens
 */
export const UserMenuOpens: Story = {
  args: {
    userName: 'Test User',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  decorators: [
    (Story) => {
      store.dispatch(setSidebarCollapsed(false))
      return <Story />
    },
  ],
  play: async ({ canvasElement }) => {
    // Wait for sidebar to render
    await waitFor(() => {
      expect(canvasElement).toHaveTextContent('Test User')
    })

    // Find and click user menu button
    const userButton = canvasElement.querySelector(
      'button[aria-haspopup="menu"]',
    )
    if (userButton) {
      await userEvent.click(userButton)
    }

    // Wait for dropdown to appear
    await waitFor(
      () => {
        const dropdown = document.querySelector('[role="menu"]')
        expect(dropdown).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}
