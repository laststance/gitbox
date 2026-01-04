/**
 * RenameBoardDialog Component Stories
 *
 * A dialog for renaming a board with inline validation.
 * Uses useActionState for form handling with server-side validation.
 * Shows character count and validation errors inline.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor, fn } from 'storybook/test'

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

/**
 * Tests typing a new name in the input
 */
export const TypeNewName: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    currentName: 'Old Name',
    onClose: fn(),
    onRenameSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const input = document.querySelector('input[name="name"]')
      expect(input).toBeInTheDocument()
    })

    // Find and clear input, then type new name
    const input = document.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, 'New Board Name')

    // Verify the input has the new value
    expect(input.value).toBe('New Board Name')
  },
}

/**
 * Tests cancel button closes dialog
 */
export const CancelRename: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    currentName: 'My Board',
    onClose: fn(),
    onRenameSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Cancel')
    })

    // Find and click Cancel button
    const cancelButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Cancel'),
    )
    if (cancelButton) {
      await userEvent.click(cancelButton)
    }
  },
}

/**
 * Tests save button submission
 */
export const SubmitRename: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    currentName: 'Test Board',
    onClose: fn(),
    onRenameSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const input = document.querySelector('input[name="name"]')
      expect(input).toBeInTheDocument()
    })

    // Clear and type new name
    const input = document.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, 'Updated Name')

    // Find and click Save button
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Save'),
    )
    if (saveButton) {
      await userEvent.click(saveButton)
    }
  },
}

/**
 * Tests character counter updates
 */
export const CharacterCounter: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    currentName: 'Short',
    onClose: fn(),
    onRenameSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const input = document.querySelector('input[name="name"]')
      expect(input).toBeInTheDocument()
    })

    // Clear and type a longer name
    const input = document.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, 'This is a much longer name to test counter')

    // Verify counter shows updated count
    await waitFor(() => {
      expect(document.body).toHaveTextContent('/50')
    })
  },
}
