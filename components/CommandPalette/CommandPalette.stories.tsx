/**
 * CommandPalette Component Stories
 *
 * A global command palette component accessible via ⌘K (Cmd+K on Mac, Ctrl+K on Windows/Linux).
 * Provides quick access to navigation, actions, and settings through keyboard commands.
 * Features search functionality, keyboard navigation, and categorized commands.
 * Supports both mouse and keyboard interactions with proper focus management.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor } from 'storybook/test'

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

/**
 * Tests opening command palette with keyboard shortcut
 */
export const OpenWithKeyboard: Story = {
  render: () => <CommandPalette />,
  play: async () => {
    // Trigger Cmd+K to open the palette
    await userEvent.keyboard('{Control>}k{/Control}')

    // Wait for palette to appear
    await waitFor(() => {
      const input = document.querySelector(
        'input[placeholder="Search commands..."]',
      )
      expect(input).toBeInTheDocument()
    })
  },
}

/**
 * Tests search functionality in command palette
 */
export const SearchCommands: Story = {
  render: () => <CommandPalette />,
  play: async () => {
    // Open palette
    await userEvent.keyboard('{Control>}k{/Control}')

    // Wait for palette to open
    await waitFor(() => {
      const input = document.querySelector(
        'input[placeholder="Search commands..."]',
      )
      expect(input).toBeInTheDocument()
    })

    // Type in search
    const input = document.querySelector(
      'input[placeholder="Search commands..."]',
    ) as HTMLInputElement
    await userEvent.type(input, 'board')

    // Should filter to show only board-related commands
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Go to Boards')
      expect(document.body).toHaveTextContent('Create New Board')
    })
  },
}

/**
 * Tests keyboard navigation in command palette
 */
export const KeyboardNavigation: Story = {
  render: () => <CommandPalette />,
  play: async () => {
    // Open palette
    await userEvent.keyboard('{Control>}k{/Control}')

    // Wait for palette to open
    await waitFor(() => {
      const input = document.querySelector(
        'input[placeholder="Search commands..."]',
      )
      expect(input).toBeInTheDocument()
    })

    // Navigate down
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}')

    // Navigate up
    await userEvent.keyboard('{ArrowUp}')
  },
}

/**
 * Tests closing command palette with Escape
 */
export const CloseWithEscape: Story = {
  render: () => <CommandPalette />,
  play: async () => {
    // Open palette
    await userEvent.keyboard('{Control>}k{/Control}')

    // Wait for palette to open
    await waitFor(() => {
      const input = document.querySelector(
        'input[placeholder="Search commands..."]',
      )
      expect(input).toBeInTheDocument()
    })

    // Close with Escape
    await userEvent.keyboard('{Escape}')

    // Wait for palette to close
    await waitFor(() => {
      const input = document.querySelector(
        'input[placeholder="Search commands..."]',
      )
      expect(input).not.toBeInTheDocument()
    })
  },
}

/**
 * Tests no results state
 */
export const NoResults: Story = {
  render: () => <CommandPalette />,
  play: async () => {
    // Open palette
    await userEvent.keyboard('{Control>}k{/Control}')

    // Wait for palette to open
    await waitFor(() => {
      const input = document.querySelector(
        'input[placeholder="Search commands..."]',
      )
      expect(input).toBeInTheDocument()
    })

    // Type non-matching search
    const input = document.querySelector(
      'input[placeholder="Search commands..."]',
    ) as HTMLInputElement
    await userEvent.type(input, 'xyznonexistent')

    // Should show no results message
    await waitFor(() => {
      expect(document.body).toHaveTextContent('No commands found')
    })
  },
}
