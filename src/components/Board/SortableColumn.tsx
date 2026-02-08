'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { memo } from 'react'

import type { CommentData } from '@/lib/actions/project-info'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { CommentColor } from '@/lib/supabase/types'
import type { CardDisplaySettings } from '@/lib/types/board-settings'

import { StatusColumn } from './StatusColumn'

/**
 * Drag type identifier for columns
 * Used to distinguish column drags from card drags in DndContext
 */
export const COLUMN_DRAG_TYPE = 'column'

interface SortableColumnProps {
  status: StatusListDomain
  cards: RepoCardForRedux[]
  /** Map of cardId → comment data (text + color) from projectinfo */
  comments?: Record<string, CommentData>
  /** Card display settings from board.settings */
  cardDisplaySettings?: CardDisplaySettings
  onMaintenance?: (id: string) => void
  /** Callback when Note button is clicked (opens unified NoteModal) */
  onNote?: (id: string) => void
  /** Callback when repository is removed from board */
  onRemove?: (id: string) => void
  /** Callback when comment is updated (for optimistic updates) */
  onCommentChange?: (cardId: string, newComment: string) => void
  /** Callback when comment color is changed */
  onCommentColorChange?: (cardId: string, color: CommentColor) => void
  /** Callback when comment is deleted */
  onCommentDelete?: (cardId: string) => void
  onEditStatus?: (status: StatusListDomain) => void
  onDeleteStatus?: (statusId: string) => void
  onAddCard?: (statusId: string) => void
  /** CSS Grid positioning style (gridRow, gridColumn) */
  gridStyle?: React.CSSProperties
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
    comments,
    cardDisplaySettings,
    onMaintenance,
    onNote,
    onRemove,
    onCommentChange,
    onCommentColorChange,
    onCommentDelete,
    onEditStatus,
    onDeleteStatus,
    onAddCard,
    gridStyle,
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

    // Combine dnd-kit transform with grid positioning
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      ...gridStyle,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-background/50 border-border flex w-full flex-col rounded-xl border backdrop-blur-sm transition-all duration-200 ${isDragging ? 'z-50 scale-[1.02] opacity-50 shadow-2xl' : ''} ${isOver && !isDragging ? 'ring-primary ring-2 ring-offset-2' : ''} `}
        data-testid={`sortable-column-${status.id}`}
      >
        {/* StatusColumn renders the column content with draggable header */}
        <div className="flex-1 p-4">
          <StatusColumn
            status={status}
            cards={cards}
            comments={comments}
            cardDisplaySettings={cardDisplaySettings}
            onMaintenance={onMaintenance}
            onNote={onNote}
            onRemove={onRemove}
            onCommentChange={onCommentChange}
            onCommentColorChange={onCommentColorChange}
            onCommentDelete={onCommentDelete}
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
