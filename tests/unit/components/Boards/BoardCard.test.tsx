/**
 * Unit Test: BoardCard Component
 *
 * Test targets:
 * - Callback handlers (handleRenameSuccess, handleDeleteSuccess, handleCloseRename)
 * - These are passed to child dialog components
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track callback invocations
const renameSuccessLog: Array<[string, string]> = []
const deleteSuccessLog: Array<string> = []
const closeRenameLog: number[] = []
const closeDeleteLog: number[] = []

// Mock the dialog components to allow direct callback testing
vi.mock('@/components/Boards/RenameBoardDialog', () => ({
  RenameBoardDialog: ({
    isOpen,
    onClose,
    onRenameSuccess,
    boardId,
  }: {
    isOpen: boolean
    onClose: () => void
    onRenameSuccess: (newName: string) => void
    boardId: string
  }) => {
    if (!isOpen) return null
    return (
      <div data-testid="rename-dialog">
        <button
          type="button"
          data-testid="rename-success-btn"
          onClick={() => {
            renameSuccessLog.push([boardId, 'New Test Name'])
            onRenameSuccess('New Test Name')
          }}
        >
          Rename Success
        </button>
        <button
          type="button"
          data-testid="rename-close-btn"
          onClick={() => {
            closeRenameLog.push(1)
            onClose()
          }}
        >
          Close
        </button>
      </div>
    )
  },
}))

vi.mock('@/components/Boards/DeleteBoardDialog', () => ({
  DeleteBoardDialog: ({
    isOpen,
    onClose,
    onDeleteSuccess,
    boardId,
  }: {
    isOpen: boolean
    onClose: () => void
    onDeleteSuccess: () => void
    boardId: string
  }) => {
    if (!isOpen) return null
    return (
      <div data-testid="delete-dialog">
        <button
          type="button"
          data-testid="delete-success-btn"
          onClick={() => {
            deleteSuccessLog.push(boardId)
            onDeleteSuccess()
          }}
        >
          Delete Success
        </button>
        <button
          type="button"
          data-testid="delete-close-btn"
          onClick={() => {
            closeDeleteLog.push(1)
            onClose()
          }}
        >
          Close
        </button>
      </div>
    )
  },
}))

// Mock server action
vi.mock('@/lib/actions/board-data', () => ({
  toggleBoardFavorite: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock DropdownMenu to render content inline without portal
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild,
    ...props
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <div {...props}>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

// Import after mocks
import { BoardCard } from '@/components/Boards/BoardCard'
import type { Tables } from '@/lib/supabase/types'

type Board = Tables<'board'>

const createMockBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  name: 'Test Board',
  user_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  settings: null,
  theme: 'sunrise',
  is_favorite: false,
  ...overrides,
})

describe('BoardCard', () => {
  const mockOnRename = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnToggleFavorite = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    renameSuccessLog.length = 0
    deleteSuccessLog.length = 0
    closeRenameLog.length = 0
    closeDeleteLog.length = 0
  })

  describe('handleRenameSuccess callback', () => {
    it('should call onRename with boardId and newName when rename succeeds', async () => {
      const board = createMockBoard({ id: 'board-123' })
      render(
        <BoardCard
          board={board}
          onRename={mockOnRename}
          onDelete={mockOnDelete}
          onToggleFavorite={mockOnToggleFavorite}
        />,
      )

      // Open rename dialog via dropdown
      const menuButton = screen.getByRole('button', {
        name: `Open menu for ${board.name}`,
      })
      fireEvent.click(menuButton)

      const renameMenuItem = screen.getByText('Rename')
      fireEvent.click(renameMenuItem)

      // Dialog should be visible
      expect(screen.getByTestId('rename-dialog')).toBeInTheDocument()

      // Trigger rename success callback
      const renameSuccessBtn = screen.getByTestId('rename-success-btn')
      fireEvent.click(renameSuccessBtn)

      // Verify onRename was called (line 72)
      expect(mockOnRename).toHaveBeenCalledWith('board-123', 'New Test Name')
    })
  })

  describe('handleDeleteSuccess callback', () => {
    it('should call onDelete with boardId when delete succeeds', async () => {
      const board = createMockBoard({ id: 'board-to-delete' })
      render(
        <BoardCard
          board={board}
          onRename={mockOnRename}
          onDelete={mockOnDelete}
          onToggleFavorite={mockOnToggleFavorite}
        />,
      )

      // Open delete dialog via dropdown
      const menuButton = screen.getByRole('button', {
        name: `Open menu for ${board.name}`,
      })
      fireEvent.click(menuButton)

      const deleteMenuItem = screen.getByText('Delete')
      fireEvent.click(deleteMenuItem)

      // Dialog should be visible
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument()

      // Trigger delete success callback
      const deleteSuccessBtn = screen.getByTestId('delete-success-btn')
      fireEvent.click(deleteSuccessBtn)

      // Verify onDelete was called (line 78)
      expect(mockOnDelete).toHaveBeenCalledWith('board-to-delete')
    })
  })

  describe('handleCloseRename callback', () => {
    it('should close rename dialog when onClose is called', async () => {
      const board = createMockBoard()
      render(
        <BoardCard
          board={board}
          onRename={mockOnRename}
          onDelete={mockOnDelete}
          onToggleFavorite={mockOnToggleFavorite}
        />,
      )

      // Open rename dialog
      const menuButton = screen.getByRole('button', {
        name: `Open menu for ${board.name}`,
      })
      fireEvent.click(menuButton)

      const renameMenuItem = screen.getByText('Rename')
      fireEvent.click(renameMenuItem)

      // Dialog should be visible
      expect(screen.getByTestId('rename-dialog')).toBeInTheDocument()

      // Trigger close callback (line 90)
      const closeBtn = screen.getByTestId('rename-close-btn')
      fireEvent.click(closeBtn)

      // Dialog should be closed
      expect(screen.queryByTestId('rename-dialog')).not.toBeInTheDocument()
    })
  })

  describe('handleCloseDelete callback', () => {
    it('should close delete dialog when onClose is called', async () => {
      const board = createMockBoard()
      render(
        <BoardCard
          board={board}
          onRename={mockOnRename}
          onDelete={mockOnDelete}
          onToggleFavorite={mockOnToggleFavorite}
        />,
      )

      // Open delete dialog
      const menuButton = screen.getByRole('button', {
        name: `Open menu for ${board.name}`,
      })
      fireEvent.click(menuButton)

      const deleteMenuItem = screen.getByText('Delete')
      fireEvent.click(deleteMenuItem)

      // Dialog should be visible
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument()

      // Trigger close callback
      const closeBtn = screen.getByTestId('delete-close-btn')
      fireEvent.click(closeBtn)

      // Dialog should be closed
      expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument()
    })
  })
})
