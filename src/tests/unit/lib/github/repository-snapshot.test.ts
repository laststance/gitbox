/**
 * Unit tests: a card's GitHub snapshot is taken from GitHub's own response.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createGitHubAxios, getGitHubToken } from '@/lib/axios-github'
import {
  readRepositorySnapshot,
  repositoryFromGitHubPayload,
} from '@/lib/github/repository-snapshot'

vi.mock('@/lib/axios-github', () => ({
  getGitHubToken: vi.fn(),
  createGitHubAxios: vi.fn(),
}))

const repositoryBody = {
  id: 42,
  name: 'gitbox',
  full_name: 'laststance/gitbox',
  owner: { login: 'laststance' },
  description: 'Boards for repositories',
  stargazers_count: 7,
  language: 'TypeScript',
  topics: ['kanban'],
  visibility: 'public',
  updated_at: '2026-10-16T00:00:00Z',
}

describe('repositoryFromGitHubPayload', () => {
  // Value: protects=a refresh stores the description, stars, language, topics and visibility GitHub returned; fails_when=a field is dropped or renamed and the card keeps the snapshot from the day it was added; why_new=the refresh is the first reader of these fields; seam=none; no_claim=the database write (refresh-metadata-core.test.ts)
  test('keeps the fields a card shows from the repository GitHub returned', () => {
    // Arrange
    const payload = repositoryBody

    // Act
    const repository = repositoryFromGitHubPayload(payload)

    // Assert
    expect(repository).toEqual({
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
    })
  })

  // Value: protects=a private repository whose response has no visibility string is still stored as private; fails_when=the refresh refuses the body and the card keeps a public snapshot; why_new=GitHub sends visibility only on some responses and private on all of them; seam=none; no_claim=the HTTP client
  test('reads private from the boolean when visibility is absent', () => {
    // Arrange
    const payload = { ...repositoryBody, visibility: undefined, private: true }

    // Act
    const repository = repositoryFromGitHubPayload(payload)

    // Assert
    expect(repository?.visibility).toBe('private')
  })

  // Value: protects=a body without an id is not stored as this card's repository; fails_when=githubId becomes something other than a GitHub id and a later add matches the wrong card; why_new=the id is what tells a rename from a new repository; seam=none; no_claim=the toast
  test('refuses a repository body that has no id', () => {
    // Arrange
    const payload = { ...repositoryBody, id: undefined }

    // Act
    const repository = repositoryFromGitHubPayload(payload)

    // Assert
    expect(repository).toBeNull()
  })
})

describe('readRepositorySnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=a refresh without a GitHub token does not call GitHub; fails_when=the request goes out unauthenticated and a 401 clears the session; why_new=the reader is new; seam=none; no_claim=the toast wording
  test('does not call GitHub when the token is missing', async () => {
    // Arrange
    vi.mocked(getGitHubToken).mockResolvedValue(null)

    // Act
    const read = await readRepositorySnapshot('laststance', 'gitbox')

    // Assert
    expect(read).toEqual({ outcome: 'unavailable' })
    expect(createGitHubAxios).not.toHaveBeenCalled()
  })

  // Value: protects=a deleted repository is reported as gone, so the card is left as it is; fails_when=a 404 is treated as a temporary failure and the user is told to try again forever; why_new=the refresh distinguishes the two; seam=none; no_claim=the database mark
  test('reports a deleted repository as gone', async () => {
    // Arrange
    vi.mocked(getGitHubToken).mockResolvedValue('token')
    vi.mocked(createGitHubAxios).mockReturnValue({
      get: vi.fn(async () => {
        throw { isAxiosError: true, response: { status: 404 } }
      }),
    } as never)

    // Act
    const read = await readRepositorySnapshot('laststance', 'gitbox')

    // Assert
    expect(read).toEqual({ outcome: 'gone' })
  })
})
