/**
 * SettingsClient Component Stories
 *
 * A client component for the Settings page.
 * Allows users to customize theme (14 themes: 7 light + 7 dark),
 * language (English/Japanese), and other display preferences.
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

export const Default: Story = {
  render: () => <SettingsClient />,
}
