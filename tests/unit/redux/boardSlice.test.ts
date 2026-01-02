/**
 * Unit Tests: boardSlice Redux Actions
 *
 * Tests for board state management including:
 * - addRepoCards action (optimistic updates)
 * - setRepoCards action
 * - updateRepoCardOptimistic action
 */

import { describe, it, expect } from 'vitest'

import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import boardSlice, {
  setRepoCards,
  addRepoCards,
  updateRepoCardOptimistic,
  selectRepoCards,
  setActiveBoard,
  clearBoard,
  selectActiveBoard,
  setStatusLists,
  setLoading,
  setError,
  recordDragOperation,
  clearLastDragOperation,
  removeRepoCard,
  selectStatusLists,
  selectBoardLoading,
  selectBoardError,
  selectLastDragOperation,
  selectCanUndo,
  selectGridDimensions,
  selectStatusesByRow,
} from '@/lib/redux/slices/boardSlice'

/**
 * Create a mock RepoCardForRedux object for testing
 * @param overrides - Partial overrides for the card properties
 * @returns A complete RepoCardForRedux object
 */
const createMockCard = (
  overrides: Partial<RepoCardForRedux> = {},
): RepoCardForRedux => ({
  id: `card-${Math.random().toString(36).substring(2, 11)}`,
  title: 'test/repo',
  description: 'Test repository',
  statusId: 'status-1',
  boardId: 'board-1',
  repoOwner: 'test',
  repoName: 'repo',
  order: 0,
  meta: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('boardSlice', () => {
  describe('addRepoCards action', () => {
    it('should add new cards to empty state', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCards = [
        createMockCard({ id: 'card-1', title: 'owner/repo-1' }),
        createMockCard({ id: 'card-2', title: 'owner/repo-2' }),
      ]

      const nextState = boardSlice(initialState, addRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(2)
      expect(nextState.repoCards[0].id).toBe('card-1')
      expect(nextState.repoCards[1].id).toBe('card-2')
    })

    it('should append cards to existing cards', () => {
      const existingCards = [
        createMockCard({ id: 'existing-1', title: 'existing/repo-1' }),
      ]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCards = [
        createMockCard({ id: 'new-1', title: 'new/repo-1' }),
        createMockCard({ id: 'new-2', title: 'new/repo-2' }),
      ]

      const nextState = boardSlice(initialState, addRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(3)
      expect(nextState.repoCards[0].id).toBe('existing-1')
      expect(nextState.repoCards[1].id).toBe('new-1')
      expect(nextState.repoCards[2].id).toBe('new-2')
    })

    it('should handle empty array input', () => {
      const existingCards = [createMockCard({ id: 'existing-1' })]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, addRepoCards([]))

      expect(nextState.repoCards).toHaveLength(1)
      expect(nextState.repoCards[0].id).toBe('existing-1')
    })

    it('should preserve card metadata', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCard = createMockCard({
        id: 'card-with-meta',
        title: 'laststance/signage',
        description: 'Dark self screen saver app',
        meta: {
          stars: 42,
          language: 'TypeScript',
          topics: ['react', 'electron'],
        },
      })

      const nextState = boardSlice(initialState, addRepoCards([newCard]))

      expect(nextState.repoCards[0].meta).toEqual({
        stars: 42,
        language: 'TypeScript',
        topics: ['react', 'electron'],
      })
    })
  })

  describe('setRepoCards action (full replacement)', () => {
    it('should replace all existing cards', () => {
      const existingCards = [
        createMockCard({ id: 'old-1' }),
        createMockCard({ id: 'old-2' }),
      ]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCards = [createMockCard({ id: 'new-1' })]

      const nextState = boardSlice(initialState, setRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(1)
      expect(nextState.repoCards[0].id).toBe('new-1')
    })

    it('should clear cards when set to empty array', () => {
      const existingCards = [
        createMockCard({ id: 'card-1' }),
        createMockCard({ id: 'card-2' }),
      ]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, setRepoCards([]))

      expect(nextState.repoCards).toHaveLength(0)
    })
  })

  describe('updateRepoCardOptimistic action', () => {
    it('should update a single card by ID', () => {
      const existingCards = [
        createMockCard({ id: 'card-1', order: 0 }),
        createMockCard({ id: 'card-2', order: 1 }),
      ]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(
        initialState,
        updateRepoCardOptimistic({
          cardId: 'card-1',
          updates: { order: 5 },
        }),
      )

      expect(nextState.repoCards[0].order).toBe(5)
      expect(nextState.repoCards[1].order).toBe(1) // Unchanged
    })

    it('should not modify state for non-existent card ID', () => {
      const existingCards = [createMockCard({ id: 'card-1' })]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(
        initialState,
        updateRepoCardOptimistic({
          cardId: 'non-existent',
          updates: { order: 5 },
        }),
      )

      expect(nextState.repoCards).toEqual(existingCards)
    })
  })

  describe('selectRepoCards selector', () => {
    it('should return repoCards from state', () => {
      const cards = [
        createMockCard({ id: 'card-1' }),
        createMockCard({ id: 'card-2' }),
      ]

      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: cards,
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectRepoCards(state)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('card-1')
    })
  })

  describe('Optimistic Update Pattern', () => {
    it('should support optimistic add then rollback pattern', () => {
      const existingCards = [createMockCard({ id: 'existing-1' })]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      // Optimistic add
      const newCard = createMockCard({ id: 'optimistic-1' })
      const optimisticState = boardSlice(initialState, addRepoCards([newCard]))

      expect(optimisticState.repoCards).toHaveLength(2)

      // Rollback (server action failed)
      const rolledBackState = boardSlice(
        optimisticState,
        setRepoCards(existingCards),
      )

      expect(rolledBackState.repoCards).toHaveLength(1)
      expect(rolledBackState.repoCards[0].id).toBe('existing-1')
    })

    it('should maintain order when adding cards', () => {
      const existingCards = [
        createMockCard({ id: 'card-1', order: 0 }),
        createMockCard({ id: 'card-2', order: 1 }),
      ]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCard = createMockCard({ id: 'card-3', order: 2 })
      const nextState = boardSlice(initialState, addRepoCards([newCard]))

      expect(nextState.repoCards.map((c) => c.order)).toEqual([0, 1, 2])
    })
  })

  describe('setActiveBoard action', () => {
    /**
     * Helper to create a mock board object
     */
    const createMockBoard = (overrides = {}) => ({
      id: 'board-1',
      name: 'Test Board',
      theme: null,
      settings: null,
      user_id: 'user-1',
      is_favorite: false,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      ...overrides,
    })

    it('should set activeBoard from null', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const board = createMockBoard()
      const nextState = boardSlice(initialState, setActiveBoard(board))

      expect(nextState.activeBoard).not.toBeNull()
      expect(nextState.activeBoard?.id).toBe('board-1')
      expect(nextState.activeBoard?.name).toBe('Test Board')
    })

    it('should update activeBoard when already set', () => {
      const existingBoard = createMockBoard({
        id: 'old-board',
        name: 'Old Board',
      })
      const initialState = {
        activeBoard: existingBoard,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newBoard = createMockBoard({ id: 'new-board', name: 'New Board' })
      const nextState = boardSlice(initialState, setActiveBoard(newBoard))

      expect(nextState.activeBoard?.id).toBe('new-board')
      expect(nextState.activeBoard?.name).toBe('New Board')
    })

    it('should clear activeBoard when set to null', () => {
      const existingBoard = createMockBoard()
      const initialState = {
        activeBoard: existingBoard,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, setActiveBoard(null))

      expect(nextState.activeBoard).toBeNull()
    })

    it('should preserve board properties including theme', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const board = createMockBoard({
        theme: 'dark-green',
        is_favorite: true,
      })
      const nextState = boardSlice(initialState, setActiveBoard(board))

      expect(nextState.activeBoard?.theme).toBe('dark-green')
      expect(nextState.activeBoard?.is_favorite).toBe(true)
    })
  })

  describe('selectActiveBoard selector', () => {
    it('should return activeBoard from state', () => {
      const board = {
        id: 'board-1',
        name: 'Test Board',
        theme: null,
        settings: null,
        user_id: 'user-1',
        is_favorite: false,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }

      const state = {
        board: {
          activeBoard: board,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      expect(selectActiveBoard(state)).toEqual(board)
    })

    it('should return null when no activeBoard is set', () => {
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      expect(selectActiveBoard(state)).toBeNull()
    })
  })

  describe('clearBoard action', () => {
    it('should reset all board state to initial values', () => {
      const initialState = {
        activeBoard: {
          id: 'board-1',
          name: 'Test Board',
          theme: 'dark',
          settings: { layout: 'grid' },
          user_id: 'user-1',
          is_favorite: true,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        statusLists: [
          {
            id: 'status-1',
            title: 'Todo',
            color: '#fff',
            gridRow: 0,
            gridCol: 0,
            boardId: 'board-1',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        repoCards: [createMockCard({ id: 'card-1' })],
        loading: true,
        error: 'Some error',
        lastDragOperation: {
          cardId: 'card-1',
          fromStatusId: 'status-1',
          toStatusId: 'status-2',
          fromOrder: 0,
          toOrder: 1,
          timestamp: Date.now(),
        },
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, clearBoard())

      expect(nextState.activeBoard).toBeNull()
      expect(nextState.statusLists).toEqual([])
      expect(nextState.repoCards).toEqual([])
      expect(nextState.loading).toBe(false)
      expect(nextState.error).toBeNull()
      expect(nextState.lastDragOperation).toBeNull()
      expect(nextState.undoHistory).toEqual([])
    })
  })

  /**
   * Helper to create a mock StatusListDomain object
   */
  const createMockStatus = (
    overrides: Partial<StatusListDomain> = {},
  ): StatusListDomain => ({
    id: `status-${Math.random().toString(36).substring(2, 11)}`,
    title: 'Test Status',
    color: '#3b82f6',
    gridRow: 1,
    gridCol: 1,
    boardId: 'board-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  describe('setStatusLists action', () => {
    it('should set status lists from empty state', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newStatuses = [
        createMockStatus({ id: 'status-1', title: 'Todo' }),
        createMockStatus({ id: 'status-2', title: 'In Progress' }),
      ]

      const nextState = boardSlice(initialState, setStatusLists(newStatuses))

      expect(nextState.statusLists).toHaveLength(2)
      expect(nextState.statusLists[0].title).toBe('Todo')
      expect(nextState.statusLists[1].title).toBe('In Progress')
    })

    it('should replace existing status lists', () => {
      const existingStatuses = [createMockStatus({ id: 'old-1', title: 'Old' })]
      const initialState = {
        activeBoard: null,
        statusLists: existingStatuses,
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newStatuses = [createMockStatus({ id: 'new-1', title: 'New' })]
      const nextState = boardSlice(initialState, setStatusLists(newStatuses))

      expect(nextState.statusLists).toHaveLength(1)
      expect(nextState.statusLists[0].title).toBe('New')
    })
  })

  describe('setLoading action', () => {
    it('should set loading to true', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, setLoading(true))

      expect(nextState.loading).toBe(true)
    })

    it('should set loading to false', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: true,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, setLoading(false))

      expect(nextState.loading).toBe(false)
    })
  })

  describe('setError action', () => {
    it('should set error message', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(
        initialState,
        setError('Something went wrong'),
      )

      expect(nextState.error).toBe('Something went wrong')
    })

    it('should clear error when set to null', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: 'Previous error',
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, setError(null))

      expect(nextState.error).toBeNull()
    })
  })

  describe('recordDragOperation action', () => {
    it('should record a drag operation', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const dragOp = {
        cardId: 'card-1',
        fromStatusId: 'status-1',
        toStatusId: 'status-2',
        fromOrder: 0,
        toOrder: 1,
        timestamp: 1234567890,
      }

      const nextState = boardSlice(initialState, recordDragOperation(dragOp))

      expect(nextState.lastDragOperation).toEqual(dragOp)
      expect(nextState.undoHistory).toHaveLength(1)
      expect(nextState.undoHistory[0]).toEqual(dragOp)
    })

    it('should keep maximum 10 history entries', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: Array.from({ length: 10 }, (_, i) => ({
          cardId: `card-${i}`,
          fromStatusId: 'status-1',
          toStatusId: 'status-2',
          fromOrder: 0,
          toOrder: 1,
          timestamp: i,
        })),
      }

      const newDragOp = {
        cardId: 'card-new',
        fromStatusId: 'status-1',
        toStatusId: 'status-2',
        fromOrder: 0,
        toOrder: 1,
        timestamp: 999,
      }

      const nextState = boardSlice(initialState, recordDragOperation(newDragOp))

      expect(nextState.undoHistory).toHaveLength(10)
      expect(nextState.undoHistory[0].cardId).toBe('card-new')
      // The oldest entry (card-9) should be removed (slice keeps first 10)
      expect(
        nextState.undoHistory.find((op) => op.cardId === 'card-9'),
      ).toBeUndefined()
    })
  })

  describe('clearLastDragOperation action', () => {
    it('should clear the last drag operation', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: {
          cardId: 'card-1',
          fromStatusId: 'status-1',
          toStatusId: 'status-2',
          fromOrder: 0,
          toOrder: 1,
          timestamp: 1234567890,
        },
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, clearLastDragOperation())

      expect(nextState.lastDragOperation).toBeNull()
    })
  })

  describe('removeRepoCard action', () => {
    it('should remove a card by ID', () => {
      const existingCards = [
        createMockCard({ id: 'card-1' }),
        createMockCard({ id: 'card-2' }),
        createMockCard({ id: 'card-3' }),
      ]
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, removeRepoCard('card-2'))

      expect(nextState.repoCards).toHaveLength(2)
      expect(nextState.repoCards.find((c) => c.id === 'card-2')).toBeUndefined()
    })

    it('should not modify state when card ID does not exist', () => {
      const existingCards = [createMockCard({ id: 'card-1' })]
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, removeRepoCard('non-existent'))

      expect(nextState.repoCards).toHaveLength(1)
    })
  })

  describe('selectStatusLists selector', () => {
    it('should return status lists from state', () => {
      const statuses = [
        createMockStatus({ id: 'status-1', title: 'Todo' }),
        createMockStatus({ id: 'status-2', title: 'Done' }),
      ]
      const state = {
        board: {
          activeBoard: null,
          statusLists: statuses,
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectStatusLists(state)

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Todo')
    })
  })

  describe('selectBoardLoading selector', () => {
    it('should return loading state', () => {
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: true,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      expect(selectBoardLoading(state)).toBe(true)
    })
  })

  describe('selectBoardError selector', () => {
    it('should return error from state', () => {
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: 'Test error',
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      expect(selectBoardError(state)).toBe('Test error')
    })
  })

  describe('selectLastDragOperation selector', () => {
    it('should return last drag operation', () => {
      const dragOp = {
        cardId: 'card-1',
        fromStatusId: 'status-1',
        toStatusId: 'status-2',
        fromOrder: 0,
        toOrder: 1,
        timestamp: 1234567890,
      }
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: dragOp,
          undoHistory: [],
        },
      }

      expect(selectLastDragOperation(state)).toEqual(dragOp)
    })
  })

  describe('selectCanUndo selector', () => {
    it('should return true when there is a last drag operation', () => {
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: {
            cardId: 'card-1',
            fromStatusId: 'status-1',
            toStatusId: 'status-2',
            fromOrder: 0,
            toOrder: 1,
            timestamp: 1234567890,
          },
          undoHistory: [],
        },
      }

      expect(selectCanUndo(state)).toBe(true)
    })

    it('should return false when there is no last drag operation', () => {
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      expect(selectCanUndo(state)).toBe(false)
    })
  })

  describe('selectGridDimensions selector', () => {
    it('should return max row and col from status lists', () => {
      const statuses = [
        createMockStatus({ id: 's1', gridRow: 1, gridCol: 1 }),
        createMockStatus({ id: 's2', gridRow: 1, gridCol: 2 }),
        createMockStatus({ id: 's3', gridRow: 2, gridCol: 1 }),
        createMockStatus({ id: 's4', gridRow: 3, gridCol: 3 }),
      ]
      const state = {
        board: {
          activeBoard: null,
          statusLists: statuses,
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectGridDimensions(state)

      expect(result.maxRow).toBe(3)
      expect(result.maxCol).toBe(3)
    })

    it('should return 0,0 for empty status lists', () => {
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectGridDimensions(state)

      expect(result.maxRow).toBe(0)
      expect(result.maxCol).toBe(0)
    })
  })

  describe('selectStatusesByRow selector', () => {
    it('should group statuses by row and sort by column', () => {
      const statuses = [
        createMockStatus({
          id: 's1',
          title: 'Row1-Col2',
          gridRow: 1,
          gridCol: 2,
        }),
        createMockStatus({
          id: 's2',
          title: 'Row1-Col1',
          gridRow: 1,
          gridCol: 1,
        }),
        createMockStatus({
          id: 's3',
          title: 'Row2-Col1',
          gridRow: 2,
          gridCol: 1,
        }),
        createMockStatus({
          id: 's4',
          title: 'Row1-Col3',
          gridRow: 1,
          gridCol: 3,
        }),
      ]
      const state = {
        board: {
          activeBoard: null,
          statusLists: statuses,
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectStatusesByRow(state)

      // Row 1 should have 3 statuses sorted by column
      const row1 = result.get(1)
      expect(row1).toHaveLength(3)
      expect(row1![0].title).toBe('Row1-Col1')
      expect(row1![1].title).toBe('Row1-Col2')
      expect(row1![2].title).toBe('Row1-Col3')

      // Row 2 should have 1 status
      const row2 = result.get(2)
      expect(row2).toHaveLength(1)
      expect(row2![0].title).toBe('Row2-Col1')
    })

    it('should return empty map for empty status lists', () => {
      const state = {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          loading: false,
          error: null,
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectStatusesByRow(state)

      expect(result.size).toBe(0)
    })
  })
})
