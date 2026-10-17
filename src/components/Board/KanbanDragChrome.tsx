'use client'

import { DragOverlay, useDndContext } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import React, { memo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'

import { ColumnInsertZone } from './ColumnInsertZone'
import {
  columnInsertionZones,
  dragSubject,
  type DragSubject,
} from './kanban-drag-subject'
import { NewRowDropZone } from './NewRowDropZone'

interface KanbanDragViewProps {
  /** Column ids for the sortable context, in grid order. */
  columnIds: string[]
  /** The columns themselves. */
  children: React.ReactNode
  /** Columns, used to find empty cells and the overlay title. */
  statuses: StatusListDomain[]
  /** Furthest row and column already on the board. */
  gridDimensions: { maxRow: number; maxCol: number }
  /** Cards grouped by column, for the column overlay's count. */
  cardsByStatus: Record<string, RepoCardForRedux[]>
  /** Stable empty list when a column has no cards. */
  emptyCards: RepoCardForRedux[]
  /** Every card, for the card overlay's title. */
  cards: RepoCardForRedux[]
  /** What dnd-kit is moving, or null. */
  subject: DragSubject | null
}

/**
 * The grid, the drop zones, and the overlay for one drag subject.
 *
 * Rendered by {@link KanbanDragChrome}. The subject comes from dnd-kit, so a
 * null subject draws the resting board even when no drag handler ran.
 *
 * @param props - The board's columns and the current subject.
 * @returns The grid and, while something is moving, its overlay.
 */
function KanbanDragViewComponent({
  columnIds,
  children,
  statuses,
  gridDimensions,
  cardsByStatus,
  emptyCards,
  cards,
  subject,
}: KanbanDragViewProps): React.ReactElement {
  const draggingColumn = subject?.kind === 'column'
  const zones = draggingColumn
    ? columnInsertionZones(statuses, gridDimensions, subject.id)
    : []
  const extraTrack = draggingColumn ? 1 : 0
  const activeCard =
    subject?.kind === 'card'
      ? cards.find((card) => card.id === subject.id)
      : undefined
  const activeColumn = draggingColumn
    ? statuses.find((status) => status.id === subject.id)
    : undefined

  return (
    <>
      <SortableContext items={columnIds} strategy={rectSortingStrategy}>
        <div
          className="grid w-fit min-w-full gap-4 pb-4"
          suppressHydrationWarning
          style={{
            gridTemplateColumns: `repeat(${gridDimensions.maxCol + 1 + extraTrack}, minmax(280px, var(--column-width)))`,
            gridTemplateRows: `repeat(${gridDimensions.maxRow + 1 + extraTrack}, minmax(min-content, auto))`,
          }}
        >
          {children}
          {zones.map((zone) => (
            <ColumnInsertZone
              key={`insert-${zone.gridRow}-${zone.gridCol}`}
              gridRow={zone.gridRow}
              gridCol={zone.gridCol}
              activeColumnId={subject?.id}
            />
          ))}
          {draggingColumn && (
            <NewRowDropZone
              targetRow={gridDimensions.maxRow + 1}
              columnCount={gridDimensions.maxCol + 2}
            />
          )}
        </div>
      </SortableContext>
      <DragOverlay>
        {draggingColumn && activeColumn && (
          <div className="bg-background/80 border-primary w-70 max-w-full rotate-2 rounded-xl border-2 p-4 opacity-90 shadow-2xl backdrop-blur-sm">
            <h2 className="text-foreground font-semibold wrap-anywhere">
              {activeColumn.title}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {(cardsByStatus[activeColumn.id] ?? emptyCards).length} cards
            </p>
          </div>
        )}
        {subject?.kind === 'card' && activeCard && (
          <Card className="w-70 max-w-full rotate-3 cursor-grabbing opacity-90 shadow-2xl">
            <CardContent className="p-4">
              <h3 className="text-foreground font-semibold wrap-anywhere">
                {activeCard.title}
              </h3>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </>
  )
}

export const KanbanDragView = memo(KanbanDragViewComponent)
KanbanDragView.displayName = 'KanbanDragView'

type KanbanDragChromeProps = Omit<KanbanDragViewProps, 'subject'>

/**
 * Reads the item dnd-kit is moving and draws the board from that.
 *
 * Must be a child of the kanban `DndContext`. The hook that owns the sensors
 * runs outside that context, so it cannot see `useDndContext`.
 *
 * @param props - The columns and the lists the overlay labels.
 * @returns The grid for the current drag, or the resting grid.
 */
function KanbanDragChromeComponent(
  props: KanbanDragChromeProps,
): React.ReactElement {
  const { active } = useDndContext()
  return <KanbanDragView {...props} subject={dragSubject(active)} />
}

export const KanbanDragChrome = memo(KanbanDragChromeComponent)
KanbanDragChrome.displayName = 'KanbanDragChrome'
