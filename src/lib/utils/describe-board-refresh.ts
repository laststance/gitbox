/**
 * The sentence shown after a board's cards are read from GitHub again.
 *
 * Called by {@link BoardPageClient} once {@link refreshBoardMetadata} has
 * answered. The counts are the action's, so the toast and the test name the
 * same result.
 *
 * @param result - How many cards were written, how many GitHub did not give,
 *   and how many were left for a later refresh.
 * @returns The sentence for the toast.
 * @example
 * describeBoardRefresh({ updated: 2, failed: 1, remaining: 0 })
 * // => 'Refreshed 2 cards from GitHub. 1 could not be read.'
 */
export function describeBoardRefresh(result: {
  updated: number
  failed: number
  remaining: number
}): string {
  if (result.updated === 0 && result.failed === 0) {
    return 'This board has no cards to refresh.'
  }
  if (result.updated === 0) {
    return 'No card could be read from GitHub.'
  }

  const refreshed =
    result.updated === 1
      ? 'Refreshed 1 card from GitHub.'
      : `Refreshed ${result.updated} cards from GitHub.`
  const unread =
    result.failed === 0
      ? ''
      : result.failed === 1
        ? ' 1 could not be read.'
        : ` ${result.failed} could not be read.`
  const rest = result.remaining > 0 ? ' Refresh again for the rest.' : ''
  return `${refreshed}${unread}${rest}`
}
