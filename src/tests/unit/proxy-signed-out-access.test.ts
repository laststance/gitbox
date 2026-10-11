/**
 * Unit Tests: what the proxy lets a signed-out visitor open
 *
 * A shared board link (`/public/<slug>`) is meant for people without an
 * account, and the PWA manifest and the link-preview images are fetched
 * without a session. The E2E specs cannot catch a regression here: test mode
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

  // Value: protects=a shared board link opens without an account;
  //   fails_when=the /public/ pass-through is removed from the proxy;
  //   why_new=E2E test mode bypasses the sign-in check, so no existing test
  //   runs it for this path; seam=none; no_claim=that the page renders the
  //   board (the page and database are not involved)
  test('opens a shared board link without sending the visitor to login', async () => {
    // Arrange
    const sharedBoardRequest = new NextRequest(
      'https://gitbox.example/public/a1b2c3d4e5f6',
    )

    // Act
    const response = await proxy(sharedBoardRequest)

    // Assert
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
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

  test('sends the visitor to login for the bare /public/ path', async () => {
    // Arrange: no slug, so this is not a shared board link
    const bareRequest = new NextRequest('https://gitbox.example/public/')

    // Act
    const response = await proxy(bareRequest)

    // Assert
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://gitbox.example/login',
    )
  })

  test('sends the visitor to login for a path that only starts like /public', async () => {
    // Arrange
    const lookalikeRequest = new NextRequest('https://gitbox.example/publicity')

    // Act
    const response = await proxy(lookalikeRequest)

    // Assert
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://gitbox.example/login',
    )
  })

  test('sends the visitor to login for a path below a shared board link', async () => {
    // Arrange: only /public/<slug> itself is a shared board page
    const nestedRequest = new NextRequest(
      'https://gitbox.example/public/a1b2c3d4e5f6/edit',
    )

    // Act
    const response = await proxy(nestedRequest)

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
