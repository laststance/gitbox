/**
 * Unit Tests: Cookie Constants
 *
 * Tests for environment-specific cookie name generation,
 * the 30-day maxAge constant, and the set/delete cookie helpers.
 */

import { cookies } from 'next/headers'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import {
  getGitHubTokenCookieName,
  GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS,
  setGitHubTokenCookie,
  deleteGitHubTokenCookie,
  deleteRejectedGitHubTokenCookie,
  readGitHubTokenCookie,
} from '@/lib/constants/cookies'

describe('getGitHubTokenCookieName', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('should extract project ID from the production Supabase URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://zfcwvzazzzsefbkztsyp.supabase.co'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_zfcwvzaz')
  })

  test('should extract project ID from the URL of any other hosted project', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://abcdefghijklmnopqrst.supabase.co'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_abcdefgh')
  })

  test('should return default when URL is empty', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  test('should return default when URL is undefined', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  test('should return default when URL format is invalid', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  test('should return default for non-supabase URLs', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_default')
  })

  test('should handle short project IDs', () => {
    // Edge case: project ID shorter than 8 chars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co'

    const cookieName = getGitHubTokenCookieName()

    expect(cookieName).toBe('gh_token_abc')
  })
})

describe('GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS', () => {
  test('should equal 30 days in seconds (regression guard for the 8h bug)', () => {
    // The original bug used `60 * 60 * 8` (8 hours) which caused users to lose
    // GitHub access after a workday. 30 days matches Supabase refresh_token TTL.
    expect(GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60)
    expect(GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS).toBe(2_592_000)
  })
})

describe('setGitHubTokenCookie', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://zfcwvzazzzsefbkztsyp.supabase.co'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  test('should call cookieStore.set with the env-specific name and 30d maxAge', async () => {
    const setSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ set: setSpy } as never)

    await setGitHubTokenCookie('test-provider-token')

    expect(setSpy).toHaveBeenCalledTimes(1)
    expect(setSpy).toHaveBeenCalledWith(
      'gh_token_zfcwvzaz',
      'test-provider-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS,
        path: '/',
      }),
    )
  })

  test('should set secure=false outside production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV =
      'development'
    const setSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ set: setSpy } as never)

    await setGitHubTokenCookie('token')

    expect(setSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ secure: false }),
    )
  })

  test('should set secure=true in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const setSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ set: setSpy } as never)

    await setGitHubTokenCookie('token')

    expect(setSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ secure: true }),
    )
  })
})

describe('deleteGitHubTokenCookie', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://zfcwvzazzzsefbkztsyp.supabase.co'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  test('should call cookieStore.delete with the env-specific name', async () => {
    const deleteSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ delete: deleteSpy } as never)

    await deleteGitHubTokenCookie()

    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).toHaveBeenCalledWith('gh_token_zfcwvzaz')
  })

  test('removes every generation so an older cookie cannot keep the session', async () => {
    // Arrange
    const deleteSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [
        { name: 'gh_token_zfcwvzaz', value: 'old-token' },
        { name: 'gh_token_zfcwvzaz_2', value: 'newer-token' },
        { name: 'sb-other', value: 'session' },
      ],
      delete: deleteSpy,
    } as never)

    // Act
    await deleteGitHubTokenCookie()

    // Assert
    expect(deleteSpy).toHaveBeenCalledTimes(2)
    expect(deleteSpy).toHaveBeenCalledWith('gh_token_zfcwvzaz')
    expect(deleteSpy).toHaveBeenCalledWith('gh_token_zfcwvzaz_2')
  })
})

describe('readGitHubTokenCookie', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://zfcwvzazzzsefbkztsyp.supabase.co'
  })

  test('reads the newest generation when the request still carries an older token', async () => {
    // Arrange
    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [
        { name: 'gh_token_zfcwvzaz', value: 'stale-token' },
        { name: 'gh_token_zfcwvzaz_1', value: 'fresh-token' },
      ],
    } as never)

    // Act
    const stored = await readGitHubTokenCookie()

    // Assert
    expect(stored).toEqual({
      name: 'gh_token_zfcwvzaz_1',
      value: 'fresh-token',
    })
  })
})

describe('a refresh and a stale 401 use different cookie names', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://zfcwvzazzzsefbkztsyp.supabase.co'
  })

  test('stores a refreshed token under the next generation and retires the one it replaced', async () => {
    // Arrange
    const setSpy = vi.fn()
    const deleteSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [{ name: 'gh_token_zfcwvzaz', value: 'stale-token' }],
      set: setSpy,
      delete: deleteSpy,
    } as never)

    // Act
    await setGitHubTokenCookie('fresh-token')

    // Assert
    expect(deleteSpy).toHaveBeenCalledWith('gh_token_zfcwvzaz')
    expect(setSpy).toHaveBeenCalledWith(
      'gh_token_zfcwvzaz_1',
      'fresh-token',
      expect.objectContaining({
        httpOnly: true,
        maxAge: GITHUB_TOKEN_COOKIE_MAX_AGE_SECONDS,
        path: '/',
      }),
    )
  })

  test('keeps the refreshed token when the older request deletes the generation it sent', async () => {
    // Arrange: both requests snapshot the browser before either response lands.
    const browser = new Map<string, string>([
      ['gh_token_zfcwvzaz', 'stale-token'],
    ])
    const refresh = snapshotCookieJar(browser)
    const stale = snapshotCookieJar(browser)

    // Act: the refresh response is applied, then the stale 401.
    vi.mocked(cookies).mockResolvedValue(refresh.jar as never)
    await setGitHubTokenCookie('fresh-token')
    applyCookieOps(browser, refresh.ops)

    vi.mocked(cookies).mockResolvedValue(stale.jar as never)
    await deleteRejectedGitHubTokenCookie('gh_token_zfcwvzaz')
    applyCookieOps(browser, stale.ops)

    // Assert
    expect(browser.get('gh_token_zfcwvzaz_1')).toBe('fresh-token')
    expect(browser.has('gh_token_zfcwvzaz')).toBe(false)
  })

  test('keeps the refreshed token when the stale 401 is applied before the refresh response', async () => {
    // Arrange
    const browser = new Map<string, string>([
      ['gh_token_zfcwvzaz', 'stale-token'],
    ])
    const refresh = snapshotCookieJar(browser)
    const stale = snapshotCookieJar(browser)

    // Act
    vi.mocked(cookies).mockResolvedValue(refresh.jar as never)
    await setGitHubTokenCookie('fresh-token')
    vi.mocked(cookies).mockResolvedValue(stale.jar as never)
    await deleteGitHubTokenCookie()
    applyCookieOps(browser, stale.ops)
    applyCookieOps(browser, refresh.ops)

    // Assert
    expect(browser.get('gh_token_zfcwvzaz_1')).toBe('fresh-token')
    expect(browser.has('gh_token_zfcwvzaz')).toBe(false)
  })

  test('leaves every other cookie when the rejected name is not a provider token', async () => {
    // Arrange
    const deleteSpy = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ delete: deleteSpy } as never)

    // Act
    const deleted = await deleteRejectedGitHubTokenCookie('sb-session')

    // Assert
    expect(deleted).toBe(false)
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})

interface CookieOp {
  op: 'set' | 'delete'
  name: string
  value?: string
}

/**
 * A request-scoped cookie jar. Mutations are recorded and do not change the
 * snapshot, matching `cookies()` seeing only the Cookie header it arrived with.
 */
function snapshotCookieJar(browser: Map<string, string>): {
  jar: {
    getAll: () => { name: string; value: string }[]
    get: (name: string) => { value: string } | undefined
    set: (name: string, value: string) => void
    delete: (name: string) => void
  }
  ops: CookieOp[]
} {
  const snapshot = new Map(browser)
  const ops: CookieOp[] = []
  return {
    jar: {
      getAll: () => [...snapshot].map(([name, value]) => ({ name, value })),
      get: (name: string) => {
        const value = snapshot.get(name)
        return value === undefined ? undefined : { value }
      },
      set: (name: string, value: string): void => {
        ops.push({ op: 'set', name, value })
      },
      delete: (name: string): void => {
        ops.push({ op: 'delete', name })
      },
    },
    ops,
  }
}

function applyCookieOps(browser: Map<string, string>, ops: CookieOp[]): void {
  for (const op of ops) {
    if (op.op === 'delete') {
      browser.delete(op.name)
      continue
    }
    browser.set(op.name, op.value ?? '')
  }
}
