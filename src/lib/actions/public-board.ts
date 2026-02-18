'use server'

/**
 * Public Board Actions
 *
 * Server-side data fetching for publicly shared boards.
 * No authentication required — relies on RLS `is_public = true` policies.
 */

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'

import { toRepoCardDomain, toStatusListDomain } from '@/lib/actions/mappers'
import type { RepoCardDomain, StatusListDomain } from '@/lib/models/domain'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { createClient } from '@/lib/supabase/server'

/** Public-safe board fields (excludes user_id) */
interface PublicBoard {
  id: string
  name: string
  subtitle: string | null
  created_at: string | null
  updated_at: string | null
  is_public: boolean
  share_slug: string | null
  settings: unknown
}

/** Data returned for a public board view */
export interface PublicBoardData {
  board: PublicBoard
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

  // Fetch the public board by slug (explicit columns — excludes user_id)
  const { data: board, error: boardError } = await supabase
    .from('board')
    .select(
      'id, name, subtitle, created_at, updated_at, is_public, share_slug, settings',
    )
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
  const repoCards = (repoCardsResult.data || []).map(toRepoCardDomain)

  return { board, statusLists, repoCards }
}
