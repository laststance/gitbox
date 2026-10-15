/**
 * Unit tests: the silent-refresh count does not depend on sessionStorage.
 *
 * The client sends `attempt=1` when sessionStorage throws. The cookie from
 * the previous refresh is what makes the next visit exceed the cap.
 */

import { describe, expect, test } from 'vitest'

import {
  isSpentRefreshLogin,
  nextRefreshAttempt,
  readRefreshAttempt,
} from '@/lib/utils/refresh-attempt-cookie'

describe('readRefreshAttempt', () => {
  test('reads the count when it is the only cookie', () => {
    // Arrange
    const cookieHeader = 'gh_refresh_count=1'

    // Act
    const recorded = readRefreshAttempt(cookieHeader)

    // Assert
    expect(recorded).toBe(1)
  })

  test('reads the count from a cookie list', () => {
    // Arrange
    const cookieHeader = 'sb-127-auth-token=session; gh_refresh_count=1'

    // Act
    const recorded = readRefreshAttempt(cookieHeader)

    // Assert
    expect(recorded).toBe(1)
  })

  test('returns 0 when the header has no attempt cookie', () => {
    // Arrange
    const cookieHeader = 'sb-127-auth-token=session'

    // Act
    const recorded = readRefreshAttempt(cookieHeader)

    // Assert
    expect(recorded).toBe(0)
  })

  test('returns 0 when the stored value is not a count', () => {
    // Arrange
    const cookieHeader = 'gh_refresh_count=nope'

    // Act
    const recorded = readRefreshAttempt(cookieHeader)

    // Assert
    expect(recorded).toBe(0)
  })
})

describe('nextRefreshAttempt', () => {
  test('counts a first visit as 1 when nothing is stored', () => {
    // Arrange
    const queryAttempt = 1
    const recorded = 0

    // Act
    const attempt = nextRefreshAttempt(queryAttempt, recorded)

    // Assert
    expect(attempt).toBe(1)
  })

  test('counts a second visit as 2 when the query still says 1', () => {
    // Arrange: sessionStorage was unavailable, so the client sent attempt=1 again.
    const queryAttempt = 1
    const recorded = 1

    // Act
    const attempt = nextRefreshAttempt(queryAttempt, recorded)

    // Assert
    expect(attempt).toBe(2)
  })

  test('keeps a query that is already over the stored count', () => {
    // Arrange
    const queryAttempt = 2
    const recorded = 0

    // Act
    const attempt = nextRefreshAttempt(queryAttempt, recorded)

    // Assert
    expect(attempt).toBe(2)
  })
})

describe('isSpentRefreshLogin', () => {
  test('matches the login page the cap redirects to', () => {
    // Arrange
    const pathname = '/login'
    const error = 'token_refresh_failed'

    // Act
    const matches = isSpentRefreshLogin(pathname, error)

    // Assert
    expect(matches).toBe(true)
  })

  test('leaves a different login error alone', () => {
    // Arrange
    const pathname = '/login'
    const error = 'auth_failed'

    // Act
    const matches = isSpentRefreshLogin(pathname, error)

    // Assert
    expect(matches).toBe(false)
  })
})
