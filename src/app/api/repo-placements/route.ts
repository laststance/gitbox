/**
 * Placements for the Add Repositories picker.
 *
 * A GET so the browser can load it beside the catalog Server Action. The
 * command palette still calls {@link getUserRepoPlacements} directly. The
 * proxy does not cover `/api`, so this handler checks the session itself.
 */

import { NextResponse } from 'next/server'

import {
  getUserRepoPlacements,
  type RepoPlacementsLookup,
} from '@/lib/actions/board-data'
import type { ActionResult } from '@/lib/actions/types'

/**
 * Returns the signed-in user's placements and saved-repository marks.
 *
 * Called by {@link fetchRepoPlacements} each time the picker opens. The
 * answer is not cached: a card added in another tab has to show up on the
 * next open.
 *
 * @returns
 * - `200` with `{ success: true, data }` when the lookup ran
 * - `401` when there is no session
 * - `500` when the lookup failed
 * @example
 * const response = await GET()
 * response.status // => 200
 */
export async function GET(): Promise<
  NextResponse<ActionResult<RepoPlacementsLookup>>
> {
  const result = await getUserRepoPlacements()
  return NextResponse.json(result, {
    status: statusForPlacements(result),
    headers: { 'cache-control': 'no-store' },
  })
}

/**
 * Maps a placements result onto an HTTP status.
 *
 * @param result - What {@link getUserRepoPlacements} returned.
 * @returns `200` for a lookup, `401` for a missing session, `500` otherwise.
 */
function statusForPlacements(
  result: ActionResult<RepoPlacementsLookup>,
): number {
  if (result.success) return 200
  if (result.error === 'Authentication required') return 401
  return 500
}
