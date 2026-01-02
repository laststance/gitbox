/**
 * BoardSettingsDialog Component Stories
 *
 * A tabbed dialog for managing board settings including:
 * - General: Rename board functionality
 * - Cards: Card display settings
 * - Danger Zone: Delete board with confirmation
 *
 * Note: Theme is now managed globally via Sidebar ThemeToggle.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'

import { BoardSettingsDialog } from './BoardSettingsDialog'

const meta = {
  title: 'Boards/BoardSettingsDialog',
  component: BoardSettingsDialog,
  parameters: {
    layout: 'centered',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
    boardId: 'board-123',
    boardName: 'My Project Board',
  },
} satisfies Meta<typeof BoardSettingsDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default open state on General tab.
 * Shows the rename board form with current name pre-filled.
 */
export const Default: Story = {}

/**
 * Dialog with long board name.
 * Tests character counter near limit.
 */
export const LongBoardName: Story = {
  args: {
    boardName: 'This Is An Extremely Long Board Name That Approaches The Limit',
  },
}

/**
 * Dialog with short board name.
 */
export const ShortBoardName: Story = {
  args: {
    boardName: 'Tasks',
  },
}

/**
 * Dialog in closed state.
 * Verifies the dialog properly hides when isOpen is false.
 */
export const Closed: Story = {
  args: {
    isOpen: false,
  },
}

/**
 * Dialog with special characters in board name.
 * Tests proper handling and display of special characters.
 */
export const SpecialCharacters: Story = {
  args: {
    boardName: 'Project <Alpha> & "Beta"',
  },
}
