/**
 * Unit Tests: repo card duplicate rules (Issue #215)
 *
 * Covers the pure parts of "one repository, one card per user": which requested
 * repositories may still be added, the sentence shown for each one that may
 * not, and the friendly error for a write the unique index rejected.
 *
 * @see src/lib/actions/repo-card-duplicates.ts
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

import {
  findBoardPlacement,
  isUniqueViolation,
  splitRequestedRepos,
  toDialogRaceMessage,
  toUniqueViolationError,
  type RepoPlacements,
} from '@/lib/actions/repo-card-duplicates'
import { ActionUserError } from '@/lib/actions/types'

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ warn, error: vi.fn() }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}))

describe('splitRequestedRepos', () => {
  test('lets a repository through when it is placed nowhere', () => {
    // Arrange
    const requested = [{ name: 'gitbox', owner: { login: 'laststance' } }]
    const placements: RepoPlacements = { boards: [], maintenance: [] }

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
    const placements: RepoPlacements = {
      boards: [
        {
          identifier: 'laststance/gitbox',
          boardId: 'board-2',
          boardName: 'Work Projects',
        },
      ],
      maintenance: [],
    }

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
    const placements: RepoPlacements = {
      boards: [
        {
          identifier: 'laststance/gitbox',
          boardId: 'board-1',
          boardName: 'Test Board',
        },
      ],
      maintenance: [],
    }

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

  test('skips a repository that is in Maintenance', () => {
    // Arrange
    const requested = [{ name: 'old-project', owner: { login: 'laststance' } }]
    const placements: RepoPlacements = {
      boards: [],
      maintenance: ['laststance/old-project'],
    }

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result).toEqual({
      addable: [],
      skipped: [
        {
          fullName: 'laststance/old-project',
          reason: 'maintenance',
          message: 'laststance/old-project is in Maintenance',
        },
      ],
    })
  })

  test('treats a different letter case as the same repository', () => {
    // Arrange
    const requested = [{ name: 'GitBox', owner: { login: 'Laststance' } }]
    const placements: RepoPlacements = {
      boards: [
        {
          identifier: 'laststance/gitbox',
          boardId: 'board-2',
          boardName: 'Work Projects',
        },
      ],
      maintenance: [],
    }

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
    const placements: RepoPlacements = { boards: [], maintenance: [] }

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
    const placements: RepoPlacements = {
      boards: [
        {
          identifier: 'laststance/gitbox',
          boardId: 'board-2',
          boardName: 'Work Projects',
        },
      ],
      maintenance: ['laststance/old-project'],
    }

    // Act
    const result = splitRequestedRepos(requested, placements, 'board-1')

    // Assert
    expect(result.addable).toEqual([
      { name: 'free-repo', owner: { login: 'laststance' } },
    ])
    expect(result.skipped.map((skippedRepo) => skippedRepo.message)).toEqual([
      'laststance/gitbox is already on board "Work Projects"',
      'laststance/old-project is in Maintenance',
    ])
  })
})

describe('findBoardPlacement', () => {
  test('finds the holding board regardless of letter case', () => {
    // Arrange
    const placements: RepoPlacements = {
      boards: [
        {
          identifier: 'laststance/gitbox',
          boardId: 'board-2',
          boardName: 'Work Projects',
        },
      ],
      maintenance: [],
    }

    // Act
    const holdingBoard = findBoardPlacement(placements, 'Laststance', 'GitBox')

    // Assert
    expect(holdingBoard).toEqual({
      identifier: 'laststance/gitbox',
      boardId: 'board-2',
      boardName: 'Work Projects',
    })
  })

  test('reports no holding board for a repository that is only in Maintenance', () => {
    // Arrange
    const placements: RepoPlacements = {
      boards: [],
      maintenance: ['laststance/gitbox'],
    }

    // Act
    const holdingBoard = findBoardPlacement(placements, 'laststance', 'gitbox')

    // Assert
    expect(holdingBoard).toBeUndefined()
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
        'laststance/gitbox was just placed on a board. Close this dialog and try again.',
      action: 'restoreToBoard',
      userId: 'user-1',
    })

    // Assert
    expect(error).toBeInstanceOf(ActionUserError)
    expect(error.message).toBe(
      'laststance/gitbox was just placed on a board. Close this dialog and try again.',
    )
    expect(warn).toHaveBeenCalledWith(
      {
        action: 'restoreToBoard',
        userId: 'user-1',
        constraint: 'repocard_unique_repo_per_user',
      },
      'Repo placement rejected by unique constraint (concurrent placement)',
    )
  })

  test('builds the dialog race sentence from the repository name', () => {
    // Arrange & Act
    const message = toDialogRaceMessage('laststance', 'gitbox')

    // Assert
    expect(message).toBe(
      'laststance/gitbox was just placed on a board. Close this dialog and try again.',
    )
  })
})
