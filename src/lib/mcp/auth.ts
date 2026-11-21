/**
 * GitBox MCP bearer gate
 *
 * `/api/mcp` runs as the configured owner on the service-role client, so the
 * `Authorization: Bearer` check happens before the MCP handler ever sees the
 * request — before MCP initialization, before tool dispatch.
 *
 * The comparison hashes both inputs to SHA-256 first: `timingSafeEqual`
 * throws on buffers of different lengths, and the presented token is
 * attacker-controlled, so raw strings cannot be compared directly.
 */

import { createHash, timingSafeEqual } from 'node:crypto'

import { mcpError } from './errors'

function sha256(input: string): Buffer {
  return createHash('sha256').update(input, 'utf8').digest()
}

function deny(
  status: number,
  code: 'MCP_DISABLED' | 'UNAUTHORIZED',
  error: string,
): Response {
  return Response.json(mcpError(code, error), {
    status,
    // Auth material went through this response — never let a cache hold it
    headers: { 'cache-control': 'no-store' },
  })
}

/**
 * Authorize one request to the MCP endpoint.
 *
 * Called by `src/app/api/mcp/route.ts` ahead of the MCP handler, for every
 * method. A returned `Response` is the refusal; `null` means the request
 * may proceed.
 *
 * @param request - The incoming request.
 * @param expectedToken - `GITBOX_MCP_TOKEN` as configured; absent or empty
 *   means the endpoint is disabled.
 * @returns `null` when the bearer matches, else the HTTP refusal
 *   (503 when the endpoint is not configured, 401 on a missing or wrong bearer).
 * @example
 * const denied = checkMcpAuth(request, env.GITBOX_MCP_TOKEN)
 * if (denied) return denied
 */
export function checkMcpAuth(
  request: Request,
  expectedToken: string | undefined,
): Response | null {
  // Never default-accept: an unconfigured endpoint is disabled outright
  if (!expectedToken) {
    return deny(
      503,
      'MCP_DISABLED',
      'The GitBox MCP endpoint is not configured (GITBOX_MCP_TOKEN is unset)',
    )
  }

  const authorization = request.headers.get('authorization') ?? ''
  const presented = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice('bearer '.length).trim()
    : ''
  if (!presented) {
    return deny(401, 'UNAUTHORIZED', 'Missing bearer token')
  }

  // Hash both sides to equal-length digests before the constant-time
  // compare — timingSafeEqual throws on different lengths.
  if (!timingSafeEqual(sha256(presented), sha256(expectedToken))) {
    return deny(401, 'UNAUTHORIZED', 'Invalid bearer token')
  }

  return null
}
