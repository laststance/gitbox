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
import { ICON_TRIGGER_CLASS } from '@/lib/constants/touch-target'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import type { CommentColor } from '@/lib/supabase/types'
import type { CardDisplaySettings } from '@/lib/types/board-settings'
import type { RepoCardId, StatusListId } from '@/lib/types/brands'

import { RepoCard, RestingRepoCard } from './RepoCard'

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
  onAddCard?: (statusId: StatusListId, opener?: HTMLElement) => void
  /**
   * The server and the first client render. Cards are not draggable yet:
   * dnd-kit's description id is a process-wide counter, so the server's
   * HTML would not match the browser.
   */
  resting?: boolean
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
    resting = false,
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
      <div
        className="flex flex-col"
        data-testid={`status-column-${status.id}`}
        // Read by card-focus-target.ts: the cards of one column are neighbors
        data-status-column-id={status.id}
      >
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
                // shrink-0: beside a title that gives way the dot would give
                // way too, down to 3px of its 12px
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: status.color }}
              />
            )}
            {/* wrap-anywhere: a column name without a space has no place to
                break. The title could not get narrower than that one word
                and pushed "Column options" out of the column, where the
                mouse does not reach it. Now the word breaks where the line
                ends. */}
            <h2 className="text-foreground font-semibold wrap-anywhere">
              {status.title}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {/* Column Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`hover:bg-accent ${ICON_TRIGGER_CLASS}`}
                  aria-label="Column options"
                  data-testid="column-options-trigger"
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
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
              {cards.map((card) => {
                const cardProps = {
                  card,
                  commentData: comments?.[card.id],
                  showComment: cardDisplaySettings?.showComment,
                  commentText: cardDisplaySettings?.commentText,
                  onMoveToBoard,
                  onNote,
                  onRefresh,
                  onRemove,
                  onCommentChange,
                  onCommentColorChange,
                  onCommentDelete,
                }
                // No enter animation here: it reads reduced motion, which the
                // server and the browser can disagree on
                if (resting) {
                  return (
                    <div key={card.id}>
                      <RestingRepoCard {...cardProps} />
                    </div>
                  )
                }
                return (
                  <m.div
                    key={card.id}
                    initial={
                      prefersReducedMotion ? false : { opacity: 0, y: 20 }
                    }
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
                    <RepoCard {...cardProps} />
                  </m.div>
                )
              })}
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
            onClick={(event): void => {
              onAddCard(status.id, event.currentTarget)
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-accent mt-3 w-full justify-start"
            data-testid="add-repo-button"
            // Read by card-focus-target.ts: takes the focus when the column empties
            data-column-add-repo
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
