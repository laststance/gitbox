/**
 * MCP endpoint E2E — the agent flow end to end
 *
 * `/api/mcp` is the JSON-RPC surface agents call ("add the drinkgo repository
 * to the Laststance board"). These tests POST `tools/call` envelopes through
 * the real route — bearer gate, tool dispatch, service-role queries and the
 * MSW-backed GitHub verification all run for real:
 * - a missing bearer never reaches MCP (401, not a JSON-RPC error)
 * - add_repository_to_board places a repository the mock GitHub confirms
 * - add_project_links merges into project memory without touching the note
 * - get_project_info reads the same memory back
 *
 * The repository is `testuser/private-project`: the only mock GitHub repo
 * that sits on none of the test user's boards, so the add is a real insert
 * rather than a skip.
 */

import type { APIRequestContext } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import {
  TEST_USER_ID,
  createServiceRoleSupabaseClient,
} from '../helpers/db-query'

// Same literal as scripts/e2e-parallel.sh and playwright.config.ts; the env
// read keeps a local override possible.
const MCP_TOKEN =
  process.env.GITBOX_MCP_TOKEN ??
  '9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a'

const REPO_OWNER = 'testuser'
const REPO_NAME = 'private-project'
const BOARD_NAME = 'Test Board'

let requestId = 0

/**
 * POST one `tools/call` JSON-RPC envelope and unwrap the tool payload.
 *
 * The streamable-HTTP transport frames the answer as SSE, so the JSON-RPC
 * response is parsed out of the `data:` line; the tool result itself is the
 * JSON text inside `result.content[0]`.
 */
async function callMcpTool(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await request.post('/api/mcp', {
    headers: {
      authorization: `Bearer ${MCP_TOKEN}`,
      // The transport refuses a POST that cannot take an event stream
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    data: {
      jsonrpc: '2.0',
      id: ++requestId,
      method: 'tools/call',
      params: { name, arguments: args },
    },
  })
  expect(response.status()).toBe(200)

  const body = await response.text()
  const dataLine = body.split('\n').find((line) => line.startsWith('data:'))
  expect(dataLine, 'SSE response carries a data line').toBeTruthy()

  const rpc = JSON.parse(dataLine!.slice('data:'.length)) as {
    result?: { content?: { type: string; text: string }[] }
  }
  const text = rpc.result?.content?.[0]?.text
  expect(text, 'tool result carries JSON text').toBeTruthy()

  return JSON.parse(text!) as Record<string, unknown>
}

/**
 * Drop the card and memory a test leaves behind, so each write test starts
 * clean.
 *
 * Both deletes are attempted before any throw — teardown must not skip the
 * second cleanup because the first one failed.
 */
async function removeRepositoryArtifacts(): Promise<void> {
  const service = createServiceRoleSupabaseClient()
  const cardDelete = await service
    .from('repocard')
    .delete()
    .eq('repo_owner', REPO_OWNER)
    .eq('repo_name', REPO_NAME)
    .in('board_id', [
      '00000000-0000-0000-0000-000000000100',
      '00000000-0000-0000-0000-000000000101',
    ])
  const memoryDelete = await service
    .from('projectinfo')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .eq('repo_owner', REPO_OWNER)
    .eq('repo_name', REPO_NAME)

  const failures: string[] = []
  if (cardDelete.error) {
    failures.push(`repocard delete — ${cardDelete.error.message}`)
  }
  if (memoryDelete.error) {
    failures.push(`projectinfo delete — ${memoryDelete.error.message}`)
  }
  if (failures.length > 0) {
    throw new Error(
      `Failed to remove test repository artifacts: ${failures.join('; ')}`,
    )
  }
}

test.describe('MCP endpoint', () => {
  // Each write test owns the repository's state: a card the previous test
  // placed would turn this test's first add into a skip (addedCount 0).
  test.beforeEach(async () => {
    await removeRepositoryArtifacts()
  })

  test.afterEach(async () => {
    await removeRepositoryArtifacts()
  })

  // A request without the bearer must not reach MCP at all: 401 and the
  // UNAUTHORIZED envelope, not a JSON-RPC dispatch.
  test('rejects a call without a bearer before MCP dispatch', async ({
    request,
  }) => {
    // Arrange
    const call = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'list_boards', arguments: {} },
    }

    // Act
    const response = await request.post('/api/mcp', {
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      data: call,
    })

    // Assert
    expect(response.status()).toBe(401)
    const body = (await response.json()) as { ok: boolean; code: string }
    expect(body).toEqual({
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Missing bearer token',
    })
    expect(response.headers()['cache-control']).toBe('no-store')
  })

  // The supported agent flow: place a repository, then attach dashboard
  // links, then read the memory back — all through the MCP envelope.
  test('adds a repository, merges project links, and reads them back', async ({
    request,
  }) => {
    // Act 1 — place testuser/private-project on the Test Board
    const added = await callMcpTool(request, 'add_repository_to_board', {
      repo: 'testuser/private-project',
      board: BOARD_NAME,
    })

    // Assert 1 — the card is reported with the GitHub-confirmed names
    expect(added).toMatchObject({
      ok: true,
      board: { name: BOARD_NAME },
      addedCount: 1,
      cards: [{ repoOwner: 'testuser', repoName: 'private-project' }],
      skipped: [],
    })
    const cardId = (added['cards'] as { id: string }[])[0]!.id
    expect(cardId).toBeTruthy()

    // Act 2 — merge two dashboard links into the repository's memory
    const linked = await callMcpTool(request, 'add_project_links', {
      repo: 'testuser/private-project',
      links: [
        { type: 'vercel', url: 'https://private-project.vercel.app' },
        { type: 'supabase', url: 'https://supabase.com/dashboard/project/abc' },
      ],
    })

    // Assert 2 — both links land, deduplicated list is echoed back
    expect(linked).toEqual({
      ok: true,
      repo: 'testuser/private-project',
      cardId,
      links: [
        { type: 'vercel', url: 'https://private-project.vercel.app' },
        { type: 'supabase', url: 'https://supabase.com/dashboard/project/abc' },
      ],
    })

    // Act 3 — read the same memory back
    const info = await callMcpTool(request, 'get_project_info', {
      repo: 'testuser/private-project',
    })

    // Assert 3 — the links round-trip through projectinfo
    expect(info).toMatchObject({
      ok: true,
      repo: 'testuser/private-project',
      cardId,
      boardName: BOARD_NAME,
      note: '',
      links: [
        { type: 'vercel', url: 'https://private-project.vercel.app' },
        { type: 'supabase', url: 'https://supabase.com/dashboard/project/abc' },
      ],
    })
  })

  // The idempotent re-call: the same add answers ok with the repository in
  // `skipped`, never a second card.
  test('skips a repository that is already placed', async ({ request }) => {
    // Arrange — the repository is on the board already; the first call must
    // actually have placed it, or the skip below proves nothing
    const placed = await callMcpTool(request, 'add_repository_to_board', {
      repo: 'testuser/private-project',
      board: BOARD_NAME,
    })
    expect(placed).toMatchObject({
      ok: true,
      addedCount: 1,
      cards: [{ repoOwner: 'testuser', repoName: 'private-project' }],
      skipped: [],
    })

    // Act
    const again = await callMcpTool(request, 'add_repository_to_board', {
      repo: 'testuser/private-project',
      board: BOARD_NAME,
    })

    // Assert
    expect(again).toMatchObject({
      ok: true,
      addedCount: 0,
      cards: [],
      skipped: [
        {
          fullName: 'testuser/private-project',
          reason: 'this-board',
          boardName: BOARD_NAME,
        },
      ],
    })
  })
})
