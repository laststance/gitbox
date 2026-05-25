/**
 * Board Initial Data Server Action
 *
 * Provides unified data fetching for Server Components.
 * Fetches all initial board data in a single function:
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
import type { StatusListDomain, RepoCardDomain } from '@/lib/models/domain'
import { createClient } from '@/lib/supabase/server'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
import { logBoardTiming } from '@/lib/utils/board-timing'
import { boardIdSchema } from '@/lib/validations/board'

import { createDefaultStatusLists } from './board'
import {
  remapBoardEmbed,
  type BoardBundle,
  type BoardBundleRow,
} from './mappers'
import type { CommentData } from './project-info'

/**
 * PostgREST caps the number of rows returned for an embedded relation
 * (default `db-max-rows` = 1000). A board whose `repocard` embed hits this
 * cap may be silently truncated, so `getBoardBundle` warns when it is reached.
 */
const POSTGREST_EMBED_MAX_ROWS = 1000

/**
 * Complete initial data for a board
 *
 * Used by Server Component to pass to Client Component.
 * Contains all data needed to render the board without additional fetches.
 */
export interface BoardInitialData {
  /** Columns (status lists) sorted by grid position */
  statusLists: StatusListDomain[]
  /** Repository cards on the board */
  repoCards: RepoCardDomain[]
  /** Map of cardId → comment data (text + color) from projectinfo */
  comments: Record<string, CommentData>
  /** Lowercase "owner/repo" identifiers of repos in maintenance mode */
  maintenanceRepoIdentifiers: RepoIdentifier[]
}

/**
 * Get maintenance repo identifiers for the current user
 *
 * Returns lowercase "owner/repo" strings for all repos in maintenance mode.
 * Used to filter these repos from the Add Repository combobox.
 *
 * @returns Array of lowercase "owner/repo" identifiers
 *
 * @example
 * const identifiers = await getUserMaintenanceRepoIdentifiers()
 * // Returns: ["facebook/react", "vercel/next.js"]
 */
export async function getUserMaintenanceRepoIdentifiers(): Promise<
  RepoIdentifier[]
> {
  const authedContext = await getCachedClaims()
  if (!authedContext) return []
  const { supabase, claims } = authedContext

  const { data } = await supabase
    .from('maintenance')
    .select('repo_owner, repo_name')
    .eq('user_id', claims.sub)

  return (data || []).map(
    (item) =>
      `${item.repo_owner.toLowerCase()}/${item.repo_name.toLowerCase()}`,
  )
}

/**
 * Fetch a board and all of its render data in ONE PostgREST round-trip.
 * Replaces the old 4-wave waterfall (board + statuslist + repocard + comments)
 * with a single nested embed, remapped into the domain shape. Called by
 * `app/board/[id]/page.tsx` (wrapped in `React.cache` so generateMetadata and
 * the page share one fetch). Maintenance identifiers are fetched separately by
 * the page because they are user-scoped, not board-scoped.
 *
 * Not-found contract: `.maybeSingle()` returns `{ data: null, error: null }`
 * for zero rows, so a non-null `error` is a real failure (RLS denial, network)
 * and is thrown — never silently converted to a 404. `null` data → `null`
 * return → caller calls `notFound()`.
 *
 * @param boardId - The board ID to fetch.
 * @returns
 * - The {@link BoardBundle} when the board exists (and is visible under RLS).
 * - `null` when the ID is malformed, the board does not exist, or RLS hides it
 *   (caller → notFound). A bad ID never reaches Postgres, so it cannot 500.
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

  const supabase = await createClient()

  // One nested embed: board + its columns + its cards (each with its single
  // projectinfo comment). PostgREST resolves the joins server-side under RLS.
  const embedStart = performance.now()
  const { data, error } = await supabase
    .from('board')
    .select(
      '*, statuslist(*), repocard(*, projectinfo(comment, comment_color))',
    )
    .eq('id', boardId)
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

  // null data (no error) means the board is absent or RLS-hidden → 404 at caller.
  if (!data) {
    logBoardTiming(boardId, { embedMs })
    return null
  }

  // Surface a possible silent truncation at the PostgREST embed row cap.
  if (data.repocard.length >= POSTGREST_EMBED_MAX_ROWS) {
    Sentry.captureMessage(
      'Board repocard embed may be truncated at PostgREST row limit',
      {
        level: 'warning',
        extra: { boardId, repoCardCount: data.repocard.length },
      },
    )
  }

  const bundle = remapBoardEmbed(data)

  // Preserve legacy getBoardData behavior: a board with no columns gets the
  // default preset created on first view, and renders with zero cards.
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
