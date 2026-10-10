import type { RepoIdentifier } from '@/lib/types/domain-primitives'

/**
 * Builds the case-insensitive identity of a GitHub repository.
 *
 * GitHub treats `Owner/Repo` and `owner/repo` as the same repository, so the
 * server actions and placement lookups build every "is this repository already
 * placed?" key through this one function instead of comparing raw strings.
 * The picker's catalog rows use GitHub's `full_name` lowercased, which is the
 * same string and also exists when a repository has no owner data.
 *
 * @param owner - Repository owner login, any letter case.
 * @param name - Repository name, any letter case.
 * @returns Lowercase `owner/name`.
 * @example
 * toRepoIdentifier('Laststance', 'GitBox') // => 'laststance/gitbox'
 */
export const toRepoIdentifier = (owner: string, name: string): RepoIdentifier =>
  `${owner}/${name}`.toLowerCase()
