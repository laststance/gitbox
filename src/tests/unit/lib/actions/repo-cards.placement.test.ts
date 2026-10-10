/**
 * Unit Tests: placing actions enforce "one repository, one card per user" (Issue #215)
 *
 * Runs `addRepositoriesToBoard` and `restoreToBoard` against a stubbed Supabase
 * client to lock in the paths E2E cannot reach reliably:
 * - a failed placement lookup must abort before any write (fail closed)
 * - a malformed payload must be rejected before any query
 * - a write rejected by the unique index must surface the race sentence
 *
 * The happy paths and the real database constraints are covered by E2E
 * (`e2e/logged-in/one-repo-across-boards.spec.ts`).
 *
 * @see src/lib/actions/repo-cards.ts
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

import type { GitHubRepository } from '@/lib/actions/github'
import {
  addRepositoriesToBoard,
  restoreToBoard,
} from '@/lib/actions/repo-cards'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

type QueryResult = {
  data: unknown
  error: { code?: string; message: string } | null
}

/**
 * Minimal stand-in for a PostgREST query builder: every filter returns the same
 * builder, and awaiting it (directly or via single / maybeSingle) yields `result`.
 * `insert` is the spy to expose as the builder's `insert` method, when the
 * table under test is written to.
 */
function makeQuery(result: QueryResult, insert?: () => unknown) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    single: async () => result,
    maybeSingle: async () => result,
    insert,
    // Makes the builder awaitable, like the real PostgREST builder
    then: async (resolve: (value: QueryResult) => unknown) => resolve(result),
  }
  return query
}

/** Sign in as `user-1` with a Supabase stub that answers per table. */
function signInWithSupabaseStub(tables: {
  board?: QueryResult
  repocard: QueryResult
  maintenance: QueryResult
  insert?: QueryResult
}) {
  const insert = vi.fn(() =>
    makeQuery(tables.insert ?? { data: [], error: null }),
  )
  const rpc = vi.fn(async () => ({ data: 'new-card-id', error: null }))
  const from = vi.fn((table: string) => {
    if (table === 'board') {
      return makeQuery(
        tables.board ?? {
          data: { id: 'board-1', user_id: 'user-1' },
          error: null,
        },
      )
    }
    if (table === 'repocard') return makeQuery(tables.repocard, insert)
    return makeQuery(tables.maintenance)
  })

  vi.mocked(getCachedClaims).mockResolvedValue({
    supabase: { from, rpc },
    claims: { sub: 'user-1' },
  } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

  return { from, insert, rpc }
}

/** A catalog repository as the picker sends it. */
function makeRepository(owner: string, name: string): GitHubRepository {
  return {
    id: 1001,
    name,
    full_name: `${owner}/${name}`,
    owner: { login: owner, avatar_url: '' },
    description: null,
    stargazers_count: 0,
    language: null,
    topics: [],
    visibility: 'public',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('addRepositoriesToBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('adds nothing when the lookup of existing cards fails', async () => {
    // Arrange
    const { insert } = signInWithSupabaseStub({
      repocard: { data: null, error: { message: 'connection reset' } },
      maintenance: { data: [], error: null },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'gitbox'),
    ])

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  test('adds nothing when the lookup of Maintenance repositories fails', async () => {
    // Arrange
    const { insert } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
      maintenance: { data: null, error: { message: 'connection reset' } },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'gitbox'),
    ])

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  test('rejects a repository name carrying markup before running any query', async () => {
    // Arrange
    const { from } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
      maintenance: { data: [], error: null },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', '<img src=x onerror=alert(1)>'),
    ])

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(from).not.toHaveBeenCalled()
  })

  test('reports where each repository lives instead of failing when all of them are already placed', async () => {
    // Arrange
    const { insert } = signInWithSupabaseStub({
      repocard: {
        data: [
          {
            repo_owner: 'laststance',
            repo_name: 'gitbox',
            board: { id: 'board-2', user_id: 'user-1', name: 'Work Projects' },
          },
        ],
        error: null,
      },
      maintenance: {
        data: [{ repo_owner: 'laststance', repo_name: 'old-project' }],
        error: null,
      },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('Laststance', 'GitBox'),
      makeRepository('laststance', 'old-project'),
    ])

    // Assert
    expect(result).toEqual({
      success: true,
      data: {
        addedCount: 0,
        cards: [],
        skipped: [
          {
            fullName: 'Laststance/GitBox',
            reason: 'other-board',
            message: 'Laststance/GitBox is already on board "Work Projects"',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
          {
            fullName: 'laststance/old-project',
            reason: 'maintenance',
            message: 'laststance/old-project is in Maintenance',
          },
        ],
      },
    })
    expect(insert).not.toHaveBeenCalled()
  })

  test('explains that nothing was added when another tab placed the repository first', async () => {
    // Arrange
    signInWithSupabaseStub({
      repocard: { data: [], error: null },
      maintenance: { data: [], error: null },
      insert: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "repocard_unique_repo_per_user"',
        },
      },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'gitbox'),
    ])

    // Assert
    expect(result).toEqual({
      success: false,
      error:
        'Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.',
    })
  })
})

describe('restoreToBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('restores nothing when the lookup of existing cards fails', async () => {
    // Arrange
    const { rpc } = signInWithSupabaseStub({
      board: { data: { id: 'board-1' }, error: null },
      repocard: { data: null, error: { message: 'connection reset' } },
      maintenance: {
        data: { id: 'maint-1', repo_owner: 'laststance', repo_name: 'gitbox' },
        error: null,
      },
    })

    // Act
    const result = await restoreToBoard('maint-1', 'board-1', 'status-1')

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
