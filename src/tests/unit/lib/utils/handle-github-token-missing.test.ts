/**
 * Unit Tests: handle-github-token-missing
 *
 * Verifies the silent re-auth helper behaves correctly under:
 *  - First-time call (no `attempt` query param)
 *  - Module-level lock (parallel hooks fire only one redirect)
 *  - sessionStorage counter increment across redirects
 *  - Counter reset via `clearGitHubRefreshAttempts`
 *  - Tampered storage values (parsed defensively)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const STORAGE_KEY = 'gh_refresh_attempts'

describe('handleGitHubTokenMissing', () => {
  // We re-import the module per test so the module-level `isRefreshInFlight`
  // lock resets, mirroring real-world behavior where the page reloads after
  // a redirect.
  let originalLocation: Location

  beforeEach(() => {
    vi.resetModules()
    window.sessionStorage.clear()
    originalLocation = window.location
    // happy-dom assigns to window.location.href triggering JSDOM-style nav.
    // Replace with a plain object so we can assert on the value without the
    // env trying to actually navigate.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: 'http://localhost/board/abc' },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })

  test('redirects to /api/auth/github/refresh with `next` and no attempt param on first call', async () => {
    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    const wasHandled = handleGitHubTokenMissing('/board/abc')

    expect(wasHandled).toBe(true)
    expect(window.location.href).toBe(
      '/api/auth/github/refresh?next=%2Fboard%2Fabc',
    )
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  test('emits ?attempt=2 on the second call (after sessionStorage already records 1)', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, '1')
    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    handleGitHubTokenMissing('/board/abc')

    expect(window.location.href).toBe(
      '/api/auth/github/refresh?next=%2Fboard%2Fabc&attempt=2',
    )
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('2')
  })

  test('only redirects once when called many times in the same JS tick (module lock)', async () => {
    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    const firstResult = handleGitHubTokenMissing('/board/abc')
    const firstHref = window.location.href

    // Simulate 4 sibling hooks all firing in parallel (one initial + 3 dup).
    const secondResult = handleGitHubTokenMissing('/board/abc')
    const thirdResult = handleGitHubTokenMissing('/board/abc')
    const fourthResult = handleGitHubTokenMissing('/board/abc')

    // All siblings should report "handled" so the caller short-circuits its
    // own error UI even though only one redirect actually fired.
    expect(firstResult).toBe(true)
    expect(secondResult).toBe(true)
    expect(thirdResult).toBe(true)
    expect(fourthResult).toBe(true)
    expect(window.location.href).toBe(firstHref)
    // Counter should only have been bumped once.
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  test('coerces tampered sessionStorage values (e.g. "abc") back to a fresh first attempt', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'not-a-number')
    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    handleGitHubTokenMissing('/board/abc')

    expect(window.location.href).toBe(
      '/api/auth/github/refresh?next=%2Fboard%2Fabc',
    )
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  test('coerces negative sessionStorage values back to a fresh first attempt', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, '-5')
    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    handleGitHubTokenMissing('/board/abc')

    expect(window.location.href).toBe(
      '/api/auth/github/refresh?next=%2Fboard%2Fabc',
    )
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  test('starts a refresh when sessionStorage throws', async () => {
    // Arrange: Safari private mode and a full quota throw instead of storing the count.
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
    try {
      const { handleGitHubTokenMissing } =
        await import('@/lib/utils/handle-github-token-missing')

      // Act
      const wasHandled = handleGitHubTokenMissing('/board/abc')

      // Assert: the visit still leaves, with no attempt query. The server cookie counts it.
      expect(wasHandled).toBe(true)
      expect(window.location.href).toBe(
        '/api/auth/github/refresh?next=%2Fboard%2Fabc',
      )
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  test('encodes the next path so query params survive intact', async () => {
    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    handleGitHubTokenMissing('/board/abc?tab=cards&filter=open')

    expect(window.location.href).toBe(
      '/api/auth/github/refresh?next=%2Fboard%2Fabc%3Ftab%3Dcards%26filter%3Dopen',
    )
  })

  test('returns false and does NOT navigate when running inside an iframe (Storybook test orchestrator, embedded views)', async () => {
    // happy-dom defaults `window.parent === window`. Override it so the
    // helper detects an embedded context and bails out cleanly.
    const fakeParent = { ...window } as Window
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => fakeParent,
    })
    const initialHref = window.location.href

    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    const wasHandled = handleGitHubTokenMissing('/board/abc')

    expect(wasHandled).toBe(false)
    expect(window.location.href).toBe(initialHref)
    // Counter is untouched so the next non-iframe call still starts at 1.
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()

    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => window,
    })
  })

  test('returns false in SSR contexts where window is undefined', async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'window',
    )
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    const { handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    const wasHandled = handleGitHubTokenMissing('/board/abc')

    expect(wasHandled).toBe(false)

    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    }
  })
})

describe('clearGitHubRefreshAttempts', () => {
  beforeEach(() => {
    vi.resetModules()
    window.sessionStorage.clear()
  })

  test('removes the counter from sessionStorage', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, '1')
    const { clearGitHubRefreshAttempts } =
      await import('@/lib/utils/handle-github-token-missing')

    clearGitHubRefreshAttempts()

    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  test('starts again at the first attempt after a failed refresh cleared the counter', async () => {
    // Arrange: the cap left the counter at 2, which is what the next visit would read.
    window.sessionStorage.setItem(STORAGE_KEY, '2')
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: 'http://localhost/login' },
    })
    const { clearRefreshAttemptsAfterFailedRefresh, handleGitHubTokenMissing } =
      await import('@/lib/utils/handle-github-token-missing')

    try {
      // Act: the login page drops the counter, then a later visit refreshes again.
      clearRefreshAttemptsAfterFailedRefresh('token_refresh_failed')
      handleGitHubTokenMissing('/board/abc')

      // Assert: the next refresh is a first try, not attempt=3.
      expect(window.location.href).toBe(
        '/api/auth/github/refresh?next=%2Fboard%2Fabc',
      )
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('1')
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      })
    }
  })

  test('leaves the counter when the login error is not a failed refresh', async () => {
    // Arrange
    window.sessionStorage.setItem(STORAGE_KEY, '2')
    const { clearRefreshAttemptsAfterFailedRefresh } =
      await import('@/lib/utils/handle-github-token-missing')

    // Act
    clearRefreshAttemptsAfterFailedRefresh('auth_failed')

    // Assert
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('2')
  })

  test('is a no-op when the counter is already absent', async () => {
    const { clearGitHubRefreshAttempts } =
      await import('@/lib/utils/handle-github-token-missing')

    expect(() => clearGitHubRefreshAttempts()).not.toThrow()
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
