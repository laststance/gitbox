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

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

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
function signInWithStub(card: Answer, writeError: Answer['error'] = null) {
  const upsert = vi.fn(async () => ({ error: writeError }))
  // A PostgREST filter builder: chainable, and awaited for its answer
  const filteredUpdate = {
    eq: vi.fn(() => filteredUpdate),
    then: (resolve: (answer: { error: Answer['error'] }) => void): void =>
      resolve({ error: writeError }),
  }
  const update = vi.fn(() => filteredUpdate)
  const from = vi.fn((table: string) => {
    if (table === 'repocard') {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => card,
      }
      return query
    }
    if (table === 'projectinfo') {
      return { upsert, update }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  createClient.mockResolvedValue({ from })
  return { from, upsert, update, filterUpdatedRows: filteredUpdate.eq }
}

describe('project-info-core', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
