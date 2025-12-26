/**
 * Unit Tests: boardSlice Redux Actions
 *
 * Tests for board state management including:
 * - addRepoCards action (optimistic updates)
 * - setRepoCards action
 * - updateRepoCardOptimistic action
 */

import { describe, it, expect } from 'vitest'

import type { RepoCardForRedux } from '@/lib/models/domain'
import boardSlice, {
  setRepoCards,
  addRepoCards,
  updateRepoCardOptimistic,
  selectRepoCards,
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
  note: null,
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
        createMockCard({ id: 'card-1', note: 'Original note' }),
        createMockCard({ id: 'card-2', note: null }),
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
          updates: { note: 'Updated note' },
        }),
      )

      expect(nextState.repoCards[0].note).toBe('Updated note')
      expect(nextState.repoCards[1].note).toBe(null) // Unchanged
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
          updates: { note: 'Updated' },
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
})
