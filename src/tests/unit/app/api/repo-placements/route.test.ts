/**
 * Unit Tests: GET /api/repo-placements
 *
 * The picker calls this route instead of the placements Server Action, so the
 * route has to answer with that action's result and refuse a signed-out caller.
 *
 * @see src/app/api/repo-placements/route.ts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { GET } from '@/app/api/repo-placements/route'
import { getUserRepoPlacements } from '@/lib/actions/board-data'

vi.mock('@/lib/actions/board-data', () => ({
  getUserRepoPlacements: vi.fn(),
}))

describe('GET /api/repo-placements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the placements lookup and tells the browser not to cache it', async () => {
    // Arrange
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work',
            cardId: '00000000-0000-4000-8000-0000000000c2',
            githubRepoId: null,
          },
        ],
        savedMemories: [],
      },
    })

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work',
            cardId: '00000000-0000-4000-8000-0000000000c2',
            githubRepoId: null,
          },
        ],
        savedMemories: [],
      },
    })
  })

  test('answers 401 when the caller is signed out', async () => {
    // Arrange
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      error: 'Authentication required',
    })
  })
})
