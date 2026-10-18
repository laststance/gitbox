import { toast } from 'sonner'

import { boardRefreshRequested } from '@/lib/redux/slices/boardSyncSlice'
import type { AppDispatch } from '@/lib/redux/store'

/**
 * What a failed-save rollback did to the board on screen:
 * - `'restored'`: the layout from before the failed change is back
 * - `'reload-requested'`: the board had changed in the meantime, so nothing was
 *   put back and a fresh copy of the board was requested from the server
 */
export type BoardRollbackOutcome = 'restored' | 'reload-requested'

/** Sonner id shared by the "save failed" toasts, so a burst of failures shows one toast. */
const BOARD_SAVE_FAILED_TOAST_ID = 'board-save-failed'

/** Second line of a "save failed" toast, by what happened on screen. */
const FAILED_SAVE_DESCRIPTIONS = {
  offline: "You're offline. Try again when the connection is back.",
  reloading: 'Reloading the board to show what was saved.',
  retry: 'Please try again.',
} as const

type FailedSaveDescription =
  (typeof FAILED_SAVE_DESCRIPTIONS)[keyof typeof FAILED_SAVE_DESCRIPTIONS]

/**
 * Tells the user that a change on the board was not saved, in words that
 * match what the screen did. Exists because "Please try again" is wrong when
 * the browser is offline or when the board is reloading instead of going
 * back. Called by {@link useKanbanDnD}, {@link useKanbanUndo} and
 * {@link useOptimisticCardAction} after their rollback.
 *
 * @param title - First line of the toast, e.g. `'Failed to move card'`.
 * @param outcome - What the rollback did (returned by {@link rollbackRepoCards} or {@link rollbackStatusLists}).
 * @param toastId - Sonner id to show the toast under. Pass the id of an earlier
 *   toast to replace it; defaults to one id shared by all failed saves.
 * @param description - Second line to use instead of the one {@link toFailedSaveDescription}
 *   picks. The grid-position refusal passes its sentence; other failures leave
 *   this out.
 * @example
 * notifyFailedBoardSave('Failed to move card', dispatch(rollbackRepoCards(cardsAfterDrag, cardsBeforeDrag)))
 * // online, layout put back => toast "Failed to move card / Please try again."
 */
export const notifyFailedBoardSave = (
  title: string,
  outcome: BoardRollbackOutcome,
  toastId: string = BOARD_SAVE_FAILED_TOAST_ID,
  description?: string,
): void => {
  toast.error(title, {
    id: toastId,
    description:
      description ?? toFailedSaveDescription(outcome, navigator.onLine),
  })
}

/**
 * Picks the second line of a "save failed" toast. Used by
 * {@link notifyFailedBoardSave}.
 *
 * @param outcome - What the rollback did to the board on screen.
 * @param isOnline - Whether the browser had a connection when the save failed.
 * @returns
 * - Offline: wait for the connection (retrying now cannot work)
 * - `'reload-requested'`: the board is reloading, nothing went back
 * - `'restored'`: the old layout is back, so try again
 * @example
 * toFailedSaveDescription('restored', true)         // => 'Please try again.'
 * toFailedSaveDescription('reload-requested', true) // => 'Reloading the board to show what was saved.'
 * toFailedSaveDescription('restored', false)        // => "You're offline. Try again when the connection is back."
 */
/**
 * Reports a board save that threw, after the caller rolled the screen back.
 *
 * A throw has no answer, so the database may already hold the change. The
 * previous layout goes back when it still can, and a fresh copy is asked for
 * either way. Offline, the one notice is the offline one: a second toast
 * would say the same thing. Called from the catch of a drag, an undo and
 * Remove from Board.
 *
 * @param dispatch - Store dispatch. A restored layout still needs a fetch.
 * @param title - First line of the toast when the browser is online.
 * @param outcome - What the rollback did before this was called.
 * @param toastId - Sonner id. Undo replaces its success toast with this.
 * @example
 * reportThrownBoardSave(dispatch, 'Failed to move card', dispatch(rollbackRepoCards(after, before)))
 */
export const reportThrownBoardSave = (
  dispatch: AppDispatch,
  title: string,
  outcome: BoardRollbackOutcome,
  toastId?: string,
): void => {
  // The snapshot was put back. The database may disagree, so read it again.
  if (outcome === 'restored') {
    dispatch(boardRefreshRequested())
  }
  // The offline notice is already the sentence for this. A second toast stacks.
  if (navigator.onLine === false) return
  notifyFailedBoardSave(title, 'reload-requested', toastId)
}

const toFailedSaveDescription = (
  outcome: BoardRollbackOutcome,
  isOnline: boolean,
): FailedSaveDescription => {
  if (!isOnline) return FAILED_SAVE_DESCRIPTIONS.offline
  if (outcome === 'reload-requested') return FAILED_SAVE_DESCRIPTIONS.reloading
  return FAILED_SAVE_DESCRIPTIONS.retry
}
