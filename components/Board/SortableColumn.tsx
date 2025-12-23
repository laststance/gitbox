'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
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
 * column reordering via drag & drop.
 *
 * Features:
 * - Drag handle in column header for intuitive UX
 * - Visual feedback during drag (opacity, scale, shadow)
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
          flex flex-col h-full min-w-[280px] bg-background/50 backdrop-blur-sm
          rounded-xl border border-border
          ${isDragging ? 'opacity-50 shadow-2xl scale-[1.02] z-50' : ''}
        `}
        data-testid={`sortable-column-${status.id}`}
      >
        {/* Column Header with Drag Handle */}
        <div className="flex items-center gap-2 p-4 pb-2">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent touch-none"
            aria-label={`Drag to reorder ${status.title} column`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Column Content (StatusColumn handles the rest) */}
        </div>

        {/* StatusColumn renders the actual column content */}
        <div className="flex-1 px-4 pb-4 -mt-2">
          <StatusColumn
            status={status}
            cards={cards}
            onEdit={onEdit}
            onMaintenance={onMaintenance}
            onNote={onNote}
            onEditStatus={onEditStatus}
            onDeleteStatus={onDeleteStatus}
            onAddCard={onAddCard}
          />
        </div>
      </div>
    )
  },
)

SortableColumn.displayName = 'SortableColumn'

export default SortableColumn
