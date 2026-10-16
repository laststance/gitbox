/**
 * A repository id is stored only after GitHub has confirmed it.
 *
 * @see src/lib/github/verify-repository-identity.ts
 */

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createGitHubAxios, getGitHubToken } from '@/lib/axios-github'
import {
  backfillVerifiedRepositoryIds,
  verifyRepositoryIdentity,
} from '@/lib/github/verify-repository-identity'

vi.mock('@/lib/axios-github', () => ({
  getGitHubToken: vi.fn(),
  createGitHubAxios: vi.fn(),
}))

describe('verifyRepositoryIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the id GitHub answered with, including after a rename', async () => {
    // Arrange
    const get = vi.fn().mockResolvedValue({
      data: { id: 42, name: 'gitbox-renamed', owner: { login: 'laststance' } },
    })
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({ get } as never)

    // Act
    const verified = await verifyRepositoryIdentity('laststance', 'gitbox')

    // Assert
    expect(get).toHaveBeenCalledWith('/repos/laststance/gitbox')
    expect(verified).toEqual({
      outcome: 'confirmed',
      repository: {
        id: 42,
        owner: 'laststance',
        name: 'gitbox-renamed',
      },
    })
  })

  test('says the repository is gone only when GitHub answers 404', async () => {
    // Arrange
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({
      get: vi.fn().mockRejectedValue(
        new AxiosError('Not Found', '404', undefined, undefined, {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: {} as never,
          data: {},
        }),
      ),
    } as never)

    // Act
    const verified = await verifyRepositoryIdentity('laststance', 'gitbox')

    // Assert
    expect(verified).toEqual({ outcome: 'gone' })
  })

  test('returns nothing when GitHub cannot be asked', async () => {
    // Arrange
    vi.mocked(getGitHubToken).mockResolvedValue(null)

    // Act
    const verified = await verifyRepositoryIdentity('laststance', 'gitbox')

    // Assert
    expect(verified).toEqual({ outcome: 'unavailable' })
    expect(createGitHubAxios).not.toHaveBeenCalled()
  })
})

describe('backfillVerifiedRepositoryIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function supabaseFor(
    cards: { id: string; repo_owner: string; repo_name: string }[],
    cardUpdate: ReturnType<typeof vi.fn>,
    memoryUpdate: ReturnType<typeof vi.fn>,
  ) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'repocard') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  or: () => ({
                    order: () => ({
                      order: () => ({
                        limit: async () =>
                          Promise.resolve({ data: cards, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            update: cardUpdate,
          }
        }
        return { update: memoryUpdate }
      }),
    }
  }

  function updateResult(error: { code: string; message: string } | null) {
    return {
      eq: () => ({
        is: async () => Promise.resolve({ error }),
      }),
    }
  }

  test('writes the confirmed id onto the card and its memory when GitHub renamed it', async () => {
    // Arrange: the card still spells gitbox; GitHub redirects to the new name
    const cardUpdate = vi.fn().mockReturnValue(updateResult(null))
    const memoryUpdate = vi.fn().mockReturnValue({
      eq: () => ({
        eq: () => ({
          is: async () => Promise.resolve({ error: null }),
        }),
      }),
    })
    const supabase = supabaseFor(
      [{ id: 'card-1', repo_owner: 'laststance', repo_name: 'gitbox' }],
      cardUpdate,
      memoryUpdate,
    )
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({
      get: vi.fn().mockResolvedValue({
        data: {
          id: 42,
          name: 'gitbox-renamed',
          owner: { login: 'laststance' },
        },
      }),
    } as never)

    // Act
    await backfillVerifiedRepositoryIds(supabase as never, 'user-1')

    // Assert
    expect(cardUpdate).toHaveBeenCalledWith({
      github_repo_id: 42,
      github_identity_checked_at: '2026-10-16T00:00:00.000Z',
    })
    expect(memoryUpdate).toHaveBeenCalledWith({ github_repo_id: 42 })
  })

  test("does not store an id when GitHub still answers with the card's name", async () => {
    // Arrange: the name may have been taken by a different repository
    const cardUpdate = vi.fn().mockReturnValue(updateResult(null))
    const memoryUpdate = vi.fn()
    const supabase = supabaseFor(
      [{ id: 'card-1', repo_owner: 'laststance', repo_name: 'gitbox' }],
      cardUpdate,
      memoryUpdate,
    )
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({
      get: vi.fn().mockResolvedValue({
        data: { id: 42, name: 'gitbox', owner: { login: 'laststance' } },
      }),
    } as never)

    // Act
    await backfillVerifiedRepositoryIds(supabase as never, 'user-1')

    // Assert
    expect(cardUpdate).toHaveBeenCalledWith({
      github_identity_checked_at: '2026-10-16T00:00:00.000Z',
    })
    expect(memoryUpdate).not.toHaveBeenCalled()
  })

  test('remembers a repository GitHub says is gone, and does not store an id', async () => {
    // Arrange
    const cardUpdate = vi.fn().mockReturnValue(updateResult(null))
    const memoryUpdate = vi.fn()
    const supabase = supabaseFor(
      [{ id: 'card-1', repo_owner: 'laststance', repo_name: 'gone' }],
      cardUpdate,
      memoryUpdate,
    )
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({
      get: vi.fn().mockRejectedValue(
        new AxiosError('Not Found', '404', undefined, undefined, {
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: {} as never,
          data: {},
        }),
      ),
    } as never)

    // Act
    await backfillVerifiedRepositoryIds(supabase as never, 'user-1')

    // Assert
    expect(cardUpdate).toHaveBeenCalledWith({
      github_identity_checked_at: '2026-10-16T00:00:00.000Z',
    })
    expect(memoryUpdate).not.toHaveBeenCalled()
  })

  test('leaves a card unchecked when GitHub rate-limits the confirmation', async () => {
    // Arrange
    const cardUpdate = vi.fn()
    const memoryUpdate = vi.fn()
    const supabase = supabaseFor(
      [{ id: 'card-1', repo_owner: 'laststance', repo_name: 'gitbox' }],
      cardUpdate,
      memoryUpdate,
    )
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({
      get: vi.fn().mockRejectedValue(
        new AxiosError('rate limit', '429', undefined, undefined, {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {},
          config: {} as never,
          data: {},
        }),
      ),
    } as never)

    // Act
    await backfillVerifiedRepositoryIds(supabase as never, 'user-1')

    // Assert
    expect(cardUpdate).not.toHaveBeenCalled()
    expect(memoryUpdate).not.toHaveBeenCalled()
  })

  test('remembers a card whose confirmed id is already on another card', async () => {
    // Arrange
    const cardUpdate = vi
      .fn()
      .mockReturnValueOnce(
        updateResult({ code: '23505', message: 'duplicate key' }),
      )
      .mockReturnValueOnce(updateResult(null))
    const memoryUpdate = vi.fn()
    const supabase = supabaseFor(
      [{ id: 'card-2', repo_owner: 'laststance', repo_name: 'gitbox-copy' }],
      cardUpdate,
      memoryUpdate,
    )
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({
      get: vi.fn().mockResolvedValue({
        data: { id: 42, name: 'gitbox', owner: { login: 'laststance' } },
      }),
    } as never)

    // Act
    await backfillVerifiedRepositoryIds(supabase as never, 'user-1')

    // Assert
    expect(cardUpdate).toHaveBeenNthCalledWith(1, {
      github_repo_id: 42,
      github_identity_checked_at: '2026-10-16T00:00:00.000Z',
    })
    expect(cardUpdate).toHaveBeenNthCalledWith(2, {
      github_identity_checked_at: '2026-10-16T00:00:00.000Z',
    })
    expect(memoryUpdate).not.toHaveBeenCalled()
  })
})
