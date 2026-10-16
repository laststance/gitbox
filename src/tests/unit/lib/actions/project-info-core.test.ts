/**
 * Unit Tests: project-info-core (issue #216)
 *
 * The note, links and comment belong to the user and the repository, not to
 * the card: every function here starts from the card id the browser sends,
 * reads the repository that card holds and works on that repository's row.
 * These tests run the functions against a stubbed Supabase client to check
 * what the app sends and when it refuses to send anything.
 *
 * What the database does with the rows (row level security, one row per user
 * and repository, the upsert merging only the columns it is sent) is covered
 * against a real database in `e2e/logged-in/project-info-data-access.spec.ts`
 * and `e2e/logged-in/repository-memory.spec.ts`.
 *
 * @see src/lib/actions/project-info-core.ts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  deleteCommentCore,
  getProjectInfoCore,
  updateCommentColorCore,
  updateCommentCore,
  upsertProjectInfoCore,
} from '@/lib/actions/project-info-core'
import { ActionUserError } from '@/lib/actions/types'
import { lookupRepositoryByGitHubId } from '@/lib/github/verify-repository-identity'

const { createClient, lookupRepositoryByGitHubId: lookupById } = vi.hoisted(
  () => ({
    createClient: vi.fn(),
    lookupRepositoryByGitHubId: vi.fn(async (id: number) => ({
      outcome: 'confirmed' as const,
      repository: { id, owner: 'laststance', name: `moved-${id}` },
    })),
  }),
)

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/github/verify-repository-identity', () => ({
  lookupRepositoryByGitHubId: lookupById,
}))

/** What PostgREST answers for one request. */
type Answer = {
  data: unknown
  error: { code?: string; message: string } | null
}

/** The card of laststance/nsx on a board of user-1, as the card read answers it. */
const NSX_CARD: Answer = {
  data: {
    repo_owner: 'laststance',
    repo_name: 'nsx',
    board: { user_id: 'user-1' },
  },
  error: null,
}

/**
 * Sign in with a Supabase stand-in whose `repocard` read answers `card`.
 *
 * `projectinfo` can only be written: `upsert`, and `update` followed by `eq`
 * filters (the shape of the comment delete). Both answer `writeError`. Any
 * other table is an error, so a function that reaches for one fails loudly.
 *
 * @param card - The answer to the single-row read of the card.
 * @param writeError - What the database answers a write (`null`: accepted).
 * @returns The spies a test inspects.
 * @example
 * const { upsert } = signInWithStub(NSX_CARD)
 */
function signInWithStub(
  card: Answer,
  writeError: Answer['error'] = null,
  memory: Answer = { data: null, error: null },
  namedMemory?: Answer,
  heldCard: Answer = { data: null, error: null },
) {
  const upsert = vi.fn(async () => ({ error: writeError }))
  // A PostgREST filter builder: chainable, and awaited for its answer
  const filteredUpdate = {
    eq: vi.fn(() => filteredUpdate),
    then: (resolve: (answer: { error: Answer['error'] }) => void): void =>
      resolve({ error: writeError }),
  }
  const update = vi.fn(() => filteredUpdate)
  const memoryQuery = {
    columns: 'id',
    eq: vi.fn(() => memoryQuery),
    maybeSingle: async () =>
      memoryQuery.columns === 'github_repo_id'
        ? (namedMemory ?? memory)
        : memory,
  }
  const from = vi.fn((table: string) => {
    if (table === 'repocard') {
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        maybeSingle: async () => heldCard,
        single: async () => card,
      }
      return query
    }
    if (table === 'projectinfo') {
      return {
        upsert,
        update,
        select: (columns: string) => {
          memoryQuery.columns = columns
          return memoryQuery
        },
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  createClient.mockResolvedValue({ from })
  return {
    from,
    upsert,
    update,
    filterUpdatedRows: filteredUpdate.eq,
    filterMemoryLookup: memoryQuery.eq,
  }
}

describe('project-info-core', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=a note past the limit is explained and nothing is written; fails_when=the refusal is a plain Error, so the auth guard replaces it with "An unexpected error occurred" and the Note dialog no longer says why; why_new=the writes moved onto the guards; seam=none; no_claim=the toast wording (useNoteModalDraft.test.tsx)
  test('a note past the limit is explained to the user and nothing is written', async () => {
    // Arrange
    const { upsert } = signInWithStub(NSX_CARD)

    // Act
    const attempt = upsertProjectInfoCore('card-1', {
      note: 'x'.repeat(20001),
      links: [],
    })

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(ActionUserError)
    await expect(attempt).rejects.toThrow(
      'Note must be 20000 characters or less',
    )
    expect(upsert).not.toHaveBeenCalled()
  })

  // Value: protects=a note, comment or color is written only for a card the user holds; the card is the gate to a repository's row; fails_when=a write skips the card lookup or ignores its error; why_new=no unit test ran these functions after they were keyed by repository; seam=none; no_claim=the policy that also refuses a repository without a card (project-info-data-access.spec.ts)
  test.each([
    {
      write: 'saving a note and links',
      run: async (): Promise<void> =>
        upsertProjectInfoCore('missing-card', { note: 'a note', links: [] }),
    },
    {
      write: 'editing the comment',
      run: async (): Promise<void> =>
        updateCommentCore('missing-card', 'a comment'),
    },
    {
      write: 'changing the comment color',
      run: async (): Promise<void> =>
        updateCommentColorCore('missing-card', 'blue'),
    },
    {
      write: 'deleting the comment',
      run: async (): Promise<void> => deleteCommentCore('missing-card'),
    },
  ])(
    'refuses $write for a card that is not the user’s and writes nothing',
    async ({ run }) => {
      // Arrange: row level security hides another user's card, so the read finds no row
      const { from } = signInWithStub({
        data: null,
        error: { code: 'PGRST116', message: 'no rows' },
      })

      // Act
      const attempt = run()

      // Assert
      await expect(attempt).rejects.toThrow('Card not found')
      expect(from).not.toHaveBeenCalledWith('projectinfo')
    },
  )

  // Value: protects=a card read that failed is not reported as a missing card, and nothing is written; fails_when=every read error says "Card not found" again, or a write goes ahead without the repository; why_new=maintainability review of #216; seam=none; no_claim=the toast wording (useNoteModalDraft.test.tsx)
  test('says the card could not be read when the read itself fails, and writes nothing', async () => {
    // Arrange: the database cancels the read
    const { from } = signInWithStub({
      data: null,
      error: { code: '57014', message: 'canceling statement' },
    })

    // Act
    const attempt = updateCommentCore('card-1', 'a comment')

    // Assert
    await expect(attempt).rejects.toThrow('Failed to read the card')
    expect(from).not.toHaveBeenCalledWith('projectinfo')
  })

  // Value: protects=a write the database refuses reaches the caller as an error, which keeps the note draft and rolls back the comment; fails_when=a write error is ignored and the save reports success; why_new=testing review of #216: the stub accepted every write; seam=none; no_claim=what the dialog does with the error (useNoteModalDraft.test.tsx)
  test.each([
    {
      write: 'saving a note and links',
      run: async (): Promise<void> =>
        upsertProjectInfoCore('card-1', { note: 'a note', links: [] }),
      message: 'Failed to save project information',
    },
    {
      write: 'editing the comment',
      run: async (): Promise<void> => updateCommentCore('card-1', 'a comment'),
      message: 'Failed to update comment',
    },
    {
      write: 'changing the comment color',
      run: async (): Promise<void> => updateCommentColorCore('card-1', 'blue'),
      message: 'Failed to update comment color',
    },
    {
      write: 'deleting the comment',
      run: async (): Promise<void> => deleteCommentCore('card-1'),
      message: 'Failed to delete comment',
    },
  ])(
    'reports $write as failed with "$message" when the database refuses it',
    async ({ run, message }) => {
      // Arrange
      signInWithStub(NSX_CARD, {
        code: '42501',
        message: 'new row violates row-level security policy',
      })

      // Act
      const attempt = run()

      // Assert
      await expect(attempt).rejects.toThrow(message)
    },
  )

  // Value: protects=each save names the repository of the card and sends only the parts the user changed, so a comment edit keeps the note, links and color; fails_when=a default color, comment or note is sent along, or the conflict target changes; why_new=the old insert-or-update branches had no unit test; seam=none; no_claim=how the database merges the columns (e2e)
  test.each([
    {
      change: 'a comment without a color',
      run: async (): Promise<void> => updateCommentCore('card-1', 'ship it'),
      payload: {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        comment: 'ship it',
      },
    },
    {
      change: 'a comment with a color',
      run: async (): Promise<void> =>
        updateCommentCore('card-1', 'ship it', 'blue'),
      payload: {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        comment: 'ship it',
        comment_color: 'blue',
      },
    },
    {
      change: 'a color alone',
      run: async (): Promise<void> => updateCommentColorCore('card-1', 'green'),
      payload: {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        comment_color: 'green',
      },
    },
    {
      change: 'a note and a link without touching the comment',
      run: async (): Promise<void> =>
        upsertProjectInfoCore('card-1', {
          note: 'CLI tool documentation',
          links: [{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
        }),
      payload: {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        note: 'CLI tool documentation',
        links: [{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
      },
    },
  ])(
    'saves $change for the repository of the card and sends nothing else',
    async ({ run, payload }) => {
      // Arrange
      const { upsert } = signInWithStub(NSX_CARD)

      // Act
      await run()

      // Assert
      expect(upsert).toHaveBeenCalledTimes(1)
      expect(upsert).toHaveBeenCalledWith(payload, {
        onConflict: 'user_id,repo_key',
      })
    },
  )

  // Value: protects=a renamed repository keeps the note that was saved under its old name; fails_when=the save inserts a second row keyed by the new name and the unique GitHub id rejects it; why_new=the id became the memory's identity; seam=none; no_claim=the policy that also requires a card with that id
  test("updates the memory that already has the card's GitHub id when the repository was renamed", async () => {
    // Arrange: the card now spells the new name; the memory row is the old one
    const { upsert, update, filterUpdatedRows } = signInWithStub(
      {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox-renamed',
          github_repo_id: 42,
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      null,
      { data: { id: 'memory-1' }, error: null },
    )

    // Act
    await upsertProjectInfoCore('card-1', {
      note: 'still the same repository',
      links: [],
    })

    // Assert
    expect(upsert).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      repo_owner: 'laststance',
      repo_name: 'gitbox-renamed',
      github_repo_id: 42,
      note: 'still the same repository',
      links: [],
    })
    expect(filterUpdatedRows).toHaveBeenCalledWith('id', 'memory-1')
    expect(filterUpdatedRows).toHaveBeenCalledWith('user_id', 'user-1')
  })

  // Value: protects=the first save of a confirmed repository still creates the row by name; fails_when=a missing memory is updated instead of inserted, or the confirmed id is left off the insert; why_new=the id lookup returns no row on a first save; seam=none; no_claim=the database default for user_id
  test("inserts a memory on the repository name when no row has the card's GitHub id yet", async () => {
    // Arrange
    const { upsert, update } = signInWithStub({
      data: {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        github_repo_id: 42,
        board: { user_id: 'user-1' },
      },
      error: null,
    })

    // Act
    await updateCommentCore('card-1', 'ship it')

    // Assert
    expect(update).not.toHaveBeenCalled()
    expect(upsert).toHaveBeenCalledWith(
      {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        github_repo_id: 42,
        comment: 'ship it',
      },
      { onConflict: 'user_id,repo_key' },
    )
  })

  // Value: protects=a note saved under a name that now belongs to another repository is not overwritten with the new repository's text; fails_when=the name upsert sets the new GitHub id on the old memory; why_new=the name is no longer the identity once both rows have ids; seam=none; no_claim=the dialog copy
  test('saves nothing when the name already belongs to a memory with a different GitHub id', async () => {
    // Arrange: a card still holds repository 99, so its memory stays on this name
    const { upsert, update } = signInWithStub(
      {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      null,
      { data: null, error: null },
      { data: { github_repo_id: 99 }, error: null },
      { data: { id: 'card-99' }, error: null },
    )

    // Act
    const attempt = upsertProjectInfoCore('card-1', {
      note: 'a note',
      links: [],
    })

    // Assert
    await expect(attempt).rejects.toThrow('Failed to save project information')
    expect(upsert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(lookupRepositoryByGitHubId).not.toHaveBeenCalled()
  })

  // Value: protects=deleting the card does not leave the new repository unable to save a note; fails_when=the old memory keeps the name and every save is refused; why_new=the memory outlives the card; seam=none; no_claim=the row level security exception for an orphan memory
  test('moves an orphaned memory to the name GitHub gives its id, then saves the note', async () => {
    // Arrange: no card holds repository 99; its memory still spells gitbox
    const { upsert, update } = signInWithStub(
      {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      null,
      { data: null, error: null },
      { data: { github_repo_id: 99 }, error: null },
    )

    // Act
    await upsertProjectInfoCore('card-1', {
      note: 'the new repository',
      links: [],
    })

    // Assert
    expect(lookupRepositoryByGitHubId).toHaveBeenCalledWith(99)
    expect(update).toHaveBeenCalledWith({
      repo_owner: 'laststance',
      repo_name: 'moved-99',
    })
    expect(upsert).toHaveBeenCalledWith(
      {
        repo_owner: 'laststance',
        repo_name: 'gitbox',
        github_repo_id: 42,
        note: 'the new repository',
        links: [],
      },
      { onConflict: 'user_id,repo_key' },
    )
  })

  // Value: protects=deleting a comment does not clear the comment of a different repository that used to have this name; fails_when=the name update runs after the id lookup misses; why_new=the delete followed the name whenever the id had no row; seam=none; no_claim=the dialog copy
  test("clears nothing when the name's memory belongs to a different GitHub id", async () => {
    // Arrange
    const { update } = signInWithStub(
      {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      null,
      { data: null, error: null },
      { data: { github_repo_id: 99 }, error: null },
    )

    // Act
    await deleteCommentCore('card-1')

    // Assert
    expect(update).not.toHaveBeenCalled()
  })

  // Value: protects=a failed lookup does not insert a second memory; fails_when=the save continues to the name upsert after the id read fails; why_new=the id lookup is a new request; seam=none; no_claim=the text the dialog shows
  test("saves nothing when the memory for the card's GitHub id cannot be read", async () => {
    // Arrange
    const { upsert, update } = signInWithStub(
      {
        data: {
          repo_owner: 'laststance',
          repo_name: 'nsx',
          github_repo_id: 42,
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      null,
      { data: null, error: { message: 'canceling statement' } },
    )

    // Act
    const attempt = upsertProjectInfoCore('card-1', {
      note: 'a note',
      links: [],
    })

    // Assert
    await expect(attempt).rejects.toThrow('Failed to save project information')
    expect(upsert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  // Value: protects=Delete comment reaches only the user's row of the repository whichever letter case its card spells; the key is shared by every user holding the repository; fails_when=the update filters on the raw owner/name, or drops the owner filter and leans on row level security alone; why_new=deleteCommentCore had no unit test (security review of #216); seam=none; no_claim=that the row really changes (e2e)
  test("clears the comment of the user's row of the repository whatever letter case its card spells", async () => {
    // Arrange: GitHub spells the repository LastStance/NSX, the row's repo_key is lowercase
    const { update, filterUpdatedRows } = signInWithStub({
      data: {
        repo_owner: 'LastStance',
        repo_name: 'NSX',
        board: { user_id: 'user-1' },
      },
      error: null,
    })

    // Act
    await deleteCommentCore('card-1')

    // Assert
    expect(update).toHaveBeenCalledWith({
      comment: null,
      comment_color: 'primary',
    })
    expect(filterUpdatedRows).toHaveBeenCalledWith('user_id', 'user-1')
    expect(filterUpdatedRows).toHaveBeenCalledWith('repo_key', 'laststance/nsx')
  })

  // Value: protects=deleting a comment after a rename clears the memory the card shows, which still has the old name; fails_when=the update filters on the new name and leaves the comment in place; why_new=the card and the memory meet on the GitHub id; seam=none; no_claim=that the row really changes (e2e)
  test("clears the comment of the memory that already has the card's GitHub id", async () => {
    // Arrange
    const { update, filterUpdatedRows } = signInWithStub(
      {
        data: {
          repo_owner: 'laststance',
          repo_name: 'gitbox-renamed',
          github_repo_id: 42,
          board: { user_id: 'user-1' },
        },
        error: null,
      },
      null,
      { data: { id: 'memory-1' }, error: null },
    )

    // Act
    await deleteCommentCore('card-1')

    // Assert
    expect(update).toHaveBeenCalledWith({
      comment: null,
      comment_color: 'primary',
    })
    expect(filterUpdatedRows).toHaveBeenCalledWith('id', 'memory-1')
    expect(filterUpdatedRows).toHaveBeenCalledWith('user_id', 'user-1')
    expect(filterUpdatedRows).not.toHaveBeenCalledWith(
      'repo_key',
      'laststance/gitbox-renamed',
    )
  })

  // Value: protects=the Note dialog shows what is saved for the card's repository, an empty note when nothing is, and never an empty editor over a note it could not read (a card gone in another tab, a failed request); fails_when=the embed's fields are mapped wrong, null project info throws, or a missing card or failed read is answered as an empty note; why_new=getProjectInfoCore had no unit test after the embed read; seam=none; no_claim=the note editor refusing to open (useNoteModal.test.ts)
  test.each([
    {
      situation:
        'a note, a comment and a link saved for the repository of the card',
      answer: {
        data: {
          projectinfo: {
            note: 'CLI tool documentation',
            comment: 'v2.0 release in progress',
            links: [{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
          },
        },
        error: null,
      },
      expected: {
        note: 'CLI tool documentation',
        comment: 'v2.0 release in progress',
        links: [{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
      },
    },
    {
      situation: 'nothing is saved for the repository of the card',
      answer: { data: { projectinfo: null }, error: null },
      expected: { note: '', comment: '', links: [] },
    },
    {
      situation: 'the card is not found',
      answer: {
        data: null,
        error: { code: 'PGRST116', message: 'no rows' },
      },
      expected: 'Card not found',
    },
    {
      situation: 'the request fails',
      answer: {
        data: null,
        error: { code: '57014', message: 'canceling statement' },
      },
      expected: 'Failed to fetch project information',
    },
  ])('answers $situation with $expected', async ({ answer, expected }) => {
    // Arrange
    signInWithStub(answer)

    // Act
    const outcome = await getProjectInfoCore('card-1').then(
      (projectInfo) => projectInfo,
      (error: Error) => error.message,
    )

    // Assert
    expect(outcome).toEqual(expected)
  })
})
