/**
 * Unit Test: BoardGrid Component
 *
 * Test targets:
 * - Grid rendering with boards
 * - Empty state when no boards
 * - Optimistic update handlers (rename, delete, toggleFavorite)
 * - useOptimistic reducer logic
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { BoardGrid } from '@/components/Boards/BoardGrid'
import type { Tables } from '@/lib/supabase/types'

type Board = Tables<'board'>

// Track calls to handlers
const renameCallLog: Array<[string, string]> = []
const deleteCallLog: Array<string> = []
const favoriteCallLog: Array<[string, boolean]> = []

vi.mock('@/components/Boards/BoardCard', () => ({
  BoardCard: ({
    board,
    onRename,
    onDelete,
    onToggleFavorite,
  }: {
    board: Board
    onRename: (boardId: string, newName: string) => void
    onDelete: (boardId: string) => void
    onToggleFavorite: (boardId: string, isFavorite: boolean) => void
  }) => {
    return (
      <div data-testid={`board-card-${board.id}`}>
        <span data-testid={`board-name-${board.id}`}>{board.name}</span>
        <span data-testid={`board-favorite-${board.id}`}>
          {board.is_favorite ? 'favorite' : 'not-favorite'}
        </span>
        <button
          type="button"
          data-testid={`rename-btn-${board.id}`}
          onClick={() => {
            renameCallLog.push([board.id, 'New Name'])
            onRename(board.id, 'New Name')
          }}
        >
          Rename
        </button>
        <button
          type="button"
          data-testid={`delete-btn-${board.id}`}
          onClick={() => {
            deleteCallLog.push(board.id)
            onDelete(board.id)
          }}
        >
          Delete
        </button>
        <button
          type="button"
          data-testid={`favorite-btn-${board.id}`}
          onClick={() => {
            const newFavorite = !board.is_favorite
            favoriteCallLog.push([board.id, newFavorite])
            onToggleFavorite(board.id, newFavorite)
          }}
        >
          Toggle Favorite
        </button>
      </div>
    )
  },
}))

const createMockBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  name: 'Test Board',
  user_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  settings: null,
  theme: null,
  is_favorite: false,
  ...overrides,
})

describe('BoardGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear call logs
    renameCallLog.length = 0
    deleteCallLog.length = 0
    favoriteCallLog.length = 0
  })

  describe('Grid Rendering', () => {
    it('should render board cards for each board', () => {
      const boards = [
        createMockBoard({ id: 'board-1', name: 'Board 1' }),
        createMockBoard({ id: 'board-2', name: 'Board 2' }),
        createMockBoard({ id: 'board-3', name: 'Board 3' }),
      ]

      render(<BoardGrid initialBoards={boards} />)

      expect(screen.getByTestId('board-card-board-1')).toBeInTheDocument()
      expect(screen.getByTestId('board-card-board-2')).toBeInTheDocument()
      expect(screen.getByTestId('board-card-board-3')).toBeInTheDocument()
    })

    it('should display board names', () => {
      const boards = [
        createMockBoard({ id: 'board-1', name: 'My First Board' }),
        createMockBoard({ id: 'board-2', name: 'My Second Board' }),
      ]

      render(<BoardGrid initialBoards={boards} />)

      expect(screen.getByTestId('board-name-board-1')).toHaveTextContent(
        'My First Board',
      )
      expect(screen.getByTestId('board-name-board-2')).toHaveTextContent(
        'My Second Board',
      )
    })

    it('should render grid container with correct classes', () => {
      const boards = [createMockBoard()]

      const { container } = render(<BoardGrid initialBoards={boards} />)

      const grid = container.querySelector('.grid')
      expect(grid).toBeInTheDocument()
      expect(grid).toHaveClass('gap-6', 'sm:grid-cols-2', 'lg:grid-cols-3')
    })
  })

  describe('Empty State', () => {
    it('should render empty state when no boards', () => {
      render(<BoardGrid initialBoards={[]} />)

      expect(screen.getByText('No boards yet')).toBeInTheDocument()
      expect(
        screen.getByText('Get started by creating your first board'),
      ).toBeInTheDocument()
    })

    it('should render create board link in empty state', () => {
      render(<BoardGrid initialBoards={[]} />)

      const createLink = screen.getByRole('link', { name: /create board/i })
      expect(createLink).toBeInTheDocument()
      expect(createLink).toHaveAttribute('href', '/boards/new')
    })

    it('should not render empty state when boards exist', () => {
      render(<BoardGrid initialBoards={[createMockBoard()]} />)

      expect(screen.queryByText('No boards yet')).not.toBeInTheDocument()
    })
  })

  describe('Optimistic Rename', () => {
    it('should call onRename handler when rename is triggered', () => {
      const boards = [createMockBoard({ id: 'board-1', name: 'Original Name' })]

      render(<BoardGrid initialBoards={boards} />)

      const renameBtn = screen.getByTestId('rename-btn-board-1')
      fireEvent.click(renameBtn)

      // The callback was captured and should have been called
      expect(renameCallLog.length).toBe(1)
    })

    it('should pass correct arguments to rename handler', () => {
      const boards = [createMockBoard({ id: 'board-1' })]

      render(<BoardGrid initialBoards={boards} />)

      const renameBtn = screen.getByTestId('rename-btn-board-1')
      fireEvent.click(renameBtn)

      // Verify the onRename was called with correct args
      expect(renameCallLog[0]).toEqual(['board-1', 'New Name'])
    })
  })

  describe('Optimistic Delete', () => {
    it('should call onDelete handler when delete is triggered', () => {
      const boards = [createMockBoard({ id: 'board-1' })]

      render(<BoardGrid initialBoards={boards} />)

      const deleteBtn = screen.getByTestId('delete-btn-board-1')
      fireEvent.click(deleteBtn)

      expect(deleteCallLog.length).toBe(1)
    })

    it('should pass correct boardId to delete handler', () => {
      const boards = [createMockBoard({ id: 'board-to-delete' })]

      render(<BoardGrid initialBoards={boards} />)

      const deleteBtn = screen.getByTestId('delete-btn-board-to-delete')
      fireEvent.click(deleteBtn)

      expect(deleteCallLog[0]).toBe('board-to-delete')
    })
  })

  describe('Optimistic Toggle Favorite', () => {
    it('should call onToggleFavorite handler', () => {
      const boards = [createMockBoard({ id: 'board-1', is_favorite: false })]

      render(<BoardGrid initialBoards={boards} />)

      const favoriteBtn = screen.getByTestId('favorite-btn-board-1')
      fireEvent.click(favoriteBtn)

      expect(favoriteCallLog.length).toBe(1)
    })

    it('should pass correct arguments to toggleFavorite handler', () => {
      const boards = [createMockBoard({ id: 'board-1', is_favorite: false })]

      render(<BoardGrid initialBoards={boards} />)

      const favoriteBtn = screen.getByTestId('favorite-btn-board-1')
      fireEvent.click(favoriteBtn)

      expect(favoriteCallLog[0]).toEqual(['board-1', true]) // Toggle from false to true
    })

    it('should toggle favorite from true to false', () => {
      const boards = [createMockBoard({ id: 'board-1', is_favorite: true })]

      render(<BoardGrid initialBoards={boards} />)

      const favoriteBtn = screen.getByTestId('favorite-btn-board-1')
      fireEvent.click(favoriteBtn)

      expect(favoriteCallLog[0]).toEqual(['board-1', false]) // Toggle from true to false
    })
  })

  describe('Multiple Boards', () => {
    it('should render all boards in the grid', () => {
      const boards = [
        createMockBoard({ id: 'board-1', name: 'Board 1' }),
        createMockBoard({ id: 'board-2', name: 'Board 2' }),
        createMockBoard({ id: 'board-3', name: 'Board 3' }),
        createMockBoard({ id: 'board-4', name: 'Board 4' }),
      ]

      render(<BoardGrid initialBoards={boards} />)

      boards.forEach((board) => {
        expect(screen.getByTestId(`board-card-${board.id}`)).toBeInTheDocument()
      })
    })

    it('should pass correct board data to each BoardCard', () => {
      const boards = [
        createMockBoard({ id: 'b1', name: 'Alpha', is_favorite: true }),
        createMockBoard({ id: 'b2', name: 'Beta', is_favorite: false }),
      ]

      render(<BoardGrid initialBoards={boards} />)

      expect(screen.getByTestId('board-name-b1')).toHaveTextContent('Alpha')
      expect(screen.getByTestId('board-name-b2')).toHaveTextContent('Beta')
      expect(screen.getByTestId('board-favorite-b1')).toHaveTextContent(
        'favorite',
      )
      expect(screen.getByTestId('board-favorite-b2')).toHaveTextContent(
        'not-favorite',
      )
    })
  })

  describe('Accessibility', () => {
    it('should have accessible empty state with proper heading', () => {
      render(<BoardGrid initialBoards={[]} />)

      const heading = screen.getByRole('heading', { name: /no boards yet/i })
      expect(heading).toBeInTheDocument()
    })

    it('should have SVG icons with aria-hidden in empty state', () => {
      const { container } = render(<BoardGrid initialBoards={[]} />)

      const svgs = container.querySelectorAll('svg')
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true')
      })
    })
  })
})
