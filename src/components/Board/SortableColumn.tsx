'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { memo } from 'react'

import type { CommentData } from '@/lib/actions/project-info'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { CommentColor } from '@/lib/supabase/types'
import type { CardDisplaySettings } from '@/lib/types/board-settings'
import type { RepoCardId, StatusListId } from '@/lib/types/brands'

import { COLUMN_DRAG_TYPE, StatusColumn } from './StatusColumn'

// Re-export so existing consumers (useKanbanDnD) keep working.
export { COLUMN_DRAG_TYPE }

interface SortableColumnProps {
  status: StatusListDomain
  cards: RepoCardForRedux[]
  /** Map of cardId → comment data (text + color) from projectinfo */
  comments?: Record<string, CommentData>
  /** Card display settings from board.settings */
  cardDisplaySettings?: CardDisplaySettings
  /** Callback when card is moved to another board */
  onMoveToBoard?: (id: RepoCardId) => void
  /** Callback when Note button is clicked (opens unified NoteModal) */
  onNote?: (id: RepoCardId) => void
  /** Read this card's repository from GitHub and rewrite its snapshot. */
  onRefresh?: (id: RepoCardId) => void
  /** Callback when repository is removed from board */
  onRemove?: (id: RepoCardId) => void
  /** Callback when comment is updated (for optimistic updates) */
  onCommentChange?: (cardId: RepoCardId, newComment: string) => void
  /** Callback when comment color is changed */
  onCommentColorChange?: (cardId: RepoCardId, color: CommentColor) => void
  /** Callback when comment is deleted */
  onCommentDelete?: (cardId: RepoCardId) => void
  onEditStatus?: (status: StatusListDomain) => void
  onDeleteStatus?: (statusId: StatusListId) => void
  onAddCard?: (statusId: StatusListId) => void
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
    onMoveToBoard,
    onNote,
    onRefresh,
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
            onMoveToBoard={onMoveToBoard}
            onNote={onNote}
            onRefresh={onRefresh}
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

/**
 * A column before drag-and-drop is attached.
 *
 * The server and the first client render use this. {@link SortableColumn}
 * takes over once the page has mounted. dnd-kit's description id is counted
 * in the server process, so a column that is already sortable would not match
 * the browser and hydration would throw the board away.
 */
export const RestingColumn = memo<SortableColumnProps>(
  ({ status, gridStyle, ...column }) => {
    return (
      <div
        style={gridStyle}
        className="bg-background/50 border-border flex w-full flex-col rounded-xl border backdrop-blur-sm"
        data-testid={`sortable-column-${status.id}`}
      >
        <div className="flex-1 p-4">
          <StatusColumn {...column} status={status} resting />
        </div>
      </div>
    )
  },
)

RestingColumn.displayName = 'RestingColumn'
