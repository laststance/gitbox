/**
 * Unit Tests: a column undo puts positions back and leaves the rest as it is
 *
 * A snapshot is taken before a column drag. Before Z, a column can be
 * renamed, deleted or added. Replaying the snapshot shows the old name,
 * brings the deleted column back and hides the new one.
 *
 * @see src/lib/utils/reconcile-column-undo.ts
 */

import { describe, expect, test } from 'vitest'

import type { StatusListDomain } from '@/lib/models/domain'
import { toBoardId, toStatusListId } from '@/lib/types/brands'
import { reconcileColumnUndo } from '@/lib/utils/reconcile-column-undo'

/** A column of board-1 at the given grid position. */
function makeColumn(
  id: string,
  title: string,
  gridRow: number,
  gridCol: number,
  color = '#6B7280',
): StatusListDomain {
  return {
    id: toStatusListId(id),
    title,
    color,
    gridRow,
    gridCol,
    boardId: toBoardId('board-1'),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('reconcileColumnUndo', () => {
  // Value: protects=Z after a rename shows the new name at the old position (TODOS.md column undo); fails_when=the snapshot's name replaces the rename; why_new=column undo replayed the snapshot whole; seam=none; no_claim=the position write (useKanbanUndo.test.tsx)
  test('a renamed column goes back to its old position and keeps the new name', () => {
    // Arrange
    const snapshotBeforeDrag = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
    ]
    const columnsOnBoardNow = [
      makeColumn('col-a', 'Ideas', 0, 1),
      makeColumn('col-b', 'In progress', 0, 0, '#111111'),
    ]

    // Act
    const columnsAfterUndo = reconcileColumnUndo(
      snapshotBeforeDrag,
      columnsOnBoardNow,
    )

    // Assert
    expect(columnsAfterUndo).toEqual([
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'In progress', 0, 1, '#111111'),
    ])
  })

  // Value: protects=a column deleted since the drag is not brought back, and one added since stays (TODOS.md column undo); fails_when=the deleted column returns or the added one disappears; why_new=the snapshot was replayed as it was; seam=none; no_claim=the position write (useKanbanUndo.test.tsx)
  test('a deleted column stays gone and a column added since stays where it is', () => {
    // Arrange: three columns, then Shipped was deleted and Later was added
    const snapshotBeforeDrag = [
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'Building', 0, 1),
      makeColumn('col-c', 'Shipped', 0, 2),
    ]
    const columnsOnBoardNow = [
      makeColumn('col-a', 'Ideas', 0, 2),
      makeColumn('col-b', 'In progress', 0, 0, '#111111'),
      makeColumn('col-d', 'Later', 1, 0),
    ]

    // Act
    const columnsAfterUndo = reconcileColumnUndo(
      snapshotBeforeDrag,
      columnsOnBoardNow,
    )

    // Assert
    expect(columnsAfterUndo).toEqual([
      makeColumn('col-a', 'Ideas', 0, 0),
      makeColumn('col-b', 'In progress', 0, 1, '#111111'),
      makeColumn('col-d', 'Later', 1, 0),
    ])
  })
})
