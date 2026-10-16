/**
 * Unit Tests: boardSlice Redux Actions
 *
 * Tests for board state management including:
 * - setStatusLists action
 * - setRepoCards action
 * - addRepoCards action (optimistic updates)
 * - removeRepoCard action
 * - selectStatusLists, selectRepoCards selectors
 */

import { describe, test, expect } from 'vitest'

import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import boardSlice, {
  setRepoCards,
  addRepoCards,
  applyRefreshedRepoCards,
  selectRepoCards,
  setStatusLists,
  removeRepoCard,
  selectStatusLists,
} from '@/lib/redux/slices/boardSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

/**
 * Create a mock RepoCardForRedux object for testing
 * @param overrides - Partial overrides for the card properties
 * @returns A complete RepoCardForRedux object
 */
const createMockCard = (
  overrides: Partial<RepoCardForRedux> = {},
): RepoCardForRedux => ({
  id: toRepoCardId(`card-${Math.random().toString(36).substring(2, 11)}`),
  title: 'test/repo',
  description: 'Test repository',
  statusId: toStatusListId('status-1'),
  boardId: toBoardId('board-1'),
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
  id: toStatusListId(`status-${Math.random().toString(36).substring(2, 11)}`),
  title: 'Test Status',
  color: '#3b82f6',
  gridRow: 1,
  gridCol: 1,
  boardId: toBoardId('board-1'),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('boardSlice', () => {
  describe('addRepoCards action', () => {
    test('should add new cards to empty state', () => {
      const initialState = {
        statusLists: [],
        repoCards: [],
      }

      const newCards = [
        createMockCard({ id: toRepoCardId('card-1'), title: 'owner/repo-1' }),
        createMockCard({ id: toRepoCardId('card-2'), title: 'owner/repo-2' }),
      ]

      const nextState = boardSlice(initialState, addRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(2)
      expect(nextState.repoCards[0]!.id).toBe('card-1')
      expect(nextState.repoCards[1]!.id).toBe('card-2')
    })

    test('should append cards to existing cards', () => {
      const existingCards = [
        createMockCard({
          id: toRepoCardId('existing-1'),
          title: 'existing/repo-1',
        }),
      ]

      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      const newCards = [
        createMockCard({ id: toRepoCardId('new-1'), title: 'new/repo-1' }),
        createMockCard({ id: toRepoCardId('new-2'), title: 'new/repo-2' }),
      ]

      const nextState = boardSlice(initialState, addRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(3)
      expect(nextState.repoCards[0]!.id).toBe('existing-1')
      expect(nextState.repoCards[1]!.id).toBe('new-1')
      expect(nextState.repoCards[2]!.id).toBe('new-2')
    })

    test('should handle empty array input', () => {
      const existingCards = [createMockCard({ id: toRepoCardId('existing-1') })]

      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      const nextState = boardSlice(initialState, addRepoCards([]))

      expect(nextState.repoCards).toHaveLength(1)
      expect(nextState.repoCards[0]!.id).toBe('existing-1')
    })

    test('should preserve card metadata', () => {
      const initialState = {
        statusLists: [],
        repoCards: [],
      }

      const newCard = createMockCard({
        id: toRepoCardId('card-with-meta'),
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
    test('should replace all existing cards', () => {
      const existingCards = [
        createMockCard({ id: toRepoCardId('old-1') }),
        createMockCard({ id: toRepoCardId('old-2') }),
      ]

      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      const newCards = [createMockCard({ id: toRepoCardId('new-1') })]

      const nextState = boardSlice(initialState, setRepoCards(newCards))

      expect(nextState.repoCards).toHaveLength(1)
      expect(nextState.repoCards[0]!.id).toBe('new-1')
    })

    test('should clear cards when set to empty array', () => {
      const existingCards = [
        createMockCard({ id: toRepoCardId('card-1') }),
        createMockCard({ id: toRepoCardId('card-2') }),
      ]

      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      const nextState = boardSlice(initialState, setRepoCards([]))

      expect(nextState.repoCards).toHaveLength(0)
    })
  })

  describe('selectRepoCards selector', () => {
    test('should return repoCards from state', () => {
      const cards = [
        createMockCard({ id: toRepoCardId('card-1') }),
        createMockCard({ id: toRepoCardId('card-2') }),
      ]

      const state = {
        board: {
          statusLists: [],
          repoCards: cards,
        },
      }

      const result = selectRepoCards(state)

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('card-1')
    })
  })

  describe('Optimistic Update Pattern', () => {
    test('should support optimistic add then rollback pattern', () => {
      const existingCards = [createMockCard({ id: toRepoCardId('existing-1') })]

      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      // Optimistic add
      const newCard = createMockCard({ id: toRepoCardId('optimistic-1') })
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

    test('should maintain order when adding cards', () => {
      const existingCards = [
        createMockCard({ id: toRepoCardId('card-1'), order: 0 }),
        createMockCard({ id: toRepoCardId('card-2'), order: 1 }),
      ]

      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      const newCard = createMockCard({ id: toRepoCardId('card-3'), order: 2 })
      const nextState = boardSlice(initialState, addRepoCards([newCard]))

      expect(nextState.repoCards.map((c) => c.order)).toEqual([0, 1, 2])
    })
  })

  describe('setStatusLists action', () => {
    test('should set status lists from empty state', () => {
      const initialState = {
        statusLists: [],
        repoCards: [],
      }

      const newStatuses = [
        createMockStatus({ id: toStatusListId('status-1'), title: 'Todo' }),
        createMockStatus({
          id: toStatusListId('status-2'),
          title: 'In Progress',
        }),
      ]

      const nextState = boardSlice(initialState, setStatusLists(newStatuses))

      expect(nextState.statusLists).toHaveLength(2)
      expect(nextState.statusLists[0]!.title).toBe('Todo')
      expect(nextState.statusLists[1]!.title).toBe('In Progress')
    })

    test('should replace existing status lists', () => {
      const existingStatuses = [
        createMockStatus({ id: toStatusListId('old-1'), title: 'Old' }),
      ]
      const initialState = {
        statusLists: existingStatuses,
        repoCards: [],
      }

      const newStatuses = [
        createMockStatus({ id: toStatusListId('new-1'), title: 'New' }),
      ]
      const nextState = boardSlice(initialState, setStatusLists(newStatuses))

      expect(nextState.statusLists).toHaveLength(1)
      expect(nextState.statusLists[0]!.title).toBe('New')
    })
  })

  describe('removeRepoCard action', () => {
    test('should remove a card by ID', () => {
      const existingCards = [
        createMockCard({ id: toRepoCardId('card-1') }),
        createMockCard({ id: toRepoCardId('card-2') }),
        createMockCard({ id: toRepoCardId('card-3') }),
      ]
      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      const nextState = boardSlice(
        initialState,
        removeRepoCard(toRepoCardId('card-2')),
      )

      expect(nextState.repoCards).toHaveLength(2)
      expect(nextState.repoCards.find((c) => c.id === 'card-2')).toBeUndefined()
    })

    test('should not modify state when card ID does not exist', () => {
      const existingCards = [createMockCard({ id: toRepoCardId('card-1') })]
      const initialState = {
        statusLists: [],
        repoCards: existingCards,
      }

      const nextState = boardSlice(
        initialState,
        removeRepoCard(toRepoCardId('non-existent')),
      )

      expect(nextState.repoCards).toHaveLength(1)
    })
  })

  describe('applyRefreshedRepoCards', () => {
    test('shows the description GitHub just returned and leaves the other card', () => {
      // Arrange
      const kept = createMockCard({
        id: toRepoCardId('card-kept'),
        description: 'Stays',
      })
      const refreshed = createMockCard({
        id: toRepoCardId('card-refreshed'),
        description: 'Old description',
      })
      const initialState = {
        statusLists: [],
        repoCards: [kept, refreshed],
      }

      // Act
      const nextState = boardSlice(
        initialState,
        applyRefreshedRepoCards([
          {
            id: 'card-refreshed',
            description: 'Boards for repositories',
            meta: {
              stars: 7,
              githubId: 42,
              description: 'Boards for repositories',
            },
          },
        ]),
      )

      // Assert
      expect(nextState.repoCards[0]).toBe(kept)
      expect(nextState.repoCards[1]?.description).toBe(
        'Boards for repositories',
      )
      expect(nextState.repoCards[1]?.meta).toEqual({
        stars: 7,
        githubId: 42,
        description: 'Boards for repositories',
      })
    })
  })

  describe('selectStatusLists selector', () => {
    test('should return status lists from state', () => {
      const statuses = [
        createMockStatus({ id: toStatusListId('status-1'), title: 'Todo' }),
        createMockStatus({ id: toStatusListId('status-2'), title: 'Done' }),
      ]
      const state = {
        board: {
          statusLists: statuses,
          repoCards: [],
        },
      }

      const result = selectStatusLists(state)

      expect(result).toHaveLength(2)
      expect(result[0]!.title).toBe('Todo')
    })
  })
})
