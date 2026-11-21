/**
 * GitBox MCP endpoint — agent-facing Model Context Protocol server.
 *
 * Lets an AI agent do first-party board operations with the same invariants
 * as the UI: "add the drinkgo repository to the Laststance board", "add the
 * Supabase/Resend/Vercel dashboard URLs to its project note".
 *
 * Access: `Authorization: Bearer $GITBOX_MCP_TOKEN` — checked by
 * {@link checkMcpAuth} before the MCP handler sees the request, so a wrong or
 * missing credential never reaches MCP initialization. Operations run as
 * `GITBOX_MCP_OWNER_ID` on the service-role client (RLS does not apply; the
 * owner filter is re-applied in `src/lib/mcp/tools.ts`). Repository identity
 * is verified with `GITBOX_MCP_GITHUB_TOKEN`; the route refuses to serve
 * without it (503), so the cookie-token fallback inside the verification
 * cores can never run on this path.
 *
 * Transport: stateless JSON-RPC over POST (every POST opens a fresh
 * transport). GET/DELETE are exported but answered 405 by the SDK, matching
 * the canonical stateless serving.
 */

import { createMcpHandler } from 'mcp-handler'

import { env } from '@/lib/env'
import { checkMcpAuth } from '@/lib/mcp/auth'
import { mcpError } from '@/lib/mcp/errors'
import { registerGitboxTools, type McpToolContext } from '@/lib/mcp/tools'
import { createAdminClient } from '@/lib/supabase/server'

import packageJson from '../../../../package.json'

export const runtime = 'nodejs'
// Identity verification plus the unconfirmed-id backfill can chain ~25
// GitHub calls on one add.
export const maxDuration = 30

/**
 * Build the per-request tool context.
 *
 * Runs inside the server factory, so each stateless request gets a client
 * and the configured owner — `GITBOX_MCP_OWNER_ID` and
 * `GITBOX_MCP_GITHUB_TOKEN` are verified before the handler is invoked, so
 * missing values never reach a tool.
 *
 * @returns Owner-scoped context for the registered tools.
 */
function mcpContext(): McpToolContext {
  // The route gates on these env first; the throws only guard a direct call.
  const ownerId = env.GITBOX_MCP_OWNER_ID
  if (!ownerId) {
    throw new Error('GITBOX_MCP_OWNER_ID is not configured')
  }
  const githubToken = env.GITBOX_MCP_GITHUB_TOKEN
  if (!githubToken) {
    // An undefined token would drop the verification cores onto the
    // cookie-token fallback — which this route must never use.
    throw new Error('GITBOX_MCP_GITHUB_TOKEN is not configured')
  }
  return {
    supabase: createAdminClient(),
    ownerId,
    githubToken,
  }
}

const handler = createMcpHandler(
  (server) => {
    registerGitboxTools(server, mcpContext())
  },
  {
    serverInfo: { name: 'gitbox', version: packageJson.version },
    instructions:
      'GitBox board and project memory server. Repository arguments are ' +
      '"owner/name". Call list_boards before add_repository_to_board or ' +
      'list_columns, and list_link_presets before add_project_links. ' +
      'Failures answer { ok: false, error, code, hints } — read hints and retry.',
  },
)

/**
 * Shared gate for every method: the bearer check wraps the MCP handler so
 * invalid credentials are rejected before MCP initialization.
 *
 * @param request - The incoming request (any method).
 * @returns The auth refusal, the 503 for an unconfigured endpoint, or the
 *   MCP handler's response.
 */
async function handle(request: Request): Promise<Response> {
  const denied = checkMcpAuth(request, env.GITBOX_MCP_TOKEN)
  if (denied) return denied

  // All three GITBOX_MCP_* vars configure the endpoint; a partial setup is
  // disabled outright. The GITHUB_TOKEN leg also pins the guarantee that
  // tools never fall back to the cookie token (there are no cookies here).
  if (!env.GITBOX_MCP_OWNER_ID || !env.GITBOX_MCP_GITHUB_TOKEN) {
    const missing = !env.GITBOX_MCP_OWNER_ID
      ? 'GITBOX_MCP_OWNER_ID'
      : 'GITBOX_MCP_GITHUB_TOKEN'
    return Response.json(
      mcpError(
        'MCP_DISABLED',
        `The GitBox MCP endpoint is not configured (${missing} is unset)`,
      ),
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }

  const response = await handler(request)
  // Board contents and tool results must not sit in a shared cache
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * `GET /api/mcp` — stateless serving has no stream to open.
 *
 * Runs the shared {@link handle} gate: a missing `GITBOX_MCP_TOKEN` answers
 * 503 `MCP_DISABLED`, a missing or wrong `Authorization: Bearer` answers 401.
 * Past auth the MCP SDK answers 405, matching the canonical stateless
 * serving (no SSE stream exists without a session).
 *
 * @param request - The incoming request; must carry the bearer.
 * @returns 401/503 from the gate, or the SDK's 405.
 */
export async function GET(request: Request): Promise<Response> {
  return handle(request)
}

/**
 * `POST /api/mcp` — the JSON-RPC entry point agents call.
 *
 * Runs the shared {@link handle} gate: a missing `GITBOX_MCP_TOKEN` answers
 * 503 `MCP_DISABLED`, a missing or wrong `Authorization: Bearer` answers 401.
 * Authenticated requests open a fresh transport per call (stateless) and
 * dispatch `initialize`, `tools/list` and `tools/call`; the tool envelope is
 * framed as an SSE `data:` line.
 *
 * @param request - The incoming request; must carry the bearer.
 * @returns 401/503 from the gate, or the framed JSON-RPC result.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(request)
}

/**
 * `DELETE /api/mcp` — no session exists to tear down.
 *
 * Runs the shared {@link handle} gate: a missing `GITBOX_MCP_TOKEN` answers
 * 503 `MCP_DISABLED`, a missing or wrong `Authorization: Bearer` answers 401.
 * Past auth the MCP SDK answers 405 — the transport is stateless, so there
 * is no session to delete.
 *
 * @param request - The incoming request; must carry the bearer.
 * @returns 401/503 from the gate, or the SDK's 405.
 */
export async function DELETE(request: Request): Promise<Response> {
  return handle(request)
}
