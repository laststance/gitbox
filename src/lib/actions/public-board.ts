'use server'

/**
 * Public Board Actions
 *
 * Server-side data fetching for publicly shared boards.
 * No authentication required. Row level security shows a board to its owner
 * only, so the read goes through the `get_public_board(p_slug)` database
 * function, which returns the one public board with that share slug.
 */

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'

import { toRepoCardDomain, toStatusListDomain } from '@/lib/actions/mappers'
import type { RepoCardDomain, StatusListDomain } from '@/lib/models/domain'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { createClient } from '@/lib/supabase/server'
import type { PublicBoardSlug } from '@/lib/types/brands'
import { getForwardedClientIp } from '@/lib/utils/get-client-ip'
import { publicBoardRowSchema } from '@/lib/validations/public-board'

/** What the shared page shows of the board itself: no id, owner or settings */
interface PublicBoard {
  name: string
  subtitle: string | null
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
 * Called by the `/public/[slug]` page (and its metadata), for visitors with
 * or without an account.
 *
 * @param slug - The board's share_slug (12-char hex)
 * @returns
 * - The board with its columns and cards when a public board has this slug
 * - `null` when the slug is malformed or unknown, the board is not public,
 *   the caller is rate limited, or the lookup fails
 *
 * @example
 * const data = await getPublicBoardBySlug("a1b2c3d4e5f6")
 * // { board: {...}, statusLists: [...], repoCards: [...] }
 */
export async function getPublicBoardBySlug(
  slug: PublicBoardSlug,
): Promise<PublicBoardData | null> {
  // Rate limit by IP — anonymous endpoint. When there is no proxy header
  // (rare in production), fall back to a per-request UUID so headerless
  // traffic does not collapse into a single shared bucket where one client
  // can throttle every other anonymous viewer.
  const ip = getForwardedClientIp(await headers()) ?? crypto.randomUUID()
  const rl = checkRateLimit('publicBoardView', ip)
  if (!rl.allowed) return null

  // Validate slug format (12 hex chars)
  if (!/^[a-f0-9]{12}$/.test(slug)) return null

  const supabase = await createClient()

  // One call returns the board with its columns and cards. The function
  // answers null for an unknown slug and for a board that is not public.
  const { data: publicBoardJson, error } = await supabase.rpc(
    'get_public_board',
    { p_slug: slug },
  )

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Public board: get_public_board', slug },
    })
    return null
  }

  if (publicBoardJson === null) return null

  // The function builds its JSON by hand in SQL; check it before mapping
  const parsedPublicBoard = publicBoardRowSchema.safeParse(publicBoardJson)
  if (!parsedPublicBoard.success) {
    Sentry.captureException(parsedPublicBoard.error, {
      extra: { context: 'Public board: unexpected get_public_board shape' },
    })
    return null
  }

  const { board, statuslist, repocard } = parsedPublicBoard.data
  const statusLists = statuslist.map(toStatusListDomain)
  const repoCards = repocard.map(toRepoCardDomain)

  return { board, statusLists, repoCards }
}
