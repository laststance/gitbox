/**
 * Unit Tests: GET /api/saved-repository-memories
 *
 * The picker calls this route beside the placements route, so the list does
 * not wait for the Saved marks. The route answers with that action's result
 * and refuses a signed-out caller.
 *
 * @see src/app/api/saved-repository-memories/route.ts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { GET } from '@/app/api/saved-repository-memories/route'
import { getSavedRepositoryMemories } from '@/lib/actions/board-data'

vi.mock('@/lib/actions/board-data', () => ({
  getSavedRepositoryMemories: vi.fn(),
}))

describe('GET /api/saved-repository-memories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the saved marks and tells the browser not to cache them', async () => {
    // Arrange
    vi.mocked(getSavedRepositoryMemories).mockResolvedValue({
      success: true,
      data: [
        {
          identifier: 'laststance/nsx',
          hasNote: true,
          linkCount: 1,
          hasComment: false,
        },
      ],
    })

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      success: true,
      data: [
        {
          identifier: 'laststance/nsx',
          hasNote: true,
          linkCount: 1,
          hasComment: false,
        },
      ],
    })
  })

  test('answers 200 with no marks when the lookup failed', async () => {
    // Arrange
    vi.mocked(getSavedRepositoryMemories).mockResolvedValue({
      success: true,
      data: null,
    })

    // Act
    const response = await GET()

    // Assert
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: null })
  })

  test('answers 401 when the caller is signed out', async () => {
    // Arrange
    vi.mocked(getSavedRepositoryMemories).mockResolvedValue({
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
