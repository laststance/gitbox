/**
 * Unit tests: refreshing a card writes GitHub's snapshot and keeps the name.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, test, vi } from 'vitest'

import {
  CARDS_PER_METADATA_REFRESH,
  cardsForThisRefresh,
  refreshBoardMetadataCore,
  refreshCardMetadataCore,
  type ReadRepositorySnapshot,
} from '@/lib/actions/refresh-metadata-core'
import { ActionUserError } from '@/lib/actions/types'
import type { Database } from '@/lib/supabase/types'
import type { GitHubRepository } from '@/lib/types/github'

const USER_ID = '00000000-0000-0000-0000-000000000001'

const repository: GitHubRepository = {
  id: 42,
  name: 'gitbox',
  full_name: 'laststance/gitbox',
  owner: { login: 'laststance', avatar_url: '' },
  description: 'Boards for repositories',
  stargazers_count: 7,
  language: 'TypeScript',
  topics: ['kanban'],
  visibility: 'public',
  updated_at: '2026-10-16T00:00:00Z',
}

function readAs(
  result: Awaited<ReturnType<ReadRepositorySnapshot>>,
): ReadRepositorySnapshot {
  return async () => result
}

function fakeSupabase(options: {
  board?: { id: string } | null
  card?: {
    id: string
    repo_owner: string
    repo_name: string
    github_repo_id: number | null
  } | null
  cards?: Array<{
    id: string
    repo_owner: string
    repo_name: string
    github_repo_id: number | null
  }>
}) {
  const updates: Array<Record<string, unknown>> = []
  const client = {
    updates,
    from(table: string) {
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        order() {
          return builder
        },
        async range() {
          return Promise.resolve({ data: options.cards ?? [], error: null })
        },
        async maybeSingle() {
          if (table === 'board') {
            return Promise.resolve({
              data:
                options.board === undefined ? { id: 'board-1' } : options.board,
              error: null,
            })
          }
          return Promise.resolve({ data: options.card ?? null, error: null })
        },
        update(payload: Record<string, unknown>) {
          return {
            async eq() {
              updates.push(payload)
              return Promise.resolve({ error: null })
            },
          }
        },
      }
      return builder
    },
  }
  return client
}

describe('refreshCardMetadataCore', () => {
  // Value: protects=a card that never stored a GitHub id gets that id and the current snapshot; fails_when=the refresh rewrites the description but leaves github_repo_id null, so a renamed repository can be added a second time; why_new=cards added before the id was stored have none; seam=none; no_claim=the picker match (find-board-placement)
  test('stores the GitHub id and the snapshot when the card has no id yet', async () => {
    // Arrange
    const supabase = fakeSupabase({
      card: {
        id: 'card-1',
        repo_owner: 'laststance',
        repo_name: 'gitbox',
        github_repo_id: null,
      },
    })

    // Act
    const refreshed = await refreshCardMetadataCore(
      supabase as unknown as SupabaseClient<Database>,
      USER_ID,
      'card-1',
      readAs({ outcome: 'read', repository }),
    )

    // Assert
    expect(refreshed).toEqual({
      id: 'card-1',
      description: 'Boards for repositories',
      meta: {
        stars: 7,
        language: 'TypeScript',
        topics: ['kanban'],
        visibility: 'public',
        description: 'Boards for repositories',
        updatedAt: '2026-10-16T00:00:00Z',
        githubId: 42,
      },
    })
    expect(supabase.updates).toEqual([
      {
        meta: refreshed.meta,
        github_repo_id: 42,
      },
    ])
  })

  // Value: protects=a renamed repository keeps the note's owner and name and still stores the same GitHub id; fails_when=the card is renamed and the note, which is keyed by owner and name, no longer belongs to it; why_new=GitHub's redirect returns the new name; seam=none; no_claim=the picker, which matches the id
  test('keeps the card name when GitHub has renamed the repository', async () => {
    // Arrange
    const supabase = fakeSupabase({
      card: {
        id: 'card-1',
        repo_owner: 'laststance',
        repo_name: 'gitbox',
        github_repo_id: 42,
      },
    })
    const renamed: GitHubRepository = {
      ...repository,
      name: 'gitbox-next',
      full_name: 'ryota-murakami/gitbox-next',
      owner: { login: 'ryota-murakami', avatar_url: '' },
    }

    // Act
    await refreshCardMetadataCore(
      supabase as unknown as SupabaseClient<Database>,
      USER_ID,
      'card-1',
      readAs({ outcome: 'read', repository: renamed }),
    )

    // Assert
    expect(supabase.updates).toEqual([
      {
        meta: {
          stars: 7,
          language: 'TypeScript',
          topics: ['kanban'],
          visibility: 'public',
          description: 'Boards for repositories',
          updatedAt: '2026-10-16T00:00:00Z',
          githubId: 42,
        },
        github_repo_id: 42,
      },
    ])
    expect(supabase.updates[0]).not.toHaveProperty('repo_owner')
    expect(supabase.updates[0]).not.toHaveProperty('repo_name')
  })

  // Value: protects=a name that now belongs to a different repository does not replace this card's snapshot; fails_when=the card takes the other repository's stars and id; why_new=the stored id is how a reused name is told apart; seam=none; no_claim=the toast text beyond the sentence
  test('leaves a card whose name now belongs to a different repository', async () => {
    // Arrange
    const supabase = fakeSupabase({
      card: {
        id: 'card-1',
        repo_owner: 'laststance',
        repo_name: 'gitbox',
        github_repo_id: 42,
      },
    })

    // Act
    const refresh = refreshCardMetadataCore(
      supabase as unknown as SupabaseClient<Database>,
      USER_ID,
      'card-1',
      readAs({ outcome: 'read', repository: { ...repository, id: 99 } }),
    )

    // Assert
    await expect(refresh).rejects.toThrow(ActionUserError)
    await expect(refresh).rejects.toThrow(
      'This name now belongs to a different repository, so the card was left as it is.',
    )
    expect(supabase.updates).toEqual([
      {
        github_identity_checked_at: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T/,
        ) as string,
      },
    ])
    expect(supabase.updates[0]).not.toHaveProperty('meta')
  })

  // Value: protects=a missing card is explained instead of being reported as an unexpected error; fails_when=the toast says an unexpected error occurred and the card looks broken; why_new=the refresh reads the card before GitHub; seam=none; no_claim=Sentry
  test("says the card was not found when it is not this user's", async () => {
    // Arrange
    const supabase = fakeSupabase({ card: null })

    // Act
    const refresh = refreshCardMetadataCore(
      supabase as unknown as SupabaseClient<Database>,
      USER_ID,
      'card-1',
      readAs({ outcome: 'read', repository }),
    )

    // Assert
    await expect(refresh).rejects.toThrow('Card not found')
    expect(supabase.updates).toEqual([])
  })
})

describe('refreshBoardMetadataCore', () => {
  // Value: protects=one missing repository does not stop the rest of the board from refreshing; fails_when=the first 404 rejects the whole request and every other card keeps its old snapshot; why_new=a board refresh asks GitHub once per card; seam=none; no_claim=the header toast
  test('refreshes the card GitHub still has and leaves the one it does not', async () => {
    // Arrange
    const supabase = fakeSupabase({
      cards: [
        {
          id: 'card-gone',
          repo_owner: 'laststance',
          repo_name: 'gone',
          github_repo_id: 1,
        },
        {
          id: 'card-live',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
        },
      ],
    })
    const read: ReadRepositorySnapshot = vi.fn(async (_owner, name) => {
      if (name === 'gone') return { outcome: 'gone' as const }
      return { outcome: 'read' as const, repository }
    })

    // Act
    const result = await refreshBoardMetadataCore(
      supabase as unknown as SupabaseClient<Database>,
      USER_ID,
      'board-1',
      read,
    )

    // Assert
    expect(result.failed).toEqual([{ id: 'card-gone', reason: 'gone' }])
    expect(result.updated.map((card) => card.id)).toEqual(['card-live'])
    expect(result.remaining).toBe(0)
    expect(result.updated[0]?.meta.githubId).toBe(42)
  })

  // Value: protects=a board GitHub did not answer is not announced as empty; fails_when=the toast says there are no cards to refresh and the user thinks the board was updated; why_new=a skipped read used to be dropped from the result; seam=none; no_claim=the toast method
  test('reports every card GitHub did not answer', async () => {
    // Arrange
    const supabase = fakeSupabase({
      cards: [
        {
          id: 'card-1',
          repo_owner: 'laststance',
          repo_name: 'gitbox',
          github_repo_id: 42,
        },
      ],
    })

    // Act
    const result = await refreshBoardMetadataCore(
      supabase as unknown as SupabaseClient<Database>,
      USER_ID,
      'board-1',
      readAs({ outcome: 'unavailable' }),
    )

    // Assert
    expect(result).toEqual({
      updated: [],
      failed: [{ id: 'card-1', reason: 'unavailable' }],
      remaining: 0,
    })
    expect(supabase.updates).toEqual([])
  })

  // Value: protects=a board refresh does not ask GitHub about more than 100 cards at once; fails_when=one click requests every card and the request runs long enough to time out; why_new=the cap; seam=none; no_claim=the order of the next batch
  test('leaves cards past the first 100 for the next refresh', () => {
    // Arrange
    const cards = Array.from(
      { length: CARDS_PER_METADATA_REFRESH + 1 },
      (_, index) => index,
    )

    // Act
    const batch = cardsForThisRefresh(cards)

    // Assert
    expect(batch.batch).toHaveLength(100)
    expect(batch.batch[0]).toBe(0)
    expect(batch.batch[99]).toBe(99)
    expect(batch.remaining).toBe(1)
  })

  // Value: protects=refreshing a board the user does not own writes nothing; fails_when=another account's cards are read from GitHub and updated; why_new=the board id comes from the browser; seam=none; no_claim=row level security
  test("says the board was not found when it is not this user's", async () => {
    // Arrange
    const supabase = fakeSupabase({ board: null, cards: [] })
    const read = vi.fn<ReadRepositorySnapshot>()

    // Act
    const refresh = refreshBoardMetadataCore(
      supabase as unknown as SupabaseClient<Database>,
      USER_ID,
      'board-1',
      read,
    )

    // Assert
    await expect(refresh).rejects.toThrow('Board not found')
    expect(read).not.toHaveBeenCalled()
    expect(supabase.updates).toEqual([])
  })
})
