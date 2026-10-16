/**
 * Board Initial Data Server Actions
 *
 * Unified data fetching for the /board/[id] Server Component. The primary entry
 * point, `getBoardBundle`, fetches a board and everything needed to render it in
 * ONE PostgREST round-trip (replacing the old multi-query waterfall):
 * - The board row itself
 * - Status lists (columns)
 * - Repo cards
 * - Comments for cards
 *
 * This enables the Server Component pattern where data is fetched
 * on the server and passed to Client Components as props.
 *
 * @example
 * // In Server Component (page.tsx)
 * const bundle = await getBoardBundle(boardId)
 * if (!bundle) notFound()
 * return <BoardPageClient board={bundle.board} initialData={initialData} />
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { POSTGREST_MAX_ROWS } from '@/lib/constants/postgrest'
import { logBoardTiming } from '@/lib/utils/board-timing'
import { readEveryRow } from '@/lib/utils/read-every-row'
import { boardIdSchema } from '@/lib/validations/board'

import { withAuthResult } from './auth-guard'
import { createDefaultStatusLists } from './board-creation'
import {
  BOARD_BUNDLE_SELECT,
  PROJECT_COMMENT_EMBED,
  REPO_CARD_COLUMNS,
  remapBoardEmbed,
  type BoardBundle,
  type BoardBundleRow,
} from './mappers'
import {
  lookupRepoPlacements,
  type BoardPlacement,
} from './repo-card-duplicates'
import {
  lookupSavedRepositoryMemories,
  type SavedRepositoryMemory,
} from './saved-repository-memories'
import type { ActionResult } from './types'

/**
 * What {@link BoardPageClient} needs besides the board row: the columns, the
 * cards and their comments, as {@link getBoardBundle} reads them. The page (a
 * Server Component) hands it over, so the board renders without a fetch of
 * its own.
 */
export type BoardInitialData = Omit<BoardBundle, 'board'>

/**
 * What the Add Repositories picker learns when it opens.
 *
 * @example
 * {
 *   placements: [{ identifier: 'laststance/gitbox', boardId: '…', boardName: 'Work' }],
 *   savedMemories: [{ identifier: 'laststance/nsx', hasNote: true, linkCount: 1, hasComment: false }],
 * }
 */
export interface RepoPlacementsLookup {
  /** Every card of the user, with the board that holds it. */
  placements: BoardPlacement[]
  /**
   * Repositories on no board whose note, links or comment are saved (issue
   * #216); `null` when that lookup failed, and the picker then shows no marks.
   */
  savedMemories: SavedRepositoryMemory[] | null
}

/**
 * Get every placement of the current user's repositories (which board holds
 * each one) and what is saved for the repositories on no board.
 *
 * Called by `GET /api/repo-placements` (the picker) and by the command
 * palette. The picker uses the route so the request is not queued behind the
 * catalog Server Action. The picker lists repositories that are already
 * placed elsewhere instead of offering them (Issue #215) and marks the ones
 * whose note, links or comment come back when they are added (Issue #216).
 * Fetched on open rather than with the page so Back / Forward navigation and
 * moves made in other tabs never leave it stale.
 *
 * @returns
 * - On success: `{ success: true, data: RepoPlacementsLookup }`; `savedMemories`
 *   is `null` when only that lookup failed
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - On placement lookup failure: `{ success: false, error: 'An unexpected error occurred' }`
 * @example
 * const result = await getUserRepoPlacements()
 * if (result.success) {
 *   result.data.placements // => [{ identifier: 'laststance/gitbox', boardId: '…', boardName: 'Work' }]
 *   result.data.savedMemories // => [{ identifier: 'laststance/nsx', hasNote: true, linkCount: 1, hasComment: false }]
 * }
 */
export async function getUserRepoPlacements(): Promise<
  ActionResult<RepoPlacementsLookup>
> {
  return withAuthResult(async (supabase, claims) => {
    // Confirm ids after the list is sent, so the picker does not wait and
    // the requests are not dropped when this action returns. The import is
    // dynamic: this module is bundled into Storybook, and `next/server`
    // cannot load there. A failure leaves the ids null; the list is returned.
    try {
      const { scheduleRepositoryBackfill } =
        await import('@/lib/github/schedule-repository-backfill')
      scheduleRepositoryBackfill(supabase, claims.sub)
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'scheduleRepositoryBackfill' },
      })
    }

    const [placements, allSavedMemories] = await Promise.all([
      lookupRepoPlacements(supabase, claims.sub),
      // The marks are extra: without them the picker still lists where each
      // repository is placed
      lookupSavedRepositoryMemories(supabase, claims.sub).catch(
        (error: unknown) => {
          Sentry.captureException(error, {
            tags: { action: 'lookupSavedRepositoryMemories' },
          })
          return null
        },
      ),
    ])

    // A repository on a board shows its memory on its card, not in the picker
    const placedIdentifiers = new Set(
      placements.map((placement) => placement.identifier),
    )
    const savedMemories =
      allSavedMemories?.filter(
        (memory) => !placedIdentifiers.has(memory.identifier),
      ) ?? null

    return { placements, savedMemories }
  })
}

/**
 * Fetch a board and all of its render data in ONE PostgREST round-trip.
 * Replaces the old 4-wave waterfall (board + statuslist + repocard + comments)
 * with a single nested embed, remapped into the domain shape. Called by
 * `app/board/[id]/page.tsx` (wrapped in `React.cache` so generateMetadata and
 * the page share one fetch).
 *
 * Not-found contract: `.maybeSingle()` returns `{ data: null, error: null }`
 * for zero rows, so a non-null `error` is a real failure (RLS denial, network)
 * and is thrown — never silently converted to a 404. `null` data → `null`
 * return → caller calls `notFound()`.
 *
 * @param boardId - The board ID to fetch.
 * @returns
 * - The {@link BoardBundle} when the board exists and belongs to the signed-in user.
 * - `null` when the ID is malformed, the board does not exist or it belongs
 *   to someone else, even when public (caller → notFound). A bad ID never
 *   reaches Postgres, so it cannot 500.
 * - `null` when there is no session. The board page sends that visitor to the
 *   login page with {@link requireClaims} instead of showing a 404.
 * @throws When the embed query errors (propagated, not treated as not-found).
 * @example
 * const bundle = await getBoardBundle('board-uuid-123')
 * if (!bundle) notFound()
 * // bundle.statusLists / bundle.repoCards / bundle.comments are render-ready
 */
export async function getBoardBundle(
  boardId: string,
): Promise<BoardBundle | null> {
  // Reject malformed IDs before they reach Postgres. Passing a non-UUID to
  // `.eq('id', ...)` triggers a Postgres "invalid input syntax for type uuid"
  // error, which would otherwise be thrown as a 500. A bad ID is not a server
  // failure — it is a board that cannot exist — so treat it like zero rows:
  // return null → caller calls notFound() (404), metadata falls back to 'Board'.
  if (!boardIdSchema.safeParse(boardId).success) {
    return null
  }

  // No session means there is no owner to match. The board page redirects to
  // the login page before it reads this result, so the null never becomes a
  // "Board not found" for a visitor whose session just ended.
  const authedContext = await getCachedClaims()
  if (!authedContext) {
    return null
  }
  const { supabase, claims } = authedContext

  // One nested embed: board + its columns + its cards (each with its single
  // projectinfo comment). The card embed names `repocard_board_id_fkey`,
  // because `repocard_board_owner_fkey` is a second link and an unnamed
  // embed is refused. PostgREST resolves the joins server-side under RLS.
  const embedStart = performance.now()
  const { data, error } = await supabase
    .from('board')
    .select(BOARD_BUNDLE_SELECT)
    .eq('id', boardId)
    // This page is the owner's editing view: anyone else gets a 404 here and
    // uses /public/[slug]. Row level security hides other users' boards too;
    // this filter keeps the page correct without depending on the policies.
    .eq('user_id', claims.sub)
    // Order embedded cards by `order` ascending. A full page is read again
    // below, past the row cap; under the cap this order is what the page gets.
    .order('order', { ascending: true, referencedTable: 'repocard' })
    .maybeSingle()
    .overrideTypes<BoardBundleRow, { merge: false }>()
  const embedMs = performance.now() - embedStart

  // A non-null error is a genuine failure (RLS denial, network) — propagate it.
  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'getBoardBundle embed', boardId },
    })
    throw new Error('Failed to fetch board bundle')
  }

  // null data (no error) means the board is absent or not this user's → 404 at caller.
  if (!data) {
    logBoardTiming(boardId, { embedMs })
    return null
  }

  // The embed stops at the row cap. A full list of cards or of columns is
  // not the whole board: read the rest before the page can count them.
  let row = data
  if (row.repocard.length >= POSTGREST_MAX_ROWS) {
    row = {
      ...row,
      repocard: await readCappedBoardRows(
        boardId,
        readEveryRow((from, to) =>
          supabase
            .from('repocard')
            .select(`${REPO_CARD_COLUMNS}, ${PROJECT_COMMENT_EMBED}`)
            .eq('board_id', boardId)
            .order('order', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
    }
  }
  if (row.statuslist.length >= POSTGREST_MAX_ROWS) {
    row = {
      ...row,
      statuslist: await readCappedBoardRows(
        boardId,
        readEveryRow((from, to) =>
          supabase
            .from('statuslist')
            .select('*')
            .eq('board_id', boardId)
            .order('grid_row', { ascending: true })
            .order('grid_col', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
    }
  }

  const bundle = remapBoardEmbed(row)

  // A board with no columns gets the default preset created on first view and
  // renders with zero cards.
  if (bundle.statusLists.length === 0) {
    const defaultCreateStart = performance.now()
    const defaultStatusLists = await createDefaultStatusLists(boardId)
    const defaultCreateMs = performance.now() - defaultCreateStart
    logBoardTiming(boardId, { embedMs, defaultCreateMs })
    return {
      ...bundle,
      statusLists: defaultStatusLists,
      repoCards: [],
      comments: {},
    }
  }

  logBoardTiming(boardId, { embedMs })
  return bundle
}

/**
 * Read one capped child of a board, and turn a failed page into the same
 * failure as a failed embed.
 *
 * A page that errors or does not advance must not become a 404: the board
 * exists, the read of it did not finish.
 *
 * @param boardId - The board being read, for the error report.
 * @param rows - The paged read.
 * @returns The rows of every page.
 */
async function readCappedBoardRows<T>(
  boardId: string,
  rows: Promise<T>,
): Promise<T> {
  try {
    return await rows
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'getBoardBundle page', boardId },
    })
    throw new Error('Failed to fetch board bundle')
  }
}
