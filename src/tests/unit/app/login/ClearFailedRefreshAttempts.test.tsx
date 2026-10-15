/**
 * Unit Tests: the login page drops the silent-refresh counter
 *
 * After the refresh route hits its attempt cap it sends the browser to
 * `/login?error=token_refresh_failed` with the counter still in
 * sessionStorage. The next visit would be refused again. The login page
 * clears that counter when it shows this error.
 *
 * @see src/app/login/ClearFailedRefreshAttempts.tsx
 */

import { render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { ClearFailedRefreshAttempts } from '@/app/login/ClearFailedRefreshAttempts'

const STORAGE_KEY = 'gh_refresh_attempts'

/** Points the page URL at a login error without leaving the test on that URL. */
function showLoginError(error: string): () => void {
  const originalLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { search: `?error=${error}` },
  })
  return (): void => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  }
}

describe('login page after the refresh attempt cap', () => {
  let restoreLocation = (): void => {}

  afterEach(() => {
    restoreLocation()
    window.sessionStorage.clear()
  })

  test('clears the refresh counter when the page shows token_refresh_failed', () => {
    // Arrange
    window.sessionStorage.setItem(STORAGE_KEY, '2')
    restoreLocation = showLoginError('token_refresh_failed')

    // Act
    render(<ClearFailedRefreshAttempts />)

    // Assert
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  test('leaves the counter when the login page shows a different error', () => {
    // Arrange
    window.sessionStorage.setItem(STORAGE_KEY, '2')
    restoreLocation = showLoginError('auth_failed')

    // Act
    render(<ClearFailedRefreshAttempts />)

    // Assert
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('2')
  })
})
