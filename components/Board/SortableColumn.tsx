'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { memo } from 'react'

import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'

import { StatusColumn } from './StatusColumn'

/**
 * Drag type identifier for columns
 * Used to distinguish column drags from card drags in DndContext
 */
export const COLUMN_DRAG_TYPE = 'column'

interface SortableColumnProps {
  status: StatusListDomain
  cards: RepoCardForRedux[]
  onEdit?: (id: string) => void
  onMaintenance?: (id: string) => void
  onNote?: (id: string) => void
  onEditStatus?: (status: StatusListDomain) => void
  onDeleteStatus?: (statusId: string) => void
  onAddCard?: (statusId: string) => void
}

/**
 * Sortable Column Component
 *
 * Wraps StatusColumn with @dnd-kit useSortable hook to enable
 * column reordering via drag & drop in a 2D grid layout.
 *
 * Features:
 * - Full 2D drag support (horizontal and vertical movement)
 * - Visual feedback during drag (opacity, scale, shadow)
 * - Drop zone indicator (ring effect when hovering)
 * - Smooth CSS transitions for drop animation
 * - Maintains card DnD functionality within columns
 *
 * @example
 * <SortableColumn
 *   status={statusList}
 *   cards={columnCards}
 *   onEditStatus={handleEditStatus}
 * />
 */
export const SortableColumn = memo<SortableColumnProps>(
  ({
    status,
    cards,
    onEdit,
    onMaintenance,
    onNote,
    onEditStatus,
    onDeleteStatus,
    onAddCard,
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
      isOver,
    } = useSortable({
      id: status.id,
      data: {
        type: COLUMN_DRAG_TYPE,
        status,
      },
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          flex flex-col h-full w-full bg-background/50 backdrop-blur-sm
          rounded-xl border border-border transition-all duration-200
          ${isDragging ? 'opacity-50 shadow-2xl scale-[1.02] z-50' : ''}
          ${isOver && !isDragging ? 'ring-2 ring-primary ring-offset-2' : ''}
        `}
        data-testid={`sortable-column-${status.id}`}
      >
        {/* StatusColumn renders the column content with draggable header */}
        <div className="flex-1 p-4">
          <StatusColumn
            status={status}
            cards={cards}
            onEdit={onEdit}
            onMaintenance={onMaintenance}
            onNote={onNote}
            onEditStatus={onEditStatus}
            onDeleteStatus={onDeleteStatus}
            onAddCard={onAddCard}
            dragAttributes={attributes}
            dragListeners={listeners}
          />
        </div>
      </div>
    )
  },
)

SortableColumn.displayName = 'SortableColumn'

export default SortableColumn
