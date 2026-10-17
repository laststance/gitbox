/**
 * Unit Tests: a column position the table would refuse
 *
 * createStatusList, updateStatusListPosition and batchUpdateStatusListPositions
 * answer with a sentence when the column would sit past row or column 999.
 * The table check is asked directly in
 * e2e/logged-in/column-grid-position-data-access.spec.ts.
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  batchUpdateStatusListPositions,
  createStatusList,
  updateStatusListPosition,
} from '@/lib/actions/board'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

const from = vi.fn()
const callDatabaseFunction = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

const GRID_REFUSAL = 'A column cannot sit past row 999 or column 999.'

const GRID_CONSTRAINT_ERROR = {
  code: '23514',
  message:
    'new row for relation "statuslist" violates check constraint "statuslist_grid_position_bounds"',
}

/**
 * The read of the furthest column in the first row.
 * @param gridCol - Furthest column, or null when the row is empty.
 */
function readFurthestColumn(gridCol: number | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: gridCol === null ? null : { grid_col: gridCol },
      error: null,
    })),
    insert: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  return query
}

describe('column positions past 999', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: { from, rpc: callDatabaseFunction },
      claims: { sub: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
  })

  test('refuses a new column when the first row already ends at column 999', async () => {
    // Arrange
    const read = readFurthestColumn(999)
    from.mockReturnValue(read)

    // Act
    const result = await createStatusList('board-1', 'Later', '#6B7280')

    // Assert
    expect(result).toEqual({ success: false, error: GRID_REFUSAL })
    expect(read.insert).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('answers with the same sentence when the table refuses the new column', async () => {
    // Arrange: the app's own check let the column through, and the table did not
    const read = readFurthestColumn(0)
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: null, error: GRID_CONSTRAINT_ERROR }),
      }),
    }))
    from.mockReturnValueOnce(read).mockReturnValueOnce({ insert })

    // Act
    const result = await createStatusList('board-1', 'Later', '#6B7280')

    // Assert
    expect(result).toEqual({ success: false, error: GRID_REFUSAL })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('does not call a color the table refused a problem with the grid', async () => {
    // Arrange
    const read = readFurthestColumn(0)
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: null,
          error: {
            code: '23514',
            message:
              'new row for relation "statuslist" violates check constraint "statuslist_color_hex"',
          },
        }),
      }),
    }))
    from.mockReturnValueOnce(read).mockReturnValueOnce({ insert })

    // Act
    const result = await createStatusList('board-1', 'Later', '#6B7280')

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  test('tells the user a column cannot move past row 999', async () => {
    // Act
    const result = await updateStatusListPosition('status-1', 1000, 0)

    // Assert
    expect(result).toEqual({ success: false, error: GRID_REFUSAL })
    expect(from).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('answers with the same sentence when the table refuses the move', async () => {
    // Arrange
    const select = vi.fn(async () => ({
      data: null,
      error: GRID_CONSTRAINT_ERROR,
    }))
    const eq = vi.fn(() => ({ select }))
    from.mockReturnValue({
      update: () => ({ eq }),
    })

    // Act
    const result = await updateStatusListPosition('status-1', 2, 0)

    // Assert
    expect(result).toEqual({ success: false, error: GRID_REFUSAL })
    expect(eq).toHaveBeenCalledWith('id', 'status-1')
    expect(select).toHaveBeenCalledWith('id')
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('refuses a whole column move when one column would pass column 999', async () => {
    // Act
    const result = await batchUpdateStatusListPositions([
      { id: 'status-1', gridRow: 0, gridCol: 999 },
      { id: 'status-2', gridRow: 0, gridCol: 1000 },
    ])

    // Assert
    expect(result).toEqual({ success: false, error: GRID_REFUSAL })
    expect(callDatabaseFunction).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('answers with the same sentence when the table refuses the batch', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: null,
      error: GRID_CONSTRAINT_ERROR,
    })

    // Act
    const result = await batchUpdateStatusListPositions([
      { id: 'status-1', gridRow: 0, gridCol: 0 },
    ])

    // Assert
    expect(callDatabaseFunction).toHaveBeenCalledWith(
      'batch_update_statuslist_positions',
      {
        p_updates: [{ id: 'status-1', grid_row: 0, grid_col: 0 }],
      },
    )
    expect(result).toEqual({ success: false, error: GRID_REFUSAL })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
