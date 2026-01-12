/**
 * Board Slice
 *
 * Board state management
 * - Active board
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { Board } from '@/lib/supabase/types'

// Convert recursive Json type to unknown to avoid Immer type inference issues
type SimplifiedBoard = Omit<Board, 'settings'> & { settings: unknown }

interface BoardState {
  activeBoard: SimplifiedBoard | null
  statusLists: StatusListDomain[]
  repoCards: RepoCardForRedux[]
  loading: boolean
  error: string | null
}

const initialState: BoardState = {
  activeBoard: null,
  statusLists: [],
  repoCards: [],
  loading: false,
  error: null,
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
    /**
     * Add new repo cards to the state (for optimistic updates)
     * Unlike setRepoCards which replaces all cards, this appends new cards
     */
    addRepoCards: (state, action: PayloadAction<RepoCardForRedux[]>) => {
      state.repoCards = [...state.repoCards, ...action.payload]
    },
    /**
     * Remove a repo card from the state (for optimistic updates)
     * @param cardId - The ID of the card to remove
     */
    removeRepoCard: (state, action: PayloadAction<string>) => {
      state.repoCards = state.repoCards.filter(
        (card) => card.id !== action.payload,
      )
    },
    /**
     * Set loading state
     */
    setBoardLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    /**
     * Set error state (null to clear)
     */
    setBoardError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
  },
})

export const {
  setActiveBoard,
  setStatusLists,
  setRepoCards,
  addRepoCards,
  removeRepoCard,
  setBoardLoading,
  setBoardError,
} = boardSlice.actions

export default boardSlice.reducer

// Selectors
export const selectStatusLists = (state: { board: BoardState }) =>
  state.board.statusLists
export const selectRepoCards = (state: { board: BoardState }) =>
  state.board.repoCards
export const selectBoardLoading = (state: { board: BoardState }) =>
  state.board.loading
export const selectBoardError = (state: { board: BoardState }) =>
  state.board.error
