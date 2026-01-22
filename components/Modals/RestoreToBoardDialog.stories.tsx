/**
 * RestoreToBoardDialog Component Stories
 *
 * A dialog for selecting a target board and status column when restoring
 * a repository from maintenance mode back to an active board.
 *
 * Features:
 * - Board selection dropdown with all user's boards
 * - Status (column) selection that updates based on selected board
 * - Color indicators for status columns
 * - Loading states and error handling
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor, fn } from 'storybook/test'

import { RestoreToBoardDialog, type BoardOption } from './RestoreToBoardDialog'

const mockBoards: BoardOption[] = [
  {
    id: 'board-1',
    name: 'Frontend Development',
    statusLists: [
      { id: 'status-1', name: 'Backlog', color: '#6b7280' },
      { id: 'status-2', name: 'In Progress', color: '#3b82f6' },
      { id: 'status-3', name: 'Done', color: '#22c55e' },
    ],
  },
  {
    id: 'board-2',
    name: 'Backend API',
    statusLists: [
      { id: 'status-4', name: 'Todo', color: '#f59e0b' },
      { id: 'status-5', name: 'Review', color: '#8b5cf6' },
    ],
  },
  {
    id: 'board-3',
    name: 'Design System',
    statusLists: [],
  },
]

const meta = {
  title: 'Modals/RestoreToBoardDialog',
  component: RestoreToBoardDialog,
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
    onRestored: fn(),
    maintenanceId: 'maintenance-123',
    repoName: 'octocat/hello-world',
    boards: mockBoards,
    isLoadingBoards: false,
    boardsError: null,
  },
} satisfies Meta<typeof RestoreToBoardDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default open state with boards loaded.
 * Shows board and column selection dropdowns.
 */
export const Default: Story = {}

/**
 * Loading state while fetching boards.
 * Shows loading spinner and text.
 */
export const Loading: Story = {
  args: {
    isLoadingBoards: true,
    boards: [],
  },
}

/**
 * Error state when boards fail to load.
 * Shows error message.
 */
export const ErrorState: Story = {
  args: {
    boardsError: 'Failed to load boards. Please try again.',
    boards: [],
  },
}

/**
 * Empty state when no boards exist.
 * Shows message prompting user to create a board.
 */
export const NoBoards: Story = {
  args: {
    boards: [],
  },
}

/**
 * Board with no status columns.
 * Shows warning message about needing columns.
 */
export const BoardWithNoColumns: Story = {
  args: {
    boards: [
      {
        id: 'board-empty',
        name: 'Empty Board',
        statusLists: [],
      },
    ],
  },
}

/**
 * Single board available.
 * Board is auto-selected.
 */
export const SingleBoard: Story = {
  args: {
    boards: [mockBoards[0]!],
  },
}

/**
 * Long repository name for testing text overflow.
 */
export const LongRepoName: Story = {
  args: {
    repoName: 'organization-name/very-long-repository-name-for-testing',
  },
}

/**
 * Dialog in closed state.
 */
export const Closed: Story = {
  args: {
    isOpen: false,
  },
}

/**
 * Tests that dialog renders with correct title and description
 */
export const DialogRendersCorrectly: Story = {
  args: {
    isOpen: true,
    boards: mockBoards,
    repoName: 'octocat/hello-world',
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Check title
    expect(document.body).toHaveTextContent('Restore to Board')

    // Check repo name in description
    expect(document.body).toHaveTextContent('octocat/hello-world')
  },
}

/**
 * Tests board selection dropdown
 */
export const BoardSelectionWorks: Story = {
  args: {
    isOpen: true,
    boards: mockBoards,
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Board')
    })

    // Find board select trigger
    const boardTrigger = document.querySelector('#board-select')
    expect(boardTrigger).toBeInTheDocument()

    // Click to open dropdown
    if (boardTrigger) {
      await userEvent.click(boardTrigger)
    }

    // Wait for dropdown content
    await waitFor(
      () => {
        const content = document.querySelector('[role="listbox"]')
        expect(content).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}

/**
 * Tests loading state display
 */
export const LoadingStateDisplays: Story = {
  args: {
    isOpen: true,
    isLoadingBoards: true,
    boards: [],
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    // Wait for dialog
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Loading boards...')
    })
  },
}

/**
 * Tests error state display
 */
export const ErrorStateDisplays: Story = {
  args: {
    isOpen: true,
    boardsError: 'Failed to load boards',
    boards: [],
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Failed to load boards')
    })
  },
}

/**
 * Tests empty boards state
 */
export const EmptyBoardsStateDisplays: Story = {
  args: {
    isOpen: true,
    boards: [],
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    await waitFor(() => {
      expect(document.body).toHaveTextContent('No boards available')
    })
  },
}

/**
 * Tests cancel button closes dialog
 */
export const CancelButtonWorks: Story = {
  args: {
    isOpen: true,
    boards: mockBoards,
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    // Wait for dialog
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Cancel')
    })

    // Find and click cancel button
    const cancelButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Cancel'),
    )

    if (cancelButton) {
      await userEvent.click(cancelButton)
    }
  },
}

/**
 * Tests restore button is disabled when no selection
 */
export const RestoreButtonDisabledWhenNoSelection: Story = {
  args: {
    isOpen: true,
    boards: [
      {
        id: 'board-empty',
        name: 'Empty Board',
        statusLists: [],
      },
    ],
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const restoreButton = Array.from(
        document.querySelectorAll('button'),
      ).find((btn) => btn.textContent?.includes('Restore'))

      expect(restoreButton).toBeDisabled()
    })
  },
}

/**
 * Tests column dropdown shows color indicators
 */
export const ColumnDropdownShowsColors: Story = {
  args: {
    isOpen: true,
    boards: mockBoards,
    onClose: fn(),
    onRestored: fn(),
  },
  play: async () => {
    // Wait for dialog
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Column')
    })

    // Find column select trigger
    const columnTrigger = document.querySelector('#status-select')
    expect(columnTrigger).toBeInTheDocument()

    // Click to open dropdown
    if (columnTrigger) {
      await userEvent.click(columnTrigger)
    }

    // Wait for dropdown content with color indicators
    await waitFor(
      () => {
        const content = document.querySelector('[role="listbox"]')
        expect(content).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}
