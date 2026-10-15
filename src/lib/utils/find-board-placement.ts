/**
 * Finds the card that already holds a GitHub repository.
 *
 * A confirmed GitHub id wins over `owner/name`, so a rename or a transfer
 * still finds the card. Called by the Add Repositories picker and by
 * {@link splitRequestedRepos}.
 *
 * @param placements - Cards the user already has, first card wins on a tie.
 * @param repository - The repository being classified. `githubId` is omitted
 *   when it has not been confirmed.
 * @returns The placement, or `undefined` when the repository is on no board.
 * @example
 * findBoardPlacement(
 *   [{ identifier: 'old/name', githubRepoId: 42, boardId: 'b', boardName: 'Work', cardId: 'c' }],
 *   { identifier: 'new/name', githubId: 42 },
 * )
 * // => the placement whose githubRepoId is 42
 */

export interface PlacementIdentity {
  /** Lowercase `owner/name`. */
  identifier: string
  /** GitHub repository id, once the API has confirmed it. */
  githubRepoId?: number | null
}

export interface RepositoryIdentity {
  /** Lowercase `owner/name` of the repository being looked up. */
  identifier: string
  /** GitHub repository id, when this side of the comparison has one. */
  githubId?: number | null
}

/**
 * Indexes placements once so each repository is classified without scanning
 * the list again.
 *
 * @param placements - Cards the user already has.
 * @returns Maps from lowercase `owner/name` and from a confirmed GitHub id.
 *   The first card wins when legacy data has two.
 * @example
 * indexBoardPlacements([{ identifier: 'a/b', githubRepoId: 7, boardId: 'b', boardName: 'Work', cardId: 'c' }])
 */
export function indexBoardPlacements<Placement extends PlacementIdentity>(
  placements: readonly Placement[],
): {
  byIdentifier: Map<string, Placement>
  byGitHubId: Map<number, Placement>
} {
  const byIdentifier = new Map<string, Placement>()
  const byGitHubId = new Map<number, Placement>()
  for (const placement of placements) {
    if (!byIdentifier.has(placement.identifier)) {
      byIdentifier.set(placement.identifier, placement)
    }
    // Null means the id is not confirmed yet, so the name is the only key
    if (
      typeof placement.githubRepoId === 'number' &&
      !byGitHubId.has(placement.githubRepoId)
    ) {
      byGitHubId.set(placement.githubRepoId, placement)
    }
  }
  return { byIdentifier, byGitHubId }
}

/**
 * Resolves one repository against indexes from {@link indexBoardPlacements}.
 *
 * @param indexes - The maps that function built.
 * @param repository - The repository being classified.
 * @returns The placement, preferring a confirmed GitHub id over the name.
 * @example
 * findIndexedPlacement(indexBoardPlacements([]), { identifier: 'a/b' })
 * // => undefined
 */
export function findIndexedPlacement<Placement extends PlacementIdentity>(
  indexes: {
    byIdentifier: Map<string, Placement>
    byGitHubId: Map<number, Placement>
  },
  repository: RepositoryIdentity,
): Placement | undefined {
  if (typeof repository.githubId === 'number') {
    const byId = indexes.byGitHubId.get(repository.githubId)
    if (byId) return byId
  }
  return indexes.byIdentifier.get(repository.identifier)
}
