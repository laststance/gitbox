import type { RepoIdentifier } from '@/lib/types/domain-primitives'

/**
 * Builds the case-insensitive identity of a GitHub repository.
 *
 * GitHub treats `Owner/Repo` and `owner/repo` as the same repository, so every
 * "is this repository already placed?" comparison (picker, server actions) goes
 * through this one function instead of comparing raw strings.
 *
 * @param owner - Repository owner login, any letter case.
 * @param name - Repository name, any letter case.
 * @returns Lowercase `owner/name`.
 * @example
 * toRepoIdentifier('Laststance', 'GitBox') // => 'laststance/gitbox'
 */
export const toRepoIdentifier = (owner: string, name: string): RepoIdentifier =>
  `${owner}/${name}`.toLowerCase()
