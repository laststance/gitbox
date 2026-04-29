/**
 * Unit Tests: axios-github
 *
 * Tests for GitHub API Axios instance and token utilities:
 * - createGitHubAxios (axios instance creation)
 * - hasGitHubToken (token availability check)
 * - 401 response interceptor (clears stale cookie via deleteGitHubTokenCookie)
 */

import axios from 'axios'
import { cookies } from 'next/headers'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { deleteGitHubTokenCookie } from '@/lib/constants/cookies'
import type * as CookiesModule from '@/lib/constants/cookies'

// Mock next/headers before importing the module
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

// Mock the cookie helper so we can spy on the delete call without touching
// the real Next cookie store (which is not available in this test runtime).
vi.mock('@/lib/constants/cookies', async () => {
  const actual = await vi.importActual<typeof CookiesModule>(
    '@/lib/constants/cookies',
  )
  return {
    ...actual,
    deleteGitHubTokenCookie: vi.fn().mockResolvedValue(undefined),
  }
})

describe('axios-github', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('createGitHubAxios', () => {
    it('should create an axios instance with correct base URL', async () => {
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      expect(instance.defaults.baseURL).toBe('https://api.github.com')
    })

    it('should set correct default headers', async () => {
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      expect(instance.defaults.headers['Accept']).toBe(
        'application/vnd.github.v3+json',
      )
      expect(instance.defaults.headers['User-Agent']).toBe('GitBox-App')
    })

    it('should set 10 second timeout', async () => {
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      expect(instance.defaults.timeout).toBe(10000)
    })

    it('should add request interceptor', async () => {
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      // Axios interceptors have handlers array
      expect(instance.interceptors.request).toBeDefined()
    })

    describe('request interceptor in test mode', () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK = 'true'
        process.env.APP_ENV = 'test'
      })

      it('should add mock token header in test mode', async () => {
        vi.resetModules()
        const { createGitHubAxios } = await import('@/lib/axios-github')
        const instance = createGitHubAxios()

        // Create a mock config
        const config = {
          headers: {} as Record<string, string>,
        } as any

        // Get the interceptor function
        const interceptorFn = (instance.interceptors.request as any).handlers[0]
          .fulfilled

        const result = await interceptorFn(config)

        expect(result.headers.Authorization).toBe(
          'Bearer mock-github-provider-token-for-testing',
        )
      })
    })

    describe('request interceptor in production mode', () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK = 'false'
        process.env.APP_ENV = 'production'
      })

      it('should read token from cookies', async () => {
        const mockCookieStore = {
          get: vi.fn().mockReturnValue({ value: 'real-github-token' }),
        }
        vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

        vi.resetModules()
        const { createGitHubAxios } = await import('@/lib/axios-github')
        const instance = createGitHubAxios()

        const config = {
          headers: {} as Record<string, string>,
        } as any

        const interceptorFn = (instance.interceptors.request as any).handlers[0]
          .fulfilled

        const result = await interceptorFn(config)

        expect(result.headers.Authorization).toBe('Bearer real-github-token')
      })

      it('should not add Authorization header when no token', async () => {
        const mockCookieStore = {
          get: vi.fn().mockReturnValue(undefined),
        }
        vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

        vi.resetModules()
        const { createGitHubAxios } = await import('@/lib/axios-github')
        const instance = createGitHubAxios()

        const config = {
          headers: {} as Record<string, string>,
        } as any

        const interceptorFn = (instance.interceptors.request as any).handlers[0]
          .fulfilled

        const result = await interceptorFn(config)

        expect(result.headers.Authorization).toBeUndefined()
      })
    })
  })

  describe('hasGitHubToken', () => {
    describe('in test mode', () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK = 'true'
        process.env.APP_ENV = 'test'
      })

      it('should return true in test mode', async () => {
        vi.resetModules()
        const { hasGitHubToken } = await import('@/lib/axios-github')

        const result = await hasGitHubToken()

        expect(result).toBe(true)
      })

      it('should NOT treat NODE_ENV=test alone as test mode (requires APP_ENV=test)', async () => {
        // Vitest/Jest default NODE_ENV to 'test' — trusting it as a signal
        // would accidentally enable the mock-token path in unit tests that
        // run against production code. Gate must require APP_ENV=test too.
        //
        // `delete` is required: assigning `undefined` coerces to the string
        // 'undefined' and leaves the key present on process.env.
        delete process.env.APP_ENV
        ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'

        const mockCookieStore = {
          get: vi.fn().mockReturnValue(undefined),
        }
        vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

        vi.resetModules()
        const { hasGitHubToken } = await import('@/lib/axios-github')

        const result = await hasGitHubToken()

        expect(result).toBe(false)
        expect(mockCookieStore.get).toHaveBeenCalled()
      })
    })

    describe('in production mode', () => {
      beforeEach(() => {
        process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK = 'false'
        process.env.APP_ENV = 'production'
        ;(process.env as Record<string, string | undefined>).NODE_ENV =
          'production'
      })

      it('should return true when token exists', async () => {
        const mockCookieStore = {
          get: vi.fn().mockReturnValue({ value: 'github-token' }),
        }
        vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

        vi.resetModules()
        const { hasGitHubToken } = await import('@/lib/axios-github')

        const result = await hasGitHubToken()

        expect(result).toBe(true)
      })

      it('should return false when token does not exist', async () => {
        const mockCookieStore = {
          get: vi.fn().mockReturnValue(undefined),
        }
        vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

        vi.resetModules()
        const { hasGitHubToken } = await import('@/lib/axios-github')

        const result = await hasGitHubToken()

        expect(result).toBe(false)
      })

      it('should return false when token value is empty', async () => {
        const mockCookieStore = {
          get: vi.fn().mockReturnValue({ value: '' }),
        }
        vi.mocked(cookies).mockResolvedValue(mockCookieStore as any)

        vi.resetModules()
        const { hasGitHubToken } = await import('@/lib/axios-github')

        const result = await hasGitHubToken()

        expect(result).toBe(false)
      })
    })
  })

  describe('response interceptor: 401 cookie cleanup', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK = 'false'
      process.env.APP_ENV = 'production'
      vi.mocked(deleteGitHubTokenCookie).mockClear()
    })

    /**
     * Helper: Build a structurally-valid AxiosError so the interceptor's
     * `axios.isAxiosError(error)` guard passes.
     *
     * Constructing via `new axios.AxiosError(...)` guarantees the prototype
     * chain matches what `isAxiosError` checks for — a plain `{ isAxiosError:
     * true, ... }` object would fail that check.
     */
    function makeAxiosError(status: number) {
      return new axios.AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status,
          data: {},
          statusText: 'Error',
          headers: {},
          config: { headers: {} as never },
        } as never,
      )
    }

    it('clears the GitHub cookie when the API responds 401', async () => {
      vi.resetModules()
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      const rejectedHandler = (instance.interceptors.response as any)
        .handlers[0].rejected

      await expect(rejectedHandler(makeAxiosError(401))).rejects.toBeDefined()

      expect(deleteGitHubTokenCookie).toHaveBeenCalledTimes(1)
    })

    it('does NOT clear the cookie on non-401 errors (403, 404, 500)', async () => {
      vi.resetModules()
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      const rejectedHandler = (instance.interceptors.response as any)
        .handlers[0].rejected

      for (const status of [403, 404, 500]) {
        await expect(
          rejectedHandler(makeAxiosError(status)),
        ).rejects.toBeDefined()
      }

      expect(deleteGitHubTokenCookie).not.toHaveBeenCalled()
    })

    it('does NOT clear the cookie on non-axios errors (network drop, timeout)', async () => {
      vi.resetModules()
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      const rejectedHandler = (instance.interceptors.response as any)
        .handlers[0].rejected

      const plainError = new Error('Network down')
      await expect(rejectedHandler(plainError)).rejects.toBe(plainError)

      expect(deleteGitHubTokenCookie).not.toHaveBeenCalled()
    })

    it('still rejects the original error when cookie deletion throws', async () => {
      vi.mocked(deleteGitHubTokenCookie).mockRejectedValueOnce(
        new Error('cookie store unavailable in static generation'),
      )
      vi.resetModules()
      const { createGitHubAxios } = await import('@/lib/axios-github')
      const instance = createGitHubAxios()

      const rejectedHandler = (instance.interceptors.response as any)
        .handlers[0].rejected

      const original = makeAxiosError(401)
      await expect(rejectedHandler(original)).rejects.toBe(original)
    })
  })
})
