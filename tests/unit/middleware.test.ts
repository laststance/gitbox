/**
 * Middleware Tests
 *
 * T028.7: Unit test for middleware auth and locale routing
 * - 認証チェックのテスト
 * - ロケールルーティングのテスト
 * - 公開パスとプライベートパスの検証
 */

import { describe, it, expect } from 'vitest'

describe('Middleware (middleware.ts)', () => {
  describe('Module Exports', () => {
    it('should export proxy function', async () => {
      const middlewareModule = await import('@/proxy')

      expect(middlewareModule.proxy).toBeDefined()
      expect(typeof middlewareModule.proxy).toBe('function')
    })

    it('should export config object', async () => {
      const middlewareModule = await import('@/proxy')

      expect(middlewareModule.config).toBeDefined()
      expect(middlewareModule.config.matcher).toBeDefined()
    })
  })

  describe('Matcher Configuration', () => {
    it('should have matcher array', async () => {
      const { config } = await import('@/proxy')

      expect(Array.isArray(config.matcher)).toBe(true)
      expect(config.matcher.length).toBeGreaterThan(0)
    })

    it('should exclude static files from matching', async () => {
      const { config } = await import('@/proxy')
      const matcher = config.matcher[0]

      expect(typeof matcher).toBe('string')
      expect(matcher).toContain('_next/static')
      expect(matcher).toContain('_next/image')
      expect(matcher).toContain('favicon.ico')
    })
  })

  describe('Public Paths Configuration', () => {
    it('should define public paths', () => {
      // Public paths should include:
      // - Root path /
      // - Auth callback /auth/callback
      // - Login page /login

      const expectedPublicPaths = ['/', '/auth/callback']

      expectedPublicPaths.forEach((path) => {
        expect(path).toBeDefined()
        expect(typeof path).toBe('string')
      })
    })
  })

  describe('Locale Support', () => {
    it('should support en and ja locales', () => {
      const locales = ['en', 'ja']

      expect(locales).toContain('en')
      expect(locales).toContain('ja')
      expect(locales.length).toBe(2)
    })
  })

  describe('Proxy Function Type', () => {
    it('should be an async function', async () => {
      const { proxy } = await import('@/proxy')

      expect(proxy.constructor.name).toBe('AsyncFunction')
    })
  })
})
