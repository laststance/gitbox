/**
 * Unit Tests: axios-github
 *
 * Tests for GitHub API Axios instance and token utilities:
 * - createGitHubAxios (axios instance creation)
 * - hasGitHubToken (token availability check)
 */

import { cookies } from 'next/headers'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock next/headers before importing the module
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

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
        process.env.APP_ENV = undefined
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
})
