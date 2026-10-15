/**
 * Card Move Constants
 *
 * Text about moving a card to another board that the server and the browser
 * both show, so the two never word the same situation differently.
 */

/**
 * What a user reads when it is not known whether a card was moved: the
 * request or its answer was lost on the way, so the card may be on the other
 * board. Returned by {@link moveCardToBoard} together with the error code
 * `MOVE_UNCONFIRMED` when the database gave no answer, and shown by
 * {@link MoveToAnotherBoardDialog} and {@link MoveHereDialog} when the
 * request itself fails or gets no answer in time. The dialog tells this
 * case from a refusal by that code, never by this text: after it the board
 * is fetched again and "Reload page" is offered. The move can be sent again
 * without harm.
 */
export const MOVE_UNCONFIRMED_MESSAGE =
  'Could not confirm that the card was moved. Check the board before trying again.'
