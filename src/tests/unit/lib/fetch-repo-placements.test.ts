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
  fetchSavedRepositoryMemories,
  REPO_PLACEMENTS_PATH,
  SAVED_REPOSITORY_MEMORIES_PATH,
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
        data: { placements: [] },
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
      data: { placements: [] },
    })
  })

  // Value: protects=the Saved marks are their own GET, so they are not queued behind the catalog action and do not ride in the placements response; fails_when=the picker asks the placements path for the marks; why_new=the marks left the placements response; seam=axios mocked; no_claim=that the list does not wait (useRepoPlacements.test.tsx)
  test('loads saved marks with their own GET', async () => {
    // Arrange
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: [
          {
            identifier: 'laststance/nsx',
            hasNote: true,
            linkCount: 0,
            hasComment: false,
          },
        ],
      },
    })

    // Act
    const result = await fetchSavedRepositoryMemories()

    // Assert
    expect(axios.get).toHaveBeenCalledWith(
      SAVED_REPOSITORY_MEMORIES_PATH,
      expect.objectContaining({
        headers: { accept: 'application/json' },
      }),
    )
    expect(result).toEqual({
      success: true,
      data: [
        {
          identifier: 'laststance/nsx',
          hasNote: true,
          linkCount: 0,
          hasComment: false,
        },
      ],
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
