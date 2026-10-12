/**
 * Board Slice
 *
 * Holds the currently-viewed board's hydrated contents (status columns,
 * cards). The slice is persisted to LocalStorage via
 * `redux-storage-middleware` so reloads don't blank the UI while we re-fetch.
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { RepoCardId } from '@/lib/types/brands'

/**
 * Shape of the `state.board` Redux slice. Which board the columns and cards
 * belong to is kept by {@link boardSyncSlice} (`hydratedBoardId`); the board
 * row itself reaches the page as a prop and is not stored.
 */
interface BoardState {
  /** Status columns of the board on screen, ordered by grid position. */
  statusLists: StatusListDomain[]
  /** Repo cards of the board on screen (meta widened for Immer). */
  repoCards: RepoCardForRedux[]
}

const initialState: BoardState = {
  statusLists: [],
  repoCards: [],
}

export const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
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
     * Remove a repo card from the state (for optimistic updates).
     *
     * @param action.payload - The {@link RepoCardId} to remove.
     */
    removeRepoCard: (state, action: PayloadAction<RepoCardId>) => {
      state.repoCards = state.repoCards.filter(
        (card) => card.id !== action.payload,
      )
    },
  },
})

export const { setStatusLists, setRepoCards, addRepoCards, removeRepoCard } =
  boardSlice.actions

export default boardSlice.reducer

// Selectors
export const selectStatusLists = (state: { board: BoardState }) =>
  state.board.statusLists
export const selectRepoCards = (state: { board: BoardState }) =>
  state.board.repoCards
