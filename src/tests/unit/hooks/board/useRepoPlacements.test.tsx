/**
 * Unit Tests: useRepoPlacements Hook
 *
 * Verifies the repository picker asks where the user's repositories live on
 * every opening, shows loading again after a reopen instead of the previous
 * answer, ignores an answer that belongs to an earlier opening, and degrades
 * to "placements unknown" when the request itself fails.
 *
 * @see src/hooks/board/useRepoPlacements.ts
 */

import * as Sentry from '@sentry/nextjs'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useRepoPlacements } from '@/hooks/board/useRepoPlacements'
import { getUserRepoPlacements } from '@/lib/actions/board-data'

vi.mock('@/lib/actions/board-data', () => ({
  getUserRepoPlacements: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

describe('useRepoPlacements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('ignores an answer from an earlier opening that arrives after the picker was closed and reopened', async () => {
    // Arrange
    const firstOpeningRequest =
      Promise.withResolvers<Awaited<ReturnType<typeof getUserRepoPlacements>>>()
    vi.mocked(getUserRepoPlacements)
      // First opening: the server does not answer yet
      .mockReturnValueOnce(firstOpeningRequest.promise)
      // Second opening: nothing is placed anymore
      .mockResolvedValueOnce({
        success: true,
        data: { boards: [], maintenance: [] },
      })
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRepoPlacements(isOpen),
      { initialProps: { isOpen: true } },
    )
    rerender({ isOpen: false })
    rerender({ isOpen: true })
    await waitFor(() => {
      expect(result.current.isLoadingPlacements).toBe(false)
    })

    // Act
    await act(async () => {
      firstOpeningRequest.resolve({
        success: true,
        data: {
          boards: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
            },
          ],
          maintenance: [],
        },
      })
    })

    // Assert
    expect(result.current.placements).toEqual({ boards: [], maintenance: [] })
    expect(result.current.isLoadingPlacements).toBe(false)
    expect(getUserRepoPlacements).toHaveBeenCalledTimes(2)
  })

  test('shows loading again right after reopening instead of the placements of the previous opening', async () => {
    // Arrange
    vi.mocked(getUserRepoPlacements)
      // First opening: another board holds the repository
      .mockResolvedValueOnce({
        success: true,
        data: {
          boards: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
            },
          ],
          maintenance: [],
        },
      })
      // Second opening: the server does not answer for the rest of this test
      .mockReturnValueOnce(new Promise(() => {}))
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRepoPlacements(isOpen),
      { initialProps: { isOpen: true } },
    )
    await waitFor(() => {
      expect(result.current.isLoadingPlacements).toBe(false)
    })
    rerender({ isOpen: false })

    // Act
    rerender({ isOpen: true })

    // Assert
    expect(result.current.isLoadingPlacements).toBe(true)
    expect(result.current.placements).toBeNull()
  })

  test('stops loading with unknown placements and reports the failure when the request is rejected', async () => {
    // Arrange
    const networkError = new Error('Failed to fetch')
    vi.mocked(getUserRepoPlacements).mockRejectedValue(networkError)

    // Act
    const { result } = renderHook(() => useRepoPlacements(true))

    // Assert
    await waitFor(() => {
      expect(result.current.isLoadingPlacements).toBe(false)
    })
    expect(result.current.placements).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(networkError, {
      tags: { action: 'fetchRepoPlacements' },
    })
  })

  test('does not keep placements that were refreshed after the picker closed', async () => {
    // Arrange: the picker was open, settled, and is closed again
    vi.mocked(getUserRepoPlacements)
      // First opening
      .mockResolvedValueOnce({
        success: true,
        data: { boards: [], maintenance: [] },
      })
      // Refresh asked for after closing, e.g. by an add that was still running
      .mockResolvedValueOnce({
        success: true,
        data: {
          boards: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
            },
          ],
          maintenance: [],
        },
      })
      // Second opening: the server does not answer for the rest of this test
      .mockReturnValueOnce(new Promise(() => {}))
    const { result, rerender } = renderHook(
      ({ isOpen }) => useRepoPlacements(isOpen),
      { initialProps: { isOpen: true } },
    )
    await waitFor(() => {
      expect(result.current.isLoadingPlacements).toBe(false)
    })
    rerender({ isOpen: false })
    await act(async () => {
      await result.current.refreshPlacements()
    })

    // Act
    rerender({ isOpen: true })

    // Assert: the next opening loads instead of starting from the late answer
    expect(result.current.isLoadingPlacements).toBe(true)
    expect(result.current.placements).toBeNull()
  })
})
