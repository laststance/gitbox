import type { BoardId } from '@/lib/types/brands'

/**
 * The columns and cards one render of the board shows.
 *
 * The Redux store is empty while the server renders the page, and on the
 * first client render as well: the board is not kept in localStorage. Called
 * by {@link KanbanBoard}. Until {@link serverSnapshotApplied} records this
 * board, the columns and cards of the page are shown, so the server's HTML
 * is the board. Once the store holds this board, the store wins, because a
 * drag, an undo and a refetch live there.
 *
 * @param boardId - Board this page is showing.
 * @param hydratedBoardId - Board the store holds, or `null` before any.
 * @param storeColumns - Columns in the store.
 * @param storeCards - Cards in the store.
 * @param pageColumns - Columns the page was given. Absent when the caller
 *   only has the store, as the component tests do.
 * @param pageCards - Cards the page was given.
 * @returns The columns and cards to render.
 * @example
 * boardContentForRender({
 *   boardId,
 *   hydratedBoardId: null,
 *   storeColumns: [],
 *   storeCards: [],
 *   pageColumns: initialStatusLists,
 *   pageCards: initialRepoCards,
 * })
 */
export function boardContentForRender<Columns, Cards>(input: {
  boardId: string
  hydratedBoardId: string | null
  storeColumns: Columns
  storeCards: Cards
  pageColumns: Columns | undefined
  pageCards: Cards | undefined
}): { columns: Columns; cards: Cards } {
  const storeHoldsThisBoard =
    input.hydratedBoardId !== null && input.hydratedBoardId === input.boardId
  // A caller that never received the page data keeps reading the store
  if (
    storeHoldsThisBoard ||
    input.pageColumns === undefined ||
    input.pageCards === undefined
  ) {
    return { columns: input.storeColumns, cards: input.storeCards }
  }
  return { columns: input.pageColumns, cards: input.pageCards }
}

/**
 * Board the store holds, or `null` when this state has no sync slice.
 *
 * The component tests build a store with only the board slice. Called by
 * {@link KanbanBoard}; production state always has the slice, and
 * {@link selectHydratedBoardId} is the one those callers use.
 *
 * @param state - Root state, or a test store that left the slice out.
 * @returns The hydrated board id, or `null`.
 * @example
 * useAppSelector(selectHydratedBoardIdIfPresent)
 */
export function selectHydratedBoardIdIfPresent(state: {
  boardSync?: { hydratedBoardId: BoardId | null }
}): BoardId | null {
  return state.boardSync?.hydratedBoardId ?? null
}
