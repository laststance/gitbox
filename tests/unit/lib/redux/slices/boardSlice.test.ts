/**
 * Board Slice Tests
 *
 * T028.4 (Part 2/3): Unit test for boardSlice
 * - ボード状態管理のテスト
 * - ドラッグ&ドロップ操作のテスト
 * - Undo/Redo 履歴のテスト
 */

import { describe, it, expect } from 'vitest'
import boardReducer, {
  setActiveBoard,
  setStatusLists,
  setRepoCards,
  setLoading,
  setError,
  recordDragOperation,
  clearLastDragOperation,
  updateRepoCardOptimistic,
  clearBoard,
  selectActiveBoard,
  selectStatusLists,
  selectRepoCards,
  selectBoardLoading,
  selectBoardError,
  selectLastDragOperation,
  selectCanUndo,
} from '@/lib/redux/slices/boardSlice'
import type { Board, RepoCard, StatusList } from '@/lib/supabase/types'

const mockBoard: Board = {
  id: 'board-123',
  user_id: 'user-123',
  name: 'Test Board',
  theme: 'sunrise',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockStatusList: StatusList = {
  id: 'status-123',
  board_id: 'board-123',
  name: 'In Progress',
  color: '#3b82f6',
  order: 1,
  created_at: '2024-01-01T00:00:00Z',
}

const mockRepoCard: RepoCard = {
  id: 'card-123',
  board_id: 'board-123',
  status_id: 'status-123',
  repo_full_name: 'owner/repo',
  order: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('Board Slice (lib/redux/slices/boardSlice.ts)', () => {
  const initialState = {
    activeBoard: null,
    statusLists: [],
    repoCards: [],
    loading: false,
    error: null,
    lastDragOperation: null,
    undoHistory: [],
  }

  describe('Reducers', () => {
    it('should return initial state', () => {
      expect(boardReducer(undefined, { type: 'unknown' })).toEqual(initialState)
    })

    it('should handle setActiveBoard', () => {
      const state = boardReducer(initialState, setActiveBoard(mockBoard))

      expect(state.activeBoard).toEqual(mockBoard)
    })

    it('should handle setStatusLists', () => {
      const statusLists = [mockStatusList]
      const state = boardReducer(initialState, setStatusLists(statusLists))

      expect(state.statusLists).toEqual(statusLists)
    })

    it('should handle setRepoCards', () => {
      const repoCards = [mockRepoCard]
      const state = boardReducer(initialState, setRepoCards(repoCards))

      expect(state.repoCards).toEqual(repoCards)
    })

    it('should handle setLoading', () => {
      const state = boardReducer(initialState, setLoading(true))

      expect(state.loading).toBe(true)
    })

    it('should handle setError', () => {
      const error = 'Board loading failed'
      const state = boardReducer(initialState, setError(error))

      expect(state.error).toBe(error)
    })

    it('should handle clearBoard', () => {
      const filledState = {
        activeBoard: mockBoard,
        statusLists: [mockStatusList],
        repoCards: [mockRepoCard],
        loading: true,
        error: 'Some error',
        lastDragOperation: {
          cardId: 'card-123',
          fromStatusId: 'status-1',
          toStatusId: 'status-2',
          fromOrder: 0,
          toOrder: 1,
          timestamp: Date.now(),
        },
        undoHistory: [],
      }

      const state = boardReducer(filledState, clearBoard())

      expect(state).toEqual(initialState)
    })
  })

  describe('Drag & Drop Operations', () => {
    it('should handle recordDragOperation', () => {
      const dragOp = {
        cardId: 'card-123',
        fromStatusId: 'status-1',
        toStatusId: 'status-2',
        fromOrder: 0,
        toOrder: 1,
        timestamp: Date.now(),
      }

      const state = boardReducer(initialState, recordDragOperation(dragOp))

      expect(state.lastDragOperation).toEqual(dragOp)
      expect(state.undoHistory).toHaveLength(1)
      expect(state.undoHistory[0]).toEqual(dragOp)
    })

    it('should limit undo history to 10 items', () => {
      let state = initialState

      // Add 15 drag operations
      for (let i = 0; i < 15; i++) {
        const dragOp = {
          cardId: `card-${i}`,
          fromStatusId: 'status-1',
          toStatusId: 'status-2',
          fromOrder: i,
          toOrder: i + 1,
          timestamp: Date.now() + i,
        }

        state = boardReducer(state, recordDragOperation(dragOp))
      }

      expect(state.undoHistory).toHaveLength(10)
      expect(state.undoHistory[0].cardId).toBe('card-14')
      expect(state.undoHistory[9].cardId).toBe('card-5')
    })

    it('should handle clearLastDragOperation', () => {
      const stateWithDrag = {
        ...initialState,
        lastDragOperation: {
          cardId: 'card-123',
          fromStatusId: 'status-1',
          toStatusId: 'status-2',
          fromOrder: 0,
          toOrder: 1,
          timestamp: Date.now(),
        },
      }

      const state = boardReducer(stateWithDrag, clearLastDragOperation())

      expect(state.lastDragOperation).toBeNull()
    })
  })

  describe('Optimistic Updates', () => {
    it('should handle updateRepoCardOptimistic', () => {
      const stateWithCards = {
        ...initialState,
        repoCards: [mockRepoCard],
      }

      const updates = { order: 5, status_id: 'new-status' }
      const state = boardReducer(
        stateWithCards,
        updateRepoCardOptimistic({ cardId: 'card-123', updates })
      )

      expect(state.repoCards[0].order).toBe(5)
      expect(state.repoCards[0].status_id).toBe('new-status')
    })

    it('should not update if card not found', () => {
      const stateWithCards = {
        ...initialState,
        repoCards: [mockRepoCard],
      }

      const updates = { order: 5 }
      const state = boardReducer(
        stateWithCards,
        updateRepoCardOptimistic({ cardId: 'non-existent', updates })
      )

      expect(state.repoCards).toEqual(stateWithCards.repoCards)
    })
  })

  describe('Selectors', () => {
    const mockState = {
      board: {
        activeBoard: mockBoard,
        statusLists: [mockStatusList],
        repoCards: [mockRepoCard],
        loading: false,
        error: null,
        lastDragOperation: {
          cardId: 'card-123',
          fromStatusId: 'status-1',
          toStatusId: 'status-2',
          fromOrder: 0,
          toOrder: 1,
          timestamp: Date.now(),
        },
        undoHistory: [],
      },
    }

    it('selectActiveBoard should return active board', () => {
      expect(selectActiveBoard(mockState)).toEqual(mockBoard)
    })

    it('selectStatusLists should return status lists', () => {
      expect(selectStatusLists(mockState)).toEqual([mockStatusList])
    })

    it('selectRepoCards should return repo cards', () => {
      expect(selectRepoCards(mockState)).toEqual([mockRepoCard])
    })

    it('selectBoardLoading should return loading state', () => {
      expect(selectBoardLoading(mockState)).toBe(false)
    })

    it('selectBoardError should return error', () => {
      expect(selectBoardError(mockState)).toBeNull()
    })

    it('selectLastDragOperation should return last drag operation', () => {
      expect(selectLastDragOperation(mockState)).toEqual(
        mockState.board.lastDragOperation
      )
    })

    it('selectCanUndo should return true when last drag operation exists', () => {
      expect(selectCanUndo(mockState)).toBe(true)
    })

    it('selectCanUndo should return false when no drag operation', () => {
      const stateWithoutDrag = {
        board: { ...mockState.board, lastDragOperation: null },
      }

      expect(selectCanUndo(stateWithoutDrag)).toBe(false)
    })
  })
})
