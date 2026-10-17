/**
 * Drops what this account left in the browser when the account leaves.
 *
 * The unsaved notes and the last move destination live in one localStorage
 * entry for every account that uses the browser. Sign-out used to redirect
 * without touching it, so the next account's browser still held the previous
 * account's note text. Called by the Sign Out buttons and the Delete Account
 * confirmation, before those server actions redirect. The theme and the other
 * display settings stay.
 */

import type { Dispatch } from '@reduxjs/toolkit'

import { PERSISTED_STATE_SAVE_DELAY_MS } from '@/lib/redux/persisted-slices'
import { clearDraftNotes } from '@/lib/redux/slices/draftSlice'
import { clearMoveDestinations } from '@/lib/redux/slices/settingsSlice'

/** A store that holds the persisted slices. The app passes its own store. */
interface AccountStore {
  dispatch: Dispatch
}

/**
 * Empties the unsaved notes and the remembered move destinations, then waits
 * until the storage middleware has written them.
 *
 * The middleware writes {@link PERSISTED_STATE_SAVE_DELAY_MS} after the last
 * dispatch. Called with the app store from each place that signs out or
 * deletes the account, and awaited before the redirect.
 *
 * @param store - The store whose slices are persisted.
 */
export async function forgetAccountOnThisBrowser(
  store: AccountStore,
): Promise<void> {
  store.dispatch(clearDraftNotes())
  store.dispatch(clearMoveDestinations())
  await new Promise<void>((resolve) => {
    setTimeout(resolve, PERSISTED_STATE_SAVE_DELAY_MS)
  })
}
