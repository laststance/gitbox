/**
 * Unit Tests: getUserRepoPlacements()
 *
 * The Add Repositories picker asks, on every opening, where the user's
 * repositories sit and what is saved for the ones on no board (issue #216).
 * The marks are extra: when their lookup fails the picker still has to list
 * the repositories that are placed elsewhere.
 *
 * @see src/lib/actions/board-data.ts
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  getSavedRepositoryMemories,
  getUserRepoPlacements,
} from '@/lib/actions/board-data'
import { lookupRepoPlacements } from '@/lib/actions/repo-card-duplicates'
import { lookupSavedRepositoryMemories } from '@/lib/actions/saved-repository-memories'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

// The timing log reads a server-only env flag
vi.mock('@/lib/utils/board-timing', () => ({
  logBoardTiming: vi.fn(),
}))

vi.mock('@/lib/actions/board-creation', () => ({
  createDefaultStatusLists: vi.fn(),
}))

vi.mock('@/lib/actions/repo-card-duplicates', () => ({
  lookupRepoPlacements: vi.fn(),
}))

vi.mock('@/lib/actions/saved-repository-memories', () => ({
  lookupSavedRepositoryMemories: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

describe('getUserRepoPlacements()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: {},
      claims: { sub: '00000000-0000-0000-0000-000000000001' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
    vi.mocked(lookupRepoPlacements).mockResolvedValue([
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work',
        cardId: '00000000-0000-4000-8000-0000000000c2',
      },
    ])
  })

  // Value: protects=the placement list does not wait on the Saved marks; fails_when=getUserRepoPlacements calls the memory lookup again and a slow mark query holds the list; why_new=the two lookups used to share one Promise.all; seam=none; no_claim=the view that leaves out repositories on a board (saved_repository_mark)
  test('returns the placements without looking up saved memories', async () => {
    // Act
    const result = await getUserRepoPlacements()

    // Assert
    expect(lookupSavedRepositoryMemories).not.toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
      },
    })
  })

  // Value: protects=a picker never shows a free list built without the placements: a failed placement lookup fails the action, which the picker shows as an error; fails_when=the placement lookup gets a catch of its own and the action answers with an empty list; why_new=the memory lookup used to run in the same Promise.all (testing review of #216); seam=none; no_claim=the picker's error view (AddRepositoryCombobox.placements.test.tsx)
  test('fails, rather than list nothing as placed, when the placement lookup fails', async () => {
    // Arrange
    vi.mocked(lookupRepoPlacements).mockRejectedValue(
      new Error('Failed to look up repository placements'),
    )
    vi.mocked(lookupSavedRepositoryMemories).mockResolvedValue([])

    // Act
    const result = await getUserRepoPlacements()

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
  })
})

describe('getSavedRepositoryMemories()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: {},
      claims: { sub: '00000000-0000-0000-0000-000000000001' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
  })

  // Value: protects=the picker receives the marks the lookup returned; fails_when=the action drops them or waits on placements; why_new=the marks left the placements action; seam=none; no_claim=which rows the view returns (saved-repository-memories.test.ts)
  test('returns the marks of repositories on no board', async () => {
    // Arrange
    vi.mocked(lookupSavedRepositoryMemories).mockResolvedValue([
      {
        identifier: 'laststance/nsx',
        hasNote: false,
        linkCount: 1,
        hasComment: true,
      },
    ])

    // Act
    const result = await getSavedRepositoryMemories()

    // Assert
    expect(lookupRepoPlacements).not.toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      data: [
        {
          identifier: 'laststance/nsx',
          hasNote: false,
          linkCount: 1,
          hasComment: true,
        },
      ],
    })
  })

  // Value: protects=a failed mark lookup costs only the marks, and the failure still reaches Sentry; fails_when=the action fails the request or the catch drops the report; why_new=the catch moved off the placements action; seam=none; no_claim=a real network failure (mocked rejection)
  test('returns no marks and reports the failure when the lookup fails', async () => {
    // Arrange
    vi.mocked(lookupSavedRepositoryMemories).mockRejectedValue(
      new Error('Failed to look up saved repository memories'),
    )

    // Act
    const result = await getSavedRepositoryMemories()

    // Assert
    expect(result).toEqual({ success: true, data: null })
    expect(Sentry.captureException).toHaveBeenCalledWith(
      new Error('Failed to look up saved repository memories'),
      { tags: { action: 'lookupSavedRepositoryMemories' } },
    )
  })
})
