'use server'

/**
 * Public Board Actions
 *
 * Server-side data fetching for publicly shared boards.
 * No authentication required — relies on RLS `is_public = true` policies.
 */

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'

import { toStatusListDomain } from '@/lib/actions/mappers'
import type {
  StatusListDomain,
  RepoCardDomain,
  RepoCardMeta,
} from '@/lib/models/domain'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { createClient } from '@/lib/supabase/server'
import type { Board, Tables } from '@/lib/supabase/types'

type RepoCardRow = Tables<'repocard'>

/** Data returned for a public board view */
export interface PublicBoardData {
  board: Board
  statusLists: StatusListDomain[]
  repoCards: RepoCardDomain[]
}

/**
 * Fetch a public board by its share slug.
 *
 * @param slug - The board's share_slug (12-char hex)
 * @returns Board data if found and public, null otherwise
 *
 * @example
 * const data = await getPublicBoardBySlug("a1b2c3d4e5f6")
 * // { board: {...}, statusLists: [...], repoCards: [...] }
 */
export async function getPublicBoardBySlug(
  slug: string,
): Promise<PublicBoardData | null> {
  // Rate limit by IP
  const headerStore = await headers()
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = checkRateLimit('publicBoardView', ip)
  if (!rl.allowed) return null

  // Validate slug format (12 hex chars)
  if (!/^[a-f0-9]{12}$/.test(slug)) return null

  const supabase = await createClient()

  // Fetch the public board by slug
  const { data: board, error: boardError } = await supabase
    .from('board')
    .select('*')
    .eq('share_slug', slug)
    .eq('is_public', true)
    .single()

  if (boardError || !board) return null

  // Fetch status lists and repo cards in parallel
  const [statusListsResult, repoCardsResult] = await Promise.all([
    supabase
      .from('statuslist')
      .select('*')
      .eq('board_id', board.id)
      .order('grid_row', { ascending: true })
      .order('grid_col', { ascending: true }),
    supabase
      .from('repocard')
      .select('*')
      .eq('board_id', board.id)
      .order('order', { ascending: true }),
  ])

  if (statusListsResult.error) {
    Sentry.captureException(statusListsResult.error, {
      extra: { context: 'Public board: fetch status lists', slug },
    })
    return null
  }

  if (repoCardsResult.error) {
    Sentry.captureException(repoCardsResult.error, {
      extra: { context: 'Public board: fetch repo cards', slug },
    })
    return null
  }

  const statusLists = (statusListsResult.data || []).map(toStatusListDomain)
  const repoCards = (repoCardsResult.data || []).map((row: RepoCardRow) => {
    const meta = (row.meta as RepoCardMeta) || {}
    return {
      id: row.id,
      title: `${row.repo_owner}/${row.repo_name}`,
      description: meta.description || '',
      statusId: row.status_id,
      boardId: row.board_id,
      repoOwner: row.repo_owner,
      repoName: row.repo_name,
      order: row.order,
      meta: {
        stars: meta.stars,
        updatedAt: meta.updatedAt,
        visibility: meta.visibility,
        language: meta.language,
        topics: meta.topics,
        description: meta.description,
      },
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? new Date().toISOString(),
    } satisfies RepoCardDomain
  })

  return { board, statusLists, repoCards }
}
