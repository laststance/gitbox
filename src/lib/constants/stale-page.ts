/**
 * What a user reads when this page called a Server Action the current build
 * does not have.
 *
 * The server rejected the call without running it, so nothing was written.
 * Reloading the page loads the build that has the action. Shown by
 * {@link requestBoardCreation} and {@link toMoveFailure}. "Reload page" is
 * the way on from it. This is not {@link BOARD_CREATION_UNCONFIRMED_MESSAGE}
 * or {@link MOVE_UNCONFIRMED_MESSAGE}: those say a write may have happened.
 */
export const PAGE_OUT_OF_DATE_MESSAGE =
  'This page is out of date. Reload the page and try again.'
