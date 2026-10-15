import { POSTGREST_MAX_ROWS } from '@/lib/constants/postgrest'

/**
 * Read every row of a PostgREST query, past the `db-max-rows` cap.
 *
 * One `.select()` stops at {@link POSTGREST_MAX_ROWS}. Callers that showed
 * that page as the whole table (a board's cards, a board's columns, the
 * columns offered when moving a card) undercounted. This asks for the next
 * page until a short one comes back.
 *
 * Called by {@link getBoardBundle} when an embed comes back full, and by
 * {@link getUserBoardsWithStatusLists} for the boards and the columns.
 *
 * @param fetchPage - One page. `from` and `to` are the inclusive `.range()`.
 *   The query must use a stable order, or a later page can repeat a row and
 *   skip another.
 * @returns The pages, in order.
 * @throws When a page fails, or when a full page starts with the same row as
 *   the previous one (the range was ignored, so another request would not
 *   move forward).
 *
 * @example
 * const cards = await readEveryRow((from, to) =>
 *   supabase.from('repocard').select('id').order('id').range(from, to),
 * )
 */
export async function readEveryRow<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  let previousFirstRow: string | null = null

  for (;;) {
    const { data, error } = await fetchPage(from, from + POSTGREST_MAX_ROWS - 1)
    if (error) {
      throw new Error(error.message)
    }
    const page = data ?? []
    // A full page that starts where the last one did means `.range()` was
    // not applied. Stop rather than ask for the same page forever.
    if (page.length === POSTGREST_MAX_ROWS) {
      const firstRow = JSON.stringify(page[0])
      if (firstRow === previousFirstRow) {
        throw new Error('The database page did not advance')
      }
      previousFirstRow = firstRow
    }
    rows.push(...page)
    if (page.length < POSTGREST_MAX_ROWS) {
      return rows
    }
    from += POSTGREST_MAX_ROWS
  }
}
