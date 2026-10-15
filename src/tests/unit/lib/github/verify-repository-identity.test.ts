/**
 * A repository id is stored only after GitHub has confirmed it.
 *
 * @see src/lib/github/verify-repository-identity.ts
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

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
      id: 42,
      owner: 'laststance',
      name: 'gitbox-renamed',
    })
  })

  test('returns nothing when GitHub cannot be asked', async () => {
    // Arrange
    vi.mocked(getGitHubToken).mockResolvedValue(null)

    // Act
    const verified = await verifyRepositoryIdentity('laststance', 'gitbox')

    // Assert
    expect(verified).toBeNull()
    expect(createGitHubAxios).not.toHaveBeenCalled()
  })
})

describe('backfillVerifiedRepositoryIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('writes the confirmed id onto the card and its memory, and leaves a colliding card alone', async () => {
    // Arrange
    const cardUpdate = vi
      .fn()
      .mockReturnValueOnce({
        eq: () => ({
          is: async () => Promise.resolve({ error: null }),
        }),
      })
      .mockReturnValueOnce({
        eq: () => ({
          is: async () =>
            Promise.resolve({ error: { code: '23505', message: 'duplicate' } }),
        }),
      })
    const memoryUpdate = vi.fn().mockReturnValue({
      eq: () => ({
        eq: () => ({
          is: async () => Promise.resolve({ error: null }),
        }),
      }),
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'repocard') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: async () =>
                      Promise.resolve({
                        data: [
                          {
                            id: 'card-1',
                            repo_owner: 'laststance',
                            repo_name: 'gitbox',
                          },
                          {
                            id: 'card-2',
                            repo_owner: 'laststance',
                            repo_name: 'gitbox-copy',
                          },
                        ],
                        error: null,
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
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: 42, name: 'gitbox', owner: { login: 'laststance' } },
      })
      .mockResolvedValueOnce({
        data: { id: 42, name: 'gitbox', owner: { login: 'laststance' } },
      })
    vi.mocked(getGitHubToken).mockResolvedValue('gho_token')
    vi.mocked(createGitHubAxios).mockReturnValue({ get } as never)

    // Act
    await backfillVerifiedRepositoryIds(supabase as never, 'user-1')

    // Assert
    expect(cardUpdate).toHaveBeenCalledTimes(2)
    expect(cardUpdate).toHaveBeenNthCalledWith(1, { github_repo_id: 42 })
    expect(memoryUpdate).toHaveBeenCalledTimes(1)
    expect(memoryUpdate).toHaveBeenCalledWith({ github_repo_id: 42 })
  })
})
