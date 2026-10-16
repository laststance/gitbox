/**
 * The sentence of a server action that answered with a failure.
 *
 * The column drag and the column undo used to learn of a failure only when
 * the action threw. The position writes now return their refusal, because a
 * thrown message does not reach the browser in production. A test double that
 * resolves to nothing is still a success: those hooks must not roll the board
 * back for it.
 *
 * @param result - Whatever the action or its test double resolved to.
 * @returns The `error` of `{ success: false, error }`, otherwise null.
 * @example
 * failedActionMessage({ success: false, error: 'A column cannot sit past row 999 or column 999.' })
 * // => 'A column cannot sit past row 999 or column 999.'
 * failedActionMessage(undefined) // => null
 */
export function failedActionMessage(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null
  if (!('success' in result) || result.success !== false) return null
  if (!('error' in result) || typeof result.error !== 'string') return null
  return result.error
}
