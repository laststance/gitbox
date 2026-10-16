/**
 * Refresh the GitHub snapshot stored on a card.
 *
 * Thin wrappers around refresh-metadata-core.ts. This file is the `'use
 * server'` boundary. Both writes share the `refreshRepoMetadata` rate limit:
 * a signed-in browser can call them with any id, and each one asks GitHub.
 * A sentence the core throws as {@link ActionUserError} reaches the toast.
 */

'use server'

import { uuidSchema } from '@/lib/validations'

import { withAuthResultRateLimit } from './auth-guard'
import {
  refreshBoardMetadataCore,
  refreshCardMetadataCore,
  type RefreshBoardData,
  type RefreshedCard,
} from './refresh-metadata-core'
import type { ActionResult } from './types'

export type { RefreshBoardData, RefreshedCard }

/**
 * Read one card's repository from GitHub and rewrite its snapshot.
 *
 * Called from the card's menu. The owner and the name on the card stay, so
 * the repository's note keeps its key. `meta.githubId` and `github_repo_id`
 * are written from GitHub's answer.
 *
 * @param cardId - The card to refresh.
 * @returns The snapshot now stored on the card.
 * @example
 * const result = await refreshCardMetadata(cardId)
 * if (result.success) result.data.meta.stars
 */
export async function refreshCardMetadata(
  cardId: string,
): Promise<ActionResult<RefreshedCard>> {
  return withAuthResultRateLimit(
    'refreshRepoMetadata',
    async (supabase, claims) => {
      if (!uuidSchema.safeParse(cardId).success) {
        throw new Error('Invalid card')
      }
      return refreshCardMetadataCore(supabase, claims.sub, cardId)
    },
  )
}

/**
 * Read the cards of one board from GitHub and rewrite each snapshot.
 *
 * Called from the board header. One request covers the oldest 100 cards.
 * The rest wait for the next one.
 *
 * @param boardId - The board to refresh.
 * @returns The cards that were written, the ones that were not, and how many
 *   were left.
 * @example
 * const result = await refreshBoardMetadata(boardId)
 * if (result.success) result.data.updated.length
 */
export async function refreshBoardMetadata(
  boardId: string,
): Promise<ActionResult<RefreshBoardData>> {
  return withAuthResultRateLimit(
    'refreshRepoMetadata',
    async (supabase, claims) => {
      if (!uuidSchema.safeParse(boardId).success) {
        throw new Error('Invalid board')
      }
      return refreshBoardMetadataCore(supabase, claims.sub, boardId)
    },
  )
}
