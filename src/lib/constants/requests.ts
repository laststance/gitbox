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
 * What the limit cannot do: Next.js sends Server Actions and
 * `router.refresh()` one after another (one queue in the router; only a
 * navigation goes ahead of it). The clock starts when the action is called,
 * which can be before it is sent, and the fetch that follows an overdue write
 * goes out when that write has settled, by an answer or by the browser giving
 * up. Until then the screen can show a change nobody confirmed, which is why
 * the notices of an overdue write offer {@link reloadPage}.
 */
export const SERVER_ANSWER_TIME_LIMIT_MS = 15_000
