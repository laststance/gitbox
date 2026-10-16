import * as Sentry from '@sentry/nextjs'
import { toast } from 'sonner'

import { TOAST_WITH_ACTION_DURATION_MS } from '@/lib/constants/toast'

import { reloadPage } from './reload-page'

/** Sonner id shared by these toasts, so a burst of saves without an answer shows one. */
const BOARD_SAVE_UNCONFIRMED_TOAST_ID = 'board-save-unconfirmed'

/**
 * Tells the user that a change on the board got no answer from the server in
 * time, and leaves a trace of it in Sentry. Exists because the change stays
 * on screen while nobody knows whether it was saved: the board is fetched
 * again, and a card that jumps back when that copy arrives needs a reason.
 * Passed to {@link trackBoardWrite} as `onOverdue` by {@link useKanbanDnD},
 * {@link useKanbanUndo} and {@link useOptimisticCardAction}.
 *
 * The text holds whether the browser is online or not: offline the fetch
 * waits for the connection, and {@link useBoardServerSync} says so itself.
 * Online the fetch goes out at once, through `GET /api/boards/[id]`, because
 * a Server Action would wait behind the save that has no answer. The copy it
 * reads can still be the one from before that save landed. The toast offers
 * "Reload page", which waits for nothing.
 *
 * @param action - Name of the save, as the failure reports of the caller tag it.
 * @example
 * await trackBoardWrite(dispatch, updateRepoCardPosition(cardId, statusId, order), () =>
 *   reportUnconfirmedBoardSave('syncCardPosition'),
 * )
 * // 15 seconds without an answer => toast "Could not confirm that the change
 * // was saved / The board reloads when the server answers. Reload the page
 * // to see what was saved now." with the action "Reload page"
 */
export const reportUnconfirmedBoardSave = (action: string): void => {
  Sentry.captureMessage('A board save got no answer in time', {
    level: 'warning',
    tags: { action },
  })
  toast.warning('Could not confirm that the change was saved', {
    id: BOARD_SAVE_UNCONFIRMED_TOAST_ID,
    description:
      'The board reloads when the server answers. Reload the page to see what was saved now.',
    duration: TOAST_WITH_ACTION_DURATION_MS,
    action: { label: 'Reload page', onClick: reloadPage },
  })
}
