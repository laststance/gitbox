/**
 * Fits a column undo to the columns that are on the board right now.
 *
 * A column snapshot is taken before a drag. Before Z, a column can be
 * renamed, deleted or added, including from another tab: a refetch no longer
 * clears the undo history. Called by {@link useKanbanUndo}. Replaying the
 * snapshot as it was shows the old name, brings a deleted column back and
 * sends its position to the server, and hides a column added since.
 *
 * Only the grid position comes from the snapshot. The name, the color and
 * every other field stay as the board has them now.
 */

import type { StatusListDomain } from '@/lib/models/domain'

/**
 * Put the columns that are still on the board back to the positions they had
 * before the drag.
 *
 * @param snapshot - Columns as they were before the drag being undone.
 * @param currentColumns - Columns on the board now.
 * @returns Those snapshot columns that are still here, at their old grid
 *   position and with their current name and color, followed by the columns
 *   added since the snapshot, unchanged.
 * @example
 * reconcileColumnUndo(
 *   [ideas, building, shipped],
 *   [ideas, inProgress, later],
 * )
 * // => [ideas, inProgress at building's old position, later]
 */
export function reconcileColumnUndo(
  snapshot: StatusListDomain[],
  currentColumns: StatusListDomain[],
): StatusListDomain[] {
  const currentById = new Map(
    currentColumns.map((column) => [column.id, column]),
  )
  const snapshotIds = new Set(snapshot.map((column) => column.id))

  // A column deleted since the drag is not brought back
  const restored = snapshot.flatMap((column) => {
    const current = currentById.get(column.id)
    if (current === undefined) return []
    // The position is all the snapshot may change. A rename stays.
    if (
      current.gridRow === column.gridRow &&
      current.gridCol === column.gridCol
    ) {
      return [current]
    }
    return [{ ...current, gridRow: column.gridRow, gridCol: column.gridCol }]
  })
  // A column added since the drag stays where it is
  const addedSinceSnapshot = currentColumns.filter(
    (column) => !snapshotIds.has(column.id),
  )

  return [...restored, ...addedSinceSnapshot]
}
