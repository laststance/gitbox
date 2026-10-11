/**
 * Unit Tests: createBoard() and createFirstBoardIfNeeded()
 *
 * Both create a board through the `create_board_with_status_lists` database
 * function, which writes the board and its columns in one transaction. These
 * tests cover the app's side of that call: what it sends, what it hands back,
 * and what the user reads when the database refuses. That the function keeps
 * the column order and leaves no board behind on a refusal is covered against
 * a real database in e2e/logged-in/create-board.spec.ts.
 *
 * @see src/lib/actions/board.ts
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createBoard, createFirstBoardIfNeeded } from '@/lib/actions/board'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

/** The database function call; each test sets its answer. */
const callDatabaseFunction = vi.fn()
/** A direct table write, which board creation must never make. */
const insertRow = vi.fn()
/** Number of boards the signed-in user already has (first-board check). */
let existingBoardCount = 0

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
 * Stand-in for the Supabase client: `rpc` is the database function, and a
 * table can only be counted (the first-board check) or written through the
 * `insertRow` spy.
 */
const supabaseStub = {
  rpc: callDatabaseFunction,
  from: () => ({
    select: () => ({
      eq: async () => ({ count: existingBoardCount, error: null }),
    }),
    insert: insertRow,
  }),
}

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
    existingBoardCount = 0
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
      },
    })
  })

  test('does not invite a second try when the board exists but its answer cannot be read', async () => {
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
      error: 'An unexpected error occurred',
    })
  })

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
    const result = await createBoard('Archive', unknownPresetId)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Invalid preset selection',
    })
    expect(callDatabaseFunction).not.toHaveBeenCalled()
  })
})

describe('createFirstBoardIfNeeded()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existingBoardCount = 0
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
    const firstBoard = await createFirstBoardIfNeeded('user-1')

    // Assert
    expect(callDatabaseFunction).toHaveBeenCalledTimes(1)
    expect(callDatabaseFunction).toHaveBeenCalledWith(
      'create_board_with_status_lists',
      {
        p_name: 'First Board',
        p_columns: [
          { name: 'Pending', color: '#8B7355' },
          { name: 'Planning', color: '#6B8E23' },
          { name: 'Focus Development', color: '#CD853F' },
          { name: 'MVP Release', color: '#4682B4' },
          { name: 'Production Release', color: '#556B2F' },
        ],
      },
    )
    expect(insertRow).not.toHaveBeenCalled()
    expect(firstBoard).toEqual({ id: 'board-1', name: 'First Board' })
  })

  test('leaves a user who already has a board without a second one', async () => {
    // Arrange
    existingBoardCount = 1

    // Act
    const firstBoard = await createFirstBoardIfNeeded('user-1')

    // Assert
    expect(firstBoard).toBeNull()
    expect(callDatabaseFunction).not.toHaveBeenCalled()
  })

  test('lets the sign-in continue and reports the failure when the first board cannot be created', async () => {
    // Arrange
    const databaseError = { code: '42501', message: 'permission denied' }
    callDatabaseFunction.mockResolvedValue({ data: null, error: databaseError })

    // Act
    const firstBoard = await createFirstBoardIfNeeded('user-1')

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
})
