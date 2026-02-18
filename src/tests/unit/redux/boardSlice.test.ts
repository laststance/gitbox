/**
 * Unit Tests: boardSlice Redux Actions
 *
 * Tests for board state management including:
 * - setActiveBoard action
 * - setStatusLists action
 * - setRepoCards action
 * - addRepoCards action (optimistic updates)
 * - removeRepoCard action
 * - selectStatusLists, selectRepoCards selectors
 */

import { describe, it, expect } from 'vitest'

import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import boardSlice, {
  setRepoCards,
  addRepoCards,
  selectRepoCards,
  setActiveBoard,
  setStatusLists,
  removeRepoCard,
  selectStatusLists,
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

describe('boardSlice', () => {
  describe('addRepoCards action', () => {
    it('should add new cards to empty state', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCards = [
        createMockCard({ id: 'card-1', title: 'owner/repo-1' }),
        createMockCard({ id: 'card-2', title: 'owner/repo-2' }),
      ]

      const nextState = boardSlice(initialState, addRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(2)
      expect(nextState.repoCards[0]!.id).toBe('card-1')
      expect(nextState.repoCards[1]!.id).toBe('card-2')
    })

    it('should append cards to existing cards', () => {
      const existingCards = [
        createMockCard({ id: 'existing-1', title: 'existing/repo-1' }),
      ]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCards = [
        createMockCard({ id: 'new-1', title: 'new/repo-1' }),
        createMockCard({ id: 'new-2', title: 'new/repo-2' }),
      ]

      const nextState = boardSlice(initialState, addRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(3)
      expect(nextState.repoCards[0]!.id).toBe('existing-1')
      expect(nextState.repoCards[1]!.id).toBe('new-1')
      expect(nextState.repoCards[2]!.id).toBe('new-2')
    })

    it('should handle empty array input', () => {
      const existingCards = [createMockCard({ id: 'existing-1' })]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, addRepoCards([]))

      expect(nextState.repoCards).toHaveLength(1)
      expect(nextState.repoCards[0]!.id).toBe('existing-1')
    })

    it('should preserve card metadata', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
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

      expect(nextState.repoCards[0]!.meta).toEqual({
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
        lastDragOperation: null,
        undoHistory: [],
      }

      const newCards = [createMockCard({ id: 'new-1' })]

      const nextState = boardSlice(initialState, setRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(1)
      expect(nextState.repoCards[0]!.id).toBe('new-1')
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
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, setRepoCards([]))

      expect(nextState.repoCards).toHaveLength(0)
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
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectRepoCards(state)

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('card-1')
    })
  })

  describe('Optimistic Update Pattern', () => {
    it('should support optimistic add then rollback pattern', () => {
      const existingCards = [createMockCard({ id: 'existing-1' })]

      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: existingCards,
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
      expect(rolledBackState.repoCards[0]!.id).toBe('existing-1')
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
      subtitle: null as string | null,
      settings: null,
      user_id: 'user-1',
      is_favorite: false,
      is_public: false,
      share_slug: null as string | null,
      position: 0,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      ...overrides,
    })

    it('should set activeBoard from null', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
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
        lastDragOperation: null,
        undoHistory: [],
      }

      const nextState = boardSlice(initialState, setActiveBoard(null))

      expect(nextState.activeBoard).toBeNull()
    })

    it('should preserve board properties including position', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        lastDragOperation: null,
        undoHistory: [],
      }

      const board = createMockBoard({
        position: 3,
        is_favorite: true,
      })
      const nextState = boardSlice(initialState, setActiveBoard(board))

      expect(nextState.activeBoard?.position).toBe(3)
      expect(nextState.activeBoard?.is_favorite).toBe(true)
    })
  })

  describe('setStatusLists action', () => {
    it('should set status lists from empty state', () => {
      const initialState = {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        lastDragOperation: null,
        undoHistory: [],
      }

      const newStatuses = [
        createMockStatus({ id: 'status-1', title: 'Todo' }),
        createMockStatus({ id: 'status-2', title: 'In Progress' }),
      ]

      const nextState = boardSlice(initialState, setStatusLists(newStatuses))

      expect(nextState.statusLists).toHaveLength(2)
      expect(nextState.statusLists[0]!.title).toBe('Todo')
      expect(nextState.statusLists[1]!.title).toBe('In Progress')
    })

    it('should replace existing status lists', () => {
      const existingStatuses = [createMockStatus({ id: 'old-1', title: 'Old' })]
      const initialState = {
        activeBoard: null,
        statusLists: existingStatuses,
        repoCards: [],
        lastDragOperation: null,
        undoHistory: [],
      }

      const newStatuses = [createMockStatus({ id: 'new-1', title: 'New' })]
      const nextState = boardSlice(initialState, setStatusLists(newStatuses))

      expect(nextState.statusLists).toHaveLength(1)
      expect(nextState.statusLists[0]!.title).toBe('New')
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
          lastDragOperation: null,
          undoHistory: [],
        },
      }

      const result = selectStatusLists(state)

      expect(result).toHaveLength(2)
      expect(result[0]!.title).toBe('Todo')
    })
  })
})
