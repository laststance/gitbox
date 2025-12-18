/**
 * Sidebar Component Stories
 *
 * A navigation sidebar component for authenticated users.
 * Displays GitBox logo, navigation links (Boards, Favorites, Maintenance Mode, Settings),
 * shortcuts help, and user profile with sign out option.
 * Supports collapsible sections and active route highlighting.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

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

export const Default: Story = {
  args: {
    userName: 'octocat',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
}

export const WithoutAvatar: Story = {
  args: {
    userName: 'Test User',
  },
}

export const LongUserName: Story = {
  args: {
    userName: 'Very Long User Name That Might Overflow',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
}
