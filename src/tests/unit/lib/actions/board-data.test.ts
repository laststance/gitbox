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
 * Out of scope here (and why): the embed query, RLS, and truncation branches
 * all depend on a live Supabase + PostgREST — they are covered by E2E (board
 * rendering, board-not-found.spec.ts).
 *
 * @see src/lib/actions/board-data.ts
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

import { createDefaultStatusLists } from '@/lib/actions/board-creation'
import { getBoardBundle } from '@/lib/actions/board-data'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { toBoardId, toStatusListId } from '@/lib/types/brands'

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
