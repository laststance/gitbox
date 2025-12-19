/**
 * Board Slice
 *
 * Board state management
 * - Active board
 * - Drag & drop state
 * - Undo/Redo history
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { Board } from '@/lib/supabase/types'

interface DragOperation {
  cardId: string
  fromStatusId: string
  toStatusId: string
  fromOrder: number
  toOrder: number
  timestamp: number
}

// Convert recursive Json type to unknown to avoid Immer type inference issues
type SimplifiedBoard = Omit<Board, 'settings'> & { settings: unknown }

interface BoardState {
  activeBoard: SimplifiedBoard | null
  statusLists: StatusListDomain[]
  repoCards: RepoCardForRedux[]
  loading: boolean
  error: string | null
  // Undo/Redo
  lastDragOperation: DragOperation | null
  undoHistory: DragOperation[]
}

const initialState: BoardState = {
  activeBoard: null,
  statusLists: [],
  repoCards: [],
  loading: false,
  error: null,
  lastDragOperation: null,
  undoHistory: [],
}

export const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    setActiveBoard: (state, action: PayloadAction<SimplifiedBoard | null>) => {
      state.activeBoard = action.payload
    },
    setStatusLists: (state, action: PayloadAction<StatusListDomain[]>) => {
      state.statusLists = action.payload
    },
    setRepoCards: (state, action: PayloadAction<RepoCardForRedux[]>) => {
      state.repoCards = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    // Record drag operation
    recordDragOperation: (state, action: PayloadAction<DragOperation>) => {
      state.lastDragOperation = action.payload
      // Keep maximum 10 history entries
      state.undoHistory = [action.payload, ...state.undoHistory].slice(0, 10)
    },
    // Undo operation
    clearLastDragOperation: (state) => {
      state.lastDragOperation = null
    },
    // Optimistic card update
    updateRepoCardOptimistic: (
      state,
      action: PayloadAction<{
        cardId: string
        updates: Partial<RepoCardForRedux>
      }>,
    ) => {
      const { cardId, updates } = action.payload
      const cardIndex = state.repoCards.findIndex((card) => card.id === cardId)
      if (cardIndex !== -1) {
        state.repoCards[cardIndex] = {
          ...state.repoCards[cardIndex],
          ...updates,
        }
      }
    },
    // Reset board state
    clearBoard: (state) => {
      state.activeBoard = null
      state.statusLists = []
      state.repoCards = []
      state.loading = false
      state.error = null
      state.lastDragOperation = null
      state.undoHistory = []
    },
  },
})

export const {
  setActiveBoard,
  setStatusLists,
  setRepoCards,
  setLoading,
  setError,
  recordDragOperation,
  clearLastDragOperation,
  updateRepoCardOptimistic,
  clearBoard,
} = boardSlice.actions

export default boardSlice.reducer

// Selectors
export const selectActiveBoard = (state: { board: BoardState }) =>
  state.board.activeBoard
export const selectStatusLists = (state: { board: BoardState }) =>
  state.board.statusLists
export const selectRepoCards = (state: { board: BoardState }) =>
  state.board.repoCards
export const selectBoardLoading = (state: { board: BoardState }) =>
  state.board.loading
export const selectBoardError = (state: { board: BoardState }) =>
  state.board.error
export const selectLastDragOperation = (state: { board: BoardState }) =>
  state.board.lastDragOperation
export const selectCanUndo = (state: { board: BoardState }) =>
  state.board.lastDragOperation !== null
