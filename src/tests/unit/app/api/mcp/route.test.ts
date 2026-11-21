/**
 * Unit Tests: /api/mcp configuration gate
 *
 * All three GITBOX_MCP_* vars configure the endpoint; a partial setup is
 * disabled outright. The GITBOX_MCP_GITHUB_TOKEN leg is also what pins the
 * no-cookie-fallback guarantee: without it the route answers 503
 * MCP_DISABLED before the MCP handler — and therefore before any code that
 * could read the cookie GitHub token — runs.
 *
 * The MCP SDK transport and tool dispatch are covered by
 * `e2e/logged-in/mcp-api.spec.ts`; here the handler is a stub so the gate
 * itself is what runs.
 *
 * @see src/app/api/mcp/route.ts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

// Hoisted so the vi.mock factories (hoisted above the imports) can close
// over them, and each test can flip the env the gate reads at call time.
const { mockEnv, mcpHandlerSpy, getGitHubTokenSpy } = vi.hoisted(() => {
  const mockEnv: {
    GITBOX_MCP_TOKEN?: string
    GITBOX_MCP_OWNER_ID?: string
    GITBOX_MCP_GITHUB_TOKEN?: string
  } = {
    GITBOX_MCP_TOKEN: 'test-mcp-token',
    GITBOX_MCP_OWNER_ID: 'owner-1',
    GITBOX_MCP_GITHUB_TOKEN: 'test-github-pat',
  }
  return {
    mockEnv,
    mcpHandlerSpy: vi.fn(async () => new Response('{}', { status: 200 })),
    getGitHubTokenSpy: vi.fn(),
  }
})

vi.mock('@/lib/env', () => ({ env: mockEnv }))

vi.mock('mcp-handler', () => ({
  createMcpHandler: vi.fn(() => mcpHandlerSpy),
}))

vi.mock('@/lib/mcp/tools', () => ({ registerGitboxTools: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))

// The cookie token must never be consulted on this route — the spy makes a
// call observable instead of silently returning a real token.
vi.mock('@/lib/axios-github', () => ({ getGitHubToken: getGitHubTokenSpy }))

import { POST } from '@/app/api/mcp/route'

/** A request the bearer gate lets through, so only the env gate is under test. */
function authedRequest(): Request {
  return new Request('http://localhost:3008/api/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer test-mcp-token' },
  })
}

describe('/api/mcp configuration gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.GITBOX_MCP_TOKEN = 'test-mcp-token'
    mockEnv.GITBOX_MCP_OWNER_ID = 'owner-1'
    mockEnv.GITBOX_MCP_GITHUB_TOKEN = 'test-github-pat'
  })

  // Value: protects=a deploy missing GITBOX_MCP_GITHUB_TOKEN never serves MCP — and never drops verification onto the cookie token (the route has no cookies); fails_when=the endpoint runs without the PAT, or getGitHubToken is consulted; why_new=the three-var disabled gate is new; seam=none; no_claim=tool behavior once serving
  test('answers 503 MCP_DISABLED without touching the cookie token when GITBOX_MCP_GITHUB_TOKEN is unset', async () => {
    // Arrange
    mockEnv.GITBOX_MCP_GITHUB_TOKEN = undefined

    // Act
    const response = await POST(authedRequest())

    // Assert
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = (await response.json()) as { code: string; error: string }
    expect(body).toEqual({
      ok: false,
      code: 'MCP_DISABLED',
      error:
        'The GitBox MCP endpoint is not configured (GITBOX_MCP_GITHUB_TOKEN is unset)',
    })
    expect(mcpHandlerSpy).not.toHaveBeenCalled()
    expect(getGitHubTokenSpy).not.toHaveBeenCalled()
  })

  // Value: protects=a deploy missing GITBOX_MCP_OWNER_ID names the var that is unset; fails_when=the gate stops checking the owner id; why_new=the shared disabled gate is new; seam=none; no_claim=tool behavior once serving
  test('answers 503 MCP_DISABLED naming GITBOX_MCP_OWNER_ID when it is unset', async () => {
    // Arrange
    mockEnv.GITBOX_MCP_OWNER_ID = undefined

    // Act
    const response = await POST(authedRequest())

    // Assert
    expect(response.status).toBe(503)
    const body = (await response.json()) as { code: string; error: string }
    expect(body.code).toBe('MCP_DISABLED')
    expect(body.error).toContain('GITBOX_MCP_OWNER_ID')
    expect(mcpHandlerSpy).not.toHaveBeenCalled()
  })

  // Value: protects=a fully configured endpoint still serves — the new gate refuses nothing it should pass; fails_when=the GITHUB_TOKEN leg gates on the wrong var or an inverted check; why_new=the gate grew a second condition; seam=none; no_claim=what the handler answers
  test('reaches the MCP handler when all three vars are set', async () => {
    // Act
    const response = await POST(authedRequest())

    // Assert
    expect(mcpHandlerSpy).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
