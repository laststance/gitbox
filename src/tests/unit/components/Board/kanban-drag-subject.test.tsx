/**
 * The board draws a column drag from dnd-kit's active value.
 *
 * A null subject leaves the new-row zone and the insert zones off the board.
 * A column subject puts them back, including the cell the column left.
 */

import { DndContext } from '@dnd-kit/core'
import type { Active } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import {
  columnInsertionZones,
  dragSubject,
} from '@/components/Board/kanban-drag-subject'
import {
  KanbanDragChrome,
  KanbanDragView,
} from '@/components/Board/KanbanDragChrome'
import { COLUMN_DRAG_TYPE } from '@/components/Board/SortableColumn'
import type { StatusListDomain } from '@/lib/models/domain'
import { toBoardId, toStatusListId } from '@/lib/types/brands'

function makeColumn(id: string, gridCol: number): StatusListDomain {
  return {
    id: toStatusListId(id),
    title: `Column ${id}`,
    color: '#6B7280',
    gridRow: 0,
    gridCol,
    boardId: toBoardId('board-1'),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

const TWO_COLUMNS = [makeColumn('status-1', 0), makeColumn('status-2', 1)]

function activeItem(id: string, type?: string): Active {
  return {
    id,
    data: { current: type === undefined ? {} : { type } },
    rect: { current: { initial: null, translated: null } },
  }
}

function renderView(subject: ReturnType<typeof dragSubject>) {
  return render(
    <DndContext>
      <KanbanDragView
        columnIds={['status-1', 'status-2']}
        statuses={TWO_COLUMNS}
        gridDimensions={{ maxRow: 0, maxCol: 1 }}
        cardsByStatus={{}}
        emptyCards={[]}
        cards={[]}
        subject={subject}
      >
        <div>columns</div>
      </KanbanDragView>
    </DndContext>,
  )
}

describe('kanban drag subject', () => {
  // Value: protects=a column, a card, and no drag are told apart from dnd-kit's active value; fails_when=a column is treated as a card, or a cleared drag is still a column; why_new=the board used to store its own copy; seam=the pure reader; no_claim=the context wiring, see the chrome test
  test('reads a column, a card, and nothing', () => {
    // Arrange
    const column = activeItem('status-1', COLUMN_DRAG_TYPE)
    const card = activeItem('card-1')

    // Assert
    expect(dragSubject(column)).toEqual({ kind: 'column', id: 'status-1' })
    expect(dragSubject(card)).toEqual({ kind: 'card', id: 'card-1' })
    expect(dragSubject(null)).toBeNull()
  })

  // Value: protects=a column drag offers its own cell and the free cell to the right; fails_when=the dragged column's cell is treated as occupied, or the free cell is missing; why_new=the zone list moved out of the hook with the copy; seam=two columns in one row; no_claim=the zones on the page, see the view test
  test('offers the dragged column its own cell and the free cell', () => {
    // Act
    const zones = columnInsertionZones(
      TWO_COLUMNS,
      { maxRow: 0, maxCol: 1 },
      'status-1',
    )

    // Assert
    expect(zones).toEqual([
      { gridRow: 0, gridCol: 0 },
      { gridRow: 0, gridCol: 2 },
    ])
  })

  // Value: protects=the new-row zone and the insert zones are absent when nothing is dragged; fails_when=they stay up after dnd-kit has cleared the drag; why_new=that is the stuck-zone bug; seam=the view with a null subject; no_claim=a drag that ends before paint in a browser
  test('draws no drop zones when nothing is dragged', () => {
    // Act
    renderView(null)

    // Assert
    expect(screen.queryByText('Drop column here to create new row')).toBeNull()
    expect(screen.queryByText('Drop here to insert')).toBeNull()
    expect(screen.getByText('columns')).toBeVisible()
  })

  // Value: protects=a column subject shows the new-row zone and an insert zone; fails_when=the view ignores the subject and stays at rest; why_new=the zones moved into this view; seam=the view with a column subject, inside a context so the zones can register; no_claim=useDndContext itself
  test('draws the drop zones while a column is the subject', () => {
    // Act
    renderView({ kind: 'column', id: 'status-1' })

    // Assert
    expect(screen.getByText('Drop column here to create new row')).toBeVisible()
    expect(screen.getAllByText('Empty slot')).toHaveLength(2)
    // DragOverlay draws its children only while the context itself is
    // dragging, so the column title is not in this render.
  })

  // Value: protects=with no drag in progress the chrome, which reads useDndContext, leaves the zones off; fails_when=the chrome invents a column drag of its own; why_new=the chrome is the only reader of the context; seam=a real DndContext with nothing active; no_claim=a drag dnd-kit clears without a handler
  test('the chrome leaves the zones off when dnd-kit has nothing active', () => {
    // Act
    render(
      <DndContext>
        <KanbanDragChrome
          columnIds={['status-1', 'status-2']}
          statuses={TWO_COLUMNS}
          gridDimensions={{ maxRow: 0, maxCol: 1 }}
          cardsByStatus={{}}
          emptyCards={[]}
          cards={[]}
        >
          <div>columns</div>
        </KanbanDragChrome>
      </DndContext>,
    )

    // Assert
    expect(screen.queryByText('Drop column here to create new row')).toBeNull()
  })
})
