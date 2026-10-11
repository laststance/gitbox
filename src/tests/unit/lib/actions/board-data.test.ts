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
 * Out of scope here (and why): the embed query, RLS, and truncation branches
 * all depend on a live Supabase + PostgREST — they are covered by E2E (board
 * rendering, board-not-found.spec.ts).
 *
 * @see src/lib/actions/board-data.ts
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

import { getBoardBundle } from '@/lib/actions/board-data'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

// getClaims is the real session check in production; here it reports no session.
vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(async () => null),
}))

// The timing log reads a server-only env flag, which the browser-like test
// environment refuses to hand out.
vi.mock('@/lib/utils/board-timing', () => ({
  logBoardTiming: vi.fn(),
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
