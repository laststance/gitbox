/**
 * Unit Tests: GitBox MCP tools
 *
 * Runs the tool implementations against a stubbed Supabase client to pin the
 * pieces E2E covers only once: board name-or-id resolution, the link merge
 * that must never erase a note, and the refusal envelopes agents self-correct
 * from. The happy add path and the real constraints run in
 * `e2e/logged-in/mcp-api.spec.ts`.
 *
 * @see src/lib/mcp/tools.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { lookupRepoPlacements } from '@/lib/actions/repo-card-duplicates'
import {
  addProjectLinks,
  addRepositoryToBoard,
  getProjectInfo,
  resolveBoard,
  type McpToolContext,
} from '@/lib/mcp/tools'
import type { Database } from '@/lib/supabase/types'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/lib/actions/repo-card-duplicates', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return { ...original, lookupRepoPlacements: vi.fn(async () => []) }
})

type QueryResult = {
  data: unknown
  error: { code?: string; message: string } | null
}

/**
 * Minimal stand-in for a PostgREST query builder: every filter returns the
 * same builder, and awaiting it (directly or via single / maybeSingle)
 * yields `result`.
 */
function makeQuery(result: QueryResult) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    range: async () => result,
    maybeSingle: async () => result,
    single: async () => result,
    update: () => query,
    then: async (resolve: (value: QueryResult) => unknown) => resolve(result),
  }
  return query
}

/**
 * A `from` table map plus the `upsert` spy `projectinfo` writes go through.
 */
function supabaseStub(tables: {
  boards: QueryResult
  repocard: QueryResult
  projectinfoUpsertError?: { message: string } | null
}) {
  const upsert = vi.fn(async () => ({
    error: tables.projectinfoUpsertError ?? null,
  }))
  const from = vi.fn((table: string) => {
    if (table === 'board') return makeQuery(tables.boards)
    if (table === 'repocard') return makeQuery(tables.repocard)
    if (table === 'projectinfo') {
      return {
        select: () => makeQuery(tables.repocard),
        upsert,
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  return { from, upsert }
}

function ctxWith(from: ReturnType<typeof vi.fn>): McpToolContext {
  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    ownerId: 'user-1',
  }
}

const TWO_BOARDS: QueryResult = {
  data: [
    { id: 'board-1', name: 'Work' },
    { id: 'board-2', name: 'work' },
  ],
  error: null,
}

const NO_CARDS: QueryResult = { data: null, error: null }

/** The embed row of a card whose repository keeps a note and one link. */
const GITBOX_CARD: QueryResult = {
  data: {
    repo_owner: 'laststance',
    repo_name: 'gitbox',
    github_repo_id: null,
    projectinfo: {
      note: 'the note that must survive',
      comment: '',
      links: [{ type: 'vercel', url: 'https://a.example.com' }],
      updated_at: '2026-11-01T00:00:00Z',
    },
  },
  error: null,
}

const GITBOX_PLACEMENT = {
  identifier: 'laststance/gitbox',
  boardId: 'board-1',
  boardName: 'Work',
  cardId: 'card-1',
  githubRepoId: null,
}

describe('resolveBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects="add the drinkgo repository to the Laststance board" resolves the name the user said, whatever its letter case; fails_when=the name match is case-sensitive; why_new=board resolution is new; seam=none; no_claim=PostgREST ilike (matching happens in code)
  test('resolves a board by name, any letter case', async () => {
    // Arrange
    const { from } = supabaseStub({ boards: TWO_BOARDS, repocard: NO_CARDS })
    const supabase = { from } as unknown as SupabaseClient<Database>

    // Act
    const resolved = await resolveBoard(supabase, 'user-1', 'WORK')

    // Assert
    expect(resolved.status).toBe('ambiguous')
  })

  // Value: protects=one-named boards resolve without the id; fails_when=a single case-insensitive match is reported ambiguous; why_new=board resolution is new; seam=none; no_claim=PostgREST ilike
  test('resolves a board by name when only one matches', async () => {
    // Arrange
    const { from } = supabaseStub({
      boards: {
        data: [
          { id: 'board-1', name: 'Work' },
          { id: 'board-9', name: 'Laststance' },
        ],
        error: null,
      },
      repocard: NO_CARDS,
    })
    const supabase = { from } as unknown as SupabaseClient<Database>

    // Act
    const resolved = await resolveBoard(supabase, 'user-1', 'laststance')

    // Assert
    expect(resolved).toEqual({
      status: 'resolved',
      board: { id: 'board-9', name: 'Laststance' },
    })
  })

  // Value: protects=the id the agent read from list_boards resolves too; fails_when=id input is compared against names only; why_new=board resolution is new; seam=none; no_claim=uuid validation
  test('resolves a board by its id', async () => {
    // Arrange
    const { from } = supabaseStub({
      boards: {
        data: [
          { id: 'board-1', name: 'Work' },
          { id: 'board-9', name: 'Laststance' },
        ],
        error: null,
      },
      repocard: NO_CARDS,
    })
    const supabase = { from } as unknown as SupabaseClient<Database>

    // Act
    const resolved = await resolveBoard(supabase, 'user-1', 'board-9')

    // Assert
    expect(resolved).toEqual({
      status: 'resolved',
      board: { id: 'board-9', name: 'Laststance' },
    })
  })

  // Value: protects=a miss never picks a board silently, and the agent is handed what exists; fails_when=notFound loses availableBoards; why_new=board resolution is new; seam=none; no_claim=hint rendering in the MCP client
  test('answers notFound with every board of the owner', async () => {
    // Arrange
    const { from } = supabaseStub({
      boards: {
        data: [
          { id: 'board-1', name: 'Work' },
          { id: 'board-9', name: 'Laststance' },
        ],
        error: null,
      },
      repocard: NO_CARDS,
    })
    const supabase = { from } as unknown as SupabaseClient<Database>

    // Act
    const resolved = await resolveBoard(supabase, 'user-1', 'Missing')

    // Assert
    expect(resolved).toEqual({
      status: 'notFound',
      availableBoards: [
        { id: 'board-1', name: 'Work' },
        { id: 'board-9', name: 'Laststance' },
      ],
    })
  })

  // Value: protects=two boards sharing a name are never picked between silently; fails_when=the first match wins; why_new=board resolution is new; seam=none; no_claim=which board the caller should choose (the id is offered)
  test('answers ambiguous with the matching boards', async () => {
    // Arrange
    const { from } = supabaseStub({ boards: TWO_BOARDS, repocard: NO_CARDS })
    const supabase = { from } as unknown as SupabaseClient<Database>

    // Act
    const resolved = await resolveBoard(supabase, 'user-1', 'work')

    // Assert
    expect(resolved).toEqual({
      status: 'ambiguous',
      matches: [
        { id: 'board-1', name: 'Work' },
        { id: 'board-2', name: 'work' },
      ],
    })
  })
})

describe('add_repository_to_board board resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=the tool surfaces the board list when the name matches nothing, instead of a bare error; fails_when=the envelope lacks availableBoards; why_new=tool-level envelope is new; seam=none; no_claim=MCP transport
  test('answers BOARD_NOT_FOUND with the boards that exist', async () => {
    // Arrange
    const { from } = supabaseStub({
      boards: {
        data: [{ id: 'board-9', name: 'Laststance' }],
        error: null,
      },
      repocard: NO_CARDS,
    })

    // Act
    const result = await addRepositoryToBoard(ctxWith(from), {
      repo: 'laststance/drinkgo',
      board: 'Missing',
    })

    // Assert
    expect(result).toEqual({
      ok: false,
      code: 'BOARD_NOT_FOUND',
      error: 'No board named "Missing"',
      hints: { availableBoards: [{ id: 'board-9', name: 'Laststance' }] },
    })
  })

  // Value: protects=same-named boards are never picked between silently; fails_when=the tool inserts into the first match; why_new=tool-level envelope is new; seam=none; no_claim=MCP transport
  test('answers AMBIGUOUS_BOARD with the candidates', async () => {
    // Arrange
    const { from } = supabaseStub({ boards: TWO_BOARDS, repocard: NO_CARDS })

    // Act
    const result = await addRepositoryToBoard(ctxWith(from), {
      repo: 'laststance/drinkgo',
      board: 'work',
    })

    // Assert
    expect(result).toEqual({
      ok: false,
      code: 'AMBIGUOUS_BOARD',
      error: 'Several boards match "work" — pass the board id instead',
      hints: {
        matches: [
          { id: 'board-1', name: 'Work' },
          { id: 'board-2', name: 'work' },
        ],
      },
    })
  })

  // Value: protects=a malformed repo string is refused before any GitHub or board work; fails_when="not-a-repo" reaches verification; why_new=tool arg validation is new; seam=none; no_claim=schema-level rejection (handler validates too)
  test('answers INVALID_REPO for a repo that is not owner/name', async () => {
    // Arrange
    const { from } = supabaseStub({ boards: TWO_BOARDS, repocard: NO_CARDS })

    // Act
    const result = await addRepositoryToBoard(ctxWith(from), {
      repo: 'just-a-name',
      board: 'work',
    })

    // Assert
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ code: 'INVALID_REPO' })
  })
})

describe('add_project_links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(lookupRepoPlacements).mockResolvedValue([GITBOX_PLACEMENT])
  })

  // Value: protects=adding links keeps the note and merges by url (an omitted note would erase the user's note); fails_when=the write drops note, duplicates a url, or drops user_id (the service role has no auth.uid()); why_new=the read-modify-write is new; seam=none; no_claim=the database default for repo_key
  test('merges links by url and writes the existing note back unchanged', async () => {
    // Arrange: the card's memory keeps a note and one vercel link
    const { from, upsert } = supabaseStub({
      boards: { data: [], error: null },
      repocard: GITBOX_CARD,
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [
        // Same url as the saved link: kept once, with the saved type
        { type: 'duplicate-attempt', url: 'https://a.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })

    // Assert
    expect(result).toEqual({
      ok: true,
      repo: 'laststance/gitbox',
      cardId: 'card-1',
      links: [
        { type: 'vercel', url: 'https://a.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })
    expect(upsert).toHaveBeenCalledWith(
      {
        repo_owner: 'laststance',
        repo_name: 'gitbox',
        github_repo_id: null,
        user_id: 'user-1',
        note: 'the note that must survive',
        links: [
          { type: 'vercel', url: 'https://a.example.com' },
          { type: 'resend', url: 'https://b.example.com' },
        ],
      },
      { onConflict: 'user_id,repo_key' },
    )
  })

  // Value: protects=a repository on no board never gets a memory row written under it; fails_when=the write runs without a card; why_new=mirrors the projectinfo WITH-CHECK gate in code; seam=none; no_claim=hint rendering
  test('answers CARD_NOT_FOUND when the repository sits on no board', async () => {
    // Arrange
    vi.mocked(lookupRepoPlacements).mockResolvedValue([])
    const { from, upsert } = supabaseStub({
      boards: { data: [], error: null },
      repocard: NO_CARDS,
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/not-placed',
      links: [{ type: 'vercel', url: 'https://a.example.com' }],
    })

    // Assert
    expect(result).toMatchObject({ ok: false, code: 'CARD_NOT_FOUND' })
    expect(upsert).not.toHaveBeenCalled()
  })

  // Value: protects=a link without a type is refused with the presets hint before any write; fails_when=an empty type reaches projectinfo; why_new=arg validation is new; seam=none; no_claim=which preset the caller should choose
  test('answers INVALID_LINK_TYPE for an empty link type', async () => {
    // Arrange
    const { from, upsert } = supabaseStub({
      boards: { data: [], error: null },
      repocard: GITBOX_CARD,
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: '  ', url: 'https://a.example.com' }],
    })

    // Assert
    expect(result).toMatchObject({ ok: false, code: 'INVALID_LINK_TYPE' })
    expect(upsert).not.toHaveBeenCalled()
  })

  // Value: protects=a non-http(s) url is refused before any write; fails_when=projectLinkUrlSchema is skipped; why_new=arg validation is new; seam=none; no_claim=the schema's own rules (covered in validations tests)
  test('answers INVALID_LINK_URL for a url the schema refuses', async () => {
    // Arrange
    const { from, upsert } = supabaseStub({
      boards: { data: [], error: null },
      repocard: GITBOX_CARD,
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'vercel', url: 'javascript:alert(1)' }],
    })

    // Assert
    expect(result).toMatchObject({ ok: false, code: 'INVALID_LINK_URL' })
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('get_project_info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(lookupRepoPlacements).mockResolvedValue([GITBOX_PLACEMENT])
  })

  // Value: protects=the read-back carries the saved note, comment and links of the repository; fails_when=the embed columns change unnoticed; why_new=the tool is new; seam=none; no_claim=card ownership (placement lookup holds it)
  test('answers the note, comment and links of the repository', async () => {
    // Arrange
    const { from } = supabaseStub({
      boards: { data: [], error: null },
      repocard: GITBOX_CARD,
    })

    // Act
    const result = await getProjectInfo(ctxWith(from), {
      repo: 'laststance/gitbox',
    })

    // Assert
    expect(result).toEqual({
      ok: true,
      repo: 'laststance/gitbox',
      cardId: 'card-1',
      boardId: 'board-1',
      boardName: 'Work',
      note: 'the note that must survive',
      comment: '',
      links: [{ type: 'vercel', url: 'https://a.example.com' }],
      updatedAt: '2026-11-01T00:00:00Z',
    })
  })

  // Value: protects=project info of an unplaced repository is never fabricated; fails_when=the read proceeds on a missing card id; why_new=the tool is new; seam=none; no_claim=hint rendering
  test('answers CARD_NOT_FOUND for an unplaced repository', async () => {
    // Arrange
    vi.mocked(lookupRepoPlacements).mockResolvedValue([])
    const { from } = supabaseStub({
      boards: { data: [], error: null },
      repocard: NO_CARDS,
    })

    // Act
    const result = await getProjectInfo(ctxWith(from), {
      repo: 'laststance/ghost',
    })

    // Assert
    expect(result).toMatchObject({ ok: false, code: 'CARD_NOT_FOUND' })
  })
})
