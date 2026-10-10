/**
 * Unit Tests: auth guard error pass-through
 *
 * Locks in the split between expected and unexpected Server Action failures:
 * an `ActionUserError` reaches the client verbatim and stays out of Sentry,
 * while every other error is replaced by the generic message and reported.
 * If this regresses, either duplicate-repository messages turn back into
 * "An unexpected error occurred", or internal DB error strings leak to the browser.
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
