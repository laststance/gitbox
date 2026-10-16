/**
 * Unit Tests: what the proxy lets a signed-out visitor open
 *
 * The PWA manifest and the link-preview images are fetched without a
 * session, and an address of link sharing (removed) goes to the login page
 * like every other page. The E2E specs cannot catch a regression here: test mode
 * skips the sign-in check in the proxy, so they pass even when production
 * sends every visitor to the login page. This file runs the real sign-in
 * check with a Supabase client that reports no session.
 *
 * @see src/proxy.ts
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { proxy } from '@/proxy'

// The sign-in check only runs outside E2E test mode.
vi.mock('@/tests/isTestMode', () => ({
  isTestMode: (): boolean => false,
}))

// A Supabase client for a browser that carries no session cookie.
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getClaims: vi.fn(async () => ({ data: null, error: null })),
    },
  })),
}))

vi.mock('@/lib/security-events', () => ({
  logSecurityEvent: vi.fn(),
}))

describe('proxy() for a signed-out visitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=an address of link sharing (removed) needs an account
  //   like every other page; fails_when=a pass-through for /public/ comes
  //   back in the proxy; why_new=E2E test mode bypasses the sign-in check,
  //   so no other test runs it for this path; seam=none; no_claim=what a
  //   signed-in visitor sees there (the root 404)
  test('sends the visitor of an address from the removed link sharing to login', async () => {
    // Arrange
    const oldSharingRequest = new NextRequest(
      'https://gitbox.example/public/a1b2c3d4e5f6',
    )

    // Act
    const response = await proxy(oldSharingRequest)

    // Assert
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://gitbox.example/login',
    )
  })

  test('drops the silent-refresh count on the login page the cap redirects to', async () => {
    // Arrange
    const loginRequest = new NextRequest(
      'https://gitbox.example/login?error=token_refresh_failed',
    )

    // Act
    const response = await proxy(loginRequest)

    // Assert
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('gh_refresh_count=')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  test('leaves the silent-refresh count on a login page with a different error', async () => {
    // Arrange
    const loginRequest = new NextRequest(
      'https://gitbox.example/login?error=auth_failed',
    )

    // Act
    const response = await proxy(loginRequest)

    // Assert
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  test('sends the visitor to login for a board page', async () => {
    // Arrange
    const boardRequest = new NextRequest(
      'https://gitbox.example/board/00000000-0000-0000-0000-000000000100',
    )

    // Act
    const response = await proxy(boardRequest)

    // Assert
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://gitbox.example/login',
    )
  })

  test('does not forward a path below the Sentry tunnel route to Sentry', async () => {
    // Arrange
    const belowTunnelRequest = new NextRequest(
      'https://gitbox.example/monitoring/anything',
      { method: 'POST', body: '{}' },
    )

    // Act
    const response = await proxy(belowTunnelRequest)

    // Assert
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://gitbox.example/login',
    )
  })

  test('lets a browser finish signing in after it sent more error reports than the tunnel forwards', async () => {
    // Arrange: one address is over its error report limit (the 121st report
    // of the minute is refused). 203.0.113.0/24 is reserved for documentation.
    let lastReportResponse = new Response()
    for (let reportNumber = 1; reportNumber <= 121; reportNumber++) {
      lastReportResponse = await proxy(
        new NextRequest('https://gitbox.example/monitoring', {
          method: 'POST',
          body: '{}',
          headers: { 'x-forwarded-for': '203.0.113.20' },
        }),
      )
    }
    expect(lastReportResponse.status).toBe(429)

    // Act: the OAuth callback of the same address, limited to 10 a minute
    const callbackResponse = await proxy(
      new NextRequest('https://gitbox.example/auth/callback', {
        headers: { 'x-forwarded-for': '203.0.113.20' },
      }),
    )

    // Assert: error reports did not use up the sign-in limit
    expect(callbackResponse.status).toBe(200)
    expect(callbackResponse.headers.get('location')).toBeNull()
  })

  // The browser fetches the manifest for the install prompt and crawlers fetch
  // the images for link previews. None of them carries a session cookie.
  const sessionlessMetadataPaths = [
    '/manifest.json',
    '/manifest.webmanifest',
    '/opengraph-image',
    '/twitter-image',
    '/apple-icon',
  ]

  for (const metadataPath of sessionlessMetadataPaths) {
    test(`serves ${metadataPath} without sending the request to login`, async () => {
      // Arrange
      const metadataRequest = new NextRequest(
        `https://gitbox.example${metadataPath}`,
      )

      // Act
      const response = await proxy(metadataRequest)

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    })
  }
})
