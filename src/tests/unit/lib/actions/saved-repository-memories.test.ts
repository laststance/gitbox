/**
 * Unit Tests: summarizeMemoryRow
 *
 * Which saved memories get a mark in the Add Repositories picker (issue #216):
 * a note or a comment with text other than whitespace (a note read as the
 * editor document the Note dialog stores), or a link with a URL,
 * counted after the same normalization the Note dialog uses. A comment color
 * alone is not worth a mark.
 *
 * @see src/lib/actions/saved-repository-memories.ts
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  lookupSavedRepositoryMemories,
  summarizeMemoryRow,
} from '@/lib/actions/saved-repository-memories'
import type { Database } from '@/lib/supabase/types'

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

type MemoryQueryResult = {
  data: unknown
  error: { message: string } | null
}

/**
 * Supabase stand-in for the memory lookup: the read of `projectinfo` answers
 * with the given result. `from` and `eq` are spies, so a test sees which table
 * was read and how the read was filtered.
 * @param result - What the query resolves to.
 * @returns The client and its spies.
 * @example
 * makeSupabaseStub({ data: [], error: null }).supabase
 */
function makeSupabaseStub(result: MemoryQueryResult) {
  const from = vi.fn()
  const eq = vi.fn()
  const query = {
    select: () => query,
    eq: (...args: unknown[]) => {
      eq(...args)
      return query
    },
    // Makes the builder awaitable, like the real PostgREST builder
    then: async (resolve: (value: MemoryQueryResult) => unknown) =>
      resolve(result),
  }
  from.mockImplementation(() => query)

  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    from,
    eq,
  }
}

describe('summarizeMemoryRow', () => {
  // Value: protects=the picker marks only memories that bring something back; fails_when=whitespace or an emptied editor document counts as a note, a color alone gets a mark, or a link without URL is counted; why_new=new rule (eng review R4); seam=none; no_claim=the database query (mocked out; e2e repository-memory.spec.ts)
  test.each([
    { holds: 'a note of spaces', note: '   ', comment: null, links: [] },
    {
      holds: 'a note the Note dialog emptied',
      note: '[{"type":"p","children":[{"text":""}]}]',
      comment: null,
      links: [],
    },
    { holds: 'an empty comment', note: null, comment: '', links: [] },
    {
      holds: 'a link without URL',
      note: '',
      comment: null,
      links: [{ type: 'vercel', url: ' ' }],
    },
    {
      holds: 'the default links value of the table',
      note: null,
      comment: null,
      links: {},
    },
  ])(
    'gives no mark to a memory that holds only $holds',
    ({ note, comment, links }) => {
      // Arrange
      const row = {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        note,
        comment,
        links,
      }

      // Act
      const memory = summarizeMemoryRow(row)

      // Assert
      expect(memory).toBeNull()
    },
  )

  // Value: protects=a note saved by the Note dialog (an editor document in JSON) is named only when it holds text, so a link saved alone is not called "note, 1 link" (issue #216 red team); fails_when=the stored JSON string is measured instead of its text; why_new=the cases above used plain text only; seam=none; no_claim=what Plate serializes (slate-utils.test.ts)
  test.each([
    {
      document: 'a paragraph without text',
      note: '[{"type":"p","children":[{"text":""}]}]',
      expectedHasNote: false,
    },
    {
      document: 'a paragraph with text',
      note: '[{"type":"p","children":[{"text":"Release with pnpm release"}]}]',
      expectedHasNote: true,
    },
  ])(
    'names the note of $document saved beside a link as it reads',
    ({ note, expectedHasNote }) => {
      // Arrange
      const row = {
        repo_owner: 'laststance',
        repo_name: 'nsx',
        note,
        comment: null,
        links: [{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
      }

      // Act
      const memory = summarizeMemoryRow(row)

      // Assert
      expect(memory).toEqual({
        identifier: 'laststance/nsx',
        hasNote: expectedHasNote,
        linkCount: 1,
        hasComment: false,
      })
    },
  )

  // Value: protects=one stored row of an odd shape (an older client's note or links) costs only its own mark, not the marks of every repository (red team review of #216); fails_when=summarizing the row throws, which fails the whole lookup and the picker shows no mark at all; why_new=every case above used well-formed values; seam=none; no_claim=which shapes older clients stored (none on production on 2026-10-14)
  test.each([
    {
      shape: 'a note that is an array of numbers',
      note: '[1]',
      links: [],
      expected: {
        identifier: 'laststance/nsx',
        hasNote: true,
        linkCount: 0,
        hasComment: false,
      },
    },
    {
      shape: 'legacy links whose URLs are no strings',
      note: null,
      links: { production: [5] },
      expected: null,
    },
  ])('reads $shape without failing', ({ note, links, expected }) => {
    // Arrange
    const row = {
      repo_owner: 'laststance',
      repo_name: 'nsx',
      note,
      comment: null,
      links,
    }

    // Act
    const memory = summarizeMemoryRow(row)

    // Assert
    expect(memory).toEqual(expected)
  })

  // Value: protects=links in the legacy categorized form are counted like the Note dialog shows them; fails_when=the raw JSON is measured instead of normalizeLinks; why_new=new rule (R4); seam=none; no_claim=none beyond protects
  test('counts the links of the legacy categorized form', () => {
    // Arrange
    const row = {
      repo_owner: 'laststance',
      repo_name: 'nsx',
      note: null,
      comment: null,
      links: {
        production: ['https://nsx.example.com'],
        tracking: ['https://sentry.example.com'],
      },
    }

    // Act
    const memory = summarizeMemoryRow(row)

    // Assert
    expect(memory).toEqual({
      identifier: 'laststance/nsx',
      hasNote: false,
      linkCount: 2,
      hasComment: false,
    })
  })

  // Value: protects=the mark matches the picker's lowercase repository key whatever the card's letter case; fails_when=the identifier keeps the stored case; why_new=new rule (R4); seam=none; no_claim=none beyond protects
  test('names the repository in lowercase and tells what is saved', () => {
    // Arrange
    const row = {
      repo_owner: 'LastStance',
      repo_name: 'NSX',
      note: 'CLI tool documentation',
      comment: 'v2.0リリース準備中',
      links: [{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
    }

    // Act
    const memory = summarizeMemoryRow(row)

    // Assert
    expect(memory).toEqual({
      identifier: 'laststance/nsx',
      hasNote: true,
      linkCount: 1,
      hasComment: true,
    })
  })
})

describe('lookupSavedRepositoryMemories', () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear()
  })

  // Value: protects=the picker's marks come from the signed-in user's own memories, and a memory that holds nothing gets no mark (eng review R4, pre-landing review of #216); fails_when=the query drops the user filter (another user's rows would mark repositories once RLS is loosened), or empty rows reach the picker; why_new=only the row summary was tested; seam=Supabase client stub; no_claim=row level security itself (e2e project-info-data-access.spec.ts)
  test('reads the memories of the signed-in user only and leaves out the empty ones', async () => {
    // Arrange
    const { supabase, from, eq } = makeSupabaseStub({
      data: [
        {
          repo_owner: 'Laststance',
          repo_name: 'NSX',
          note: null,
          comment: 'v2.0 release',
          links: [],
        },
        {
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          note: '   ',
          comment: null,
          links: [],
        },
      ],
      error: null,
    })

    // Act
    const memories = await lookupSavedRepositoryMemories(supabase, 'user-1')

    // Assert
    expect(from).toHaveBeenCalledWith('projectinfo')
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(memories).toEqual([
      {
        identifier: 'laststance/nsx',
        hasNote: false,
        linkCount: 0,
        hasComment: true,
      },
    ])
  })

  // Value: protects=marks cut off at the PostgREST row cap are reported, not lost without a word (pre-landing review of #216); fails_when=the warning is dropped or no longer names the user and the count; why_new=the cap check had no test; seam=Supabase client stub, Sentry mock; no_claim=the cap of the production API (POSTGREST_MAX_ROWS)
  test('warns that marks may be missing when the lookup reaches the row limit', async () => {
    // Arrange
    const emptyRow = {
      repo_owner: 'laststance',
      repo_name: 'nsx',
      note: null,
      comment: null,
      links: [],
    }
    const { supabase } = makeSupabaseStub({
      data: Array.from({ length: 1000 }, () => emptyRow),
      error: null,
    })

    // Act
    await lookupSavedRepositoryMemories(supabase, 'user-1')

    // Assert
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Saved repository memory lookup may be truncated at PostgREST row limit',
      { level: 'warning', extra: { userId: 'user-1', memoryCount: 1000 } },
    )
  })

  // Value: protects=a failed memory read reaches the caller, which shows the list without marks (R3); fails_when=the lookup returns no marks as if nothing were saved, hiding the failure from Sentry; why_new=only the caller's handling was tested (board-data.test.ts); seam=Supabase client stub; no_claim=how the caller degrades (board-data.test.ts)
  test('fails the lookup when the memories cannot be read', async () => {
    // Arrange
    const { supabase } = makeSupabaseStub({
      data: null,
      error: { message: 'permission denied for table projectinfo' },
    })

    // Act
    const lookup = lookupSavedRepositoryMemories(supabase, 'user-1')

    // Assert
    await expect(lookup).rejects.toThrow(
      'Failed to look up saved repository memories',
    )
  })
})
