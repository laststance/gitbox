/**
 * Unit Tests: a card or column move that updated no row
 *
 * updateRepoCardPosition and updateStatusListPosition read the id the update
 * returned and fail when none came back. The batch writes fail when the
 * database says a row was missing. A drag then rolls the board back instead
 * of leaving the move on screen.
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  batchUpdateRepoCardOrders,
  batchUpdateStatusListPositions,
  updateRepoCardPosition,
  updateStatusListPosition,
} from '@/lib/actions/board'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'

const from = vi.fn()
const callDatabaseFunction = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(),
}))

/**
 * A statuslist or repocard update that ends in `.select('id')`.
 * @param result - What the select resolves to.
 */
function updateReturning(result: {
  data: { id: string }[] | null
  error: { message: string } | null
}) {
  const select = vi.fn(async () => result)
  const eq = vi.fn(() => ({ select }))
  from.mockReturnValue({ update: () => ({ eq }) })
  return { eq, select }
}

describe('a position write that matched no row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: { from, rpc: callDatabaseFunction },
      claims: { sub: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof getCachedClaims>>)
  })

  test('fails a column move when the update returns no id', async () => {
    // Arrange
    const { select } = updateReturning({ data: [], error: null })

    // Act
    const result = await updateStatusListPosition('status-1', 1, 0)

    // Assert
    expect(select).toHaveBeenCalledWith('id')
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  test('keeps a column move that returned its id', async () => {
    // Arrange
    updateReturning({ data: [{ id: 'status-1' }], error: null })

    // Act
    const result = await updateStatusListPosition('status-1', 1, 0)

    // Assert
    expect(result).toEqual({ success: true, data: undefined })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('rejects a card move when the update returns no id', async () => {
    // Arrange
    const { eq } = updateReturning({ data: [], error: null })

    // Act
    const move = updateRepoCardPosition('card-1', 'status-1', 0)

    // Assert
    await expect(move).rejects.toThrow('Failed to update repo card position')
    expect(eq).toHaveBeenCalledWith('id', 'card-1')
  })

  test('keeps a card move that returned its id', async () => {
    // Arrange
    updateReturning({ data: [{ id: 'card-1' }], error: null })

    // Act
    const result = await updateRepoCardPosition('card-1', 'status-1', 2)

    // Assert
    expect(result).toBeUndefined()
  })

  test('fails a column batch when the database matched no row', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: null,
      error: { message: 'position update matched no row', code: 'P0001' },
    })

    // Act
    const result = await batchUpdateStatusListPositions([
      { id: 'status-1', gridRow: 0, gridCol: 1 },
    ])

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  test('rejects a card batch when the database matched no row', async () => {
    // Arrange
    callDatabaseFunction.mockResolvedValue({
      data: null,
      error: { message: 'position update matched no row', code: 'P0001' },
    })

    // Act
    const move = batchUpdateRepoCardOrders([
      { id: 'card-1', statusId: 'status-1', order: 0 },
    ])

    // Assert
    await expect(move).rejects.toThrow('Failed to update some repo cards')
  })
})
