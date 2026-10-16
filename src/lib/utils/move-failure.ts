import { match } from 'ts-pattern'

import type { MoveFailure } from '@/hooks/board/useMoveDialogState'
import type { ActionResult } from '@/lib/actions/types'
import { MOVE_UNCONFIRMED_MESSAGE } from '@/lib/constants/card-move'
import { PAGE_OUT_OF_DATE_MESSAGE } from '@/lib/constants/stale-page'
import { isStalePageAction } from '@/lib/utils/is-stale-page-action'
import type { RequestOutcome } from '@/lib/utils/settle-within'

/** Shown when the server refused a move and sent no sentence of its own. */
const MOVE_FAILED_MESSAGE = 'Failed to move card'

/**
 * Says what a move dialog shows when the move did not go through.
 *
 * Called by {@link MoveToAnotherBoardDialog} and {@link MoveHereDialog}.
 * The board is fetched again after every one of these. When nobody knows
 * the outcome, "Reload page" is offered as well.
 *
 * @param outcome - How the move request ended.
 * @returns
 * - `null` when the server confirmed the move
 * - the server's reason when it refused the move (`isOutcomeKnown: true`)
 * - the server's text with `isOutcomeKnown: false` when its answer carries
 *   the code `MOVE_UNCONFIRMED`: the database gave it no answer, so the card
 *   may have moved all the same. The code decides, never the text.
 * - {@link MOVE_UNCONFIRMED_MESSAGE} with `isOutcomeKnown: false` when the
 *   request failed on the way or got no answer in time
 * - {@link PAGE_OUT_OF_DATE_MESSAGE} with `isPageOutOfDate: true` when the
 *   server rejected the call without running it. The card did not move.
 * @example
 * toMoveFailure({ status: 'overdue' })
 * // => { message: 'Could not confirm that the card was moved. Check the board before trying again.',
 * //      isOutcomeKnown: false }
 */
export function toMoveFailure(
  outcome: RequestOutcome<ActionResult<void>>,
): MoveFailure | null {
  return match(outcome)
    .with({ status: 'answered' }, ({ answer }) =>
      answer.success
        ? null
        : {
            message: answer.error || MOVE_FAILED_MESSAGE,
            isOutcomeKnown: answer.errorCode !== 'MOVE_UNCONFIRMED',
          },
    )
    .with({ status: 'failed' }, (failed) =>
      // The server did not run the action, so the card is where it was
      isStalePageAction(failed.error)
        ? {
            message: PAGE_OUT_OF_DATE_MESSAGE,
            isOutcomeKnown: false,
            isPageOutOfDate: true,
          }
        : {
            message: MOVE_UNCONFIRMED_MESSAGE,
            isOutcomeKnown: false,
          },
    )
    .with({ status: 'overdue' }, () => ({
      message: MOVE_UNCONFIRMED_MESSAGE,
      isOutcomeKnown: false,
    }))
    .exhaustive()
}
