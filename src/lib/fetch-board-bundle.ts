/**
 * Client fetch for one board's columns and cards.
 *
 * Server Actions share one queue, so a read sent while a write has no answer
 * waits behind that write. This GET does not. Called by {@link useBoardServerSync}
 * only for the fetch that follows such a write. Every other refetch calls
 * {@link getBoardBundle}, which stays in the queue and so runs after the
 * writes already sent.
 */

import axios from 'axios'

import type { BoardBundle } from '@/lib/actions/mappers'
import { SERVER_ANSWER_TIME_LIMIT_MS } from '@/lib/constants/requests'

/**
 * Path of the board bundle route.
 *
 * @param boardId - Board to read.
 * @returns The path {@link fetchBoardBundle} requests.
 * @example
 * boardBundlePath('board-1') // => '/api/boards/board-1'
 */
export function boardBundlePath(boardId: string): string {
  return `/api/boards/${encodeURIComponent(boardId)}`
}

/**
 * Loads one board's columns and cards without waiting behind a Server Action.
 *
 * A network failure or a body that is not this route's JSON throws, and
 * {@link useBoardServerSync} offers a retry. `null` means the board cannot be
 * shown (it is gone, or there is no session).
 *
 * @param boardId - Board to read.
 * @returns The bundle, or `null` when the route answers 404.
 * @throws When the response is not this route's JSON, the request fails on the
 * way, or it gets no answer within {@link SERVER_ANSWER_TIME_LIMIT_MS}.
 * @example
 * const bundle = await fetchBoardBundle('board-1')
 * bundle?.repoCards
 */
export async function fetchBoardBundle(
  boardId: string,
): Promise<BoardBundle | null> {
  const response = await axios.get<unknown>(boardBundlePath(boardId), {
    headers: { accept: 'application/json' },
    // A hung read must reject. Until it does, no other fetch is sent.
    timeout: SERVER_ANSWER_TIME_LIMIT_MS,
    // 404 still carries `{ bundle: null }`. A 500 does not, and throws.
    validateStatus: (status) => status === 200 || status === 404,
  })
  if (!isBoardBundleResponse(response.data)) {
    throw new Error(`Board request failed with status ${response.status}`)
  }
  return response.data.bundle
}

/**
 * Tells this route's JSON from an empty or HTML error page.
 *
 * @param value - Whatever the response body was.
 * @returns Whether it is `{ bundle }` with a bundle or `null`.
 */
function isBoardBundleResponse(
  value: unknown,
): value is { bundle: BoardBundle | null } {
  if (typeof value !== 'object' || value === null || !('bundle' in value)) {
    return false
  }
  const bundle = value.bundle
  if (bundle === null) return true
  return (
    typeof bundle === 'object' &&
    'statusLists' in bundle &&
    'repoCards' in bundle &&
    Array.isArray(bundle.statusLists) &&
    Array.isArray(bundle.repoCards)
  )
}
