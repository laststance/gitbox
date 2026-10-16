/**
 * Unit Tests: getUserBoardsWithStatusLists()
 *
 * The action lists the boards a card can be moved to, with their columns, for
 * the Move to Another Board dialog. The order of the boards (newest first)
 * and the order of a board's columns are read against a real database in
 * `e2e/logged-in/move-to-another-board.spec.ts`.
 * These tests cover what that spec does not reach: the shape the dialog gets
 * for a board without columns, and what the action does when the database
 * cannot answer. The stand-in below ignores filters and sort order, so
 * neither test says anything about an order.
 *
 * @see src/lib/actions/repo-cards.ts
 * @see src/hooks/board/useMoveDestinations.ts
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getUserBoardsWithStatusLists } from '@/lib/actions/repo-cards'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

type QueryAnswer = {
  data: unknown
  error: { code?: string; message: string } | null
}

/**
 * Stand-in for a PostgREST query builder: whatever filter or order is put on
 * it, awaiting it yields `answer`, as the real builder does.
 * @param answer - What the database answers to this read.
 * @returns A builder that is awaitable.
 */
function makeQuery(answer: QueryAnswer) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    range: () => query,
    then: (resolve: (value: QueryAnswer) => unknown) => resolve(answer),
  }
  return query
}

/**
 * Signs in as `user-1` with a Supabase stub that answers the two reads of the
 * action: the boards of the user, then the columns of those boards.
 * @param answers - The answer of the `board` read and of the `statuslist` read.
 */
function signInWithBoardsAndColumns(answers: {
  board: QueryAnswer
  statuslist: QueryAnswer
}): void {
  const from = vi.fn((table: string) => {
    if (table === 'board') return makeQuery(answers.board)
    if (table === 'statuslist') return makeQuery(answers.statuslist)
    throw new Error(`Unexpected table read: ${table}`)
  })

  vi.mocked(getCachedClaims).mockResolvedValue({
    supabase: { from },
    claims: { sub: 'user-1' },
  } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
}

describe('getUserBoardsWithStatusLists()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=a board without columns reaches the move dialog as the dialog expects it; fails_when=the board is dropped or the empty column list becomes undefined; why_new=only e2e reads this action and it has no board without columns; seam=none; no_claim=real ordering and RLS (stubbed client; e2e move-to-another-board.spec.ts covers them)
  test('hands the dialog every board of the user, a board without columns included, with its columns in the order the database sent', async () => {
    // Arrange: Archive is newest, Work has two columns of which the
    // second has no color, Empty has no column at all
    signInWithBoardsAndColumns({
      board: {
        data: [
          { id: 'board-archive', name: 'Archive' },
          { id: 'board-work', name: 'Work' },
          { id: 'board-empty', name: 'Empty' },
        ],
        error: null,
      },
      statuslist: {
        data: [
          {
            id: 'status-inbox',
            name: 'Inbox',
            color: '#2563EB',
            board_id: 'board-archive',
          },
          {
            id: 'status-doing',
            name: 'Doing',
            color: '#16A34A',
            board_id: 'board-work',
          },
          {
            id: 'status-done',
            name: 'Done',
            color: null,
            board_id: 'board-work',
          },
        ],
        error: null,
      },
    })

    // Act
    const result = await getUserBoardsWithStatusLists()

    // Assert
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 'board-archive',
          name: 'Archive',
          statusLists: [
            { id: 'status-inbox', name: 'Inbox', color: '#2563EB' },
          ],
        },
        {
          id: 'board-work',
          name: 'Work',
          statusLists: [
            { id: 'status-doing', name: 'Doing', color: '#16A34A' },
            { id: 'status-done', name: 'Done', color: '#6B7280' },
          ],
        },
        {
          id: 'board-empty',
          name: 'Empty',
          statusLists: [],
        },
      ],
    })
  })

  // Value: protects=a read of boards or of columns that fails ends in the dialog's "Try again", never in boards offered without their columns; fails_when=a read error is ignored and the list is built from nothing; why_new=no test reaches the two error branches of this action; seam=none; no_claim=the wording the dialog shows for the failure (the dialog test mocks this action)
  test.each([
    {
      unreadable: 'boards',
      board: {
        data: null,
        error: { code: '42501', message: 'permission denied for table board' },
      },
      statuslist: { data: [], error: null },
    },
    {
      unreadable: 'columns',
      board: {
        data: [{ id: 'board-work', name: 'Work' }],
        error: null,
      },
      statuslist: {
        data: null,
        error: { code: '57014', message: 'canceling statement' },
      },
    },
  ])(
    'fails with the generic message and reports it when the $unreadable of the user cannot be read, so the dialog offers "Try again" and not boards without columns',
    async ({ board, statuslist }) => {
      // Arrange
      signInWithBoardsAndColumns({ board, statuslist })

      // Act
      const result = await getUserBoardsWithStatusLists()

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred',
      })
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    },
  )

  test('loads columns past the first 1000, so a board is not offered without the rest', async () => {
    // Arrange: one board, then a full page of columns and one more
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `status-${index}`,
      name: `Column ${index}`,
      color: '#6B7280',
      board_id: 'board-work',
    }))
    const secondPage = [
      {
        id: 'status-1000',
        name: 'Past the cap',
        color: '#111111',
        board_id: 'board-work',
      },
    ]
    const pages = [firstPage, secondPage]
    let statusPage = 0
    const boardQuery = {
      select: () => boardQuery,
      eq: () => boardQuery,
      order: () => boardQuery,
      range: async () =>
        Promise.resolve({
          data: [{ id: 'board-work', name: 'Work' }],
          error: null,
        }),
    }
    const statusQuery = {
      select: () => statusQuery,
      in: () => statusQuery,
      order: () => statusQuery,
      range: async () => {
        const page = pages[statusPage] ?? []
        statusPage += 1
        return Promise.resolve({ data: page, error: null })
      },
    }
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: {
        from: (table: string) =>
          table === 'statuslist' ? statusQuery : boardQuery,
      },
      claims: { sub: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)

    // Act
    const result = await getUserBoardsWithStatusLists()

    // Assert
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data[0]?.statusLists).toHaveLength(1001)
    expect(result.data[0]?.statusLists[1000]).toEqual({
      id: 'status-1000',
      name: 'Past the cap',
      color: '#111111',
    })
  })
})
