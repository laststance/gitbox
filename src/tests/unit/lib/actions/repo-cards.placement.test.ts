/**
 * Unit Tests: placing actions enforce "one repository, one card per user" (Issue #215)
 *
 * Runs `addRepositoriesToBoard` and `moveCardToBoard` against a stubbed
 * Supabase client to lock in the paths E2E cannot reach reliably:
 * - a failed placement lookup must abort before any write (fail closed)
 * - a malformed payload must be rejected before any query
 * - an insert rejected by the unique index must surface the race sentence
 * - a move the caller has no right to must stop before the database function
 *
 * The happy paths and the real database constraints are covered by E2E
 * (`e2e/logged-in/one-repo-across-boards.spec.ts`).
 *
 * @see src/lib/actions/repo-cards.ts
 */

import * as Sentry from '@sentry/nextjs'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import type { GitHubRepository } from '@/lib/actions/github'
import {
  addRepositoriesToBoard,
  moveCardToBoard,
} from '@/lib/actions/repo-cards'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import {
  backfillVerifiedRepositoryIds,
  lookupRepositoryByGitHubId,
  verifyRepositoryIdentities,
} from '@/lib/github/verify-repository-identity'

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

/** The confirmation GitHub would return for one repository in these tests. */
const { confirmedRepository } = vi.hoisted(() => {
  function confirmedRepository(owner: string, name: string, id?: number) {
    return {
      outcome: 'confirmed' as const,
      repository: {
        // free-repo is the id the insert assertions already expect. Any other
        // name gets its own id, so two repositories are not one GitHub id.
        id:
          id ??
          (name.toLowerCase() === 'free-repo'
            ? 1001
            : 2000 + name.toLowerCase().charCodeAt(0)),
        owner,
        name,
      },
    }
  }
  return { confirmedRepository }
})

vi.mock('@/lib/github/verify-repository-identity', () => ({
  verifyRepositoryIdentities: vi.fn(
    async (repositories: { owner: string; name: string }[]) =>
      repositories.map((repository) =>
        confirmedRepository(repository.owner, repository.name),
      ),
  ),
  lookupRepositoryByGitHubId: vi.fn(async (id: number) =>
    confirmedRepository('laststance', `moved-${id}`, id),
  ),
  backfillVerifiedRepositoryIds: vi.fn(async () => undefined),
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
    // The placement lookup pages with `.range()`; a short answer is one page.
    range: async () => result,
    update: (_payload?: unknown) => query,
    // Makes the builder awaitable, like the real PostgREST builder
    then: async (resolve: (value: QueryResult) => unknown) => resolve(result),
  }
  return query
}

/**
 * Sign in as `user-1` with a Supabase stub that answers per table.
 *
 * `repocard` answers the list read of the placement lookup. The optional
 * `repocardSingle` / `repocardMaybeSingle` entries answer the single-row reads
 * of the same table (the card being acted on, the highest order in a column).
 * `rpc` is the answer of the database function the action calls.
 */
function signInWithSupabaseStub(tables: {
  board?: QueryResult
  statuslist?: QueryResult
  repocard: QueryResult
  repocardSingle?: QueryResult
  repocardMaybeSingle?: QueryResult
  insert?: QueryResult
  rpc?: QueryResult
}) {
  const cardUpdate = vi.fn()
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
      const query = makeQuery(tables.repocard, {
        insert,
        single: tables.repocardSingle,
        maybeSingle: tables.repocardMaybeSingle,
      })
      query.update = (payload?: unknown) => {
        cardUpdate(payload)
        return query
      }
      return query
    }
    if (table === 'projectinfo') {
      return makeQuery({ data: null, error: null })
    }
    throw new Error(`Unexpected table read: ${table}`)
  })

  vi.mocked(getCachedClaims).mockResolvedValue({
    supabase: { from, rpc },
    claims: { sub: 'user-1' },
  } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

  return { from, insert, rpc, cardUpdate }
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
    vi.mocked(verifyRepositoryIdentities).mockImplementation(
      async (repositories) =>
        repositories.map((repository) =>
          confirmedRepository(repository.owner, repository.name),
        ),
    )
    vi.mocked(backfillVerifiedRepositoryIds).mockResolvedValue(undefined)
  })

  test('adds nothing when the lookup of existing cards fails', async () => {
    // Arrange
    const { insert } = signInWithSupabaseStub({
      repocard: { data: null, error: { message: 'connection reset' } },
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

  test('reads the board while the rename backfill is still running, and reads the column order only after placements have come back', async () => {
    // Arrange — the board starts at once. The placement read waits for the
    // backfill, and the column order waits until that placement answer is
    // back, so two adds do not share a maximum taken before either inserts.
    // The backfill is the mock, not a query on the stub.
    const releases: Array<() => void> = []
    let releaseBackfill: (() => void) | undefined
    const backfillDone = new Promise<void>((resolve) => {
      releaseBackfill = (): void => {
        resolve()
      }
    })
    vi.mocked(backfillVerifiedRepositoryIds).mockReturnValue(backfillDone)
    async function answerWhenTheReadHasStarted<T>(value: T): Promise<T> {
      return new Promise((resolve) => {
        releases.push(() => resolve(value))
      })
    }
    const insert = vi.fn(() => ({
      select: async () => ({
        data: [
          {
            id: 'card-1',
            board_id: 'board-1',
            status_id: 'status-1',
            repo_owner: 'laststance',
            repo_name: 'free-repo',
            order: 3,
            meta: { stars: 0, visibility: 'public', githubId: 1001 },
            created_at: '2026-10-16T00:00:00Z',
            updated_at: '2026-10-16T00:00:00Z',
            projectinfo: null,
          },
        ],
        error: null,
      }),
    }))
    const repocard = {
      select: () => repocard,
      eq: () => repocard,
      order: () => repocard,
      limit: () => repocard,
      range: async () => answerWhenTheReadHasStarted({ data: [], error: null }),
      single: async () =>
        answerWhenTheReadHasStarted({ data: { order: 2 }, error: null }),
      insert,
    }
    const from = vi.fn((table: string) => {
      if (table === 'board') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () =>
                  answerWhenTheReadHasStarted({
                    data: { id: 'board-1', user_id: 'user-1' },
                    error: null,
                  }),
              }),
            }),
          }),
        }
      }
      if (table === 'repocard') return repocard
      throw new Error(`Unexpected table read: ${table}`)
    })
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: { from, rpc: vi.fn() },
      claims: { sub: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const pending = addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'free-repo'),
    ])
    await vi.waitFor(() => {
      expect(releases).toHaveLength(1)
    })
    expect(insert).not.toHaveBeenCalled()

    releaseBackfill?.()
    await vi.waitFor(() => {
      expect(releases).toHaveLength(2)
    })
    expect(insert).not.toHaveBeenCalled()

    const startedBeforeOrder = releases.splice(0, 2)
    for (const release of startedBeforeOrder) release()
    await vi.waitFor(() => {
      expect(releases).toHaveLength(1)
    })
    for (const release of releases) release()
    const result = await pending

    // Assert
    expect(result.success).toBe(true)
    expect(insert).toHaveBeenCalledWith([
      {
        board_id: 'board-1',
        status_id: 'status-1',
        repo_owner: 'laststance',
        repo_name: 'free-repo',
        github_repo_id: 1001,
        order: 3,
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
  })

  test('rejects a repository name carrying markup before running any query', async () => {
    // Arrange
    const { from } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
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

  test('refuses a description that is not text before running any query', async () => {
    // Arrange
    const { from } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      {
        ...makeRepository('laststance', 'gitbox'),
        description: { text: 'not a string' } as unknown as null,
      },
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
          {
            repo_owner: 'laststance',
            repo_name: 'old-project',
            board: { id: 'board-3', user_id: 'user-1', name: 'Side Projects' },
          },
        ],
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
            reason: 'other-board',
            message:
              'laststance/old-project is already on board "Side Projects"',
            boardId: 'board-3',
            boardName: 'Side Projects',
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
            // Nothing saved for this repository
            projectinfo: null,
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
        github_repo_id: 1001,
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
            comment: { comment: '', color: 'primary' },
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

  test('stores the id GitHub confirmed, not the id the browser sent', async () => {
    // Arrange
    vi.mocked(verifyRepositoryIdentities).mockResolvedValue([
      confirmedRepository('laststance', 'free-repo', 4242),
    ])
    const { insert } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
      repocardSingle: { data: { order: 0 }, error: null },
      insert: { data: [], error: null },
    })

    // Act
    await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'free-repo'),
    ])

    // Assert
    expect(insert).toHaveBeenCalledWith([
      {
        board_id: 'board-1',
        status_id: 'status-1',
        repo_owner: 'laststance',
        repo_name: 'free-repo',
        github_repo_id: 4242,
        order: 1,
        meta: {
          stars: 0,
          language: null,
          topics: [],
          visibility: 'public',
          description: null,
          updatedAt: '2026-01-01T00:00:00Z',
          githubId: 4242,
        },
      },
    ])
  })

  test('adds a repository whose name is still on a card with a different GitHub id, and moves that card to its current name', async () => {
    // Arrange: the card was confirmed as repository 99 and still spells free-repo
    const { insert, cardUpdate } = signInWithSupabaseStub({
      repocard: {
        data: [
          {
            id: '00000000-0000-4000-8000-0000000000c2',
            repo_owner: 'laststance',
            repo_name: 'free-repo',
            github_repo_id: 99,
            board: { id: 'board-2', user_id: 'user-1', name: 'Work Projects' },
          },
        ],
        error: null,
      },
      repocardSingle: { data: { order: 0 }, error: null },
      insert: { data: [], error: null },
    })

    // Act
    await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'free-repo'),
    ])

    // Assert
    expect(lookupRepositoryByGitHubId).toHaveBeenCalledWith(99)
    expect(cardUpdate).toHaveBeenCalledWith({
      repo_owner: 'laststance',
      repo_name: 'moved-99',
    })
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        repo_owner: 'laststance',
        repo_name: 'free-repo',
        github_repo_id: 1001,
      }),
    ])
  })

  test('adds nothing when GitHub does not confirm the repository', async () => {
    // Arrange
    vi.mocked(verifyRepositoryIdentities).mockResolvedValue([
      { outcome: 'unavailable' },
    ])
    const { insert } = signInWithSupabaseStub({
      repocard: { data: [], error: null },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'free-repo'),
    ])

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Could not confirm the repository with GitHub. Try again.',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  // Value: protects=a repository added again shows the comment it kept, on the new card, without a reload (issue #216); fails_when=the insert stops selecting projectinfo or the comment is not mapped to CreatedRepoCard.comment; why_new=the add test only covers a repository with nothing saved; seam=none; no_claim=that the database returns the row (repository-memory.spec.ts runs it against PostgREST)
  test('gives a card added again the comment its repository kept', async () => {
    // Arrange
    signInWithSupabaseStub({
      repocard: { data: [], error: null },
      repocardSingle: { data: null, error: null },
      insert: {
        data: [
          {
            id: 'card-10',
            board_id: 'board-1',
            status_id: 'status-1',
            repo_owner: 'laststance',
            repo_name: 'nsx',
            order: 0,
            meta: { stars: 0, visibility: 'public', githubId: 1001 },
            created_at: '2026-10-14T00:00:00Z',
            updated_at: '2026-10-14T00:00:00Z',
            projectinfo: {
              comment: 'v2.0リリース準備中',
              comment_color: 'blue',
            },
          },
        ],
        error: null,
      },
    })

    // Act
    const result = await addRepositoriesToBoard('board-1', 'status-1', [
      makeRepository('laststance', 'nsx'),
    ])

    // Assert
    expect(result.success && result.data.cards[0]?.comment).toEqual({
      comment: 'v2.0リリース準備中',
      color: 'blue',
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

describe('moveCardToBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    {
      refusal: 'the card does not exist',
      tables: {
        repocardSingle: { data: null, error: { message: 'no rows' } },
      },
    },
    {
      refusal: "the card sits on another user's board",
      tables: {
        repocardSingle: {
          data: {
            id: '00000000-0000-0000-0000-000000000301',
            repo_owner: 'laststance',
            repo_name: 'gitbox',
            board: { user_id: 'user-2' },
          },
          error: null,
        },
      },
    },
    {
      refusal: 'the target board is not one of the user',
      tables: {
        board: { data: null, error: { message: 'no rows' } },
      },
    },
    {
      refusal: 'the column is not on the target board',
      tables: {
        statuslist: { data: null, error: { message: 'no rows' } },
      },
    },
  ])(
    'moves nothing and gives no detail away when $refusal',
    async ({ tables }) => {
      // Arrange: everything is in order except the one answer of this case
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
        repocardSingle: {
          data: {
            id: '00000000-0000-0000-0000-000000000301',
            repo_owner: 'laststance',
            repo_name: 'gitbox',
            board: { user_id: 'user-1' },
          },
          error: null,
        },
        ...tables,
      })

      // Act
      const result = await moveCardToBoard(
        '00000000-0000-0000-0000-000000000301',
        '00000000-0000-0000-0000-000000000102',
        '00000000-0000-0000-0000-000000000211',
      )

      // Assert: the database function that moves the card was never called
      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred',
      })
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  test('reports a move the database refused and tells the user nothing about the reason', async () => {
    // Arrange: every check passes and the database function fails
    const databaseError = {
      code: '40P01',
      message: 'deadlock detected',
    }
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
      repocardSingle: {
        data: {
          id: '00000000-0000-0000-0000-000000000301',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      rpc: { data: null, error: databaseError },
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
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: {
        context: 'move_card_to_board RPC',
        cardId: '00000000-0000-0000-0000-000000000301',
        targetBoardId: '00000000-0000-0000-0000-000000000102',
      },
    })
  })

  // Value: protects=a move whose answer from the database was lost is not reported as refused: the card may be on the other board; fails_when=every error of the database function is answered as a refusal; why_new=the test above has the database refuse with a code of its own; seam=none; no_claim=which codes count as an answer of the database (did-database-refuse.test.ts)
  test('says the move could not be confirmed, with the code MOVE_UNCONFIRMED, when the database gave no answer', async () => {
    // Arrange: every check passes and the request to the database function
    // was lost on the way, as the Supabase client reports it
    const lostAnswer = { code: '', message: 'TypeError: fetch failed' }
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
      repocardSingle: {
        data: {
          id: '00000000-0000-0000-0000-000000000301',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      rpc: { data: null, error: lostAnswer },
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
        'Could not confirm that the card was moved. Check the board before trying again.',
      errorCode: 'MOVE_UNCONFIRMED',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(lostAnswer, {
      extra: {
        context: 'move_card_to_board RPC',
        cardId: '00000000-0000-0000-0000-000000000301',
        targetBoardId: '00000000-0000-0000-0000-000000000102',
      },
    })
  })

  // Value: protects=a call to the database that throws instead of answering is not reported as a refusal either; fails_when=the action lets the guard turn the thrown error into "An unexpected error occurred", which the dialog reads as "nothing happened"; why_new=the cases above get an error object, as the Supabase client normally returns; seam=none; no_claim=whether the client ever throws in production (it is written not to)
  test('says the move could not be confirmed when the call to the database throws instead of answering', async () => {
    // Arrange: every check passes and the call itself throws
    const thrownError = new TypeError('fetch failed')
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
      repocardSingle: {
        data: {
          id: '00000000-0000-0000-0000-000000000301',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          board: { user_id: 'user-1' },
        },
        error: null,
      },
    })
    rpc.mockRejectedValue(thrownError)

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
        'Could not confirm that the card was moved. Check the board before trying again.',
      errorCode: 'MOVE_UNCONFIRMED',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(thrownError, {
      extra: {
        context: 'move_card_to_board RPC',
        cardId: '00000000-0000-0000-0000-000000000301',
        targetBoardId: '00000000-0000-0000-0000-000000000102',
      },
    })
  })

  test('moves a card again that is already on the target board, so a move whose answer was lost can be repeated', async () => {
    // Arrange: an earlier request moved the card to board 102, and its answer
    // never reached the browser
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
          board_id: '00000000-0000-0000-0000-000000000102',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      rpc: { data: null, error: null },
    })

    // Act
    const result = await moveCardToBoard(
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000211',
    )

    // Assert
    expect(result).toEqual({ success: true, data: undefined })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('move_card_to_board', {
      p_card_id: '00000000-0000-0000-0000-000000000301',
      p_target_board_id: '00000000-0000-0000-0000-000000000102',
      p_target_status_id: '00000000-0000-0000-0000-000000000211',
    })
  })
})
