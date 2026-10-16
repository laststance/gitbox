/**
 * Standardized Server Action Result Types
 *
 * Provides a discriminated union type for Server Action return values,
 * replacing the mix of throw-based and ad-hoc result patterns.
 *
 * Pattern:
 * - Client-consumed Server Actions → return ActionResult<T>
 * - Internal helpers / server-component-only functions → may still throw
 *
 * @see https://github.com/laststance/gitbox/issues/68
 *
 * @example
 * // Server Action
 * export async function createItem(name: string): Promise<ActionResult<Item>> {
 *   try {
 *     const item = await db.items.create({ name })
 *     return { success: true, data: item }
 *   } catch (error) {
 *     return { success: false, error: 'Failed to create item' }
 *   }
 * }
 *
 * // Client caller
 * const result = await createItem('foo')
 * if (result.success) {
 *   console.log(result.data) // Item (narrowed)
 * } else {
 *   toast.error(result.error) // string (narrowed)
 * }
 */

/**
 * Machine-readable error codes for Server Action failures.
 *
 * Use sparingly — only add a code when the client needs to branch on it
 * (e.g., trigger silent re-auth on `GITHUB_TOKEN_MISSING`). The human-readable
 * `error` field remains the source of UI copy.
 *
 * - `GITHUB_TOKEN_MISSING`: the GitHub token cookie is gone; the client signs
 *   in again without asking
 * - `BOARD_CREATION_UNCONFIRMED`: {@link createBoard} got no answer it could
 *   read, so the board may exist; the client offers the boards and not a
 *   second try, which could make a second board
 * - `MOVE_UNCONFIRMED`: {@link moveCardToBoard} got no answer from the
 *   database, so the card may be on the other board; the client says so,
 *   fetches the board again and offers "Reload page"
 * - `CARD_NOT_FOUND`: the card the browser sent is gone or not the user's.
 *   The Note dialog keeps the typed text under the repository, and says to
 *   add the repository again instead of opening the same card
 *
 * @example
 * if (!result.success && result.errorCode === 'GITHUB_TOKEN_MISSING') {
 *   handleGitHubTokenMissing(window.location.pathname)
 * }
 */
export type ActionErrorCode =
  | 'GITHUB_TOKEN_MISSING'
  | 'BOARD_CREATION_UNCONFIRMED'
  | 'MOVE_UNCONFIRMED'
  | 'CARD_NOT_FOUND'

/**
 * Discriminated union for Server Action results.
 *
 * @param T - The data type on success
 * @returns Either `{ success: true, data: T }` or `{ success: false, error: string, errorCode?: ActionErrorCode }`
 *
 * @example
 * type Result = ActionResult<User[]>
 * // => { success: true; data: User[] } | { success: false; error: string; errorCode?: ActionErrorCode }
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode?: ActionErrorCode }

/**
 * An expected, user-facing Server Action failure whose message is safe to show.
 *
 * The auth guards ({@link withAuthResult}, {@link withAuthResultRateLimit}) replace
 * every other thrown message with a generic one and report it to Sentry. Throw this
 * instead when the user did something the app must explain (e.g. the repository is
 * already on another board): the guards return its message verbatim and skip Sentry.
 *
 * Never put internal details (table names, DB error strings, ids) in the message.
 *
 * @param message - What the user reads.
 * @param errorCode - Set when the client has to tell this failure from the
 *   others; the guards hand it on as `errorCode` of the result.
 *
 * @example
 * throw new ActionUserError('laststance/gitbox is already on board "Work"')
 * // caller receives => { success: false, error: 'laststance/gitbox is already on board "Work"' }
 * throw new ActionUserError(BOARD_CREATION_UNCONFIRMED_MESSAGE, 'BOARD_CREATION_UNCONFIRMED')
 * // caller receives => { success: false, error: 'Could not confirm ...', errorCode: 'BOARD_CREATION_UNCONFIRMED' }
 */
export class ActionUserError extends Error {
  /** Code the client branches on, when the failure has one. */
  readonly errorCode?: ActionErrorCode

  constructor(message: string, errorCode?: ActionErrorCode) {
    super(message)
    this.name = 'ActionUserError'
    if (errorCode) this.errorCode = errorCode
  }
}

/**
 * A board with the id, name and color of each of its columns, in column
 * order: everything a picker needs to offer the board and one of its columns.
 *
 * {@link getUserBoardsWithStatusLists} lists the user's boards in this shape
 * and {@link createBoard} returns the board it made in it, so
 * {@link MoveToAnotherBoardDialog} can offer a board created inside the dialog
 * without loading the list again.
 *
 * @example
 * const option: BoardOption = {
 *   id: 'board-uuid-456',
 *   name: 'Work',
 *   statusLists: [{ id: 'status-uuid-1', name: 'Repositories', color: '#6B7280' }],
 * }
 */
export interface BoardOption {
  id: string
  name: string
  statusLists: Array<{
    id: string
    name: string
    color: string
  }>
}
