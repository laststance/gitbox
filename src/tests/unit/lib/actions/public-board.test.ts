/**
 * Unit Tests: getPublicBoardBySlug()
 *
 * The public board page is served to anyone with the link. Row level security
 * shows a board to its owner only, so the page reads through the
 * `get_public_board(p_slug)` database function. These tests cover the app's
 * side of that call: what it asks for, what it hands to the page, and that
 * the owner's account id never gets through even if the database sent it.
 * What the function itself returns is covered against a real database in
 * e2e/unauthenticated/public-board-data-access.spec.ts.
 *
 * @see src/lib/actions/public-board.ts
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getPublicBoardBySlug } from '@/lib/actions/public-board'
import { toPublicBoardSlug } from '@/lib/types/brands'

/** The database function call the action makes; each test sets its answer. */
const callDatabaseFunction = vi.fn()
/** A direct table query, which the action must never make. */
const queryTable = vi.fn()

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc: callDatabaseFunction,
    from: queryTable,
  })),
}))

describe('getPublicBoardBySlug()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('loads a shared board with its columns and cards through the slug lookup', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: {
        board: { name: 'Shared board', subtitle: null },
        statuslist: [
          {
            id: 'status-1',
            board_id: 'board-1',
            name: 'To Do',
            color: '#6B7280',
            order: 0,
            grid_row: 0,
            grid_col: 0,
            created_at: '2026-01-01T00:00:00+00:00',
            updated_at: '2026-01-01T00:00:00+00:00',
          },
        ],
        repocard: [
          {
            id: 'card-1',
            board_id: 'board-1',
            status_id: 'status-1',
            repo_owner: 'laststance',
            repo_name: 'gitbox',
            order: 0,
            meta: null,
            created_at: '2026-01-01T00:00:00+00:00',
            updated_at: '2026-01-01T00:00:00+00:00',
          },
        ],
      },
      error: null,
    })

    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('a1b2c3d4e5f6'),
    )

    // Assert
    expect(callDatabaseFunction).toHaveBeenCalledTimes(1)
    expect(callDatabaseFunction).toHaveBeenCalledWith('get_public_board', {
      p_slug: 'a1b2c3d4e5f6',
    })
    expect(queryTable).not.toHaveBeenCalled()
    expect(publicBoard?.board).toEqual({
      name: 'Shared board',
      subtitle: null,
    })
    expect(publicBoard?.statusLists.map((column) => column.title)).toEqual([
      'To Do',
    ])
    expect(publicBoard?.repoCards.map((card) => card.title)).toEqual([
      'laststance/gitbox',
    ])
  })

  // Value: protects=the owner's account id never reaches a visitor of a
  // shared board; fails_when=the action passes the database answer through
  // without checking it against the schema; why_new=the database function is
  // the first guard, and a later edit to it could add the column back;
  // seam=none; no_claim=what the real function returns (client mocked)
  test("does not hand the owner's account id to the page even when the database sends it", async () => {
    // Arrange: a database answer that carries user_id on the board and a card
    callDatabaseFunction.mockResolvedValue({
      data: {
        board: {
          id: 'board-1',
          user_id: '00000000-0000-0000-0000-000000000002',
          name: 'Shared board',
          subtitle: null,
          created_at: null,
          updated_at: null,
          is_public: true,
          share_slug: 'a1b2c3d4e5f6',
          settings: {},
        },
        statuslist: [],
        repocard: [
          {
            id: 'card-1',
            user_id: '00000000-0000-0000-0000-000000000002',
            board_id: 'board-1',
            status_id: 'status-1',
            repo_owner: 'laststance',
            repo_name: 'gitbox',
            order: 0,
            meta: null,
            created_at: '2026-01-01T00:00:00+00:00',
            updated_at: '2026-01-01T00:00:00+00:00',
          },
        ],
      },
      error: null,
    })

    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('a1b2c3d4e5f6'),
    )

    // Assert
    expect(publicBoard?.repoCards.map((card) => card.title)).toEqual([
      'laststance/gitbox',
    ])
    expect(JSON.stringify(publicBoard)).not.toContain(
      '00000000-0000-0000-0000-000000000002',
    )
    expect(JSON.stringify(publicBoard)).not.toContain('user_id')
  })

  test('shows a column in the default color when its stored color is not #RRGGBB, so the value never reaches the page of a visitor', async () => {
    // Arrange: a color that carries CSS declarations. The table refuses such
    // a value; this is the second guard, for a row the check never saw.
    callDatabaseFunction.mockResolvedValue({
      data: {
        board: { name: 'Shared board', subtitle: null },
        statuslist: [
          {
            id: 'status-1',
            board_id: 'board-1',
            name: 'To Do',
            color: 'red; position: fixed; inset: 0',
            order: 0,
            grid_row: 0,
            grid_col: 0,
            created_at: '2026-01-01T00:00:00+00:00',
            updated_at: '2026-01-01T00:00:00+00:00',
          },
          {
            id: 'status-2',
            board_id: 'board-1',
            name: 'Done',
            color: '#10B981',
            order: 1,
            grid_row: 0,
            grid_col: 1,
            created_at: '2026-01-01T00:00:00+00:00',
            updated_at: '2026-01-01T00:00:00+00:00',
          },
        ],
        repocard: [],
      },
      error: null,
    })

    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('a1b2c3d4e5f6'),
    )

    // Assert: the board is still shown, and only the bad color is replaced
    expect(
      publicBoard?.statusLists.map((column) => [column.title, column.color]),
    ).toEqual([
      ['To Do', '#6B7280'],
      ['Done', '#10B981'],
    ])
    expect(JSON.stringify(publicBoard)).not.toContain('position: fixed')
  })

  // Value: protects=a stored color that begins as #RRGGBB and goes on with CSS declarations never reaches the page of a visitor; fails_when=the second guard of the shared board accepts a value for its first seven characters; why_new=the test above stores a color without any #RRGGBB, which a pattern without an end anchor refuses too; seam=none; no_claim=none
  test('shows a column in the default color when its stored color only begins as #RRGGBB', async () => {
    // Arrange: a row the check constraint of the table never saw
    callDatabaseFunction.mockResolvedValue({
      data: {
        board: { name: 'Shared board', subtitle: null },
        statuslist: [
          {
            id: 'status-1',
            board_id: 'board-1',
            name: 'To Do',
            color: '#a1b2c3; position: fixed; inset: 0',
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
    })

    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('a1b2c3d4e5f6'),
    )

    // Assert
    expect(
      publicBoard?.statusLists.map((column) => [column.title, column.color]),
    ).toEqual([['To Do', '#6B7280']])
    expect(JSON.stringify(publicBoard)).not.toContain('position: fixed')
  })

  test('shows no board for a slug no public board has', async () => {
    // Arrange: the function answers null for unknown and for private boards
    callDatabaseFunction.mockResolvedValue({ data: null, error: null })

    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('aabbccddeeff'),
    )

    // Assert
    expect(publicBoard).toBeNull()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('shows no board and reports it when the lookup fails', async () => {
    // Arrange
    const lookupError = { code: 'PGRST202', message: 'function not found' }
    callDatabaseFunction.mockResolvedValue({ data: null, error: lookupError })

    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('a1b2c3d4e5f6'),
    )

    // Assert
    expect(publicBoard).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(lookupError, {
      extra: {
        context: 'Public board: get_public_board',
        slug: 'a1b2c3d4e5f6',
      },
    })
  })

  test('shows no board and reports it when the database answers in an unexpected shape', async () => {
    // Arrange: a board without its columns and cards
    callDatabaseFunction.mockResolvedValue({
      data: { board: { id: 'board-1', name: 'Shared board' } },
      error: null,
    })

    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('a1b2c3d4e5f6'),
    )

    // Assert
    expect(publicBoard).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  test('does not ask the database about a slug that is not 12 hex characters', async () => {
    // Act
    const publicBoard = await getPublicBoardBySlug(
      toPublicBoardSlug('invalid-slug'),
    )

    // Assert
    expect(publicBoard).toBeNull()
    expect(callDatabaseFunction).not.toHaveBeenCalled()
  })
})
