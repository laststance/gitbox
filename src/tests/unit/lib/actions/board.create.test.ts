/**
 * Unit Tests: createBoard(), createFirstBoardIfNeeded() and
 * createDefaultStatusLists()
 *
 * createBoard() writes through `create_board_with_status_lists`, and
 * createFirstBoardIfNeeded() through `create_first_board_if_needed`. Both
 * write the board and its columns in one transaction. These tests cover the
 * app's side of that call: what it sends, what it hands back, and what the
 * user reads when the database refuses, does not answer or answers in a
 * shape the app cannot read. Which functions a browser can call is pinned in
 * browser-callable-actions.test.ts.
 *
 * createDefaultStatusLists() is the repair for a board found without columns
 * (its last column was deleted, or it is older than the database function).
 * It calls `ensure_default_status_lists`, which inserts only while the board
 * still has none.
 *
 * What the function itself does is covered against a real database: the
 * column order through the page in e2e/logged-in/create-board.spec.ts, the
 * refusals and who may call it in
 * e2e/logged-in/board-creation-data-access.spec.ts.
 *
 * @see src/lib/actions/board.ts
 * @see src/lib/actions/board-creation.ts
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createBoard } from '@/lib/actions/board'
import {
  createDefaultStatusLists,
  createFirstBoardIfNeeded,
} from '@/lib/actions/board-creation'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import type { Database } from '@/lib/supabase/types'

/** The database function call; each test sets its answer. */
const callDatabaseFunction = vi.fn()
/**
 * A direct table write. Creating a board, the first board and the default
 * columns all go through a database function, so nothing here may insert.
 */
const insertRow = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

/**
 * Stand-in for the Supabase client: `rpc` is the database function. A table
 * write would be the old path, where two requests could both insert.
 */
const supabaseStub = {
  rpc: callDatabaseFunction,
  from: () => ({
    insert: insertRow,
  }),
}

/**
 * The stub as the client of the session the OAuth callback just established.
 * Cast: the stub implements only what board creation calls.
 */
const sessionClient = supabaseStub as unknown as SupabaseClient<Database>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseStub),
}))

/** Answer of the database function for a board with one column. */
const SINGLE_COLUMN_BOARD_ROW = {
  id: 'board-1',
  name: 'Archive',
  status_lists: [{ id: 'status-1', name: 'Repositories', color: '#6B7280' }],
}

describe('createBoard()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The stub implements only what board creation calls
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: supabaseStub,
      claims: { sub: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
  })

  test('creates the board of the move dialog with its one column "Repositories" and returns that column', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: SINGLE_COLUMN_BOARD_ROW,
      error: null,
    })

    // Act
    const result = await createBoard('Archive', 'single-column')

    // Assert
    expect(callDatabaseFunction).toHaveBeenCalledTimes(1)
    expect(callDatabaseFunction).toHaveBeenCalledWith(
      'create_board_with_status_lists',
      {
        p_name: 'Archive',
        p_columns: [{ name: 'Repositories', color: '#6B7280' }],
      },
    )
    expect(insertRow).not.toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      data: {
        id: 'board-1',
        name: 'Archive',
        statusLists: [
          { id: 'status-1', name: 'Repositories', color: '#6B7280' },
        ],
      },
    })
  })

  test('sends the columns of the chosen preset in the order the preset lists them', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: SINGLE_COLUMN_BOARD_ROW,
      error: null,
    })

    // Act
    await createBoard('Web', 'web-app')

    // Assert
    expect(callDatabaseFunction).toHaveBeenCalledWith(
      'create_board_with_status_lists',
      {
        p_name: 'Web',
        p_columns: [
          { name: 'Frontend', color: '#3B82F6' },
          { name: 'Backend', color: '#10B981' },
          { name: 'Fullstack', color: '#8B5CF6' },
          { name: 'Library', color: '#F59E0B' },
          { name: 'Infrastructure', color: '#6366F1' },
        ],
      },
    )
  })

  test('stores the board name without the spaces typed around it', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: SINGLE_COLUMN_BOARD_ROW,
      error: null,
    })

    // Act
    await createBoard('  Side Projects  ', 'single-column')

    // Assert
    expect(callDatabaseFunction).toHaveBeenCalledWith(
      'create_board_with_status_lists',
      {
        p_name: 'Side Projects',
        p_columns: [{ name: 'Repositories', color: '#6B7280' }],
      },
    )
  })

  test('tells the user to try again when the database did not create the board', async () => {
    // Arrange
    const databaseError = { code: '23514', message: 'check violation' }
    callDatabaseFunction.mockResolvedValue({ data: null, error: databaseError })

    // Act
    const result = await createBoard('Archive', 'single-column')

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'The board was not created. Try again.',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: {
        context: 'createBoard: create_board_with_status_lists',
        presetId: 'single-column',
        status: 'not-created',
      },
    })
  })

  test('does not promise that nothing was written when the database gave no answer', async () => {
    // Arrange: the request was lost on the way, as the Supabase client
    // reports it. The board may exist all the same.
    callDatabaseFunction.mockResolvedValue({
      data: null,
      error: {
        message: 'TypeError: fetch failed',
        details: '',
        hint: '',
        code: '',
      },
      status: 0,
    })

    // Act
    const result = await createBoard('Archive', 'single-column')

    // Assert
    expect(result).toEqual({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(
      { message: 'TypeError: fetch failed', details: '', hint: '', code: '' },
      {
        extra: {
          context: 'createBoard: create_board_with_status_lists',
          presetId: 'single-column',
          status: 'unconfirmed',
        },
      },
    )
  })

  test('does not promise that nothing was written when the call to the database throws', async () => {
    // Arrange: the request may be on its way when this happens
    const thrownError = new Error('socket hang up')
    callDatabaseFunction.mockRejectedValue(thrownError)

    // Act
    const result = await createBoard('Archive', 'single-column')

    // Assert
    expect(result).toEqual({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(thrownError, {
      extra: {
        context: 'createBoard: create_board_with_status_lists',
        presetId: 'single-column',
        status: 'unconfirmed',
      },
    })
  })

  test('sends the user to their boards, not to a second try, when the board exists but its answer cannot be read', async () => {
    // Arrange: the call succeeded, so the board was created; the answer lacks its columns
    callDatabaseFunction.mockResolvedValue({
      data: { id: 'board-1', name: 'Archive' },
      error: null,
    })

    // Act
    const result = await createBoard('Archive', 'single-column')

    // Assert
    expect(result).toEqual({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ZodError' }),
      {
        extra: {
          context: 'createBoard: create_board_with_status_lists',
          presetId: 'single-column',
          status: 'unreadable',
        },
      },
    )
  })

  test.each([
    { shape: 'has an empty list of columns', statusLists: [] },
    { shape: 'has no list of columns', statusLists: null },
    {
      shape: 'has a column without a color',
      statusLists: [{ id: 'status-1', name: 'Repositories' }],
    },
  ])(
    'does not hand back a board the page could not show when the answer of the database $shape',
    async ({ statusLists }) => {
      // Arrange: the call succeeded, so a board exists
      callDatabaseFunction.mockResolvedValue({
        data: { id: 'board-1', name: 'Archive', status_lists: statusLists },
        error: null,
      })

      // Act
      const result = await createBoard('Archive', 'single-column')

      // Assert
      expect(result).toEqual({
        success: false,
        error:
          'Could not confirm that the board was created. Check your boards before trying again.',
        errorCode: 'BOARD_CREATION_UNCONFIRMED',
      })
    },
  )

  test('refuses an empty board name before anything is sent to the database', async () => {
    // Arrange
    const emptyName = '   '

    // Act
    const result = await createBoard(emptyName, 'single-column')

    // Assert
    expect(result).toEqual({ success: false, error: 'Board name is required' })
    expect(callDatabaseFunction).not.toHaveBeenCalled()
  })

  test('refuses a preset the server does not know', async () => {
    // Arrange
    const unknownPresetId = 'blank'

    // Act
    // @ts-expect-error a browser can send a preset id the types do not allow
    const result = await createBoard('Archive', unknownPresetId)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Invalid preset selection',
    })
    expect(callDatabaseFunction).not.toHaveBeenCalled()
  })
})

/** The five columns of the Software Release preset, in preset order. */
const SOFTWARE_RELEASE_COLUMNS = [
  { name: 'Pending', color: '#8B7355' },
  { name: 'Planning', color: '#6B8E23' },
  { name: 'Focus Development', color: '#CD853F' },
  { name: 'MVP Release', color: '#4682B4' },
  { name: 'Production Release', color: '#556B2F' },
]

describe('createFirstBoardIfNeeded()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('gives a user without boards a "First Board" with the five default columns', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: {
        id: 'board-1',
        name: 'First Board',
        status_lists: [
          { id: 'status-1', name: 'Pending', color: '#8B7355' },
          { id: 'status-2', name: 'Planning', color: '#6B8E23' },
          { id: 'status-3', name: 'Focus Development', color: '#CD853F' },
          { id: 'status-4', name: 'MVP Release', color: '#4682B4' },
          { id: 'status-5', name: 'Production Release', color: '#556B2F' },
        ],
      },
      error: null,
    })

    // Act
    const firstBoard = await createFirstBoardIfNeeded(sessionClient, 'user-1')

    // Assert: the count of boards is the database function's, under its lock
    expect(callDatabaseFunction).toHaveBeenCalledTimes(1)
    expect(callDatabaseFunction).toHaveBeenCalledWith(
      'create_first_board_if_needed',
      {
        p_name: 'First Board',
        p_columns: SOFTWARE_RELEASE_COLUMNS,
      },
    )
    expect(insertRow).not.toHaveBeenCalled()
    expect(firstBoard).toEqual({ id: 'board-1', name: 'First Board' })
  })

  test('leaves a user who already has a board without a second one', async () => {
    // Arrange: the function found a board and wrote nothing
    callDatabaseFunction.mockResolvedValue({ data: null, error: null })

    // Act
    const firstBoard = await createFirstBoardIfNeeded(sessionClient, 'user-1')

    // Assert
    expect(firstBoard).toBeNull()
    expect(callDatabaseFunction).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(insertRow).not.toHaveBeenCalled()
  })

  test('lets the sign-in continue and reports the failure when the first board cannot be created', async () => {
    // Arrange
    const databaseError = { code: '42501', message: 'permission denied' }
    callDatabaseFunction.mockResolvedValue({ data: null, error: databaseError })

    // Act
    const firstBoard = await createFirstBoardIfNeeded(sessionClient, 'user-1')

    // Assert
    expect(firstBoard).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: {
        context: 'Create first board',
        userId: 'user-1',
        status: 'not-created',
      },
    })
  })

  test('lets the sign-in continue and reports it when the database gave no answer about the first board', async () => {
    // Arrange: the request was lost on the way
    const lostRequest = {
      message: 'TypeError: fetch failed',
      details: '',
      hint: '',
      code: '',
    }
    callDatabaseFunction.mockResolvedValue({ data: null, error: lostRequest })

    // Act
    const firstBoard = await createFirstBoardIfNeeded(sessionClient, 'user-1')

    // Assert
    expect(firstBoard).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(lostRequest, {
      extra: {
        context: 'Create first board',
        userId: 'user-1',
        status: 'unconfirmed',
      },
    })
  })

  test('lets the sign-in continue and reports it when the call throws', async () => {
    // Arrange: the session is set by now; a rejection here would send the
    // user back to the login page
    const thrownError = new Error('socket hang up')
    callDatabaseFunction.mockRejectedValueOnce(thrownError)

    // Act
    const firstBoard = await createFirstBoardIfNeeded(sessionClient, 'user-1')

    // Assert
    expect(firstBoard).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(thrownError, {
      extra: {
        context: 'Create first board: unexpected failure',
        userId: 'user-1',
      },
    })
  })

  test('lets the sign-in continue when the database answers the first board with a number as its code', async () => {
    // Arrange: JSON of a gateway, not of the database
    const gatewayError = { code: 502, message: 'Bad Gateway' }
    callDatabaseFunction.mockResolvedValue({ data: null, error: gatewayError })

    // Act
    const firstBoard = await createFirstBoardIfNeeded(sessionClient, 'user-1')

    // Assert
    expect(firstBoard).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(gatewayError, {
      extra: {
        context: 'Create first board',
        userId: 'user-1',
        status: 'unconfirmed',
      },
    })
  })

  test('lets the sign-in continue and reports it when the answer about the first board cannot be read', async () => {
    // Arrange: the board was created; the answer lacks its columns
    callDatabaseFunction.mockResolvedValue({
      data: { id: 'board-1', name: 'First Board' },
      error: null,
    })

    // Act
    const firstBoard = await createFirstBoardIfNeeded(sessionClient, 'user-1')

    // Assert
    expect(firstBoard).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ZodError' }),
      {
        extra: {
          context: 'Create first board',
          userId: 'user-1',
          status: 'unreadable',
        },
      },
    )
  })
})

describe('createDefaultStatusLists()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('gives a board without columns the five default columns, side by side in one row', async () => {
    // Arrange: the database answers with the columns it kept
    const writtenRows = SOFTWARE_RELEASE_COLUMNS.map((column, index) => ({
      id: `status-${index + 1}`,
      board_id: 'board-1',
      name: column.name,
      color: column.color,
      order: index,
      grid_row: 0,
      grid_col: index,
      created_at: '2026-01-01T00:00:00+00:00',
      updated_at: '2026-01-01T00:00:00+00:00',
    }))
    callDatabaseFunction.mockResolvedValue({ data: writtenRows, error: null })

    // Act
    const columns = await createDefaultStatusLists('board-1')

    // Assert: the function places each column. The app sends names and
    // colors only; the cells are the database's.
    expect(callDatabaseFunction).toHaveBeenCalledWith(
      'ensure_default_status_lists',
      {
        p_board_id: 'board-1',
        p_columns: SOFTWARE_RELEASE_COLUMNS,
      },
    )
    expect(insertRow).not.toHaveBeenCalled()
    expect(columns.map((column) => [column.title, column.gridCol])).toEqual([
      ['Pending', 0],
      ['Planning', 1],
      ['Focus Development', 2],
      ['MVP Release', 3],
      ['Production Release', 4],
    ])
  })

  test('reports the failure and stops the page when the columns cannot be written', async () => {
    // Arrange
    const databaseError = { code: '42501', message: 'permission denied' }
    callDatabaseFunction.mockResolvedValue({ data: null, error: databaseError })

    // Act
    const creation = createDefaultStatusLists('board-1')

    // Assert
    await expect(creation).rejects.toThrow('Failed to create status lists')
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: { context: 'Create default status lists', boardId: 'board-1' },
    })
  })

  test('stops the page when the answer about the columns cannot be read', async () => {
    // Arrange: the call succeeded and named no column
    callDatabaseFunction.mockResolvedValue({ data: [], error: null })

    // Act
    const creation = createDefaultStatusLists('board-1')

    // Assert
    await expect(creation).rejects.toThrow('Failed to create status lists')
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ZodError' }),
      {
        extra: { context: 'Create default status lists', boardId: 'board-1' },
      },
    )
    expect(insertRow).not.toHaveBeenCalled()
  })
})
