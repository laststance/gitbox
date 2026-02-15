/**
 * SettingsClient Component Stories
 *
 * A client component for the Settings page.
 * Manages display preferences (compact mode, card metadata).
 * Theme selection is handled via the sidebar ThemeToggle.
 * Uses Redux for state management and localStorage for persistence.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { SettingsClient } from './SettingsClient'

const meta = {
  title: 'Pages/SettingsClient',
  component: SettingsClient,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SettingsClient>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default settings page showing theme selection and display preferences
 */
export const Default: Story = {
  render: () => <SettingsClient />,
}
