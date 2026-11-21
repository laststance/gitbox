/**
 * Unit Tests: GitBox MCP bearer gate
 *
 * `/api/mcp` runs as the configured owner on the service-role client, so the
 * bearer check must refuse cleanly before any MCP work: 503 when the endpoint
 * is not configured, 401 on a missing or wrong bearer.
 *
 * @see src/lib/mcp/auth.ts
 */

import { describe, expect, test } from 'vitest'

import { checkMcpAuth } from '@/lib/mcp/auth'

const CONFIGURED_TOKEN = 'test-mcp-token'

function requestWithBearer(bearer?: string): Request {
  return new Request('http://localhost:3008/api/mcp', {
    method: 'POST',
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  })
}

describe('checkMcpAuth', () => {
  // Value: protects=a deploy without GITBOX_MCP_TOKEN does not expose an open endpoint; fails_when=the missing token is treated as authorized; why_new=the auth gate is new; seam=none; no_claim=the route wiring (route.ts is thin)
  test('answers 503 when no token is configured', () => {
    // Arrange
    const request = requestWithBearer('whatever')

    // Act
    const denied = checkMcpAuth(request, undefined)

    // Assert
    expect(denied?.status).toBe(503)
  })

  // Value: protects=an empty configured token cannot be matched by any bearer; fails_when='' authorizes the empty-string bearer; why_new=emptyStringAsUndefined makes '' plausible config; seam=none; no_claim=env plumbing
  test('answers 503 when the configured token is empty', () => {
    // Arrange
    const request = requestWithBearer('')

    // Act
    const denied = checkMcpAuth(request, '')

    // Assert
    expect(denied?.status).toBe(503)
  })

  // Value: protects=a missing Authorization header never reaches the MCP handler, and the refusal names the scheme the client should retry with; fails_when=a request without a bearer is let through, or the 401 lacks WWW-Authenticate (RFC 9110); why_new=the auth gate is new; seam=none; no_claim=handler behavior after auth
  test('answers 401 with WWW-Authenticate: Bearer when the request carries no bearer', () => {
    // Arrange
    const request = requestWithBearer()

    // Act
    const denied = checkMcpAuth(request, CONFIGURED_TOKEN)

    // Assert
    expect(denied?.status).toBe(401)
    expect(denied?.headers.get('www-authenticate')).toBe('Bearer')
    expect(denied?.headers.get('cache-control')).toBe('no-store')
  })

  // Value: protects=a wrong bearer never reaches the MCP handler; fails_when=a mismatching token is accepted (or timingSafeEqual throws on the length difference, which would surface as a 500, not a 401); why_new=the SHA-256 pre-hash exists for this case; seam=none; no_claim=timing side channel coverage
  test('answers 401 — not a crash — when the bearer is wrong', async () => {
    // Arrange
    const request = requestWithBearer('definitely-not-the-token')

    // Act
    const denied = checkMcpAuth(request, CONFIGURED_TOKEN)

    // Assert
    expect(denied?.status).toBe(401)
    expect(denied?.headers.get('www-authenticate')).toBe('Bearer')
    const body = (await denied?.json()) as { code: string }
    expect(body.code).toBe('UNAUTHORIZED')
  })

  // Value: protects=the configured bearer opens the endpoint; fails_when=the matching token is refused; why_new=the auth gate is new; seam=none; no_claim=handler behavior after auth
  test('lets the request through when the bearer matches', () => {
    // Arrange
    const request = requestWithBearer(CONFIGURED_TOKEN)

    // Act
    const denied = checkMcpAuth(request, CONFIGURED_TOKEN)

    // Assert
    expect(denied).toBeNull()
  })
})
