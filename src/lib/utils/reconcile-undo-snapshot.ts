import type { RepoCardForRedux } from '@/lib/models/domain'

/**
 * Fits an undo snapshot to the cards that are on the board right now.
 *
 * Exists because a snapshot is taken before a drag, and the board can change
 * before the user presses Z: a card may have been moved to another board,
 * sent to Maintenance, removed, or added. Called by {@link useKanbanUndo}.
 * Replaying the raw snapshot would show a card that is gone and write its old
 * column back to the database, stranding a moved card between two boards.
 *
 * @param snapshot - Cards as they were before the drag being undone.
 * @param currentCards - Cards on the board now.
 * @returns The cards to show after the undo: snapshot cards that are still on
 * the board, with their old column and position, followed by the cards added
 * since the snapshot, unchanged.
 * @example
 * reconcileUndoSnapshot([cardA, movedAwayCard], [cardADragged, addedCard])
 * // => [cardA, addedCard]
 */
export const reconcileUndoSnapshot = (
  snapshot: RepoCardForRedux[],
  currentCards: RepoCardForRedux[],
): RepoCardForRedux[] => {
  const currentCardIds = new Set(currentCards.map((card) => card.id))
  const snapshotCardIds = new Set(snapshot.map((card) => card.id))

  // Cards that left the board since the snapshot are not brought back
  const restored = snapshot.filter((card) => currentCardIds.has(card.id))
  // Cards added since the snapshot stay where they are
  const addedSinceSnapshot = currentCards.filter(
    (card) => !snapshotCardIds.has(card.id),
  )

  return [...restored, ...addedSinceSnapshot]
}
