/**
 * Unit Tests: the picker's placements request
 *
 * The picker must load placements with a GET. A Server Action would wait
 * behind the catalog action, which is the other request the first open makes.
 *
 * @see src/lib/fetch-repo-placements.ts
 */

import axios from 'axios'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  fetchRepoPlacements,
  REPO_PLACEMENTS_PATH,
} from '@/lib/fetch-repo-placements'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

describe('fetchRepoPlacements', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('loads placements with a GET beside the catalog Server Action', async () => {
    // Arrange
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: { placements: [], savedMemories: [] },
      },
    })

    // Act
    const result = await fetchRepoPlacements()

    // Assert
    expect(axios.get).toHaveBeenCalledWith(
      REPO_PLACEMENTS_PATH,
      expect.objectContaining({
        headers: { accept: 'application/json' },
      }),
    )
    expect(result).toEqual({
      success: true,
      data: { placements: [], savedMemories: [] },
    })
  })

  test('rejects a response that is not a placements result', async () => {
    // Arrange
    vi.mocked(axios.get).mockResolvedValue({
      status: 502,
      data: '<html>bad gateway</html>',
    })

    // Act
    const request = fetchRepoPlacements()

    // Assert
    await expect(request).rejects.toThrow(
      'Placements request failed with status 502',
    )
  })
})
