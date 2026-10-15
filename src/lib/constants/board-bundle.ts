/**
 * The `repocard` columns the app reads, as a PostgREST select list.
 *
 * Leaves out `user_id`, which only the database uses, so it is never fetched
 * into a page. The public board page reads its cards through
 * `get_public_board`, which returns the same columns.
 *
 * @example
 * supabase.from('repocard').select(REPO_CARD_COLUMNS)
 */
export const REPO_CARD_COLUMNS =
  'id, board_id, status_id, repo_owner, repo_name, order, meta, created_at, updated_at'

/**
 * The comment of a card's repository, as a PostgREST embed.
 *
 * The computed relationship `projectinfo(repocard)` answers the repository's
 * row or `null`. {@link getBoardBundle} and {@link addRepositoriesToBoard}
 * select it next to {@link REPO_CARD_COLUMNS}.
 *
 * @example
 * supabase.from('repocard').select(`${REPO_CARD_COLUMNS}, ${PROJECT_COMMENT_EMBED}`)
 */
export const PROJECT_COMMENT_EMBED = 'projectinfo(comment, comment_color)'

/**
 * The one PostgREST select {@link getBoardBundle} sends for a board.
 *
 * Columns, cards and each card's comment come back together. The card list
 * stops at the API row cap, so a board with more cards than that is cut off.
 * The database contract test imports this same value.
 *
 * @example
 * supabase.from('board').select(BOARD_BUNDLE_SELECT).eq('id', boardId).maybeSingle()
 */
export const BOARD_BUNDLE_SELECT = `*, statuslist(*), repocard(${REPO_CARD_COLUMNS}, ${PROJECT_COMMENT_EMBED})`
