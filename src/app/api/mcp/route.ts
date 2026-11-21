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
 * is verified with `GITBOX_MCP_GITHUB_TOKEN`, not the cookie token.
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
 * and the configured owner — `GITBOX_MCP_OWNER_ID` is verified before the
 * handler is invoked, so a missing value never reaches a tool.
 *
 * @returns Owner-scoped context for the registered tools.
 */
function mcpContext(): McpToolContext {
  // The route gates on this env first; the throw only guards a direct call.
  const ownerId = env.GITBOX_MCP_OWNER_ID
  if (!ownerId) {
    throw new Error('GITBOX_MCP_OWNER_ID is not configured')
  }
  return {
    supabase: createAdminClient(),
    ownerId,
    githubToken: env.GITBOX_MCP_GITHUB_TOKEN,
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

  if (!env.GITBOX_MCP_OWNER_ID) {
    return Response.json(
      mcpError(
        'MCP_DISABLED',
        'The GitBox MCP endpoint is not configured (GITBOX_MCP_OWNER_ID is unset)',
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

export async function GET(request: Request): Promise<Response> {
  return handle(request)
}

export async function POST(request: Request): Promise<Response> {
  return handle(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return handle(request)
}
