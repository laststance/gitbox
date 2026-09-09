/**
 * Unit Test: StatusColumn Component
 *
 * Test targets:
 * - Column header rendering (title, color indicator)
 * - Card list rendering with SortableContext
 * - Droppable functionality
 * - Column actions (edit, delete, add card)
 * - Callback invocations
 * - Drag attributes and listeners
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import { StatusColumn, CARD_DRAG_TYPE } from '@/components/Board/StatusColumn'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
}))

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  verticalListSortingStrategy: {},
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children: React.ReactNode
      [key: string]: unknown
    }) => <div {...props}>{children}</div>,
  },
  m: {
    div: ({
      children,
      ...props
    }: {
      children: React.ReactNode
      [key: string]: unknown
    }) => <div {...props}>{children}</div>,
  },
  LazyMotion: ({ children }: { children: React.ReactNode }): React.ReactNode =>
    children,
  domAnimation: {},
  AnimatePresence: ({
    children,
  }: {
    children: React.ReactNode
  }): React.ReactNode => children,
  useReducedMotion: () => false,
}))

// Mock RepoCard to isolate StatusColumn testing
vi.mock('@/components/Board/RepoCard', () => ({
  RepoCard: ({
    card,
    onNote,
  }: {
    card: { id: string; title: string }
    onNote?: (id: string) => void
  }) => (
    <div data-testid={`repo-card-${card.id}`}>
      <span>{card.title}</span>
      {onNote && (
        <button
          type="button"
          onClick={() => onNote(card.id)}
          data-testid={`note-${card.id}`}
        >
          Note
        </button>
      )}
    </div>
  ),
}))

describe('StatusColumn', () => {
  const mockOnNote = vi.fn()
  const mockOnEditStatus = vi.fn()
  const mockOnDeleteStatus = vi.fn()
  const mockOnAddCard = vi.fn()

  const defaultStatus: StatusListDomain = {
    id: toStatusListId('status-1'),
    title: 'In Progress',
    color: '#3b82f6',
    gridRow: 1,
    gridCol: 1,
    boardId: toBoardId('board-1'),
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  const defaultCards: RepoCardForRedux[] = [
    {
      id: toRepoCardId('card-1'),
      title: 'test-repo-1',
      description: 'Test description 1',
      statusId: toStatusListId('status-1'),
      boardId: toBoardId('board-1'),
      repoOwner: 'laststance',
      repoName: 'test-repo-1',
      order: 0,
      meta: {},
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: toRepoCardId('card-2'),
      title: 'test-repo-2',
      description: 'Test description 2',
      statusId: toStatusListId('status-1'),
      boardId: toBoardId('board-1'),
      repoOwner: 'laststance',
      repoName: 'test-repo-2',
      order: 1,
      meta: {},
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Column Header', () => {
    test('should render column title', () => {
      render(<StatusColumn status={defaultStatus} cards={[]} />)

      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    test('should render color indicator when color is provided', () => {
      render(<StatusColumn status={defaultStatus} cards={[]} />)

      const colorDot = screen
        .getByTestId(`status-column-${defaultStatus.id}`)
        .querySelector('.rounded-full')
      expect(colorDot).toHaveStyle({ backgroundColor: '#3b82f6' })
    })

    test('should not render color indicator when color is empty', () => {
      const statusWithoutColor = { ...defaultStatus, color: '' }
      render(<StatusColumn status={statusWithoutColor} cards={[]} />)

      const colorDot = screen
        .getByTestId(`status-column-${defaultStatus.id}`)
        .querySelector('.rounded-full')
      expect(colorDot).toBeNull()
    })

    test('should have cursor-grab class for draggable header', () => {
      render(<StatusColumn status={defaultStatus} cards={[]} />)

      const header = screen
        .getByTestId(`status-column-${defaultStatus.id}`)
        .querySelector('.cursor-grab')
      expect(header).toBeInTheDocument()
    })
  })

  describe('Card List Rendering', () => {
    test('should render all cards in the column', () => {
      render(<StatusColumn status={defaultStatus} cards={defaultCards} />)

      expect(screen.getByTestId('repo-card-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('repo-card-card-2')).toBeInTheDocument()
    })

    test('should render empty column when no cards', () => {
      render(<StatusColumn status={defaultStatus} cards={[]} />)

      expect(screen.queryByTestId('repo-card-card-1')).not.toBeInTheDocument()
    })

    test('should wrap cards in SortableContext', () => {
      render(<StatusColumn status={defaultStatus} cards={defaultCards} />)

      expect(screen.getByTestId('sortable-context')).toBeInTheDocument()
    })

    test('should pass card data to RepoCard components', () => {
      render(<StatusColumn status={defaultStatus} cards={defaultCards} />)

      expect(screen.getByText('test-repo-1')).toBeInTheDocument()
      expect(screen.getByText('test-repo-2')).toBeInTheDocument()
    })
  })

  describe('Column Actions Menu', () => {
    test('should render column options button', () => {
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onEditStatus={mockOnEditStatus}
        />,
      )

      expect(screen.getByLabelText('Column options')).toBeInTheDocument()
    })

    test('should show Edit Column option when onEditStatus is provided', async () => {
      const user = userEvent.setup()
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onEditStatus={mockOnEditStatus}
        />,
      )

      await user.click(screen.getByLabelText('Column options'))

      await waitFor(() => {
        expect(screen.getByText('Edit Column')).toBeInTheDocument()
      })
    })

    test('should show Delete Column option when onDeleteStatus is provided', async () => {
      const user = userEvent.setup()
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onDeleteStatus={mockOnDeleteStatus}
        />,
      )

      await user.click(screen.getByLabelText('Column options'))

      await waitFor(() => {
        expect(screen.getByText('Delete Column')).toBeInTheDocument()
      })
    })

    test('should call onEditStatus when Edit Column is clicked', async () => {
      const user = userEvent.setup()
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onEditStatus={mockOnEditStatus}
        />,
      )

      await user.click(screen.getByLabelText('Column options'))
      await user.click(screen.getByText('Edit Column'))

      expect(mockOnEditStatus).toHaveBeenCalledWith(defaultStatus)
    })

    test('should call onDeleteStatus when Delete Column is clicked', async () => {
      const user = userEvent.setup()
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onDeleteStatus={mockOnDeleteStatus}
        />,
      )

      await user.click(screen.getByLabelText('Column options'))
      await user.click(screen.getByText('Delete Column'))

      expect(mockOnDeleteStatus).toHaveBeenCalledWith('status-1')
    })

    test('should have destructive styling on Delete Column option', async () => {
      const user = userEvent.setup()
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onDeleteStatus={mockOnDeleteStatus}
        />,
      )

      await user.click(screen.getByLabelText('Column options'))

      const deleteItem = screen.getByText('Delete Column')
      expect(deleteItem.closest('[role="menuitem"]')).toHaveClass(
        'text-destructive',
      )
    })
  })

  describe('Add Card Button', () => {
    test('should render Add Repo button when onAddCard is provided', () => {
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onAddCard={mockOnAddCard}
        />,
      )

      expect(screen.getByTestId('add-repo-button')).toBeInTheDocument()
      expect(screen.getByText('Add Repo')).toBeInTheDocument()
    })

    test('should not render Add Repo button when onAddCard is not provided', () => {
      render(<StatusColumn status={defaultStatus} cards={[]} />)

      expect(screen.queryByTestId('add-repo-button')).not.toBeInTheDocument()
    })

    test('should call onAddCard with statusId when clicked', async () => {
      const user = userEvent.setup()
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          onAddCard={mockOnAddCard}
        />,
      )

      await user.click(screen.getByTestId('add-repo-button'))

      expect(mockOnAddCard).toHaveBeenCalledWith('status-1')
    })
  })

  describe('Card Callbacks', () => {
    test('should pass onNote to RepoCard', async () => {
      const user = userEvent.setup()
      render(
        <StatusColumn
          status={defaultStatus}
          cards={defaultCards}
          onNote={mockOnNote}
        />,
      )

      await user.click(screen.getByTestId('note-card-1'))

      expect(mockOnNote).toHaveBeenCalledWith('card-1')
    })
  })

  describe('Drag Attributes and Listeners', () => {
    test('should apply dragAttributes to header', () => {
      // dragAttributes are spread onto the header div
      // The component already has its own aria-label, so we just verify
      // the header element exists and can accept additional attributes
      render(
        <StatusColumn
          status={defaultStatus}
          cards={[]}
          dragAttributes={
            {
              'data-drag-handle': 'true',
            } as React.HTMLAttributes<HTMLDivElement>
          }
        />,
      )

      // Header should have cursor-grab class
      const header = screen
        .getByTestId(`status-column-${defaultStatus.id}`)
        .querySelector('.cursor-grab')
      expect(header).toBeInTheDocument()
      expect(header).toHaveAttribute('data-drag-handle', 'true')
    })

    test('should have aria-label for accessibility on drag header', () => {
      render(<StatusColumn status={defaultStatus} cards={[]} />)

      const header = screen.getByLabelText(/Drag to reorder In Progress column/)
      expect(header).toBeInTheDocument()
    })
  })

  describe('Comment Integration', () => {
    test('should pass comments to RepoCard', () => {
      const comments = {
        'card-1': { comment: 'Test comment', color: 'blue' as const },
      }

      render(
        <StatusColumn
          status={defaultStatus}
          cards={defaultCards}
          comments={comments}
        />,
      )

      expect(screen.getByTestId('repo-card-card-1')).toBeInTheDocument()
    })

    test('should pass cardDisplaySettings to RepoCard', () => {
      const cardDisplaySettings = {
        showGitHubDescription: true,
        showComment: true,
        commentText: {
          fontSize: 'base' as const,
          fontWeight: 'medium' as const,
        },
      }

      render(
        <StatusColumn
          status={defaultStatus}
          cards={defaultCards}
          cardDisplaySettings={cardDisplaySettings}
        />,
      )

      expect(screen.getByTestId('repo-card-card-1')).toBeInTheDocument()
    })
  })

  describe('Test ID and Data Attributes', () => {
    test('should have correct test-id for column', () => {
      render(<StatusColumn status={defaultStatus} cards={[]} />)

      expect(screen.getByTestId('status-column-status-1')).toBeInTheDocument()
    })
  })

  describe('CARD_DRAG_TYPE Export', () => {
    test('should export CARD_DRAG_TYPE constant', () => {
      expect(CARD_DRAG_TYPE).toBe('card')
    })
  })

  describe('Edge Cases', () => {
    test('should handle status with empty color', () => {
      const minimalStatus: StatusListDomain = {
        id: toStatusListId('minimal'),
        title: 'Minimal',
        color: '',
        gridRow: 1,
        gridCol: 1,
        boardId: toBoardId('board-1'),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      render(<StatusColumn status={minimalStatus} cards={[]} />)

      expect(screen.getByText('Minimal')).toBeInTheDocument()
    })

    test('should handle large number of cards', () => {
      const manyCards: RepoCardForRedux[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: toRepoCardId(`card-${i}`),
          title: `Repo ${i}`,
          statusId: toStatusListId('status-1'),
          boardId: toBoardId('board-1'),
          repoOwner: 'laststance',
          repoName: `repo-${i}`,
          order: i,
          meta: {},
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }),
      )

      render(<StatusColumn status={defaultStatus} cards={manyCards} />)

      expect(screen.getByTestId('repo-card-card-0')).toBeInTheDocument()
      expect(screen.getByTestId('repo-card-card-49')).toBeInTheDocument()
    })
  })
})
