/**
 * Unit Tests: repo card duplicate rules (Issue #215)
 *
 * Covers the pure parts of "one repository, one card per user": which requested
 * repositories may still be added, the sentence shown for each one that may
 * not, and the friendly error for a write the unique index rejected.
 * Also runs the placement lookup against a stubbed Supabase client: what it
 * reports, when it warns about a possibly truncated answer, and that it fails
 * closed.
 *
 * @see src/lib/actions/repo-card-duplicates.ts
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import {
  isUniqueViolation,
  lookupRepoPlacements,
  splitRequestedRepos,
  toUniqueViolationError,
  type BoardPlacement,
} from '@/lib/actions/repo-card-duplicates'
import { ActionUserError } from '@/lib/actions/types'
import type { Database } from '@/lib/supabase/types'

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ warn, error: vi.fn() }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}))

type LookupResult = {
  data: unknown
  error: { message: string } | null
}

/**
 * Supabase stand-in for the placement lookup: the list read of `repocard`
 * answers with the given result. `from` and `eq` are spies so a test can see
 * which table was read and how the read was filtered.
 */
function makeSupabaseStub(result: LookupResult) {
  const from = vi.fn()
  const eq = vi.fn()
  const query = {
    select: () => query,
    eq: (...args: unknown[]) => {
      eq(...args)
      return query
    },
    // Makes the builder awaitable, like the real PostgREST builder
    then: async (resolve: (value: LookupResult) => unknown) => resolve(result),
  }
  from.mockImplementation(() => query)

  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    from,
    eq,
  }
}

/** `count` card rows of different repositories, all on the board "Work Projects". */
function makeCardRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    repo_owner: 'laststance',
    repo_name: `repo-${index}`,
    board: { id: 'board-2', user_id: 'user-1', name: 'Work Projects' },
  }))
}

describe('lookupRepoPlacements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('reports which board holds each repository, as lowercase owner/name', async () => {
    // Arrange
    const { supabase } = makeSupabaseStub({
      data: [
        {
          repo_owner: 'Laststance',
          repo_name: 'GitBox',
          board: { id: 'board-2', user_id: 'user-1', name: 'Work Projects' },
        },
      ],
      error: null,
    })

    // Act
    const placements = await lookupRepoPlacements(supabase, 'user-1')

    // Assert
    expect(placements).toEqual([
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work Projects',
      },
    ])
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  test('reads only the cards on boards owned by the given user', async () => {
    // Arrange
    const { supabase, from, eq } = makeSupabaseStub({ data: [], error: null })

    // Act
    await lookupRepoPlacements(supabase, 'user-1')

    // Assert
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('repocard')
    expect(eq).toHaveBeenCalledWith('board.user_id', 'user-1')
  })

  test('warns once that the answer may be cut off when the card lookup returns exactly 1000 rows', async () => {
    // Arrange
    const { supabase } = makeSupabaseStub({
      data: makeCardRows(1000),
      error: null,
    })

    // Act
    const placements = await lookupRepoPlacements(supabase, 'user-1')

    // Assert
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Repo placement lookup may be truncated at PostgREST row limit',
      {
        level: 'warning',
        extra: { userId: 'user-1', repoCardCount: 1000 },
      },
    )
    expect(placements).toHaveLength(1000)
  })

  test('sends no truncation warning when the card lookup returns 999 rows', async () => {
    // Arrange
    const { supabase } = makeSupabaseStub({
      data: makeCardRows(999),
      error: null,
    })

    // Act
    const placements = await lookupRepoPlacements(supabase, 'user-1')

    // Assert
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(placements).toHaveLength(999)
  })

  test('fails instead of reporting no placements when the card lookup fails', async () => {
    // Arrange
    const { supabase } = makeSupabaseStub({
      data: null,
      error: { message: 'connection reset' },
    })

    // Act
    const lookup = lookupRepoPlacements(supabase, 'user-1')

    // Assert
    await expect(lookup).rejects.toThrow(
      'Failed to look up repository placements',
    )
  })
})

describe('splitRequestedRepos', () => {
  test('lets a repository through when it is placed nowhere', () => {
    // Arrange
    const requested = [{ name: 'gitbox', owner: { login: 'laststance' } }]
    const placements: BoardPlacement[] = []

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result).toEqual({
      addable: [{ name: 'gitbox', owner: { login: 'laststance' } }],
      skipped: [],
    })
  })

  test('skips a repository that another board of the user holds and names that board', () => {
    // Arrange
    const requested = [{ name: 'gitbox', owner: { login: 'laststance' } }]
    const placements: BoardPlacement[] = [
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work Projects',
      },
    ]

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result).toEqual({
      addable: [],
      skipped: [
        {
          fullName: 'laststance/gitbox',
          reason: 'other-board',
          message: 'laststance/gitbox is already on board "Work Projects"',
          boardId: 'board-2',
          boardName: 'Work Projects',
        },
      ],
    })
  })

  test('skips a repository that is already on the target board', () => {
    // Arrange
    const requested = [{ name: 'gitbox', owner: { login: 'laststance' } }]
    const placements: BoardPlacement[] = [
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-1',
        boardName: 'Test Board',
      },
    ]

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result).toEqual({
      addable: [],
      skipped: [
        {
          fullName: 'laststance/gitbox',
          reason: 'this-board',
          message: 'laststance/gitbox is already on this board',
          boardId: 'board-1',
          boardName: 'Test Board',
        },
      ],
    })
  })

  test('treats a different letter case as the same repository', () => {
    // Arrange
    const requested = [{ name: 'GitBox', owner: { login: 'Laststance' } }]
    const placements: BoardPlacement[] = [
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work Projects',
      },
    ]

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result.addable).toEqual([])
    expect(result.skipped).toEqual([
      {
        fullName: 'Laststance/GitBox',
        reason: 'other-board',
        message: 'Laststance/GitBox is already on board "Work Projects"',
        boardId: 'board-2',
        boardName: 'Work Projects',
      },
    ])
  })

  test('keeps only the first entry when one request names the same repository twice', () => {
    // Arrange
    const requested = [
      { name: 'gitbox', owner: { login: 'laststance' }, id: 1 },
      { name: 'GITBOX', owner: { login: 'Laststance' }, id: 2 },
    ]
    const placements: BoardPlacement[] = []

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result).toEqual({
      addable: [{ name: 'gitbox', owner: { login: 'laststance' }, id: 1 }],
      skipped: [],
    })
  })

  test('adds the free repositories of a mixed request and reports the rest', () => {
    // Arrange
    const requested = [
      { name: 'free-repo', owner: { login: 'laststance' } },
      { name: 'gitbox', owner: { login: 'laststance' } },
      { name: 'old-project', owner: { login: 'laststance' } },
    ]
    const placements: BoardPlacement[] = [
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work Projects',
      },
      {
        identifier: 'laststance/old-project',
        boardId: 'board-3',
        boardName: 'Side Projects',
      },
    ]

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result.addable).toEqual([
      { name: 'free-repo', owner: { login: 'laststance' } },
    ])
    expect(result.skipped.map((skippedRepo) => skippedRepo.message)).toEqual([
      'laststance/gitbox is already on board "Work Projects"',
      'laststance/old-project is already on board "Side Projects"',
    ])
  })
})

describe('unique violation mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('recognizes a Postgres unique violation by its SQLSTATE, whatever the constraint', () => {
    // Arrange
    const perUserViolation = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "repocard_unique_repo_per_user"',
    }
    const perBoardViolation = {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "unique_repo_per_board"',
    }
    const permissionDenied = { code: '42501', message: 'permission denied' }

    // Act & Assert
    expect(isUniqueViolation(perUserViolation)).toBe(true)
    expect(isUniqueViolation(perBoardViolation)).toBe(true)
    expect(isUniqueViolation(permissionDenied)).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })

  test('turns a lost race into a user-facing error and logs it without repository names', () => {
    // Arrange
    const violation = {
      message:
        'duplicate key value violates unique constraint "repocard_unique_repo_per_user"',
    }

    // Act
    const error = toUniqueViolationError({
      error: violation,
      raceMessage:
        'Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.',
      action: 'addRepositoriesToBoard',
      userId: 'user-1',
    })

    // Assert
    expect(error).toBeInstanceOf(ActionUserError)
    expect(error.message).toBe(
      'Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.',
    )
    expect(warn).toHaveBeenCalledWith(
      {
        action: 'addRepositoriesToBoard',
        userId: 'user-1',
        constraint: 'repocard_unique_repo_per_user',
      },
      'Repo placement rejected by unique constraint (concurrent placement)',
    )
  })
})
