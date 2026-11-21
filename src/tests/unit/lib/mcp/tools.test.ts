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
import { addRepositoriesToBoardCore } from '@/lib/actions/repo-cards-core'
import { ActionUserError } from '@/lib/actions/types'
import {
  addProjectLinks,
  addRepositoryToBoard,
  addRepositoryToBoardInputSchema,
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

// The add path never reaches the real core in these tests (no GitHub, no
// real DB) — per-test the spy answers a result or throws the error under
// test.
vi.mock('@/lib/actions/repo-cards-core', () => ({
  addRepositoriesToBoardCore: vi.fn(),
}))

type QueryResult = {
  data: unknown
  error: { code?: string; message: string } | null
}

/**
 * Minimal stand-in for a PostgREST query builder: every filter returns the
 * same builder, and awaiting it (directly or via single / maybeSingle)
 * yields the next queued result — an array queues one answer per call,
 * repeating the last; a bare result repeats forever.
 */
function makeQuery(result: QueryResult | QueryResult[]) {
  const queue = Array.isArray(result) ? [...result] : [result]
  const next = (): QueryResult =>
    queue.length > 1 ? (queue.shift() as QueryResult) : queue[0]!
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    range: async () => next(),
    maybeSingle: async () => next(),
    single: async () => next(),
    update: () => query,
    then: async (resolve: (value: QueryResult) => unknown) => resolve(next()),
  }
  return query
}

/**
 * A `from` table map plus the spies `projectinfo` writes go through.
 *
 * `update().eq()…select()` answers `projectinfoUpdate` (first entry per
 * call while several are queued, the last one repeats); the merge re-read
 * `select().eq().eq().maybeSingle()` answers `projectinfoRead`; `insert()`
 * answers `projectinfoInsertError` (or success).
 */
function supabaseStub(tables: {
  boards: QueryResult
  repocard: QueryResult | QueryResult[]
  projectinfoInsertError?: { code?: string; message: string } | null
  projectinfoUpdate?: QueryResult[]
  projectinfoRead?: QueryResult
}) {
  const insert = vi.fn(async () => ({
    error: tables.projectinfoInsertError ?? null,
  }))
  const updateAnswers = [
    ...(tables.projectinfoUpdate ?? [
      { data: [{ id: 'memory-1' }], error: null },
    ]),
  ]
  const selectAfterUpdate = vi.fn(async () =>
    updateAnswers.length > 1 ? updateAnswers.shift() : updateAnswers[0],
  )
  const filter = {
    eq: vi.fn(() => filter),
    is: vi.fn(() => filter),
    select: selectAfterUpdate,
    maybeSingle: async () =>
      tables.projectinfoRead ?? { data: null, error: null },
  }
  const update = vi.fn(() => filter)
  // Built once so a queued repocard answer progresses across calls — the
  // conflict fallback re-reads the card through a second `from` call.
  const repocardQuery = makeQuery(tables.repocard)
  const from = vi.fn((table: string) => {
    if (table === 'board') return makeQuery(tables.boards)
    if (table === 'repocard') return repocardQuery
    if (table === 'projectinfo') {
      return { select: () => filter, insert, update }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  return { from, insert, update, filter }
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
      id: 'memory-1',
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

  // Value: protects=a board named like another board's UUID stays selectable by its real id — the id match wins before name matching; fails_when=name and id matches merge into one ambiguous set; why_new=id-first resolution is new; seam=none; no_claim=uuid validation
  test('resolves the board an id names even when another board carries that id as its name', async () => {
    // Arrange: board-1's name is the id of board-9
    const { from } = supabaseStub({
      boards: {
        data: [
          { id: 'board-1', name: 'board-9' },
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

describe('add_repository_to_board input schema', () => {
  // Value: protects=statusId '' is refused by argument validation instead of
  //   slipping past z.string() and silently landing the card in the first
  //   column; fails_when=the min(1) is dropped from the schema, so the
  //   handler's `args.statusId ? … : {}` spread reads '' as "no column";
  //   why_new=the empty-string rejection is new; seam=none;
  //   no_claim=which error the MCP SDK answers for a failed parse
  //   (InvalidParams) — only that the arguments are refused
  test('rejects an empty statusId while an omitted one stays valid', () => {
    // Act
    const emptyStatusId = addRepositoryToBoardInputSchema.safeParse({
      repo: 'laststance/gitbox',
      board: 'Work',
      statusId: '',
    })
    const omittedStatusId = addRepositoryToBoardInputSchema.safeParse({
      repo: 'laststance/gitbox',
      board: 'Work',
    })

    // Assert
    expect(emptyStatusId.success).toBe(false)
    expect(omittedStatusId.success).toBe(true)
  })
})

describe('add_repository_to_board error envelope', () => {
  const ONE_BOARD: QueryResult = {
    data: [{ id: 'board-1', name: 'Work' }],
    error: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=a raw database or network failure never reaches the agent — the envelope names no table, column or constraint; fails_when=error.message is echoed back (it leaks schema detail); why_new=the generic INTERNAL message is new; seam=none; no_claim=which internal error occurred (the core logged it)
  test('answers a generic INTERNAL when the core throws a non-user error', async () => {
    // Arrange
    const { from } = supabaseStub({ boards: ONE_BOARD, repocard: NO_CARDS })
    vi.mocked(addRepositoriesToBoardCore).mockRejectedValue(
      new Error(
        'duplicate key value violates unique constraint "repocard_unique_repo_per_user"',
      ),
    )

    // Act
    const result = await addRepositoryToBoard(ctxWith(from), {
      repo: 'laststance/drinkgo',
      board: 'work',
    })

    // Assert
    expect(result).toEqual({
      ok: false,
      code: 'INTERNAL',
      error: 'Failed to add repository',
    })
  })

  // Value: protects=refusals the core wrote for the caller still reach the agent verbatim — the message is the fix hint; fails_when=ActionUserError is flattened into the generic INTERNAL message; why_new=the ActionUserError carve-out is new; seam=none; no_claim=MCP transport
  test('answers OPERATION_FAILED verbatim when the core throws an ActionUserError', async () => {
    // Arrange
    const { from } = supabaseStub({ boards: ONE_BOARD, repocard: NO_CARDS })
    vi.mocked(addRepositoriesToBoardCore).mockRejectedValue(
      new ActionUserError(
        'Could not confirm the repository with GitHub. Try again.',
      ),
    )

    // Act
    const result = await addRepositoryToBoard(ctxWith(from), {
      repo: 'laststance/drinkgo',
      board: 'work',
    })

    // Assert
    expect(result).toEqual({
      ok: false,
      code: 'OPERATION_FAILED',
      error: 'Could not confirm the repository with GitHub. Try again.',
    })
  })
})

describe('add_project_links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(lookupRepoPlacements).mockResolvedValue([GITBOX_PLACEMENT])
  })

  // Value: protects=adding links to an existing memory merges by url and never sends the note (a concurrent note edit survives); fails_when=the write carries the note back, duplicates a url, or skips the version guard; why_new=the version-checked merge replaced the note-restore write; seam=none; no_claim=the database trigger that bumps updated_at
  test('merges links by url into an existing row without ever sending the note', async () => {
    // Arrange: the card's memory keeps a note and one vercel link
    const { from, insert, update, filter } = supabaseStub({
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
    // Links only — the note is never written back
    expect(update).toHaveBeenCalledWith({
      links: [
        { type: 'vercel', url: 'https://a.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })
    expect(insert).not.toHaveBeenCalled()
    // The version guard: the row id and the `updated_at` the read returned
    expect(filter.eq).toHaveBeenCalledWith('id', 'memory-1')
    expect(filter.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(filter.eq).toHaveBeenCalledWith('updated_at', '2026-11-01T00:00:00Z')
  })

  // Value: protects=a repository with nothing saved still gets its links, on a fresh row whose note starts empty (a plain insert can never clobber a note); fails_when=the write takes the update path with no row id, becomes an upsert that would overwrite on conflict, or sends github_repo_id: null over a confirmed id on the conflict row; why_new=the create branch is new; seam=none; no_claim=the database default for repo_key
  test('creates the memory row with an empty note when nothing is saved yet', async () => {
    // Arrange: the card resolves but embeds no memory row
    const { from, insert, update } = supabaseStub({
      boards: { data: [], error: null },
      repocard: {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: null,
          projectinfo: null,
        },
        error: null,
      },
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })

    // Assert: `github_repo_id` stays off the payload so a confirmed id on
    // the conflict row is not nulled
    expect(result).toEqual({
      ok: true,
      repo: 'laststance/gitbox',
      cardId: 'card-1',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })
    expect(update).not.toHaveBeenCalled()
    // A plain insert — an upsert would send `note: ''` over a concurrent row
    expect(insert).toHaveBeenCalledWith({
      repo_owner: 'laststance',
      repo_name: 'gitbox',
      user_id: 'user-1',
      note: '',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })
  })

  // Value: protects=a note another write saved between the read and the insert survives — the lost race merges links into that row instead of overwriting it; fails_when=the insert becomes an upsert again (its ON CONFLICT writes note: ''), or the fallback sends the note on retry; why_new=the 23505 fallback is new; seam=none; no_claim=which concurrent write won
  test('merges into the row a concurrent write created when the insert conflicts', async () => {
    // Arrange: the card embeds no memory row; after the insert loses the
    // race (23505) the direct repo_key read finds the row the other write
    // made — note and a slack link already saved
    const { from, insert, update } = supabaseStub({
      boards: { data: [], error: null },
      repocard: {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: null,
          projectinfo: null,
        },
        error: null,
      },
      projectinfoInsertError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
      projectinfoRead: {
        data: {
          id: 'memory-9',
          github_repo_id: null,
          links: [{ type: 'slack', url: 'https://c.example.com' }],
          updated_at: '2026-11-01T00:01:00Z',
        },
        error: null,
      },
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })

    // Assert: the links merged on top of the concurrent write's links
    expect(result).toEqual({
      ok: true,
      repo: 'laststance/gitbox',
      cardId: 'card-1',
      links: [
        { type: 'slack', url: 'https://c.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })
    expect(insert).toHaveBeenCalledTimes(1)
    // The retried write carries links only — the note is never sent
    expect(update).toHaveBeenCalledWith({
      links: [
        { type: 'slack', url: 'https://c.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })
  })

  // Value: protects=a memory created concurrently for the card's own
  //   confirmed GitHub id is merged into, not refused — a retry can
  //   succeed on that row;
  //   fails_when=a confirmed id on the conflicting row alone refuses the
  //   merge, so the tool reports the card's own memory as foreign;
  //   why_new=the direct repo_key read is new; seam=none;
  //   no_claim=which write created the row
  test('merges into the conflicting row when it carries the same GitHub id as the card', async () => {
    // Arrange: the card is confirmed as repository 42 and embeds no row;
    // the row the insert conflicted with carries the same id
    const { from, update } = supabaseStub({
      boards: { data: [], error: null },
      repocard: {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
          projectinfo: null,
        },
        error: null,
      },
      projectinfoInsertError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
      projectinfoRead: {
        data: {
          id: 'memory-9',
          github_repo_id: 42,
          links: [{ type: 'slack', url: 'https://c.example.com' }],
          updated_at: '2026-11-01T00:01:00Z',
        },
        error: null,
      },
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })

    // Assert: same repository — the version-checked merge goes ahead
    expect(result).toEqual({
      ok: true,
      repo: 'laststance/gitbox',
      cardId: 'card-1',
      links: [
        { type: 'slack', url: 'https://c.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })
    expect(update).toHaveBeenCalledWith({
      links: [
        { type: 'slack', url: 'https://c.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })
  })

  // Value: protects=an orphan memory — same name, different confirmed id —
  //   is refused once instead of answering a retryable CONFLICT that can
  //   never succeed: the embed cannot see the row, so every retry hits the
  //   same conflict;
  //   fails_when=the conflicting row is not looked up directly, or a
  //   different confirmed id is treated as mergeable;
  //   why_new=the orphan refusal is new; seam=none;
  //   no_claim=how the orphan memory came to hold the name (a rename that
  //   left the card gone)
  test('answers a non-retryable refusal when the conflicting memory belongs to another repository', async () => {
    // Arrange: the card is confirmed as repository 42 and embeds no row;
    // the row holding the name carries a different repository's id (7),
    // so the computed relationship will never show it to this card
    const { from, update } = supabaseStub({
      boards: { data: [], error: null },
      repocard: {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
          projectinfo: null,
        },
        error: null,
      },
      projectinfoInsertError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
      projectinfoRead: {
        data: {
          id: 'memory-9',
          github_repo_id: 7,
          links: [{ type: 'slack', url: 'https://c.example.com' }],
          updated_at: '2026-11-01T00:01:00Z',
        },
        error: null,
      },
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })

    // Assert: the refusal names the state and promises no retry
    expect(result).toEqual({
      ok: false,
      code: 'OPERATION_FAILED',
      error: 'Memory belongs to another repository',
    })
    expect(update).not.toHaveBeenCalled()
  })

  // Value: protects=a conflicting row that is already gone keeps the
  //   retryable answer — a retry can succeed where a foreign memory could
  //   not;
  //   fails_when=a missing row is read as a foreign memory, or the
  //   refusal drops the retry hint;
  //   why_new=the direct repo_key read replaces the embed re-read;
  //   seam=none
  test('answers CONFLICT when the conflicting row is already gone', async () => {
    // Arrange: the insert lost the race but the row vanished before the
    // repo_key read
    const { from, update } = supabaseStub({
      boards: { data: [], error: null },
      repocard: {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
          projectinfo: null,
        },
        error: null,
      },
      projectinfoInsertError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
      projectinfoRead: { data: null, error: null },
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })

    // Assert
    expect(result).toEqual({
      ok: false,
      code: 'CONFLICT',
      error:
        'The project info changed while the links were merged — run the call again',
    })
    expect(update).not.toHaveBeenCalled()
  })

  // Value: protects=a link added while another write lands still ends up merged, on top of that write's links; fails_when=the merge gives up on the first lost race or re-merges against the stale snapshot; why_new=the retry round is new; seam=none; no_claim=the trigger that bumps updated_at
  test('re-reads and merges again when a write lands between the read and the update', async () => {
    // Arrange: the first version-checked update matches no row; the re-read
    // shows a newer version that already carries a slack link
    const { from, update } = supabaseStub({
      boards: { data: [], error: null },
      repocard: GITBOX_CARD,
      projectinfoUpdate: [
        { data: [], error: null },
        { data: [{ id: 'memory-1' }], error: null },
      ],
      projectinfoRead: {
        data: {
          id: 'memory-1',
          links: [
            { type: 'vercel', url: 'https://a.example.com' },
            { type: 'slack', url: 'https://c.example.com' },
          ],
          updated_at: '2026-11-01T00:01:00Z',
        },
        error: null,
      },
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })

    // Assert: the second round merges on top of the concurrent link
    expect(result).toEqual({
      ok: true,
      repo: 'laststance/gitbox',
      cardId: 'card-1',
      links: [
        { type: 'vercel', url: 'https://a.example.com' },
        { type: 'slack', url: 'https://c.example.com' },
        { type: 'resend', url: 'https://b.example.com' },
      ],
    })
    expect(update).toHaveBeenCalledTimes(2)
  })

  // Value: protects=a merge that keeps losing the race is reported instead of looping forever; fails_when=the retry never stops or reports ok:true for a write that never landed; why_new=the retry limit is new; seam=none; no_claim=which write the caller retries against
  test('answers CONFLICT when the memory keeps changing under the merge', async () => {
    // Arrange: every version-checked update matches no row
    const { from, update } = supabaseStub({
      boards: { data: [], error: null },
      repocard: GITBOX_CARD,
      projectinfoUpdate: [{ data: [], error: null }],
      projectinfoRead: {
        data: {
          id: 'memory-1',
          links: [{ type: 'vercel', url: 'https://a.example.com' }],
          updated_at: '2026-11-01T00:01:00Z',
        },
        error: null,
      },
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [{ type: 'resend', url: 'https://b.example.com' }],
    })

    // Assert
    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' })
    expect(update).toHaveBeenCalledTimes(3)
  })

  // Value: protects=a repository on no board never gets a memory row written under it; fails_when=the write runs without a card; why_new=mirrors the projectinfo WITH-CHECK gate in code; seam=none; no_claim=hint rendering
  test('answers CARD_NOT_FOUND when the repository sits on no board', async () => {
    // Arrange
    vi.mocked(lookupRepoPlacements).mockResolvedValue([])
    const { from, insert } = supabaseStub({
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
    expect(insert).not.toHaveBeenCalled()
  })

  // Value: protects=a link without a type is refused with the presets hint before any write; fails_when=an empty type reaches projectinfo; why_new=arg validation is new; seam=none; no_claim=which preset the caller should choose
  test('answers INVALID_LINK_TYPE for an empty link type', async () => {
    // Arrange
    const { from, insert } = supabaseStub({
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
    expect(insert).not.toHaveBeenCalled()
  })

  // Value: protects=an empty url never lands in the memory — projectLinkUrlSchema accepts '' for its other callers, so the tool must refuse it first and name the offending entry; fails_when='' slips past the schema check into links; why_new=the pre-schema guard is new; seam=none; no_claim=whitespace urls (the schema handles them)
  test('answers INVALID_LINK_URL naming the entry for an empty url', async () => {
    // Arrange
    const { from, insert } = supabaseStub({
      boards: { data: [], error: null },
      repocard: GITBOX_CARD,
    })

    // Act
    const result = await addProjectLinks(ctxWith(from), {
      repo: 'laststance/gitbox',
      links: [
        { type: 'vercel', url: 'https://a.example.com' },
        { type: 'resend', url: '' },
      ],
    })

    // Assert
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_LINK_URL',
      error: 'links[1] (type "resend"): "url" must not be empty',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  // Value: protects=a non-http(s) url is refused before any write; fails_when=projectLinkUrlSchema is skipped; why_new=arg validation is new; seam=none; no_claim=the schema's own rules (covered in validations tests)
  test('answers INVALID_LINK_URL for a url the schema refuses', async () => {
    // Arrange
    const { from, insert } = supabaseStub({
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
    expect(insert).not.toHaveBeenCalled()
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
