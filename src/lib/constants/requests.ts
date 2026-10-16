/**
 * Request Constants
 */

/**
 * How long the app waits for the server's answer to a write, in milliseconds.
 * After that the outcome counts as unknown: {@link MoveToAnotherBoardDialog}
 * unlocks itself and says so, and {@link trackBoardWrite} stops holding back
 * fetches of the board. An answer normally takes well under a second.
 *
 * Both use this one value on purpose. The dialog asks for a fresh copy of the
 * board when it stops waiting, and that fetch goes out only once the move is
 * no longer counted as a pending write.
 *
 * What the limit cannot do: the clock starts when the action is called, which
 * can be before it is sent. The fetch at the limit is `GET /api/boards/[id]`,
 * so it does not wait behind that write. A later answer asks for one more
 * fetch, and that one is a Server Action, which runs after the write. The
 * screen can show a change nobody confirmed until one of those arrives, which
 * is why the notices of an overdue write offer {@link reloadPage}.
 */
export const SERVER_ANSWER_TIME_LIMIT_MS = 15_000
