/**
 * Unit Tests: repo card duplicate rules (Issue #215)
 *
 * Covers the pure parts of "one repository, one card per user": which requested
 * repositories may still be added, the sentence shown for each one that may
 * not, and the friendly error for a write the unique index rejected.
 * Also runs the placement lookup against a stubbed Supabase client: what it
 * reports, that a full page is followed by the next one, and that it fails
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
function makeSupabaseStub(result: LookupResult | LookupResult[]) {
  const pages = Array.isArray(result) ? result : [result]
  let pageIndex = 0
  const from = vi.fn()
  const eq = vi.fn()
  const order = vi.fn()
  const range = vi.fn()
  const query = {
    select: () => query,
    eq: (...args: unknown[]) => {
      eq(...args)
      return query
    },
    order: (...args: unknown[]) => {
      order(...args)
      return query
    },
    range: async (...args: unknown[]) => {
      range(...args)
      const page = pages[pageIndex] ?? { data: [], error: null }
      pageIndex += 1
      return page
    },
  }
  from.mockImplementation(() => query)

  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    from,
    eq,
    order,
    range,
  }
}

/** `count` card rows of different repositories, all on the board "Work Projects". */
function makeCardRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
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
          id: '00000000-0000-4000-8000-0000000000c2',
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
        cardId: '00000000-0000-4000-8000-0000000000c2',
        githubRepoId: null,
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

  test('includes the card on the next page when the first page is full', async () => {
    // Arrange
    const { supabase, order, range } = makeSupabaseStub([
      { data: makeCardRows(1000), error: null },
      {
        data: [
          {
            id: '00000000-0000-4000-8000-000000001000',
            repo_owner: 'laststance',
            repo_name: 'past-the-cap',
            board: { id: 'board-2', user_id: 'user-1', name: 'Work Projects' },
          },
        ],
        error: null,
      },
    ])

    // Act
    const placements = await lookupRepoPlacements(supabase, 'user-1')

    // Assert
    expect(placements).toHaveLength(1001)
    expect(placements[1000]).toEqual({
      identifier: 'laststance/past-the-cap',
      boardId: 'board-2',
      boardName: 'Work Projects',
      cardId: '00000000-0000-4000-8000-000000001000',
      githubRepoId: null,
    })
    expect(order).toHaveBeenNthCalledWith(1, 'id', { ascending: true })
    expect(order).toHaveBeenNthCalledWith(2, 'id', { ascending: true })
    expect(range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
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
        cardId: '00000000-0000-4000-8000-0000000000c2',
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

  test('treats a renamed repository as the card that already has its GitHub id', () => {
    // Arrange
    const requested = [
      { name: 'gitbox-renamed', owner: { login: 'laststance' }, id: 42 },
    ]
    const placements: BoardPlacement[] = [
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-2',
        boardName: 'Work Projects',
        cardId: '00000000-0000-4000-8000-0000000000c2',
        githubRepoId: 42,
      },
    ]

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result.addable).toEqual([])
    expect(result.skipped).toEqual([
      {
        fullName: 'laststance/gitbox-renamed',
        reason: 'other-board',
        message:
          'laststance/gitbox-renamed is already on board "Work Projects"',
        boardId: 'board-2',
        boardName: 'Work Projects',
      },
    ])
  })

  test('skips a repository that is already on the target board', () => {
    // Arrange
    const requested = [{ name: 'gitbox', owner: { login: 'laststance' } }]
    const placements: BoardPlacement[] = [
      {
        identifier: 'laststance/gitbox',
        boardId: 'board-1',
        boardName: 'Test Board',
        cardId: '00000000-0000-4000-8000-0000000000c2',
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
        cardId: '00000000-0000-4000-8000-0000000000c2',
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
        cardId: '00000000-0000-4000-8000-0000000000c2',
      },
      {
        identifier: 'laststance/old-project',
        boardId: 'board-3',
        boardName: 'Side Projects',
        cardId: '00000000-0000-4000-8000-0000000000c2',
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
