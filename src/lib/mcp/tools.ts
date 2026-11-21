/**
 * GitBox MCP tools
 *
 * The seven tools `/api/mcp` exposes, run as the configured owner
 * (`GITBOX_MCP_OWNER_ID`) on the service-role client. RLS does not apply to
 * that client, so every query re-applies the owner filter in code — the same
 * invariants the server actions enforce.
 *
 * Write tools reuse the action cores and invariants
 * ({@link addRepositoriesToBoardCore}, the version-checked `projectinfo`
 * merge) rather than duplicating action logic, so the MCP path cannot
 * drift from what the UI does.
 */

import type { McpServer } from '@modelcontextprotocol/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  normalizeLinks,
  type ProjectLink,
} from '@/lib/actions/project-info-core'
import {
  isUniqueViolation,
  lookupRepoPlacements,
  type BoardPlacement,
} from '@/lib/actions/repo-card-duplicates'
import { addRepositoriesToBoardCore } from '@/lib/actions/repo-cards-core'
import { ActionUserError } from '@/lib/actions/types'
import { LINK_TYPE_PRESETS } from '@/lib/constants/link-presets'
import { GITHUB_NAME_SEGMENT } from '@/lib/constants/regex'
import { checkRateLimit } from '@/lib/rate-limit/check'
import { logSecurityEvent } from '@/lib/security-events'
import type { Database } from '@/lib/supabase/types'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'
import { projectLinkUrlSchema } from '@/lib/validations/project-info'

import { mcpError, type McpErrorEnvelope } from './errors'

/**
 * What a tool call needs beyond the MCP request itself.
 *
 * Built once per authenticated request in `src/app/api/mcp/route.ts`.
 */
export interface McpToolContext {
  /** Service-role client — the owner filter below is applied in code. */
  supabase: SupabaseClient<Database>
  /** `GITBOX_MCP_OWNER_ID`: the user every read and write is scoped to. */
  ownerId: string
  /**
   * `GITBOX_MCP_GITHUB_TOKEN`: bearer for GitHub verification calls.
   * Always set when the context comes from the route — the endpoint
   * refuses to serve without it, so the cookie fallback never runs.
   */
  githubToken?: string
}

/** The payload a tool answers: `{ ok: true, ... }` or the error envelope. */
export type McpToolResult =
  ({ ok: true } & Record<string, unknown>) | McpErrorEnvelope

interface BoardRow {
  id: string
  name: string
}

/**
 * Find the one board of the owner a name-or-id query means.
 *
 * Matching is case-insensitive on `name` (what `ilike` would do) plus an
 * exact `id` match, so an agent can pass "Laststance" or the UUID it read
 * from `list_boards`. The owner's whole board list is loaded once — boards
 * are few — so `availableBoards` comes for free on a miss.
 *
 * Called by `add_repository_to_board` and `list_columns`. Never picks
 * silently between same-named boards: `ambiguous` returns the candidates.
 *
 * @param supabase - Service-role client.
 * @param ownerId - The user the boards must belong to.
 * @param boardQuery - Board name (any case) or id.
 * @returns `resolved` with the board, `notFound` with every board of the
 *   owner, `ambiguous` with the matching boards, or `error` on read failure.
 * @example
 * const found = await resolveBoard(supabase, ownerId, 'laststance')
 * // => { status: 'resolved', board: { id: '…', name: 'Laststance' } }
 */
export async function resolveBoard(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  boardQuery: string,
): Promise<
  | { status: 'resolved'; board: BoardRow }
  | { status: 'notFound'; availableBoards: BoardRow[] }
  | { status: 'ambiguous'; matches: BoardRow[] }
  | { status: 'error' }
> {
  const { data: boards, error } = await supabase
    .from('board')
    .select('id, name')
    .eq('user_id', ownerId)
    .order('position', { ascending: true })

  if (error || !boards) return { status: 'error' }

  const query = boardQuery.trim().toLowerCase()
  const matches = boards.filter(
    (board) => board.id === boardQuery || board.name.toLowerCase() === query,
  )

  if (matches.length === 0) {
    return { status: 'notFound', availableBoards: boards }
  }
  const [board] = matches
  if (matches.length === 1 && board) {
    return { status: 'resolved', board }
  }
  return { status: 'ambiguous', matches }
}

/**
 * Merge new links into existing ones, deduplicated by `url`.
 *
 * First occurrence wins: a link already saved keeps its `type`, and the new
 * list dedupes against itself. `add_project_links` never sends the note on
 * an existing row so a concurrent note edit survives — same spirit for
 * links.
 *
 * @param existing - Links already on the repository's memory.
 * @param added - Links the caller wants to add.
 * @returns `existing` plus the new links whose url was not there.
 * @example
 * mergeLinksByUrl([{ type: 'vercel', url: 'https://x' }], [{ type: 'resend', url: 'https://x' }, { type: 'resend', url: 'https://y' }])
 * // => [{ type: 'vercel', url: 'https://x' }, { type: 'resend', url: 'https://y' }]
 */
export function mergeLinksByUrl(
  existing: readonly ProjectLink[],
  added: readonly { type: string; url: string }[],
): ProjectLink[] {
  const merged = [...existing]
  const seenUrls = new Set(existing.map((link) => link.url))
  for (const link of added) {
    if (seenUrls.has(link.url)) continue
    seenUrls.add(link.url)
    merged.push({ type: link.type, url: link.url })
  }
  return merged
}

function parseRepo(
  repo: string,
): { owner: string; name: string } | McpErrorEnvelope {
  const parts = repo.split('/')
  const [owner, name] = parts
  if (
    parts.length !== 2 ||
    !owner ||
    !name ||
    !GITHUB_NAME_SEGMENT.test(owner) ||
    !GITHUB_NAME_SEGMENT.test(name)
  ) {
    return mcpError(
      'INVALID_REPO',
      `repo must be "owner/name" (e.g. "laststance/gitbox"), got "${repo}"`,
    )
  }
  return { owner, name }
}

/** Find the owner's placement of `owner/name`, or the CARD_NOT_FOUND envelope. */
async function requirePlacement(
  ctx: McpToolContext,
  owner: string,
  name: string,
): Promise<
  | { placement: BoardPlacement; error?: undefined }
  | { placement?: undefined; error: McpErrorEnvelope }
> {
  const placements = await lookupRepoPlacements(ctx.supabase, ctx.ownerId)
  const placement = placements.find(
    (entry) => entry.identifier === toRepoIdentifier(owner, name),
  )
  if (!placement) {
    return {
      error: mcpError(
        'CARD_NOT_FOUND',
        `No card for "${owner}/${name}" on any board`,
        {
          hint: 'call list_repo_placements to see which repositories are placed',
        },
      ),
    }
  }
  return { placement }
}

/** The project-info row a card embeds through `projectinfo(repocard)`. */
async function readCardProjectInfo(
  ctx: McpToolContext,
  cardId: string,
): Promise<
  | {
      repository: {
        repo_owner: string
        repo_name: string
        github_repo_id?: number | null
      }
      /** The memory row's id — `null` while nothing is saved. */
      memoryId: string | null
      note: string
      comment: string
      links: ProjectLink[]
      updatedAt: string | null
    }
  | McpErrorEnvelope
> {
  // The computed relationship (issue #216) resolves the repository's memory
  // row — the note outlives the card, so it is read through the card, not
  // by name.
  const { data: card, error } = await ctx.supabase
    .from('repocard')
    .select(
      'repo_owner, repo_name, github_repo_id, projectinfo(id, note, comment, links, updated_at)',
    )
    .eq('id', cardId)
    .single()

  if (error || !card) {
    return mcpError('INTERNAL', 'Failed to read project info')
  }

  const projectInfo = card.projectinfo as {
    id?: string | null
    note?: string | null
    comment?: string | null
    links?: unknown
    updated_at?: string | null
  } | null

  return {
    repository: {
      repo_owner: card.repo_owner,
      repo_name: card.repo_name,
      github_repo_id: card.github_repo_id,
    },
    memoryId: projectInfo?.id ?? null,
    note: projectInfo?.note || '',
    comment: projectInfo?.comment || '',
    links: normalizeLinks(projectInfo?.links),
    updatedAt: projectInfo?.updated_at ?? null,
  }
}

// ========================================
// Tool implementations (exported for tests)
// ========================================

/**
 * `list_boards` — every board of the configured owner.
 *
 * @param ctx - Per-request MCP context.
 * @returns `{ ok: true, boards }`.
 */
export async function listBoards(ctx: McpToolContext): Promise<McpToolResult> {
  const { data, error } = await ctx.supabase
    .from('board')
    .select('id, name, position, is_favorite')
    .eq('user_id', ctx.ownerId)
    .order('position', { ascending: true })

  if (error) return mcpError('INTERNAL', 'Failed to list boards')
  return { ok: true, boards: data ?? [] }
}

/**
 * `list_columns` — the `statuslist` rows of one board, in display order.
 *
 * @param ctx - Per-request MCP context.
 * @param args.board - Board name (any case) or id.
 * @returns `{ ok: true, columns }` or the board-resolution envelope.
 */
export async function listColumns(
  ctx: McpToolContext,
  args: { board: string },
): Promise<McpToolResult> {
  const resolved = await resolveBoard(ctx.supabase, ctx.ownerId, args.board)
  if (resolved.status === 'error') {
    return mcpError('INTERNAL', 'Failed to list boards')
  }
  if (resolved.status === 'notFound') {
    return mcpError('BOARD_NOT_FOUND', `No board named "${args.board}"`, {
      availableBoards: resolved.availableBoards,
    })
  }
  if (resolved.status === 'ambiguous') {
    return mcpError(
      'AMBIGUOUS_BOARD',
      `Several boards match "${args.board}" — pass the board id instead`,
      { matches: resolved.matches },
    )
  }

  const { data: columns, error } = await ctx.supabase
    .from('statuslist')
    .select('id, name, color, grid_row, grid_col')
    .eq('board_id', resolved.board.id)
    .order('grid_row', { ascending: true })
    .order('grid_col', { ascending: true })

  if (error) return mcpError('INTERNAL', 'Failed to list columns')
  return { ok: true, board: resolved.board, columns: columns ?? [] }
}

/**
 * `list_repo_placements` — which board holds each of the owner's repositories.
 *
 * @param ctx - Per-request MCP context.
 * @returns `{ ok: true, placements }`.
 */
export async function listRepoPlacements(
  ctx: McpToolContext,
): Promise<McpToolResult> {
  const placements = await lookupRepoPlacements(ctx.supabase, ctx.ownerId)
  return {
    ok: true,
    placements: placements.map((placement) => ({
      repo: placement.identifier,
      boardId: placement.boardId,
      boardName: placement.boardName,
      cardId: placement.cardId,
      githubRepoId: placement.githubRepoId ?? null,
    })),
  }
}

/**
 * `list_link_presets` — the 55 built-in link types plus the user's presets.
 *
 * @param ctx - Per-request MCP context.
 * @returns `{ ok: true, presets, userPresets }`.
 */
export async function listLinkPresets(
  ctx: McpToolContext,
): Promise<McpToolResult> {
  const { data: userPresets, error } = await ctx.supabase
    .from('user_link_presets')
    .select('id, value, label, icon')
    .eq('user_id', ctx.ownerId)
    .order('label', { ascending: true })

  if (error) return mcpError('INTERNAL', 'Failed to list link presets')
  return {
    ok: true,
    presets: LINK_TYPE_PRESETS,
    userPresets: userPresets ?? [],
  }
}

/**
 * `get_project_info` — the note, comment and links of a repository's memory.
 *
 * @param ctx - Per-request MCP context.
 * @param args.repo - `owner/name`.
 * @returns `{ ok: true, repo, note, comment, links, updatedAt }` or
 *   CARD_NOT_FOUND when the repository sits on no board.
 */
export async function getProjectInfo(
  ctx: McpToolContext,
  args: { repo: string },
): Promise<McpToolResult> {
  const parsed = parseRepo(args.repo)
  if ('ok' in parsed) return parsed

  const found = await requirePlacement(ctx, parsed.owner, parsed.name)
  if (found.error) return found.error

  const info = await readCardProjectInfo(ctx, found.placement.cardId)
  if ('ok' in info) return info

  return {
    ok: true,
    repo: args.repo,
    cardId: found.placement.cardId,
    boardId: found.placement.boardId,
    boardName: found.placement.boardName,
    note: info.note,
    comment: info.comment,
    links: info.links,
    updatedAt: info.updatedAt,
  }
}

/**
 * `add_repository_to_board` — place a GitHub repository on a board.
 *
 * Board resolution is shared with `list_columns`; the insert itself is
 * {@link addRepositoriesToBoardCore}, so duplicate detection, the GitHub
 * identity confirmation and the rename release behave exactly as in the UI.
 * `statusId` falls back to the board's first column inside the core.
 *
 * @param ctx - Per-request MCP context.
 * @param args.repo - `owner/name`.
 * @param args.board - Board name (any case) or id.
 * @param args.statusId - Optional column id.
 * @returns `{ ok: true, addedCount, cards, skipped }` or the refusal envelope.
 */
export async function addRepositoryToBoard(
  ctx: McpToolContext,
  args: { repo: string; board: string; statusId?: string },
): Promise<McpToolResult> {
  const rateLimit = checkRateLimit('addReposToBoard', ctx.ownerId)
  if (!rateLimit.allowed) {
    return mcpError(
      'RATE_LIMITED',
      rateLimit.error ?? 'Too many add repository requests',
    )
  }

  const parsed = parseRepo(args.repo)
  if ('ok' in parsed) return parsed

  const resolved = await resolveBoard(ctx.supabase, ctx.ownerId, args.board)
  if (resolved.status === 'error') {
    return mcpError('INTERNAL', 'Failed to list boards')
  }
  if (resolved.status === 'notFound') {
    return mcpError('BOARD_NOT_FOUND', `No board named "${args.board}"`, {
      availableBoards: resolved.availableBoards,
    })
  }
  if (resolved.status === 'ambiguous') {
    return mcpError(
      'AMBIGUOUS_BOARD',
      `Several boards match "${args.board}" — pass the board id instead`,
      { matches: resolved.matches },
    )
  }

  try {
    const result = await addRepositoriesToBoardCore({
      supabase: ctx.supabase,
      userId: ctx.ownerId,
      githubToken: ctx.githubToken,
      boardId: resolved.board.id,
      // The route's maxDuration is 30s — stop dispatching backfill GitHub
      // calls past this budget (in-flight ones finish; the rest sort first
      // on the next call). Worst case: the budget runs out as the last
      // in-flight fetch starts, and one GitHub fetch can take the full 10s
      // axios timeout → 12s + 10s ≈ 22s, which leaves ~8s for the
      // placement lookup, the GitHub confirm and the insert that still
      // have to run inside maxDuration.
      maxBackfillMs: 12_000,
      ...(args.statusId ? { statusId: args.statusId } : {}),
      // Only owner and name are sent: the schema's `id` is optional and the
      // core fills it (and the `meta` snapshot) from GitHub's own answer.
      repos: [{ owner: { login: parsed.owner }, name: parsed.name }],
    })
    return {
      ok: true,
      board: resolved.board,
      addedCount: result.addedCount,
      cards: result.cards.map((card) => ({
        id: card.id,
        repoOwner: card.repoOwner,
        repoName: card.repoName,
        statusId: card.statusId,
        order: card.order,
      })),
      skipped: result.skipped,
    }
  } catch (error) {
    // A refusal the core wrote for the caller (GitHub could not confirm,
    // lost add race, board without columns) — message is safe to show.
    if (error instanceof ActionUserError) {
      return mcpError('OPERATION_FAILED', error.message)
    }
    // Anything else is an internal failure (a raw DB error would leak
    // schema detail); the core already logged the original error.
    return mcpError('INTERNAL', 'Failed to add repository')
  }
}

/** How many read-merge-write rounds `add_project_links` runs before CONFLICT. */
const LINK_MERGE_MAX_ATTEMPTS = 3

/** The version a `links` merge of `add_project_links` writes against. */
interface MemoryLinkSnapshot {
  id: string
  links: ProjectLink[]
  /** `projectinfo.updated_at` — bumped by a trigger on every write. */
  updatedAt: string | null
}

/**
 * Re-read a memory row for another merge round of `add_project_links`.
 *
 * Called when the version-checked update matched nothing — a write landed
 * between the snapshot and the update — so the merge needs fresh links and
 * a fresh version.
 *
 * @param ctx - Per-request MCP context.
 * @param memoryId - The `projectinfo.id` of the row.
 * @returns The row's id, links and `updated_at`, or the refusal envelope.
 */
async function readMemoryLinkSnapshot(
  ctx: McpToolContext,
  memoryId: string,
): Promise<MemoryLinkSnapshot | McpErrorEnvelope> {
  const { data, error } = await ctx.supabase
    .from('projectinfo')
    .select('id, links, updated_at')
    .eq('id', memoryId)
    .eq('user_id', ctx.ownerId)
    .maybeSingle()

  if (error) return mcpError('INTERNAL', 'Failed to read project info')
  // The row vanished mid-merge — same answer the retry limit gives
  if (!data) {
    return mcpError(
      'CONFLICT',
      'The project info changed while the links were merged — run the call again',
    )
  }
  return {
    id: data.id,
    links: normalizeLinks(data.links),
    updatedAt: data.updated_at,
  }
}

/**
 * `add_project_links` — merge links into a repository's memory.
 *
 * Server-side read-modify-write, version-checked: an existing row is
 * updated through `links` only — the note is never sent, so a note saved
 * between the read and the write survives (a restored copy could not).
 * The update carries the `updated_at` it read as the version guard (a
 * trigger bumps it on every write): a concurrent write leaves the update
 * unmatched, and the merge re-reads and retries, `CONFLICT` after three
 * lost rounds. A repository with no row gets one through a plain insert —
 * `note: ''` plus the links; a row created concurrently makes the insert
 * fail (23505) rather than overwrite, and the merge falls back to the
 * version-checked update. Links dedupe by `url` (first occurrence wins).
 * `type` accepts any non-empty string — custom user presets are
 * legitimate.
 *
 * @param ctx - Per-request MCP context.
 * @param args.repo - `owner/name`.
 * @param args.links - `{ type, url }` entries to merge.
 * @returns `{ ok: true, repo, links }` or the refusal envelope.
 */
export async function addProjectLinks(
  ctx: McpToolContext,
  args: { repo: string; links: { type: string; url: string }[] },
): Promise<McpToolResult> {
  const rateLimit = checkRateLimit('projectInfo', ctx.ownerId)
  if (!rateLimit.allowed) {
    return mcpError(
      'RATE_LIMITED',
      rateLimit.error ?? 'Too many project info requests',
    )
  }

  const parsed = parseRepo(args.repo)
  if ('ok' in parsed) return parsed

  // Validate every link before touching the database
  for (const [index, link] of args.links.entries()) {
    if (typeof link.type !== 'string' || link.type.trim().length === 0) {
      return mcpError(
        'INVALID_LINK_TYPE',
        'Each link needs a non-empty "type" — any preset value or a custom one',
        { hint: 'call list_link_presets to see valid types' },
      )
    }
    // projectLinkUrlSchema accepts '' (its other callers filter empties
    // out), but this tool only adds links — an empty url is a mistake.
    if (link.url === '') {
      return mcpError(
        'INVALID_LINK_URL',
        `links[${index}] (type "${link.type}"): "url" must not be empty`,
      )
    }
    const urlResult = projectLinkUrlSchema.safeParse(link.url)
    if (!urlResult.success) {
      return mcpError(
        'INVALID_LINK_URL',
        `"${link.url}": ${urlResult.error.issues[0]?.message ?? 'invalid URL'}`,
      )
    }
  }

  const found = await requirePlacement(ctx, parsed.owner, parsed.name)
  if (found.error) return found.error

  const info = await readCardProjectInfo(ctx, found.placement.cardId)
  if ('ok' in info) return info

  let snapshot: MemoryLinkSnapshot

  if (info.memoryId === null) {
    // No memory row yet: create it with a plain insert — not the upsert of
    // writeRepositoryMemory, whose ON CONFLICT update would send `note: ''`
    // over a note a concurrent write just saved. An insert that loses the
    // race only fails; it never overwrites.
    const merged = mergeLinksByUrl(info.links, args.links)
    const { error: insertError } = await ctx.supabase
      .from('projectinfo')
      .insert({
        repo_owner: info.repository.repo_owner,
        repo_name: info.repository.repo_name,
        // A null or missing id must not overwrite a confirmed one on the
        // conflicting row — leave the column out so the row keeps it.
        ...(typeof info.repository.github_repo_id === 'number'
          ? { github_repo_id: info.repository.github_repo_id }
          : {}),
        user_id: ctx.ownerId,
        note: '',
        // Plain literals so `links` satisfies the `Json` column type
        links: merged.map((link) => ({ type: link.type, url: link.url })),
      })

    if (!insertError) {
      return {
        ok: true,
        repo: args.repo,
        cardId: found.placement.cardId,
        links: merged,
      }
    }
    if (!isUniqueViolation(insertError)) {
      // Fixed message: a raw PostgREST error would leak schema detail.
      return mcpError('OPERATION_FAILED', 'Failed to write project links')
    }

    // 23505: a concurrent write created the row between the read and this
    // insert. Merge into it through the same version-checked update path —
    // the retry never sends `note`, so what the other write saved survives.
    const reread = await readCardProjectInfo(ctx, found.placement.cardId)
    if ('ok' in reread) return reread
    if (reread.memoryId === null) {
      // The conflicting row is already gone — same answer the retry limit gives
      return mcpError(
        'CONFLICT',
        'The project info changed while the links were merged — run the call again',
      )
    }
    snapshot = {
      id: reread.memoryId,
      links: reread.links,
      updatedAt: reread.updatedAt,
    }
  } else {
    snapshot = {
      id: info.memoryId,
      links: info.links,
      updatedAt: info.updatedAt,
    }
  }

  for (let attempt = 0; attempt < LINK_MERGE_MAX_ATTEMPTS; attempt++) {
    const merged = mergeLinksByUrl(snapshot.links, args.links)
    const update = ctx.supabase
      .from('projectinfo')
      // Plain literals so `links` satisfies the `Json` column type
      .update({
        links: merged.map((link) => ({ type: link.type, url: link.url })),
      })
      .eq('id', snapshot.id)
      .eq('user_id', ctx.ownerId)
    // `eq` cannot filter on null — `is` is the null-safe version check.
    // `updated_at` is bumped by a trigger on every write, so a concurrent
    // write leaves this update unmatched.
    const { data: writtenRows, error } = await (
      snapshot.updatedAt === null
        ? update.is('updated_at', null)
        : update.eq('updated_at', snapshot.updatedAt)
    ).select('id')

    if (error) {
      return mcpError('OPERATION_FAILED', 'Failed to write project links')
    }
    if (writtenRows && writtenRows.length > 0) {
      return {
        ok: true,
        repo: args.repo,
        cardId: found.placement.cardId,
        links: merged,
      }
    }

    // A write landed between the read and this update: re-read and merge again
    const reread = await readMemoryLinkSnapshot(ctx, snapshot.id)
    if ('ok' in reread) return reread
    snapshot = reread
  }

  return mcpError(
    'CONFLICT',
    'The project info changed while the links were merged — run the call again',
  )
}

// ========================================
// Registration
// ========================================

const repoInput = z
  .string()
  .describe('GitHub repository as "owner/name", e.g. "laststance/gitbox"')

/** Audit every invocation, then shape the CallToolResult. */
async function runTool(
  ctx: McpToolContext,
  tool: string,
  run: () => Promise<McpToolResult>,
) {
  let result: McpToolResult
  let thrownMessage: string | undefined
  try {
    result = await run()
  } catch (error) {
    // A tool that threw instead of refusing: answer the generic envelope —
    // a raw error message could leak schema detail to the agent.
    thrownMessage = error instanceof Error ? error.message : String(error)
    result = mcpError('INTERNAL', 'The tool failed — run the call again')
  }
  logSecurityEvent('mcp_tool_call', {
    tool,
    userId: ctx.ownerId,
    ok: result.ok,
    // The thrown detail stays in the audit trail (Sentry), never in the reply.
    ...(thrownMessage !== undefined ? { error: thrownMessage } : {}),
  })
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    // isError marks a refusal as a tool error for the agent, while the
    // envelope stays parseable from the text content.
    ...(result.ok ? {} : { isError: true }),
  }
}

/**
 * Register the seven GitBox tools on an MCP server instance.
 *
 * Called once per request by the `createMcpHandler` initializer in
 * `src/app/api/mcp/route.ts` (the transport is stateless, so each request
 * gets a fresh server).
 *
 * @param server - The fresh {@link McpServer} for this request.
 * @param ctx - Per-request MCP context (owner-scoped service client).
 */
export function registerGitboxTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  server.registerTool(
    'list_boards',
    {
      title: 'List boards',
      description:
        'List every board of the GitBox owner, in display order. Use the name or id in add_repository_to_board and list_columns.',
      inputSchema: z.object({}),
    },
    async () => runTool(ctx, 'list_boards', async () => listBoards(ctx)),
  )

  server.registerTool(
    'list_columns',
    {
      title: 'List columns',
      description:
        'List the status columns of a board in display order (grid_row, grid_col). board is a board name (any case) or id.',
      inputSchema: z.object({ board: z.string() }),
    },
    async (args) =>
      runTool(ctx, 'list_columns', async () => listColumns(ctx, args)),
  )

  server.registerTool(
    'list_repo_placements',
    {
      title: 'List repository placements',
      description:
        'List which board holds each repository card of the owner — whether a repository is placed anywhere.',
      inputSchema: z.object({}),
    },
    async () =>
      runTool(ctx, 'list_repo_placements', async () => listRepoPlacements(ctx)),
  )

  server.registerTool(
    'list_link_presets',
    {
      title: 'List link presets',
      description:
        'List the built-in project link types and the user-defined presets. Call before add_project_links to pick a "type".',
      inputSchema: z.object({}),
    },
    async () =>
      runTool(ctx, 'list_link_presets', async () => listLinkPresets(ctx)),
  )

  server.registerTool(
    'get_project_info',
    {
      title: 'Get project info',
      description:
        'Read the note, comment and links saved for a repository (project memory). repo is "owner/name".',
      inputSchema: z.object({ repo: repoInput }),
    },
    async (args) =>
      runTool(ctx, 'get_project_info', async () => getProjectInfo(ctx, args)),
  )

  server.registerTool(
    'add_repository_to_board',
    {
      title: 'Add repository to board',
      description:
        'Add a GitHub repository to a GitBox board. repo is "owner/name"; board is a board name (any case) or id. The card lands in the first column unless statusId names another. The repository is verified against GitHub before inserting.',
      inputSchema: z.object({
        repo: repoInput,
        board: z
          .string()
          .describe('Board name (any case) or id — see list_boards'),
        statusId: z.string().optional(),
      }),
    },
    async (args) =>
      runTool(ctx, 'add_repository_to_board', async () =>
        addRepositoryToBoard(ctx, args),
      ),
  )

  server.registerTool(
    'add_project_links',
    {
      title: 'Add project links',
      description:
        "Merge project links (dashboard URLs, docs, monitoring…) into a repository's project memory. Existing links are kept; duplicates by url are skipped. type is any preset value or a custom one — see list_link_presets.",
      inputSchema: z.object({
        repo: repoInput,
        links: z.array(z.object({ type: z.string(), url: z.string() })).min(1),
      }),
    },
    async (args) =>
      runTool(ctx, 'add_project_links', async () => addProjectLinks(ctx, args)),
  )
}
