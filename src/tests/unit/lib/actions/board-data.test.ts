/**
 * Unit Tests: getBoardBundle() guards that run before Postgres, and the
 * owner filter of the query it sends
 *
 * Locks in the 404-not-500 contract for /board/[id]: a board id that is not a
 * valid UUID must be treated like a board that cannot exist (return null →
 * caller calls notFound()), and must NEVER reach Postgres — passing a non-UUID
 * to `.eq('id', ...)` would raise "invalid input syntax for type uuid" and
 * surface as a 500. getBoardBundle reaches Supabase only through the client
 * that getCachedClaims returns, so "the session lookup never ran" is the proof
 * that Postgres was not touched.
 *
 * The owner filter is checked on the query itself. E2E cannot tell it from
 * row level security: both answer "not found" for another user's board, so a
 * removed filter would go unnoticed there.
 *
 * A board that is read without columns gets the default ones before the page
 * is built. Its owner can bring that about by deleting every column;
 * e2e/logged-in/board-without-columns.spec.ts does so in a browser. The tests
 * here check what getBoardBundle hands to the page for such a board: the new
 * columns, no cards and no comments.
 *
 * An embed that comes back as an error is thrown, so the page shows its error
 * boundary instead of "Board not found". An embed that fills the row cap is
 * read again, page by page, so the board the page counts is the whole one.
 * What PostgREST returns at that cap is
 * e2e/logged-in/board-bundle-db-contract.spec.ts.
 *
 * @see src/lib/actions/board-data.ts
 */

import * as Sentry from '@sentry/nextjs'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import { createDefaultStatusLists } from '@/lib/actions/board-creation'
import { getBoardBundle } from '@/lib/actions/board-data'
import { BOARD_BUNDLE_SELECT } from '@/lib/actions/mappers'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { POSTGREST_MAX_ROWS } from '@/lib/constants/postgrest'
import { toBoardId, toStatusListId } from '@/lib/types/brands'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// getClaims is the real session check in production; here it reports no session.
vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(async () => null),
}))

// The timing log reads a server-only env flag, which the browser-like test
// environment refuses to hand out.
vi.mock('@/lib/utils/board-timing', () => ({
  logBoardTiming: vi.fn(),
}))

// The write that gives a board its default columns; one test sets its answer.
vi.mock('@/lib/actions/board-creation', () => ({
  createDefaultStatusLists: vi.fn(),
}))

// Value: protects=a malformed board id is rejected before the session lookup,
//   which is the only route from getBoardBundle to Supabase;
//   fails_when=the boardIdSchema guard is removed or moved below getCachedClaims;
//   why_new=getBoardBundle no longer calls createClient itself, so asserting
//   on createClient cannot fail; seam=none; no_claim=that Postgres answers a
//   malformed id with an error (getCachedClaims is mocked; unit only)
describe('getBoardBundle() malformed-id guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('treats a non-UUID board id as not-found (null) without querying Postgres', async () => {
    // Arrange
    const malformedBoardId = 'not-a-uuid'

    // Act
    const result = await getBoardBundle(malformedBoardId)

    // Assert
    expect(result).toBeNull()
    expect(getCachedClaims).not.toHaveBeenCalled()
  })

  test('treats an empty board id as not-found (null) without querying Postgres', async () => {
    // Arrange
    const emptyBoardId = ''

    // Act
    const result = await getBoardBundle(emptyBoardId)

    // Assert
    expect(result).toBeNull()
    expect(getCachedClaims).not.toHaveBeenCalled()
  })
})

describe('getBoardBundle() session guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // The board page turns this null into a redirect to the login page before
  // it can become a 404 (see src/tests/unit/app/board/page.test.tsx).
  test('returns no board without querying Postgres when nobody is signed in', async () => {
    // Arrange: a well-formed id, and getCachedClaims reports no session
    const boardId = '00000000-0000-0000-0000-000000000100'

    // Act
    const result = await getBoardBundle(boardId)

    // Assert
    expect(result).toBeNull()
    expect(getCachedClaims).toHaveBeenCalledTimes(1)
  })
})

describe('getBoardBundle() owner filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("asks Postgres for the board only among the signed-in user's own boards", async () => {
    // Arrange: a signed-in user, and a query that records every filter put on
    // it and finds no row
    const boardId = '00000000-0000-0000-0000-000000000100'
    const appliedFilters: Array<[column: string, value: string]> = []
    const boardQuery = {
      select: vi.fn(() => boardQuery),
      eq: vi.fn((column: string, value: string) => {
        appliedFilters.push([column, value])
        return boardQuery
      }),
      order: vi.fn(() => boardQuery),
      maybeSingle: vi.fn(() => boardQuery),
      overrideTypes: vi.fn(async () => ({ data: null, error: null })),
    }
    vi.mocked(getCachedClaims).mockResolvedValueOnce({
      supabase: { from: vi.fn(() => boardQuery) },
      claims: { sub: '00000000-0000-0000-0000-000000000001' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const result = await getBoardBundle(boardId)

    // Assert: the board id alone is not enough, the owner has to match too
    expect(appliedFilters).toEqual([
      ['id', '00000000-0000-0000-0000-000000000100'],
      ['user_id', '00000000-0000-0000-0000-000000000001'],
    ])
    expect(result).toBeNull()
  })
})

describe('getBoardBundle() board without columns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('gives a board that has no column the default ones and shows it with them', async () => {
    // Arrange: the signed-in user's board comes back without a column
    const boardId = '00000000-0000-0000-0000-000000000100'
    const boardQuery = {
      select: vi.fn(() => boardQuery),
      eq: vi.fn(() => boardQuery),
      order: vi.fn(() => boardQuery),
      maybeSingle: vi.fn(() => boardQuery),
      overrideTypes: vi.fn(async () => ({
        data: {
          id: boardId,
          name: 'Old board',
          user_id: '00000000-0000-0000-0000-000000000001',
          statuslist: [],
          repocard: [],
        },
        error: null,
      })),
    }
    vi.mocked(getCachedClaims).mockResolvedValueOnce({
      supabase: { from: vi.fn(() => boardQuery) },
      claims: { sub: '00000000-0000-0000-0000-000000000001' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
    const defaultColumn = {
      id: toStatusListId('status-1'),
      title: 'Pending',
      color: '#8B7355',
      gridRow: 0,
      gridCol: 0,
      boardId: toBoardId(boardId),
      createdAt: '2026-01-01T00:00:00+00:00',
      updatedAt: '2026-01-01T00:00:00+00:00',
    }
    vi.mocked(createDefaultStatusLists).mockResolvedValue([defaultColumn])

    // Act
    const bundle = await getBoardBundle(boardId)

    // Assert
    expect(createDefaultStatusLists).toHaveBeenCalledTimes(1)
    expect(createDefaultStatusLists).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000100',
    )
    expect(bundle?.statusLists).toEqual([defaultColumn])
    expect(bundle?.repoCards).toEqual([])
  })

  test('leaves a board that has a column as it is', async () => {
    // Arrange
    const boardId = '00000000-0000-0000-0000-000000000100'
    const boardQuery = {
      select: vi.fn(() => boardQuery),
      eq: vi.fn(() => boardQuery),
      order: vi.fn(() => boardQuery),
      maybeSingle: vi.fn(() => boardQuery),
      overrideTypes: vi.fn(async () => ({
        data: {
          id: boardId,
          name: 'Work',
          user_id: '00000000-0000-0000-0000-000000000001',
          statuslist: [
            {
              id: 'status-9',
              board_id: boardId,
              name: 'Repositories',
              color: '#6B7280',
              order: 0,
              grid_row: 0,
              grid_col: 0,
              created_at: '2026-01-01T00:00:00+00:00',
              updated_at: '2026-01-01T00:00:00+00:00',
            },
          ],
          repocard: [],
        },
        error: null,
      })),
    }
    vi.mocked(getCachedClaims).mockResolvedValueOnce({
      supabase: { from: vi.fn(() => boardQuery) },
      claims: { sub: '00000000-0000-0000-0000-000000000001' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const bundle = await getBoardBundle(boardId)

    // Assert
    expect(createDefaultStatusLists).not.toHaveBeenCalled()
    expect(bundle?.statusLists.map((column) => column.title)).toEqual([
      'Repositories',
    ])
  })
})

const BOARD_ID = '00000000-0000-0000-0000-000000000100'
const OWNER_ID = '00000000-0000-0000-0000-000000000001'

/** One column, so the default-column repair does not run. */
const ONE_COLUMN = {
  id: '00000000-0000-0000-0000-000000000010',
  board_id: BOARD_ID,
  name: 'Repositories',
  color: '#6B7280',
  order: 0,
  grid_row: 0,
  grid_col: 0,
  created_at: '2026-01-01T00:00:00+00:00',
  updated_at: '2026-01-01T00:00:00+00:00',
}

/**
 * A query that records the select list and resolves to `result`.
 *
 * @param result - The `{ data, error }` PostgREST would return
 * @returns The chain `getBoardBundle` calls
 */
function queryResolving(result: { data: unknown; error: unknown }) {
  const boardQuery = {
    select: vi.fn(() => boardQuery),
    eq: vi.fn(() => boardQuery),
    order: vi.fn(() => boardQuery),
    maybeSingle: vi.fn(() => boardQuery),
    overrideTypes: vi.fn(async () => result),
  }
  return boardQuery
}

/** Sign in as the owner and point `from('board')` at `boardQuery`. */
function signInWith(boardQuery: ReturnType<typeof queryResolving>): void {
  vi.mocked(getCachedClaims).mockResolvedValueOnce({
    supabase: { from: vi.fn(() => boardQuery) },
    claims: { sub: OWNER_ID },
  } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
}

/** `count` embedded cards, ordered 0..count-1, with no saved comment. */
function embeddedCards(count: number) {
  return Array.from({ length: count }, (_, order) => ({
    id: `00000000-0000-0000-0000-${String(order).padStart(12, '0')}`,
    board_id: BOARD_ID,
    status_id: ONE_COLUMN.id,
    repo_owner: 'laststance',
    repo_name: `repo-${order}`,
    order,
    meta: null,
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    projectinfo: null,
  }))
}

describe('getBoardBundle() embed failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('throws when the board embed fails, so a database error is not shown as a missing board', async () => {
    // Arrange: PostgREST reports the embed failed and returns no row
    const embedError = {
      message: 'permission denied for table statuslist',
      code: '42501',
    }
    const boardQuery = queryResolving({ data: null, error: embedError })
    signInWith(boardQuery)

    // Act
    const bundle = getBoardBundle(BOARD_ID)

    // Assert
    await expect(bundle).rejects.toThrow('Failed to fetch board bundle')
    expect(boardQuery.select).toHaveBeenCalledWith(BOARD_BUNDLE_SELECT)
    expect(Sentry.captureException).toHaveBeenCalledWith(embedError, {
      extra: { context: 'getBoardBundle embed', boardId: BOARD_ID },
    })
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })
})

describe('getBoardBundle() card cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('reads the cards past the first 1000, so the page does not count a cut-off board', async () => {
    // Arrange: the embed is full, and the follow-up read has one more card
    const boardQuery = queryResolving({
      data: {
        id: BOARD_ID,
        name: 'Capped',
        user_id: OWNER_ID,
        statuslist: [ONE_COLUMN],
        repocard: embeddedCards(POSTGREST_MAX_ROWS),
      },
      error: null,
    })
    const extraCard = {
      ...embeddedCards(1)[0],
      id: '00000000-0000-0000-0000-000000001000',
      repo_name: 'past-the-cap',
      order: 1000,
    }
    const cardPages = [embeddedCards(POSTGREST_MAX_ROWS), [extraCard]]
    let cardPage = 0
    const cardQuery = {
      select: () => cardQuery,
      eq: () => cardQuery,
      order: () => cardQuery,
      range: async () => {
        const page = cardPages[cardPage] ?? []
        cardPage += 1
        return Promise.resolve({ data: page, error: null })
      },
    }
    const from = vi.fn((table: string) =>
      table === 'repocard' ? cardQuery : boardQuery,
    )
    vi.mocked(getCachedClaims).mockResolvedValueOnce({
      supabase: { from },
      claims: { sub: OWNER_ID },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const bundle = await getBoardBundle(BOARD_ID)

    // Assert
    expect(from).toHaveBeenCalledWith('repocard')
    expect(bundle?.repoCards.map((card) => card.repoName)).toContain(
      'past-the-cap',
    )
    expect(bundle?.repoCards).toHaveLength(1001)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(createDefaultStatusLists).not.toHaveBeenCalled()
  })

  test('reads the columns past the first 1000', async () => {
    // Arrange
    const columns = Array.from({ length: POSTGREST_MAX_ROWS }, (_, index) => ({
      ...ONE_COLUMN,
      id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      name: `Column ${index}`,
      grid_col: index,
    }))
    const boardQuery = queryResolving({
      data: {
        id: BOARD_ID,
        name: 'Many columns',
        user_id: OWNER_ID,
        statuslist: columns,
        repocard: [],
      },
      error: null,
    })
    const extraColumn = {
      ...ONE_COLUMN,
      id: '00000000-0000-0000-0000-000000001000',
      name: 'Past the cap',
      grid_col: 1000,
    }
    const columnPages = [columns, [extraColumn]]
    let columnPage = 0
    const columnQuery = {
      select: () => columnQuery,
      eq: () => columnQuery,
      order: () => columnQuery,
      range: async () => {
        const page = columnPages[columnPage] ?? []
        columnPage += 1
        return Promise.resolve({ data: page, error: null })
      },
    }
    vi.mocked(getCachedClaims).mockResolvedValueOnce({
      supabase: {
        from: vi.fn((table: string) =>
          table === 'statuslist' ? columnQuery : boardQuery,
        ),
      },
      claims: { sub: OWNER_ID },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const bundle = await getBoardBundle(BOARD_ID)

    // Assert
    expect(bundle?.statusLists.map((column) => column.title)).toContain(
      'Past the cap',
    )
    expect(bundle?.statusLists).toHaveLength(1001)
  })

  test('throws when the page of cards does not advance, so a cut-off board is not shown', async () => {
    // Arrange
    const boardQuery = queryResolving({
      data: {
        id: BOARD_ID,
        name: 'Stuck',
        user_id: OWNER_ID,
        statuslist: [ONE_COLUMN],
        repocard: embeddedCards(POSTGREST_MAX_ROWS),
      },
      error: null,
    })
    const stuck = embeddedCards(POSTGREST_MAX_ROWS)
    const cardQuery = {
      select: () => cardQuery,
      eq: () => cardQuery,
      order: () => cardQuery,
      range: async () => Promise.resolve({ data: stuck, error: null }),
    }
    vi.mocked(getCachedClaims).mockResolvedValueOnce({
      supabase: {
        from: vi.fn((table: string) =>
          table === 'repocard' ? cardQuery : boardQuery,
        ),
      },
      claims: { sub: OWNER_ID },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const bundle = getBoardBundle(BOARD_ID)

    // Assert
    await expect(bundle).rejects.toThrow('Failed to fetch board bundle')
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  test('stays on the embed when it returns 999 cards', async () => {
    // Arrange
    const boardQuery = queryResolving({
      data: {
        id: BOARD_ID,
        name: 'Under the cap',
        user_id: OWNER_ID,
        statuslist: [ONE_COLUMN],
        repocard: embeddedCards(POSTGREST_MAX_ROWS - 1),
      },
      error: null,
    })
    const from = vi.fn(() => boardQuery)
    vi.mocked(getCachedClaims).mockResolvedValueOnce({
      supabase: { from },
      claims: { sub: OWNER_ID },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const bundle = await getBoardBundle(BOARD_ID)

    // Assert
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('board')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(bundle?.repoCards).toHaveLength(999)
  })
})
