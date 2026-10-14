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

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getUserRepoPlacements } from '@/lib/actions/board-data'
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

describe('getUserRepoPlacements()', () => {
  beforeEach(() => {
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: {},
      claims: { sub: '00000000-0000-0000-0000-000000000001' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
    vi.mocked(lookupRepoPlacements).mockResolvedValue([
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work',
      },
    ])
  })

  // Value: protects=a repository on a board shows its memory on its card, not as a mark in the picker; fails_when=placed repositories are not filtered out of savedMemories; why_new=new field (issue #216); seam=none; no_claim=the database queries (both lookups mocked)
  test('marks only the saved repositories that sit on no board', async () => {
    // Arrange
    vi.mocked(lookupSavedRepositoryMemories).mockResolvedValue([
      {
        identifier: 'laststance/gitbox',
        hasNote: true,
        linkCount: 0,
        hasComment: false,
      },
      {
        identifier: 'laststance/nsx',
        hasNote: false,
        linkCount: 1,
        hasComment: true,
      },
    ])

    // Act
    const result = await getUserRepoPlacements()

    // Assert
    expect(result).toEqual({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work',
          },
        ],
        savedMemories: [
          {
            identifier: 'laststance/nsx',
            hasNote: false,
            linkCount: 1,
            hasComment: true,
          },
        ],
      },
    })
  })

  // Value: protects=the "Already placed elsewhere" list survives a failed memory lookup (eng review R3); fails_when=one rejected lookup fails the whole action; why_new=new lookup; seam=none; no_claim=a real network failure (mocked rejection)
  test('still lists the placements, without marks, when the saved-memory lookup fails', async () => {
    // Arrange
    vi.mocked(lookupSavedRepositoryMemories).mockRejectedValue(
      new Error('Failed to look up saved repository memories'),
    )

    // Act
    const result = await getUserRepoPlacements()

    // Assert
    expect(result).toEqual({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work',
          },
        ],
        savedMemories: null,
      },
    })
  })
})
