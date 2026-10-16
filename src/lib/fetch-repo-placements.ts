/**
 * Client fetch for the Add Repositories picker's placements.
 *
 * Server Actions share one queue in the browser, so calling
 * {@link getUserRepoPlacements} from the picker waits behind the catalog
 * action on the first open. This GET runs beside that action. Called by
 * {@link useRepoPlacements} on every opening and after a move.
 */

import axios from 'axios'

import type { RepoPlacementsLookup } from '@/lib/actions/board-data'
import type { SavedRepositoryMemory } from '@/lib/actions/saved-repository-memories'
import type { ActionResult } from '@/lib/actions/types'

/** Path of the placements route. The picker is the only caller. */
export const REPO_PLACEMENTS_PATH = '/api/repo-placements'

/**
 * Path of the Saved-mark route. The picker loads it beside the placements
 * route, and does not wait for it before the list can be used.
 */
export const SAVED_REPOSITORY_MEMORIES_PATH = '/api/saved-repository-memories'

/**
 * Loads where the signed-in user's repositories are placed.
 *
 * A network failure or a body that is not an {@link ActionResult} throws, and
 * {@link useRepoPlacements} reports that. A refused lookup comes back as
 * `{ success: false }` and is not thrown.
 *
 * @returns The same result {@link getUserRepoPlacements} returns to the command palette.
 * @throws When the response is not JSON of that shape, or the request fails on the way.
 * @example
 * const result = await fetchRepoPlacements()
 * if (result.success) result.data.placements
 */
export async function fetchRepoPlacements(): Promise<
  ActionResult<RepoPlacementsLookup>
> {
  const response = await axios.get<unknown>(REPO_PLACEMENTS_PATH, {
    headers: { accept: 'application/json' },
    // 401 and 500 still carry an ActionResult. Axios must not throw those away.
    validateStatus: () => true,
  })
  if (!isActionResult<RepoPlacementsLookup>(response.data)) {
    throw new Error(`Placements request failed with status ${response.status}`)
  }
  return response.data
}

/**
 * Loads the Saved marks for repositories on no board.
 *
 * Called by {@link useRepoPlacements} beside {@link fetchRepoPlacements}.
 * The list becomes usable when the placements answer arrives; the marks fill
 * in when this one does. A network failure or a body that is not an
 * {@link ActionResult} throws. A refused lookup comes back as
 * `{ success: false }` and is not thrown.
 *
 * @returns The same result {@link getSavedRepositoryMemories} returns.
 * @throws When the response is not JSON of that shape, or the request fails on the way.
 * @example
 * const result = await fetchSavedRepositoryMemories()
 * if (result.success) result.data
 */
export async function fetchSavedRepositoryMemories(): Promise<
  ActionResult<SavedRepositoryMemory[] | null>
> {
  const response = await axios.get<unknown>(SAVED_REPOSITORY_MEMORIES_PATH, {
    headers: { accept: 'application/json' },
    // 401 and 500 still carry an ActionResult. Axios must not throw those away.
    validateStatus: () => true,
  })
  if (!isActionResult<SavedRepositoryMemory[] | null>(response.data)) {
    throw new Error(
      `Saved repository memories request failed with status ${response.status}`,
    )
  }
  return response.data
}

/**
 * Tells an action response from an empty or HTML error page.
 *
 * @param value - Whatever `response.json()` returned.
 * @returns Whether it is an {@link ActionResult}.
 */
function isActionResult<T>(value: unknown): value is ActionResult<T> {
  if (typeof value !== 'object' || value === null || !('success' in value)) {
    return false
  }
  return typeof value.success === 'boolean'
}
