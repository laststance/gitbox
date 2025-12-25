/**
 * RenameBoardDialog Component Stories
 *
 * A dialog for renaming a board with inline validation.
 * Uses useActionState for form handling with server-side validation.
 * Shows character count and validation errors inline.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'

import { RenameBoardDialog } from './RenameBoardDialog'

const meta = {
  title: 'Boards/RenameBoardDialog',
  component: RenameBoardDialog,
  parameters: {
    layout: 'centered',
    // Next.js server actions are automatically mocked by @storybook/nextjs-vite
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onRenameSuccess: fn(),
    boardId: 'board-123',
    currentName: 'My Project Board',
  },
} satisfies Meta<typeof RenameBoardDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default open state with current board name.
 * The input field is pre-filled with the current name.
 */
export const Default: Story = {}

/**
 * Dialog with a long current name.
 * Shows how the character counter displays when approaching the limit.
 */
export const LongCurrentName: Story = {
  args: {
    currentName:
      'This Is An Extremely Long Board Name That Approaches The Limit',
  },
}

/**
 * Dialog with short name (far from character limit).
 * Character counter shows plenty of room remaining.
 */
export const ShortName: Story = {
  args: {
    currentName: 'Tasks',
  },
}

/**
 * Name near character limit (shows orange warning color).
 * Demonstrates the visual warning when approaching the 50 character limit.
 */
export const NearCharacterLimit: Story = {
  args: {
    currentName: 'A'.repeat(45), // 45 characters - triggers orange warning
  },
}

/**
 * Name at exact character limit.
 * Shows the maximum allowed characters with warning styling.
 */
export const AtCharacterLimit: Story = {
  args: {
    currentName: 'A'.repeat(50), // Exactly at 50 character limit
  },
}

/**
 * Dialog in closed state.
 * Used to verify the dialog properly hides when isOpen is false.
 */
export const Closed: Story = {
  args: {
    isOpen: false,
  },
}

/**
 * Dialog with special characters in current name.
 * Tests proper handling of special characters.
 */
export const SpecialCharacters: Story = {
  args: {
    currentName: 'Project <Alpha> & "Beta"',
  },
}

/**
 * Dialog with emoji in current name.
 */
export const EmojiName: Story = {
  args: {
    currentName: 'Frontend Tasks Board',
  },
}

/**
 * Dialog with single character name.
 * Tests minimum viable board name.
 */
export const SingleCharacter: Story = {
  args: {
    currentName: 'X',
  },
}
