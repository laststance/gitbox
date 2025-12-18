/**
 * AuthenticatedLayout Component Stories
 *
 * A layout component wrapper for authenticated pages.
 * Combines Sidebar navigation with main content area.
 * Provides consistent layout structure across authenticated routes.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { AuthenticatedLayout } from './AuthenticatedLayout'

const meta = {
  title: 'Layout/AuthenticatedLayout',
  component: AuthenticatedLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AuthenticatedLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    userName: 'octocat',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    children: (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Main Content Area</h1>
        <p>This is the main content area of the authenticated layout.</p>
      </div>
    ),
  },
}

export const WithLongContent: Story = {
  args: {
    userName: 'octocat',
    userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    children: (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Long Content</h1>
        {Array.from({ length: 50 }, (_, i) => (
          <p key={i} className="mb-4">
            This is paragraph {i + 1} of a long content area to demonstrate
            scrolling behavior.
          </p>
        ))}
      </div>
    ),
  },
}
