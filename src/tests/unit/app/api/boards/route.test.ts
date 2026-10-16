/**
 * Unit Tests: GET /api/boards/[id]
 *
 * A write that got no answer is still in the Server Action queue. This route
 * reads the board without waiting behind that write.
 *
 * @see src/app/api/boards/[id]/route.ts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { GET } from '@/app/api/boards/[id]/route'
import { getBoardBundle } from '@/lib/actions/board-data'
import type { BoardBundle } from '@/lib/actions/mappers'

vi.mock('@/lib/actions/board-data', () => ({
  getBoardBundle: vi.fn(),
}))

/** A board the route can hand back. Only the fields the client reads matter. */
const bundle = {
  board: { id: 'board-1' },
  statusLists: [],
  repoCards: [],
  comments: {},
} as unknown as BoardBundle

describe('GET /api/boards/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the board and tells the browser not to cache it', async () => {
    // Arrange
    vi.mocked(getBoardBundle).mockResolvedValue(bundle)

    // Act
    const response = await GET(
      new Request('http://localhost/api/boards/board-1'),
      {
        params: Promise.resolve({ id: 'board-1' }),
      },
    )

    // Assert
    expect(getBoardBundle).toHaveBeenCalledWith('board-1')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ bundle })
  })

  test('answers 404 when the board cannot be shown', async () => {
    // Arrange
    vi.mocked(getBoardBundle).mockResolvedValue(null)

    // Act
    const response = await GET(
      new Request('http://localhost/api/boards/missing'),
      {
        params: Promise.resolve({ id: 'missing' }),
      },
    )

    // Assert
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ bundle: null })
  })
})
