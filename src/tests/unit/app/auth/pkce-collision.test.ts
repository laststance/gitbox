/**
 * Unit Tests: two tabs sharing one code-verifier cookie
 *
 * Tab B replaces the verifier tab A stored. Tab A's callback must not
 * show that failure: it starts sign-in again, and that start writes a
 * verifier of its own.
 *
 * @see src/app/auth/callback/route.ts
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { GET } from '@/app/auth/callback/route'
import { createRouteHandlerClient } from '@/lib/supabase/server'

const { jar } = vi.hoisted(() => ({
  jar: new Map<string, { name: string; value: string }>(),
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [...jar.values()],
    set: (name: string, value: string): void => {
      jar.set(name, { name, value })
    },
  }),
  headers: () => new Headers(),
}))

/** The legacy verifier cookie, the one a callback reads when it has no flow id. */
function legacyVerifier(): string | undefined {
  for (const cookie of jar.values()) {
    if (
      cookie.name.endsWith('-code-verifier') &&
      !cookie.name.includes('-flow-')
    ) {
      return cookie.value
    }
  }
  return undefined
}

describe('two tabs signing in with one cookie jar', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    jar.clear()
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      // The slower tab's code no longer matches the verifier in the jar.
      if (url.includes('/token')) {
        return new Response(
          JSON.stringify({
            msg: 'code challenge does not match previously saved code verifier',
            error: 'invalid_grant',
            error_code: 'bad_code_verifier',
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test('the slower tab starts sign-in again and that start writes its own verifier', async () => {
    // Arrange: both tabs share the jar. The second sign-in replaces the verifier.
    const request = new Request('http://localhost:3008/auth/callback')
    const tabA = await createRouteHandlerClient(request)
    await tabA.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:3008/auth/callback',
        skipBrowserRedirect: true,
      },
    })
    const verifierA = legacyVerifier()

    const tabB = await createRouteHandlerClient(request)
    await tabB.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:3008/auth/callback',
        skipBrowserRedirect: true,
      },
    })
    const verifierB = legacyVerifier()

    // Act: tab A's callback runs after tab B has replaced the verifier.
    const response = await GET(
      new Request('http://localhost:3008/auth/callback?code=code-from-tab-a'),
    )
    const verifierAfterRestart = legacyVerifier()

    // Assert
    expect(verifierA).toBeTruthy()
    expect(verifierB).not.toBe(verifierA)
    expect(response.headers.get('location')).toContain('/authorize')
    expect(response.headers.get('location')).not.toContain('invalid%20grant')
    expect(verifierAfterRestart).toBeTruthy()
    expect(verifierAfterRestart).not.toBe(verifierB)
  })
})
