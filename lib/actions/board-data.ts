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
}

/**
 * Fetch all initial data needed to render a board
 *
 * Combines multiple data sources into a single response:
 * 1. Status lists (columns) - from statuslist table
 * 2. Repo cards - from repocard table
 * 3. Comments - from projectinfo table (batch fetched)
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
  // Fetch status lists and repo cards (already parallel in getBoardData)
  const { statusLists, repoCards } = await getBoardData(boardId)

  // Batch fetch comments for all cards
  const comments =
    repoCards.length > 0
      ? await getCommentsForCards(repoCards.map((c) => c.id))
      : {}

  return { statusLists, repoCards, comments }
}
