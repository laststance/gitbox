/**
 * Unit Tests: the board refetch that must not wait behind a write
 *
 * A Server Action would stand in Next.js's queue behind a write that has no
 * answer. This GET does not.
 *
 * @see src/lib/fetch-board-bundle.ts
 */

import axios from 'axios'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { boardBundlePath, fetchBoardBundle } from '@/lib/fetch-board-bundle'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const bundle = {
  board: { id: 'board-1' },
  statusLists: [{ id: 'status-1' }],
  repoCards: [{ id: 'card-1' }],
  comments: {},
}

describe('fetchBoardBundle', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('loads the board with a GET that does not wait behind a Server Action', async () => {
    // Arrange
    vi.mocked(axios.get).mockResolvedValue({ status: 200, data: { bundle } })

    // Act
    const result = await fetchBoardBundle('board 1')

    // Assert
    expect(axios.get).toHaveBeenCalledWith(
      boardBundlePath('board 1'),
      expect.objectContaining({
        headers: { accept: 'application/json' },
      }),
    )
    expect(boardBundlePath('board 1')).toBe('/api/boards/board%201')
    expect(result).toEqual(bundle)
  })

  test('returns null when the board cannot be shown', async () => {
    // Arrange
    vi.mocked(axios.get).mockResolvedValue({
      status: 404,
      data: { bundle: null },
    })

    // Act
    const result = await fetchBoardBundle('board-1')

    // Assert
    expect(result).toBeNull()
  })

  test('throws when the answer is not the route JSON', async () => {
    // Arrange
    vi.mocked(axios.get).mockResolvedValue({ status: 500, data: '<html>' })

    // Act
    const result = fetchBoardBundle('board-1')

    // Assert
    await expect(result).rejects.toThrow('Board request failed with status 500')
  })
})
