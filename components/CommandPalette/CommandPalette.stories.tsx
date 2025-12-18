/**
 * CommandPalette Component Stories
 *
 * A global command palette component accessible via ⌘K (Cmd+K on Mac, Ctrl+K on Windows/Linux).
 * Provides quick access to navigation, actions, and settings through keyboard commands.
 * Features search functionality, keyboard navigation, and categorized commands.
 * Supports both mouse and keyboard interactions with proper focus management.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { CommandPalette } from './CommandPalette'

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CommandPalette>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <CommandPalette />,
}

export const Opened: Story = {
  render: () => {
    // Note: In Storybook, the CommandPalette will be controlled by keyboard shortcuts
    // This story demonstrates the component structure
    return <CommandPalette />
  },
}
