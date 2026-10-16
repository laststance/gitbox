/**
 * Board Slice
 *
 * Holds the currently-viewed board's hydrated contents (status columns,
 * cards). The slice is not persisted: the server sends the board with every
 * page and {@link useBoardServerSync} puts it into the store. A stored copy
 * broke the hydration of every board page (see {@link PERSISTED_SLICE_NAMES}).
 */

import type { PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

import type {
  StatusListDomain,
  RepoCardForRedux,
  RepoCardMeta,
} from '@/lib/models/domain'
import type { RepoCardId, StatusListId } from '@/lib/types/brands'

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
    /**
     * Replace the GitHub snapshot of the cards a refresh just wrote.
     *
     * Dispatched by {@link BoardPageClient} after
     * {@link refreshCardMetadata} or {@link refreshBoardMetadata}. Cards the
     * refresh did not write stay as they are. `description` is the line the
     * card shows; it is copied from the new snapshot.
     *
     * @param action.payload - The cards whose snapshot was rewritten.
     */
    applyRefreshedRepoCards: (
      state,
      action: PayloadAction<
        Array<{ id: string; description: string; meta: RepoCardMeta }>
      >,
    ) => {
      const byId = new Map(action.payload.map((card) => [card.id, card]))
      state.repoCards = state.repoCards.map((card) => {
        const refreshed = byId.get(card.id)
        if (!refreshed) return card
        return {
          ...card,
          description: refreshed.description,
          meta: refreshed.meta,
        }
      })
    },
    /**
     * Remove a deleted column and the cards it held. The database deletes
     * those cards with the column; while they stayed in the store, the Add
     * Repositories picker hid their repositories as on this board until a
     * reload, so a repository could not be added again (issue #216).
     *
     * Dispatched by {@link useStatusListDialog} once the server deleted the
     * column.
     *
     * @param action.payload - The {@link StatusListId} of the deleted column.
     */
    removeStatusListWithCards: (state, action: PayloadAction<StatusListId>) => {
      state.statusLists = state.statusLists.filter(
        (statusList) => statusList.id !== action.payload,
      )
      state.repoCards = state.repoCards.filter(
        (card) => card.statusId !== action.payload,
      )
    },
  },
})

export const {
  setStatusLists,
  setRepoCards,
  addRepoCards,
  removeRepoCard,
  applyRefreshedRepoCards,
  removeStatusListWithCards,
} = boardSlice.actions

export default boardSlice.reducer

// Selectors
export const selectStatusLists = (state: { board: BoardState }) =>
  state.board.statusLists
export const selectRepoCards = (state: { board: BoardState }) =>
  state.board.repoCards
