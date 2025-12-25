/**
 * DeleteBoardDialog Component Stories
 *
 * An AlertDialog for confirming board deletion.
 * Uses useActionState for form handling with server-side action.
 * Displays a destructive confirmation dialog before deleting a board.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'

import { DeleteBoardDialog } from './DeleteBoardDialog'

const meta = {
  title: 'Boards/DeleteBoardDialog',
  component: DeleteBoardDialog,
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
    onDeleteSuccess: fn(),
    boardId: 'board-123',
    boardName: 'My Project Board',
  },
} satisfies Meta<typeof DeleteBoardDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default open state showing the delete confirmation.
 * Click "Delete Board" to see the pending state (server action is mocked).
 */
export const Default: Story = {}

/**
 * Dialog with a long board name.
 * Tests text wrapping behavior in the dialog description.
 */
export const LongBoardName: Story = {
  args: {
    boardName:
      'This Is An Extremely Long Board Name That Tests Text Wrapping In The Dialog',
  },
}

/**
 * Dialog with a short board name.
 */
export const ShortBoardName: Story = {
  args: {
    boardName: 'Tasks',
  },
}

/**
 * Dialog with special characters in board name.
 * Tests proper escaping and display of special characters.
 */
export const SpecialCharacters: Story = {
  args: {
    boardName: 'Project <Alpha> & "Beta" Board',
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
 * Dialog with emoji in board name.
 */
export const EmojiName: Story = {
  args: {
    boardName: 'Frontend Development Board',
  },
}
