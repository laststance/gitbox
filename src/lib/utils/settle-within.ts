/**
 * Settle Within
 *
 * Waits for a request for a limited time. A screen that locks itself while it
 * waits for the server needs an end to that wait, or a request that never
 * settles keeps it locked.
 */

/**
 * How a request ended, or that it did not end in time.
 * - `answered`: the request resolved; `answer` is what it resolved with
 * - `failed`: the request rejected; `error` is what it rejected with
 * - `overdue`: no answer came within the time limit. The request is still
 *   running and may yet succeed.
 */
export type RequestOutcome<Answer> =
  | { status: 'answered'; answer: Answer }
  | { status: 'failed'; error: unknown }
  | { status: 'overdue' }

/**
 * Waits for a request for a limited time and reports how it ended. Never
 * rejects, so the caller handles all three endings in one place. Called by
 * {@link MoveToAnotherBoardDialog} for the move and for the board creation,
 * which keep the dialog from closing while they wait.
 *
 * An overdue request is not cancelled: nothing can take back a Server Action
 * that was sent. Its late answer is ignored here.
 *
 * @param request - The pending request.
 * @param timeLimitMs - How long to wait for its answer, in milliseconds.
 * @returns The {@link RequestOutcome}.
 * @example
 * await settleWithin(moveCardToBoard(cardId, boardId, statusId), 15_000)
 * // => { status: 'answered', answer: { success: true, data: undefined } }
 * // => { status: 'failed', error: TypeError('Failed to fetch') } when the request rejects
 * // => { status: 'overdue' } when 15 seconds pass without an answer
 */
export async function settleWithin<Answer>(
  request: Promise<Answer>,
  timeLimitMs: number,
): Promise<RequestOutcome<Answer>> {
  return new Promise((resolve) => {
    const timeLimit = setTimeout(
      () => resolve({ status: 'overdue' }),
      timeLimitMs,
    )

    // After the time limit both handlers still run; resolving a second time
    // does nothing, and the rejection stays handled.
    request.then(
      (answer) => {
        clearTimeout(timeLimit)
        resolve({ status: 'answered', answer })
      },
      (error: unknown) => {
        clearTimeout(timeLimit)
        resolve({ status: 'failed', error })
      },
    )
  })
}
