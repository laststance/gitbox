/**
 * Persisted Slices
 *
 * Which parts of the Redux state the browser keeps between visits, and how
 * they are read back.
 */

/**
 * The slices kept in localStorage: what the user chose (`settings`) and what
 * the user typed and did not save yet (`draft`).
 *
 * The board (`board`: its columns and cards) is not one of them. The server
 * sends it with every page and {@link useBoardServerSync} puts it into the
 * store before the first paint, so a stored copy was never shown. It did
 * harm, though: the store held it when React hydrated a board page, the
 * server had rendered that page without columns, and React threw the server's
 * markup away (error #418) on every visit after the first.
 */
export const PERSISTED_SLICE_NAMES = ['settings', 'draft'] as const

type PersistedSliceName = (typeof PERSISTED_SLICE_NAMES)[number]

/**
 * Puts what localStorage holds back into the Redux state, slice by slice,
 * and takes nothing but {@link PERSISTED_SLICE_NAMES}. Exists because the
 * storage middleware copies every key it finds by default, and a browser
 * that used the app before 2026-10-12 still holds a `board` slice. Called by
 * the storage middleware of `src/lib/redux/store.ts` once per page load.
 *
 * @param persistedState - The state read from localStorage. It may hold
 * slices that are not persisted any more, and may lack ones that are.
 * @param currentState - The state of the store at that moment.
 * @returns The current state with the stored `settings` and `draft` in place
 * of its own; every other slice as it was in `currentState`.
 * @example
 * mergePersistedSlices(
 *   { settings: { theme: 'rust' }, board: { repoCards: [staleCard] } },
 *   { settings: { theme: 'system' }, board: { repoCards: [] }, draft: {} },
 * )
 * // => { settings: { theme: 'rust' }, board: { repoCards: [] }, draft: {} }
 */
export function mergePersistedSlices<
  State extends Record<PersistedSliceName, unknown>,
>(persistedState: Partial<State>, currentState: State): State {
  const mergedState = { ...currentState }
  // Only the listed slices: any other key of the stored state stays behind
  for (const sliceName of PERSISTED_SLICE_NAMES) {
    const persistedSlice = persistedState[sliceName]
    if (persistedSlice !== undefined) {
      mergedState[sliceName] = persistedSlice
    }
  }
  return mergedState
}
