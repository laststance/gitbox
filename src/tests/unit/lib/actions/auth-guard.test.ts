/**
 * Unit Tests: auth guard error pass-through
 *
 * Locks in the split between expected and unexpected Server Action failures:
 * an `ActionUserError` reaches the client verbatim and stays out of Sentry,
 * while every other error is replaced by the generic message and reported.
 * If this regresses, either duplicate-repository messages turn back into
 * "An unexpected error occurred", or internal DB error strings leak to the browser.
 *
 * Also locks in who never gets as far as the action: a signed-out caller and a
 * caller over the rate limit are refused with their own message.
 *
 * @see src/lib/actions/auth-guard.ts
 */

import * as Sentry from '@sentry/nextjs'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import {
  withAuthResult,
  withAuthResultRateLimit,
} from '@/lib/actions/auth-guard'
import { ActionUserError } from '@/lib/actions/types'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { checkRateLimit } from '@/lib/rate-limit/check'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// The guards only need "some authenticated context"; the action under test
// never touches the Supabase client.
vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(async () => ({
    supabase: {},
    claims: { sub: '00000000-0000-0000-0000-000000000001' },
  })),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

describe('auth guard error pass-through', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('read actions show an expected error message to the user without reporting it', async () => {
    // Arrange
    const failingAction = async () => {
      throw new ActionUserError('laststance/gitbox is in Maintenance')
    }

    // Act
    const result = await withAuthResult(failingAction)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'laststance/gitbox is in Maintenance',
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('mutations show an expected error message to the user without reporting it', async () => {
    // Arrange
    const failingAction = async () => {
      throw new ActionUserError(
        'laststance/gitbox is already on board "Work Projects"',
      )
    }

    // Act
    const result = await withAuthResultRateLimit('boardCrud', failingAction)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'laststance/gitbox is already on board "Work Projects"',
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('read actions hide an unexpected error behind the generic message and report it', async () => {
    // Arrange
    const databaseError = new Error('relation "repocard" does not exist')
    const failingAction = async () => {
      throw databaseError
    }

    // Act
    const result = await withAuthResult(failingAction)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: { context: 'withAuthResult' },
    })
  })

  test('mutations hide an unexpected error behind the generic message and report it', async () => {
    // Arrange
    const databaseError = new Error('duplicate key value violates constraint')
    const failingAction = async () => {
      throw databaseError
    }

    // Act
    const result = await withAuthResultRateLimit('boardCrud', failingAction)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: { context: 'withAuthResultRateLimit:boardCrud' },
    })
  })
})

describe('auth guard refusals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('a signed-out caller cannot run a read action', async () => {
    // Arrange
    vi.mocked(getCachedClaims).mockResolvedValueOnce(null)
    const readAction = vi.fn(async () => 'board data')

    // Act
    const result = await withAuthResult(readAction)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
    })
    expect(readAction).not.toHaveBeenCalled()
  })

  test('a signed-out caller cannot run a mutation', async () => {
    // Arrange
    vi.mocked(getCachedClaims).mockResolvedValueOnce(null)
    const mutation = vi.fn(async () => 'card deleted')

    // Act
    const result = await withAuthResultRateLimit('boardCrud', mutation)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
    })
    expect(mutation).not.toHaveBeenCalled()
  })

  test('a caller over the rate limit is told to try again later and the mutation does not run', async () => {
    // Arrange
    vi.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false,
      error: 'Too many board operation requests. Please try again later.',
    })
    const mutation = vi.fn(async () => 'card deleted')

    // Act
    const result = await withAuthResultRateLimit('boardCrud', mutation)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Too many board operation requests. Please try again later.',
    })
    expect(mutation).not.toHaveBeenCalled()
    expect(checkRateLimit).toHaveBeenCalledWith(
      'boardCrud',
      '00000000-0000-0000-0000-000000000001',
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
