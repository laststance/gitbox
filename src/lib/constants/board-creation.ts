/**
 * Board Creation Constants
 *
 * Text about creating a board that the server and the browser both show, so
 * the two never word the same situation differently.
 */

/**
 * What a user reads when it is not known whether a board was created: the
 * request or its answer was lost on the way, so the board may exist. The text
 * sends the user to look before a second try would make a second board.
 * Returned by {@link createBoard} together with the error code
 * `BOARD_CREATION_UNCONFIRMED`, and used by {@link requestBoardCreation} when
 * the request itself fails or gets no answer in time. The browser tells this
 * case from a refusal by that code, never by this text: after it the move
 * dialog and {@link CreateBoardForm} lead the user to their boards, not to a
 * second try.
 */
export const BOARD_CREATION_UNCONFIRMED_MESSAGE =
  'Could not confirm that the board was created. Check your boards before trying again.'
