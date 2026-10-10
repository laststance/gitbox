/**
 * Unit Tests: placing actions enforce "one repository, one card per user" (Issue #215)
 *
 * Runs `addRepositoriesToBoard`, `restoreToBoard` and `moveCardToBoard` against
 * a stubbed Supabase client to lock in the paths E2E cannot reach reliably:
 * - a failed placement lookup must abort before any write (fail closed)
 * - a malformed payload must be rejected before any query
 * - a write rejected by the unique index must surface the race sentence
 * - a repository that is only in Maintenance must stay restorable
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
  moveCardToBoard,
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
 * `answers.insert` is the spy to expose as the builder's `insert` method, when
 * the table under test is written to. `answers.single` / `answers.maybeSingle`
 * give those two calls their own answer when one table is read both as a list
 * and as a single row within the same action.
 */
function makeQuery(
  result: QueryResult,
  answers: {
    insert?: () => unknown
    single?: QueryResult
    maybeSingle?: QueryResult
  } = {},
) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    single: async () => answers.single ?? result,
    maybeSingle: async () => answers.maybeSingle ?? result,
    insert: answers.insert,
    // Makes the builder awaitable, like the real PostgREST builder
    then: async (resolve: (value: QueryResult) => unknown) => resolve(result),
  }
  return query
}

/**
 * Sign in as `user-1` with a Supabase stub that answers per table.
 *
 * `repocard` and `maintenance` answer the list reads of the placement lookup.
 * The optional `*Single` / `*MaybeSingle` entries answer the single-row reads
 * of the same table (the card or maintenance item being acted on, the highest
 * order in a column, the duplicate check in the target board). `rpc` is the
 * answer of the database function the action calls.
 */
function signInWithSupabaseStub(tables: {
  board?: QueryResult
  statuslist?: QueryResult
  repocard: QueryResult
  repocardSingle?: QueryResult
  repocardMaybeSingle?: QueryResult
  maintenance: QueryResult
  maintenanceSingle?: QueryResult
  insert?: QueryResult
  rpc?: QueryResult
}) {
  const insert = vi.fn(() =>
    makeQuery(tables.insert ?? { data: [], error: null }),
  )
  const rpc = vi.fn(
    async () => tables.rpc ?? { data: 'new-card-id', error: null },
  )
  const from = vi.fn((table: string) => {
    if (table === 'board') {
      return makeQuery(
        tables.board ?? {
          data: { id: 'board-1', user_id: 'user-1' },
          error: null,
        },
      )
    }
    if (table === 'statuslist') {
      return makeQuery(
        tables.statuslist ?? { data: { id: 'status-1' }, error: null },
      )
    }
    if (table === 'repocard') {
      return makeQuery(tables.repocard, {
        insert,
        single: tables.repocardSingle,
        maybeSingle: tables.repocardMaybeSingle,
      })
    }
    return makeQuery(tables.maintenance, { single: tables.maintenanceSingle })
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

  // Value: protects=an oversized selection is refused with a sentence the user
  //   can act on, before any query runs;
  //   fails_when=the size check is removed or thrown as a plain Error, so the
  //   picker shows "An unexpected error occurred" and Sentry records a bug;
  //   why_new=repo-card.test.ts checks the schema limit only, not what the
  //   action tells the user; seam=none
  test('tells the user the limit when more than 100 repositories are added at once', async () => {
    // Arrange
    const { from } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
      maintenance: { data: [], error: null },
    })
    const oversizedSelection = Array.from({ length: 101 }, (_, index) => ({
      ...makeRepository('laststance', `repo-${index}`),
      id: index + 1,
    }))

    // Act
    const result = await addRepositoriesToBoard(
      'board-1',
      'status-1',
      oversizedSelection,
    )

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Add at most 100 repositories at once',
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

  // Value: protects=a mixed selection adds the free repository below the
  //   cards already in the column, remembers its GitHub id, and reports the
  //   held one;
  //   fails_when=the insert also carries the skipped repository, the new card
  //   restarts at order 0, or meta.githubId is dropped;
  //   why_new=the other tests of this action stop before the insert or make it
  //   fail, so nothing checks what is written;
  //   seam=none
  test('adds only the free repository of a mixed selection, below the cards already in the column, and reports the held one', async () => {
    // Arrange
    const { insert } = signInWithSupabaseStub({
      // Another board of the user holds laststance/gitbox
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
      // Highest order in the target column
      repocardSingle: { data: { order: 4 }, error: null },
      maintenance: { data: [], error: null },
      insert: {
        data: [
          {
            id: 'card-9',
            board_id: 'board-1',
            status_id: 'status-1',
            repo_owner: 'laststance',
            repo_name: 'free-repo',
            order: 5,
            meta: { stars: 0, visibility: 'public', githubId: 1001 },
            created_at: '2026-10-11T00:00:00Z',
            updated_at: '2026-10-11T00:00:00Z',
          },
        ],
        error: null,
      },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'free-repo'),
      makeRepository('laststance', 'gitbox'),
    ])

    // Assert
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith([
      {
        board_id: 'board-1',
        status_id: 'status-1',
        repo_owner: 'laststance',
        repo_name: 'free-repo',
        order: 5,
        meta: {
          stars: 0,
          language: null,
          topics: [],
          visibility: 'public',
          description: null,
          updatedAt: '2026-01-01T00:00:00Z',
          githubId: 1001,
        },
      },
    ])
    expect(result).toEqual({
      success: true,
      data: {
        addedCount: 1,
        cards: [
          {
            id: 'card-9',
            boardId: 'board-1',
            statusId: 'status-1',
            repoOwner: 'laststance',
            repoName: 'free-repo',
            order: 5,
            meta: { stars: 0, visibility: 'public', githubId: 1001 },
            createdAt: '2026-10-11T00:00:00Z',
            updatedAt: '2026-10-11T00:00:00Z',
          },
        ],
        skipped: [
          {
            fullName: 'laststance/gitbox',
            reason: 'other-board',
            message: 'laststance/gitbox is already on board "Work Projects"',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
        ],
      },
    })
  })

  // Value: protects=a request whose repositories are not a list is refused
  //   before the database is touched;
  //   fails_when=the schema check is removed or moved after the board query,
  //   so a single object reaches splitRequestedRepos and the action crashes
  //   mid-way;
  //   why_new=the markup test sends a well-formed list; nothing sends a
  //   payload of the wrong shape;
  //   seam=none
  test('refuses a payload that is not a list of repositories before running any query', async () => {
    // Arrange
    const { from } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
      maintenance: { data: [], error: null },
    })
    // What a tampered browser request could carry: one repository, no list
    const singleRepositoryPayload: GitHubRepository[] = JSON.parse(
      '{"id":1001,"name":"gitbox","owner":{"login":"laststance"}}',
    )

    // Act
    const result = await addRepositoriesToBoard(
      'board-1',
      'status-1',
      singleRepositoryPayload,
    )

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(from).not.toHaveBeenCalled()
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

  // Generated by /ship test coverage audit (pass 1).
  // Value: protects=a repository that sits only in Maintenance can still be
  //   restored to a board;
  //   fails_when=the placement pre-check also counts the Maintenance entry
  //   (which every restored repository has) or any other repository's card,
  //   so every restore is refused;
  //   why_new=no test runs a successful restore: E2E covers only the refusal
  //   and findBoardPlacement is tested without the action around it;
  //   seam=none
  test('restores a repository that is in Maintenance and on none of the boards', async () => {
    // Arrange
    const { rpc } = signInWithSupabaseStub({
      board: { data: { id: 'board-1' }, error: null },
      // Another repository of the user sits on a board
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
      // Highest order in the target column
      repocardMaybeSingle: { data: { order: 4 }, error: null },
      maintenance: {
        data: [{ repo_owner: 'laststance', repo_name: 'old-project' }],
        error: null,
      },
      maintenanceSingle: {
        data: {
          id: 'maint-1',
          repo_owner: 'laststance',
          repo_name: 'old-project',
        },
        error: null,
      },
      rpc: { data: 'restored-card-id', error: null },
    })

    // Act
    const result = await restoreToBoard('maint-1', 'board-1', 'status-1')

    // Assert
    expect(result).toEqual({
      success: true,
      data: { cardId: 'restored-card-id' },
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('restore_to_board', {
      p_maintenance_id: 'maint-1',
      p_board_id: 'board-1',
      p_status_id: 'status-1',
      p_repo_owner: 'laststance',
      p_repo_name: 'old-project',
      p_next_order: 5,
    })
  })

  // Generated by /ship test coverage audit (pass 1).
  // Value: protects=a restore the unique index rejected tells the user the
  //   repository was just placed and to try again;
  //   fails_when=the 23505 branch of restoreToBoard is removed or reordered
  //   after the generic handler, so the user sees "An unexpected error
  //   occurred";
  //   why_new=toUniqueViolationError is tested alone and E2E asserts the RPC's
  //   23505, but nothing runs the action that connects the two;
  //   seam=none
  test('explains that the repository was just placed when another tab restored it first', async () => {
    // Arrange
    signInWithSupabaseStub({
      board: { data: { id: 'board-1' }, error: null },
      repocard: { data: [], error: null },
      repocardMaybeSingle: { data: null, error: null },
      maintenance: {
        data: [{ repo_owner: 'laststance', repo_name: 'old-project' }],
        error: null,
      },
      maintenanceSingle: {
        data: {
          id: 'maint-1',
          repo_owner: 'laststance',
          repo_name: 'old-project',
        },
        error: null,
      },
      rpc: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "repocard_unique_repo_per_user"',
        },
      },
    })

    // Act
    const result = await restoreToBoard('maint-1', 'board-1', 'status-1')

    // Assert
    expect(result).toEqual({
      success: false,
      error:
        'laststance/old-project was just placed on a board. Close this dialog and try again.',
    })
  })
})

describe('moveCardToBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Generated by /ship test coverage audit (pass 1).
  // Value: protects=a move the unique index rejected tells the user the
  //   repository was just placed and to try again;
  //   fails_when=the 23505 branch of moveCardToBoard is removed, so a lost race
  //   shows "An unexpected error occurred" and is reported to Sentry as a bug;
  //   why_new=E2E asserts the move_card_to_board RPC returns 23505 but no test
  //   runs the action that turns it into the sentence;
  //   seam=none
  test('explains that the repository was just placed when the database rejects the move as a duplicate', async () => {
    // Arrange
    signInWithSupabaseStub({
      board: {
        data: { id: '00000000-0000-0000-0000-000000000102' },
        error: null,
      },
      statuslist: {
        data: { id: '00000000-0000-0000-0000-000000000211' },
        error: null,
      },
      repocard: { data: [], error: null },
      // The card being moved, owned by the signed-in user
      repocardSingle: {
        data: {
          id: '00000000-0000-0000-0000-000000000301',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      // The target board held no such repository when it was checked
      repocardMaybeSingle: { data: null, error: null },
      maintenance: { data: [], error: null },
      rpc: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "repocard_unique_repo_per_user"',
        },
      },
    })

    // Act
    const result = await moveCardToBoard(
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000211',
    )

    // Assert
    expect(result).toEqual({
      success: false,
      error:
        'laststance/gitbox was just placed on a board. Close this dialog and try again.',
    })
  })

  // Generated by /ship test coverage audit (pass 2).
  // Value: protects=moving onto a board that already holds the repo shows
  //   'Repository already exists in target board';
  //   fails_when=the throw reverts to a plain Error and the dialog shows the
  //   generic message;
  //   why_new=no test runs the duplicate pre-check of moveCardToBoard;
  //   seam=none
  test('says the repository already exists in the target board instead of moving the card there', async () => {
    // Arrange
    const { rpc } = signInWithSupabaseStub({
      board: {
        data: { id: '00000000-0000-0000-0000-000000000102' },
        error: null,
      },
      statuslist: {
        data: { id: '00000000-0000-0000-0000-000000000211' },
        error: null,
      },
      repocard: { data: [], error: null },
      // The card being moved, owned by the signed-in user
      repocardSingle: {
        data: {
          id: '00000000-0000-0000-0000-000000000301',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      // The target board already holds a card for the same repository
      repocardMaybeSingle: {
        data: { id: '00000000-0000-0000-0000-000000000399' },
        error: null,
      },
      maintenance: { data: [], error: null },
    })

    // Act
    const result = await moveCardToBoard(
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000211',
    )

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Repository already exists in target board',
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
