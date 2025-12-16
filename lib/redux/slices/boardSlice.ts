/**
 * Board Slice
 *
 * ボード状態の管理
 * - アクティブボード
 * - ドラッグ&ドロップ状態
 * - Undo/Redo 履歴
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Board } from '@/lib/supabase/types'
import type {
  StatusListDomain,
  RepoCardDomain,
  RepoCardForRedux,
} from '@/lib/models/domain'

interface DragOperation {
  cardId: string
  fromStatusId: string
  toStatusId: string
  fromOrder: number
  toOrder: number
  timestamp: number
}

// Immer の型推論問題を回避するため、再帰的な Json 型を unknown に変換
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
    // ドラッグ操作の記録
    recordDragOperation: (state, action: PayloadAction<DragOperation>) => {
      state.lastDragOperation = action.payload
      // 最大 10件まで履歴を保持
      state.undoHistory = [action.payload, ...state.undoHistory].slice(0, 10)
    },
    // Undo 操作
    clearLastDragOperation: state => {
      state.lastDragOperation = null
    },
    // カードの楽観的更新
    updateRepoCardOptimistic: (
      state,
      action: PayloadAction<{ cardId: string; updates: Partial<RepoCardForRedux> }>
    ) => {
      const { cardId, updates } = action.payload
      const cardIndex = state.repoCards.findIndex(card => card.id === cardId)
      if (cardIndex !== -1) {
        state.repoCards[cardIndex] = {
          ...state.repoCards[cardIndex],
          ...updates,
        }
      }
    },
    // ボード状態のリセット
    clearBoard: state => {
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
