'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { MoreHorizontal, Pencil, Trash2, Plus, Inbox } from 'lucide-react'
import React, { memo } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CommentData } from '@/lib/actions/project-info'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { CommentColor } from '@/lib/supabase/types'
import type { CardDisplaySettings } from '@/lib/types/board-settings'
import type { RepoCardId, StatusListId } from '@/lib/types/brands'

import { RepoCard } from './RepoCard'

/**
 * Drag type identifiers used by DndContext to distinguish column vs. card drags.
 * Kept together so both data-attribute sites can import from one place.
 */
export const CARD_DRAG_TYPE = 'card'
export const COLUMN_DRAG_TYPE = 'column'

interface StatusColumnProps {
  status: StatusListDomain
  cards: RepoCardForRedux[]
  /** Map of cardId → comment data (text + color) from projectinfo */
  comments?: Record<string, CommentData>
  /** Card display settings from board.settings */
  cardDisplaySettings?: CardDisplaySettings
  onMaintenance?: (id: RepoCardId) => void
  /** Callback when card is moved to another board */
  onMoveToBoard?: (id: RepoCardId) => void
  /** Callback when Note button is clicked (opens unified NoteModal) */
  onNote?: (id: RepoCardId) => void
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
  /** Drag attributes from SortableColumn for column reordering */
  dragAttributes?: React.HTMLAttributes<HTMLDivElement>
  /** Drag listeners from SortableColumn for column reordering */
  dragListeners?: React.DOMAttributes<HTMLDivElement>
}

/**
 * Status Column Component
 *
 * A column representing a status list in the Kanban board.
 * - Displays status title and color indicator
 * - Contains draggable repository cards
 * - Column actions (add card, edit, delete)
 * - Acts as droppable for cards from other columns
 */
export const StatusColumn = memo<StatusColumnProps>(
  ({
    status,
    cards,
    comments,
    cardDisplaySettings,
    onMaintenance,
    onMoveToBoard,
    onNote,
    onRemove,
    onCommentChange,
    onCommentColorChange,
    onCommentDelete,
    onEditStatus,
    onDeleteStatus,
    onAddCard,
    dragAttributes,
    dragListeners,
  }) => {
    const prefersReducedMotion = useReducedMotion()
    const cardIds = cards.map((c) => c.id)

    // Make the column a droppable target for cards
    const { setNodeRef, isOver } = useDroppable({
      id: `droppable-${status.id}`,
      data: {
        type: COLUMN_DRAG_TYPE,
        statusId: status.id,
      },
    })

    return (
      <div className="flex flex-col" data-testid={`status-column-${status.id}`}>
        {/* Draggable Column Header */}
        <div
          {...dragAttributes}
          {...dragListeners}
          className="mb-4 flex cursor-grab touch-none items-center justify-between active:cursor-grabbing"
          aria-label={`Drag to reorder ${status.title} column. Use arrow keys to move in any direction.`}
        >
          <div className="flex items-center gap-2">
            {status.color && (
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: status.color }}
              />
            )}
            <h3 className="text-foreground font-semibold">{status.title}</h3>
          </div>
          <div className="flex items-center gap-1">
            {/* Column Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-accent relative h-6 w-6 p-0 after:absolute after:-inset-[9px] after:content-['']"
                  aria-label="Column options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {onEditStatus && (
                  <DropdownMenuItem onClick={() => onEditStatus(status)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Column
                  </DropdownMenuItem>
                )}
                {onDeleteStatus && (
                  <DropdownMenuItem
                    onClick={() => onDeleteStatus(status.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Column
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={`flex-1 space-y-3 rounded-lg p-1 transition-colors duration-200 ${isOver ? 'bg-accent/50 ring-primary/20 ring-2' : ''} `}
          >
            <AnimatePresence>
              {cards.map((card) => (
                <m.div
                  key={card.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -20 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.2,
                  }}
                >
                  <RepoCard
                    card={card}
                    commentData={comments?.[card.id]}
                    showComment={cardDisplaySettings?.showComment}
                    commentText={cardDisplaySettings?.commentText}
                    onMaintenance={onMaintenance}
                    onMoveToBoard={onMoveToBoard}
                    onNote={onNote}
                    onRemove={onRemove}
                    onCommentChange={onCommentChange}
                    onCommentColorChange={onCommentColorChange}
                    onCommentDelete={onCommentDelete}
                  />
                </m.div>
              ))}
            </AnimatePresence>

            {/* Empty column guidance */}
            {cards.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Inbox className="text-muted-foreground/40 h-8 w-8" />
                <p className="text-muted-foreground text-xs">
                  Drop repos here or click &quot;Add Repo&quot; below
                </p>
              </div>
            )}
          </div>
        </SortableContext>

        {/* Add Repo button at column bottom (Trello-style) */}
        {onAddCard && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddCard(status.id)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent mt-3 w-full justify-start"
            data-testid="add-repo-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Repo
          </Button>
        )}
      </div>
    )
  },
)

StatusColumn.displayName = 'StatusColumn'
