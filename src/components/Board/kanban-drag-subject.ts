import type { Active } from '@dnd-kit/core'

import { COLUMN_DRAG_TYPE } from '@/components/Board/SortableColumn'

/**
 * What the board is dragging, read from dnd-kit rather than stored beside it.
 */
export interface DragSubject {
  /** A column header or a card. */
  kind: 'column' | 'card'
  /** The id dnd-kit reports for that item. */
  id: string
}

/**
 * The item dnd-kit currently has in hand.
 *
 * Called by {@link KanbanDragChrome} on every render of the kanban
 * `DndContext`. A drag that ends before React has drawn its start clears
 * this value without calling `onDragEnd` or `onDragCancel`, so the board
 * must read it here and not from state set in those handlers.
 *
 * @param active - `useDndContext().active`, or null when nothing is moving.
 * @returns The subject, or null when dnd-kit has nothing active.
 */
export function dragSubject(active: Active | null): DragSubject | null {
  if (!active) return null
  const kind =
    active.data.current?.type === COLUMN_DRAG_TYPE ? 'column' : 'card'
  return { kind, id: String(active.id) }
}

/**
 * Empty cells a column may be dropped on, including the cell it left.
 *
 * The dragged column is left out of the occupied set, so its own cell is a
 * place to put it back. One extra column of cells is offered past the
 * rightmost column. Called only while {@link dragSubject} says a column is
 * moving.
 *
 * @param statuses - Columns on the board, in any order.
 * @param grid - Furthest row and column indexes already in use.
 * @param activeColumnId - The column dnd-kit is moving.
 * @returns One zone per empty cell in that rectangle.
 */
export function columnInsertionZones(
  statuses: ReadonlyArray<{ id: string; gridRow: number; gridCol: number }>,
  grid: { maxRow: number; maxCol: number },
  activeColumnId: string,
): Array<{ gridRow: number; gridCol: number }> {
  const zones: Array<{ gridRow: number; gridCol: number }> = []
  const occupied = new Set(
    statuses
      .filter((status) => status.id !== activeColumnId)
      .map((status) => `${status.gridRow}-${status.gridCol}`),
  )
  // One zone per cell. statuslist_grid_position_bounds keeps the furthest cell at 999.
  for (let row = 0; row <= grid.maxRow; row++) {
    for (let col = 0; col <= grid.maxCol + 1; col++) {
      const key = `${row}-${col}`
      if (!occupied.has(key)) {
        zones.push({ gridRow: row, gridCol: col })
      }
    }
  }
  return zones
}
