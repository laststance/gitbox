/**
 * One board's columns and cards, outside the Server Action queue.
 *
 * A write that got no answer is still in that queue. A Server Action that
 * read the board would wait behind it, so the board stayed wrong until the
 * write settled. This GET does not. The proxy does not cover `/api`, so
 * {@link getBoardBundle} checks the session itself.
 */

import { NextResponse } from 'next/server'

import { getBoardBundle } from '@/lib/actions/board-data'
import type { BoardBundle } from '@/lib/actions/mappers'

/** JSON body of this route. `bundle` is `null` when the board cannot be shown. */
interface BoardBundleResponse {
  bundle: BoardBundle | null
}

/**
 * Returns the signed-in user's board, with its columns and cards.
 *
 * Called by {@link fetchBoardBundle} when a board write got no answer in time.
 * The answer is not cached: the write may land while this request is out.
 *
 * @param _request - Unused. The id is the path.
 * @param context - The board id from the path.
 * @returns
 * - `200` with the bundle when the board belongs to the caller
 * - `404` with `{ bundle: null }` when it does not, or there is no session
 * @example
 * const response = await GET(new Request('http://localhost/api/boards/board-1'), {
 *   params: Promise.resolve({ id: 'board-1' }),
 * })
 * response.status // => 200
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<BoardBundleResponse>> {
  const { id } = await context.params
  const bundle = await getBoardBundle(id)
  return NextResponse.json(
    { bundle },
    {
      status: bundle ? 200 : 404,
      headers: { 'cache-control': 'no-store' },
    },
  )
}
