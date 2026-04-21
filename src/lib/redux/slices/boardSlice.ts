/**
 * Board Slice
 *
 * Holds the currently-viewed board's hydrated contents (status columns,
 * cards) plus a bookmark to the last-visited board for quick resume. The
 * slice is persisted to LocalStorage via `redux-storage-middleware` so
 * reloads don't blank the UI while we re-fetch.
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { Board } from '@/lib/supabase/types'
import type { BoardId, RepoCardId } from '@/lib/types/brands'

/**
 * {@link Board} with `settings` widened to `unknown`.
 *
 * The raw Supabase row type expands `settings` into a recursive `Json`
 * type, which trips Immer's draft-type inference. Widening to `unknown`
 * keeps the runtime shape identical while letting Immer produce a usable
 * draft type. Components parse the real shape via `parseBoardSettings`.
 */
type SimplifiedBoard = Omit<Board, 'settings'> & { settings: unknown }

/** Lightweight bookmark for "resume where you left off" navigation. */
interface LastVisitedBoard {
  id: BoardId
  name: string
}

/** Shape of the `state.board` Redux slice. */
interface BoardState {
  /** Currently-viewed board, or `null` before any board is opened. */
  activeBoard: SimplifiedBoard | null
  /** Status columns for the active board, ordered by grid position. */
  statusLists: StatusListDomain[]
  /** Repo cards for the active board (meta widened for Immer). */
  repoCards: RepoCardForRedux[]
  /** Bookmark to the most recently opened board. */
  lastVisitedBoard: LastVisitedBoard | null
}

const initialState: BoardState = {
  activeBoard: null,
  statusLists: [],
  repoCards: [],
  lastVisitedBoard: null,
}

export const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    setActiveBoard: (state, action: PayloadAction<SimplifiedBoard | null>) => {
      state.activeBoard = action.payload
      if (action.payload) {
        state.lastVisitedBoard = {
          id: action.payload.id as BoardId,
          name: action.payload.name,
        }
      }
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

export const {
  setActiveBoard,
  setStatusLists,
  setRepoCards,
  addRepoCards,
  removeRepoCard,
} = boardSlice.actions

export default boardSlice.reducer

// Selectors
export const selectStatusLists = (state: { board: BoardState }) =>
  state.board.statusLists
export const selectRepoCards = (state: { board: BoardState }) =>
  state.board.repoCards
export const selectLastVisitedBoard = (state: { board: BoardState }) =>
  state.board.lastVisitedBoard
