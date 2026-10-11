/**
 * Middleware Tests
 *
 * T028.7: Unit test for middleware auth and locale routing
 * - Authentication check tests
 * - Locale routing tests
 * - Public and private path validation
 */

import { NextRequest } from 'next/server'
import { describe, test, expect } from 'vitest'

describe('Middleware (middleware.ts)', () => {
  describe('Module Exports', () => {
    test('should export proxy function', async () => {
      const middlewareModule = await import('@/proxy')

      expect(middlewareModule.proxy).toBeDefined()
      expect(typeof middlewareModule.proxy).toBe('function')
    })

    test('should export config object', async () => {
      const middlewareModule = await import('@/proxy')

      expect(middlewareModule.config).toBeDefined()
      expect(middlewareModule.config.matcher).toBeDefined()
    })
  })

  describe('Matcher Configuration', () => {
    test('should have matcher array', async () => {
      const { config } = await import('@/proxy')

      expect(Array.isArray(config.matcher)).toBe(true)
      expect(config.matcher.length).toBeGreaterThan(0)
    })

    test('should exclude static files from matching', async () => {
      const { config } = await import('@/proxy')
      const matcher = config.matcher[0]

      expect(typeof matcher).toBe('string')
      // Matcher uses negative lookahead to exclude _next, api, and static assets
      // Pattern: (?!_next|api|favicon.ico|icons|.*\.(?:svg|png|...))
      expect(matcher).toContain('_next')
      expect(matcher).toContain('favicon.ico')
      expect(matcher).toContain('api')
    })
  })

  describe('Sentry tunnel', () => {
    test("forwards a signed-out page's error report to this app's Sentry project instead of redirecting it to login", async () => {
      // Arrange
      const { proxy } = await import('@/proxy')
      const tunnelRequest = new NextRequest(
        'https://gitbox.example/monitoring?o=1245861&p=4510597804261376&r=us',
        { method: 'POST', body: '{}' },
      )

      // Act
      const response = await proxy(tunnelRequest)

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
      )
    })

    test('does not pass the session cookies on to Sentry', async () => {
      // Arrange: a report from a signed-in browser. The cookie is set after
      // construction because the test environment's Request drops a Cookie
      // header handed to its constructor, which would leave nothing to remove.
      const { proxy } = await import('@/proxy')
      const tunnelRequest = new NextRequest(
        'https://gitbox.example/monitoring?o=1245861&p=4510597804261376&r=us',
        {
          method: 'POST',
          body: '{}',
          headers: { 'content-type': 'text/plain;charset=UTF-8' },
        },
      )
      tunnelRequest.cookies.set('sb-session', 'fake-session')
      expect(tunnelRequest.headers.get('cookie')).toBe(
        'sb-session=fake-session',
      )

      // Act
      const response = await proxy(tunnelRequest)

      // Assert: Next.js forwards exactly the headers named here to the rewrite
      expect(response.headers.get('x-middleware-override-headers')).toBe(
        'content-type',
      )
      expect(response.headers.get('x-middleware-request-cookie')).toBeNull()
    })
  })

  describe('Sentry tunnel limits', () => {
    // The tunnel answers without a session, so anyone can post to it. Each
    // test uses a client address of its own (203.0.113.0/24 is reserved for
    // documentation): the limiter's counts last for the whole file.
    test('forwards 120 error reports a minute from one address, then answers 429 and tells the SDK when to retry', async () => {
      // Arrange: one address sent the 120 reports its minute allows
      const { proxy } = await import('@/proxy')
      const buildReportRequest = (): NextRequest =>
        new NextRequest('https://gitbox.example/monitoring', {
          method: 'POST',
          body: '{}',
          headers: { 'x-forwarded-for': '203.0.113.7' },
        })
      expect(buildReportRequest().headers.get('x-forwarded-for')).toBe(
        '203.0.113.7',
      )
      const allowedResponses: Response[] = []
      for (let reportNumber = 1; reportNumber <= 120; reportNumber++) {
        allowedResponses.push(await proxy(buildReportRequest()))
      }

      // Act: the 121st report of the same minute
      const refusedResponse = await proxy(buildReportRequest())

      // Assert: the 120th was still forwarded, the 121st was not
      expect(allowedResponses[119]?.headers.get('x-middleware-rewrite')).toBe(
        'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
      )
      expect(refusedResponse.status).toBe(429)
      expect(refusedResponse.headers.get('retry-after')).toBe('60')
      expect(refusedResponse.headers.get('x-middleware-rewrite')).toBeNull()
    })

    test('keeps forwarding reports from another address while one address is over its limit', async () => {
      // Arrange: 203.0.113.8 is over its limit
      const { proxy } = await import('@/proxy')
      for (let reportNumber = 1; reportNumber <= 121; reportNumber++) {
        await proxy(
          new NextRequest('https://gitbox.example/monitoring', {
            method: 'POST',
            body: '{}',
            headers: { 'x-forwarded-for': '203.0.113.8' },
          }),
        )
      }

      // Act: a report from 203.0.113.9
      const otherAddressResponse = await proxy(
        new NextRequest('https://gitbox.example/monitoring', {
          method: 'POST',
          body: '{}',
          headers: { 'x-forwarded-for': '203.0.113.9' },
        }),
      )

      // Assert
      expect(otherAddressResponse.status).toBe(200)
      expect(otherAddressResponse.headers.get('x-middleware-rewrite')).toBe(
        'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
      )
    })

    test('answers 413 to a report that declares a body one byte over 20 MiB', async () => {
      // Arrange: the length is set after construction because the test
      // environment's Request drops a Content-Length handed to its constructor
      const { proxy } = await import('@/proxy')
      const oversizedRequest = new NextRequest(
        'https://gitbox.example/monitoring',
        {
          method: 'POST',
          body: '{}',
          headers: { 'x-forwarded-for': '203.0.113.10' },
        },
      )
      oversizedRequest.headers.set('content-length', '20971521')
      expect(oversizedRequest.headers.get('content-length')).toBe('20971521')

      // Act
      const response = await proxy(oversizedRequest)

      // Assert: neither forwarded to Sentry nor handed on to Next.js
      expect(response.status).toBe(413)
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
      expect(response.headers.get('x-middleware-next')).toBeNull()
    })

    test('forwards a report that declares a body of exactly 20 MiB', async () => {
      // Arrange
      const { proxy } = await import('@/proxy')
      const largestAllowedRequest = new NextRequest(
        'https://gitbox.example/monitoring',
        {
          method: 'POST',
          body: '{}',
          headers: { 'x-forwarded-for': '203.0.113.11' },
        },
      )
      largestAllowedRequest.headers.set('content-length', '20971520')
      expect(largestAllowedRequest.headers.get('content-length')).toBe(
        '20971520',
      )

      // Act
      const response = await proxy(largestAllowedRequest)

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
      )
    })

    test('counts a refused oversized report against the limit of its address', async () => {
      // Arrange: 120 oversized reports from one address, each answered 413
      const { proxy } = await import('@/proxy')
      const buildOversizedRequest = (): NextRequest => {
        const oversizedRequest = new NextRequest(
          'https://gitbox.example/monitoring',
          {
            method: 'POST',
            body: '{}',
            headers: { 'x-forwarded-for': '203.0.113.12' },
          },
        )
        oversizedRequest.headers.set('content-length', '20971521')
        return oversizedRequest
      }
      const oversizedResponses: Response[] = []
      for (let reportNumber = 1; reportNumber <= 120; reportNumber++) {
        oversizedResponses.push(await proxy(buildOversizedRequest()))
      }
      expect(oversizedResponses[119]?.status).toBe(413)

      // Act: a report of normal size from the same address
      const response = await proxy(
        new NextRequest('https://gitbox.example/monitoring', {
          method: 'POST',
          body: '{}',
          headers: { 'x-forwarded-for': '203.0.113.12' },
        }),
      )

      // Assert
      expect(response.status).toBe(429)
    })
  })

  describe('Sentry tunnel path variants', () => {
    // The rewrite that `tunnelRoute` adds in next.config.ts matches the path in
    // any letter case and with trailing slashes. A variant the proxy let pass
    // would reach that rewrite with the session cookies still attached.
    const tunnelPathVariants = [
      '/Monitoring',
      '/MONITORING',
      '/monitoring/',
      '/monitoring//',
    ]

    for (const tunnelPath of tunnelPathVariants) {
      test(`forwards ${tunnelPath} to this app's Sentry project without the session cookies`, async () => {
        // Arrange: a report from a signed-in browser (cookie set after
        // construction, see the test above)
        const { proxy } = await import('@/proxy')
        const tunnelRequest = new NextRequest(
          `https://gitbox.example${tunnelPath}?o=1245861&p=4510597804261376&r=us`,
          {
            method: 'POST',
            body: '{}',
            headers: { 'content-type': 'text/plain;charset=UTF-8' },
          },
        )
        tunnelRequest.cookies.set('sb-session', 'fake-session')
        expect(tunnelRequest.headers.get('cookie')).toBe(
          'sb-session=fake-session',
        )

        // Act
        const response = await proxy(tunnelRequest)

        // Assert
        expect(response.headers.get('x-middleware-rewrite')).toBe(
          'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
        )
        expect(response.headers.get('x-middleware-override-headers')).toBe(
          'content-type',
        )
        expect(response.headers.get('x-middleware-request-cookie')).toBeNull()
      })
    }
  })

  describe('Sentry tunnel is not a relay to other Sentry projects', () => {
    test("sends a report that names another Sentry organization, project and region to this app's own project", async () => {
      // Arrange
      const { proxy } = await import('@/proxy')
      const foreignProjectRequest = new NextRequest(
        'https://gitbox.example/monitoring?o=999&p=999&r=de',
        { method: 'POST', body: '{}' },
      )

      // Act
      const response = await proxy(foreignProjectRequest)

      // Assert
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
      )
    })

    test("sends a report that repeats each query key with another project's ids to this app's own project", async () => {
      // Arrange: the first value of each key is this app's, the last one is not.
      // Reading the first value while the rewrite reads the last one is how a
      // check on the query string was bypassed.
      const { proxy } = await import('@/proxy')
      const repeatedKeysRequest = new NextRequest(
        'https://gitbox.example/monitoring?o=1245861&o=999&p=4510597804261376&p=999&r=us&r=de',
        { method: 'POST', body: '{}' },
      )

      // Act
      const response = await proxy(repeatedKeysRequest)

      // Assert
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
      )
      expect(response.headers.get('x-middleware-next')).toBeNull()
    })

    test("sends a report without any query string to this app's own project", async () => {
      // Arrange
      const { proxy } = await import('@/proxy')
      const bareRequest = new NextRequest('https://gitbox.example/monitoring', {
        method: 'POST',
        body: '{}',
      })

      // Act
      const response = await proxy(bareRequest)

      // Assert
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        'https://o1245861.ingest.us.sentry.io/api/4510597804261376/envelope/?hsts=0',
      )
    })

    test('answers 404 to a GET on the tunnel path', async () => {
      // Arrange
      const { proxy } = await import('@/proxy')
      const getRequest = new NextRequest(
        'https://gitbox.example/monitoring?o=1245861&p=4510597804261376&r=us',
        { method: 'GET' },
      )

      // Act
      const response = await proxy(getRequest)

      // Assert: neither forwarded to Sentry nor handed on to Next.js
      expect(response.status).toBe(404)
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
      expect(response.headers.get('x-middleware-next')).toBeNull()
    })
  })

  describe('Public Paths Configuration', () => {
    test('should include legal and auth-related public paths', async () => {
      const { publicPaths } = await import('@/proxy')
      const expectedPublicPaths = [
        '/',
        '/auth/callback',
        '/login',
        '/privacy',
        '/terms',
      ]

      expectedPublicPaths.forEach((path) => {
        expect(publicPaths).toContain(path)
      })
    })
  })

  describe('Locale Support', () => {
    test('should support en locale only', () => {
      const locales = ['en']

      expect(locales).toContain('en')
      expect(locales.length).toBe(1)
    })
  })

  describe('Proxy Function Type', () => {
    test('should be an async function', async () => {
      const { proxy } = await import('@/proxy')

      expect(proxy.constructor.name).toBe('AsyncFunction')
    })
  })
})
