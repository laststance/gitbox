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
 * const initialData = await fetchBoardInitialData(boardId)
 * return <BoardPageClient board={board} initialData={initialData} />
 */

'use server'

import type { StatusListDomain, RepoCardDomain } from '@/lib/models/domain'
import { createClient } from '@/lib/supabase/server'

import { getBoardData } from './board'
import { getCommentsForCards, type CommentData } from './project-info'

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
  maintenanceRepoIdentifiers: string[]
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
export async function getUserMaintenanceRepoIdentifiers(): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from('maintenance')
    .select('repo_owner, repo_name')
    .eq('user_id', user.id)

  return (data || []).map(
    (item) =>
      `${item.repo_owner.toLowerCase()}/${item.repo_name.toLowerCase()}`,
  )
}

/**
 * Fetch all initial data needed to render a board
 *
 * Combines multiple data sources into a single response:
 * 1. Status lists (columns) - from statuslist table
 * 2. Repo cards - from repocard table
 * 3. Comments - from projectinfo table (batch fetched)
 * 4. Maintenance repo identifiers - for filtering Add Repository combobox
 *
 * If board has no status lists, creates default ones automatically.
 *
 * @param boardId - The board ID to fetch data for
 * @returns Complete initial data for the board
 *
 * @example
 * // In app/board/[id]/page.tsx (Server Component)
 * const initialData = await fetchBoardInitialData(params.id)
 * // Pass to client: <BoardPageClient initialData={initialData} />
 */
export async function fetchBoardInitialData(
  boardId: string,
): Promise<BoardInitialData> {
  // Fetch board data and maintenance identifiers in parallel
  const [boardData, maintenanceRepoIdentifiers] = await Promise.all([
    getBoardData(boardId),
    getUserMaintenanceRepoIdentifiers(),
  ])

  const { statusLists, repoCards } = boardData

  // Batch fetch comments for all cards
  const commentsResult =
    repoCards.length > 0
      ? await getCommentsForCards(repoCards.map((c) => c.id))
      : null
  const comments = commentsResult?.success ? commentsResult.data : {}

  return { statusLists, repoCards, comments, maintenanceRepoIdentifiers }
}
