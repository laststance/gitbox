/**
 * Unit Tests: useRepoPlacements Hook
 *
 * Verifies the repository picker asks where the user's repositories live on
 * every opening, keeps the previous answer on screen while a reopen is still
 * loading, ignores an answer that belongs to an earlier opening, and degrades
 * to "placements unknown" when the request itself fails.
 *
 * @see src/hooks/board/useRepoPlacements.ts
 */

import * as Sentry from '@sentry/nextjs'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useRepoPlacements } from '@/hooks/board/useRepoPlacements'
import {
  fetchRepoPlacements,
  fetchSavedRepositoryMemories,
} from '@/lib/fetch-repo-placements'

vi.mock('@/lib/fetch-repo-placements', () => ({
  fetchRepoPlacements: vi.fn(),
  fetchSavedRepositoryMemories: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

describe('useRepoPlacements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSavedRepositoryMemories).mockResolvedValue({
      success: true,
      data: [],
    })
  })

  test('ignores an answer from an earlier opening that arrives after the picker was closed and reopened', async () => {
    // Arrange
    const firstOpeningRequest =
      Promise.withResolvers<Awaited<ReturnType<typeof fetchRepoPlacements>>>()
    vi.mocked(fetchRepoPlacements)
      // First opening: the server does not answer yet
      .mockReturnValueOnce(firstOpeningRequest.promise)
      // Second opening: nothing is placed anymore
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
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
          placements: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
              cardId: '00000000-0000-4000-8000-0000000000c2',
            },
          ],
        },
      })
    })

    // Assert
    expect(result.current.placements).toEqual([])
    expect(result.current.isLoadingPlacements).toBe(false)
    expect(fetchRepoPlacements).toHaveBeenCalledTimes(2)
  })

  test('keeps the previous placements on screen and unsettled when the picker opens again', async () => {
    // Arrange
    vi.mocked(fetchRepoPlacements)
      // First opening: another board holds the repository
      .mockResolvedValueOnce({
        success: true,
        data: {
          placements: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
              cardId: '00000000-0000-4000-8000-0000000000c2',
            },
          ],
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
    expect(result.current.placements).toEqual([
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work Projects',
        cardId: '00000000-0000-4000-8000-0000000000c2',
      },
    ])
  })

  test('stops loading with unknown placements and reports the failure when the request is rejected', async () => {
    // Arrange
    const networkError = new Error('Failed to fetch')
    vi.mocked(fetchRepoPlacements).mockRejectedValue(networkError)

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
    vi.mocked(fetchRepoPlacements)
      // First opening
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
      })
      // Refresh asked for after closing, e.g. by an add that was still running
      .mockResolvedValueOnce({
        success: true,
        data: {
          placements: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
              cardId: '00000000-0000-4000-8000-0000000000c2',
            },
          ],
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

    // Assert: the next opening loads from the previous settled list, not the late answer
    expect(result.current.isLoadingPlacements).toBe(true)
    expect(result.current.placements).toEqual([])
  })

  // Value: protects=the repository list is usable before the Saved marks arrive; fails_when=isLoadingPlacements stays true until the mark request settles; why_new=the marks used to share the placements response; seam=none; no_claim=the label on a row (AddRepositoryCombobox.placements.test.tsx)
  test('settles the list when placements arrive and the marks when they arrive later', async () => {
    // Arrange
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const marks =
      Promise.withResolvers<
        Awaited<ReturnType<typeof fetchSavedRepositoryMemories>>
      >()
    vi.mocked(fetchSavedRepositoryMemories).mockReturnValue(marks.promise)

    // Act
    const { result } = renderHook(() => useRepoPlacements(true))

    // Assert
    await waitFor(() => {
      expect(result.current.isLoadingPlacements).toBe(false)
    })
    expect(result.current.placements).toEqual([])
    expect(result.current.savedMemories).toBeNull()

    await act(async () => {
      marks.resolve({
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
    expect(result.current.savedMemories).toEqual([
      {
        identifier: 'laststance/nsx',
        hasNote: true,
        linkCount: 0,
        hasComment: false,
      },
    ])
    expect(result.current.isLoadingPlacements).toBe(false)
  })
})
