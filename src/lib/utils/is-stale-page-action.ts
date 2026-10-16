import { unstable_isUnrecognizedActionError } from 'next/navigation'

/**
 * Whether a Server Action call was rejected because this page's build no
 * longer has that action.
 *
 * The server did not run it, so nothing was written. Next.js marks the check
 * unstable, so the name may change. Called by {@link requestBoardCreation}
 * and {@link toMoveFailure} so a tab of the build before a deployment is not
 * told that a board or a card may have been written.
 *
 * @param error - What the action's promise rejected with.
 * @returns `true` when Next.js reports the action id was not found.
 * @example
 * isStalePageAction(error) // => true for a tab left open across a deploy
 */
export function isStalePageAction(error: unknown): boolean {
  return unstable_isUnrecognizedActionError(error)
}
