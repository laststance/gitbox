/**
 * Reads the GitHub fields a card stores in `repocard.meta`.
 *
 * {@link addRepositoriesToBoard} writes that snapshot once, when the card is
 * added. {@link refreshCardMetadataCore} reads it again from GitHub, so a
 * description, star count, language or visibility that changed on GitHub
 * reaches the card. The browser never supplies these fields.
 */

import { isAxiosError } from 'axios'

import { createGitHubAxios, getGitHubToken } from '@/lib/axios-github'
import type { Visibility } from '@/lib/types/domain-primitives'
import type { GitHubRepository } from '@/lib/types/github'

/** What GitHub returned for one owner and name, or why it did not. */
export type RepositorySnapshotRead =
  | { outcome: 'read'; repository: GitHubRepository }
  | { outcome: 'gone' }
  | { outcome: 'unavailable' }

/** The subset of a GitHub repository response this reader accepts. */
interface GitHubRepositoryPayload {
  id?: unknown
  name?: unknown
  full_name?: unknown
  owner?: { login?: unknown } | null
  description?: unknown
  stargazers_count?: unknown
  language?: unknown
  topics?: unknown
  visibility?: unknown
  private?: unknown
  updated_at?: unknown
}

/**
 * Turns a GitHub repository response into the snapshot a card stores.
 *
 * Called by {@link readRepositorySnapshot}. A payload that is missing an id,
 * a name, a star count or a visibility is refused: nothing is written from a
 * shape GitHub did not actually return.
 *
 * @param payload - The JSON body of `GET /repos/{owner}/{repo}`.
 * @returns The repository, or `null` when the body cannot be stored.
 * @example
 * repositoryFromGitHubPayload({ id: 1, name: 'gitbox', full_name: 'laststance/gitbox', owner: { login: 'laststance' }, description: null, stargazers_count: 0, language: null, topics: [], visibility: 'public', updated_at: '2026-10-16T00:00:00Z' })
 */
export function repositoryFromGitHubPayload(
  payload: GitHubRepositoryPayload,
): GitHubRepository | null {
  if (
    typeof payload.id !== 'number' ||
    !Number.isInteger(payload.id) ||
    payload.id <= 0
  ) {
    return null
  }
  if (typeof payload.name !== 'string' || payload.name.length === 0) return null
  if (typeof payload.full_name !== 'string' || payload.full_name.length === 0) {
    return null
  }
  if (
    typeof payload.owner?.login !== 'string' ||
    payload.owner.login.length === 0
  ) {
    return null
  }
  if (
    typeof payload.stargazers_count !== 'number' ||
    !Number.isInteger(payload.stargazers_count) ||
    payload.stargazers_count < 0
  ) {
    return null
  }
  if (
    typeof payload.updated_at !== 'string' ||
    payload.updated_at.length === 0
  ) {
    return null
  }
  if (payload.description !== null && typeof payload.description !== 'string') {
    return null
  }
  if (
    payload.language !== null &&
    payload.language !== undefined &&
    typeof payload.language !== 'string'
  ) {
    return null
  }

  const visibility = readVisibility(payload)
  if (!visibility) return null

  // Topics graduated into the default response. A body that omits them still
  // has the rest of the snapshot, so the card stores an empty list.
  const topics = Array.isArray(payload.topics)
    ? payload.topics.filter(
        (topic): topic is string => typeof topic === 'string',
      )
    : []

  return {
    id: payload.id,
    name: payload.name,
    full_name: payload.full_name,
    owner: { login: payload.owner.login, avatar_url: '' },
    description: payload.description,
    stargazers_count: payload.stargazers_count,
    language: typeof payload.language === 'string' ? payload.language : null,
    topics,
    visibility,
    updated_at: payload.updated_at,
  }
}

/**
 * Asks GitHub what `owner/name` is now, including the fields stored on a card.
 *
 * A rename answers with the same id and the current name, because the client
 * follows GitHub's redirect. Called by {@link refreshCardMetadataCore} and
 * {@link refreshBoardMetadataCore}. A missing token, a rate limit or a failed
 * request is `unavailable`: the card is left as it is and can be tried again.
 * 404 and 451 are `gone`.
 *
 * @param owner - Owner login stored on the card.
 * @param name - Repository name stored on the card.
 * @returns The repository GitHub returned, or why it did not.
 * @example
 * const read = await readRepositorySnapshot('laststance', 'gitbox')
 * if (read.outcome === 'read') read.repository.stargazers_count
 */
export async function readRepositorySnapshot(
  owner: string,
  name: string,
): Promise<RepositorySnapshotRead> {
  const token = await getGitHubToken()
  if (!token) return { outcome: 'unavailable' }

  const api = createGitHubAxios({
    token,
    clearTokenCookieOnUnauthorized: false,
  })
  try {
    const { data } = await api.get<GitHubRepositoryPayload>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    )
    const repository = repositoryFromGitHubPayload(data)
    if (!repository) return { outcome: 'unavailable' }
    return { outcome: 'read', repository }
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    // 404 and 451 are the only answers that mean the repository is gone
    if (status === 404 || status === 451) return { outcome: 'gone' }
    return { outcome: 'unavailable' }
  }
}

/**
 * Reads `visibility`, or derives it from the boolean GitHub still sends.
 *
 * @param payload - The repository body.
 * @returns A visibility the card can store, or `null` when neither field is usable.
 */
function readVisibility(payload: GitHubRepositoryPayload): Visibility | null {
  if (
    payload.visibility === 'public' ||
    payload.visibility === 'private' ||
    payload.visibility === 'internal'
  ) {
    return payload.visibility
  }
  if (payload.private === true) return 'private'
  if (payload.private === false) return 'public'
  return null
}
