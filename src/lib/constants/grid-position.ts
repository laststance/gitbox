/**
 * Upper bound of a column's place on the board.
 *
 * `statuslist.grid_row` and `statuslist.grid_col` are integers, and the board
 * page builds one drop zone per cell out to the furthest column. A column at
 * the far end of that range hangs the page. The table check
 * `statuslist_grid_position_bounds` uses the same bound, so a write that does
 * not go through these constants is refused too.
 */

/** Furthest row or column a column may occupy. */
export const GRID_POSITION_MAX = 999

/** Name of the CHECK on `statuslist`. The migration uses this spelling. */
export const GRID_POSITION_CONSTRAINT = 'statuslist_grid_position_bounds'

/**
 * What a position write tells the user when a column would sit past
 * {@link GRID_POSITION_MAX}.
 */
export const GRID_POSITION_REFUSED = `A column cannot sit past row ${GRID_POSITION_MAX} or column ${GRID_POSITION_MAX}.`

/** What a position write tells the user when the row is negative. */
export const GRID_ROW_NON_NEGATIVE = 'Grid row must be non-negative'

/** What a position write tells the user when the column is negative. */
export const GRID_COLUMN_NON_NEGATIVE = 'Grid column must be non-negative'

const GRID_POSITION_REFUSAL_MESSAGES = new Set<string>([
  GRID_POSITION_REFUSED,
  GRID_ROW_NON_NEGATIVE,
  GRID_COLUMN_NON_NEGATIVE,
])

/**
 * The sentence to show for a position the table would refuse, or null when
 * the failure is something else and the generic save toast already says what
 * to do.
 *
 * Called by the column drag, the column undo and the new-column dialog after
 * a position write answers with a failure.
 *
 * @param message - The `error` of that answer.
 * @returns The message when it is one this module writes, otherwise null.
 * @example
 * gridPositionRefusalSentence('A column cannot sit past row 999 or column 999.')
 * // => 'A column cannot sit past row 999 or column 999.'
 * gridPositionRefusalSentence('An unexpected error occurred')
 * // => null
 */
export function gridPositionRefusalSentence(message: string): string | null {
  return GRID_POSITION_REFUSAL_MESSAGES.has(message) ? message : null
}

/**
 * Whether a database error is the grid-position check refusing the write.
 *
 * Other checks use the same SQLSTATE (`23514`), the color of a column among
 * them, so the constraint name is what tells them apart. Called by the
 * actions that write a column's position before they turn the error into
 * {@link GRID_POSITION_REFUSED}.
 *
 * @param error - The error the Supabase client returned, or null when the
 *   write returned no error.
 * @returns `true` when this check refused the row.
 * @example
 * isGridPositionConstraintViolation({
 *   code: '23514',
 *   message: 'violates check constraint "statuslist_grid_position_bounds"',
 * })
 * // => true
 */
export function isGridPositionConstraintViolation(
  error: { code?: string; message?: string } | null,
): boolean {
  return (
    error?.code === '23514' &&
    typeof error.message === 'string' &&
    error.message.includes(GRID_POSITION_CONSTRAINT)
  )
}
