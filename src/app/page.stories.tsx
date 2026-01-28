/**
 * Landing Page Stories
 *
 * The landing page component for GitBox.
 * Displays product information, features, and call-to-action buttons
 * for signing in with GitHub OAuth.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import Page from './page'

const meta = {
  title: 'Pages/Landing',
  component: Page,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Page>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Page />,
}
