/**
 * Saved marks for the Add Repositories picker.
 *
 * A GET so the browser can load it beside the placements route and the
 * catalog Server Action. The list does not wait for this answer. The proxy
 * does not cover `/api`, so this handler checks the session itself.
 */

import { NextResponse } from 'next/server'

import { getSavedRepositoryMemories } from '@/lib/actions/board-data'
import type { SavedRepositoryMemory } from '@/lib/actions/saved-repository-memories'
import type { ActionResult } from '@/lib/actions/types'

/**
 * Returns the signed-in user's Saved marks for repositories on no board.
 *
 * Called by {@link fetchSavedRepositoryMemories} each time the picker opens.
 * The answer is not cached: a note saved in another tab has to show up on
 * the next open.
 *
 * @returns
 * - `200` with `{ success: true, data }` when the lookup ran (`data` is `null` when it failed)
 * - `401` when there is no session
 * - `500` when the action failed for another reason
 * @example
 * const response = await GET()
 * response.status // => 200
 */
export async function GET(): Promise<
  NextResponse<ActionResult<SavedRepositoryMemory[] | null>>
> {
  const result = await getSavedRepositoryMemories()
  return NextResponse.json(result, {
    status: statusForMemories(result),
    headers: { 'cache-control': 'no-store' },
  })
}

/**
 * Maps a marks result onto an HTTP status.
 *
 * @param result - What {@link getSavedRepositoryMemories} returned.
 * @returns `200` for a lookup, `401` for a missing session, `500` otherwise.
 */
function statusForMemories(
  result: ActionResult<SavedRepositoryMemory[] | null>,
): number {
  if (result.success) return 200
  if (result.error === 'Authentication required') return 401
  return 500
}
