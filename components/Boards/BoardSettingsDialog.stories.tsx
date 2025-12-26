/**
 * BoardSettingsDialog Component Stories
 *
 * A tabbed dialog for managing board settings including:
 * - General: Rename board functionality
 * - Theme: Board-specific theme picker (overrides app theme)
 * - Danger Zone: Delete board with confirmation
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
    onThemeChange: fn(),
    onDeleteSuccess: fn(),
    boardId: 'board-123',
    boardName: 'My Project Board',
    currentTheme: 'sunrise',
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
 * Dialog with no current theme set.
 * Board uses the app-level theme.
 */
export const NoTheme: Story = {
  args: {
    currentTheme: null,
  },
}

/**
 * Dialog with dark theme (midnight).
 * Shows a dark theme selected in the theme picker.
 */
export const DarkTheme: Story = {
  args: {
    currentTheme: 'midnight',
  },
}

/**
 * Dialog with forest theme.
 */
export const ForestTheme: Story = {
  args: {
    currentTheme: 'forest',
  },
}

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

/**
 * Dialog with lavender theme.
 * A light purple theme.
 */
export const LavenderTheme: Story = {
  args: {
    currentTheme: 'lavender',
  },
}

/**
 * Dialog with ocean theme.
 * A deep teal dark theme.
 */
export const OceanTheme: Story = {
  args: {
    currentTheme: 'ocean',
  },
}
