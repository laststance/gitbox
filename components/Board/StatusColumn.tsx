'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import React, { memo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'

import { RepoCard } from './RepoCard'

/**
 * Drag type identifier for cards
 * Used to distinguish card drags from column drags in DndContext
 */
export const CARD_DRAG_TYPE = 'card'

// Types: Using Domain types for type-safe state management
interface StatusColumnProps {
  status: StatusListDomain
  cards: RepoCardForRedux[]
  onEdit?: (id: string) => void
  onMaintenance?: (id: string) => void
  /** Callback when Note button is clicked */
  onNote?: (id: string) => void
  onEditStatus?: (status: StatusListDomain) => void
  onDeleteStatus?: (statusId: string) => void
  onAddCard?: (statusId: string) => void
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
 * - WIP limit badge with exceeded warning
 * - Contains draggable repository cards
 * - Column actions (add card, edit, delete)
 * - Acts as droppable for cards from other columns
 */
export const StatusColumn = memo<StatusColumnProps>(
  ({
    status,
    cards,
    onEdit,
    onMaintenance,
    onNote,
    onEditStatus,
    onDeleteStatus,
    onAddCard,
    dragAttributes,
    dragListeners,
  }) => {
    const cardIds = cards.map((c) => c.id)
    const isOverLimit = status.wipLimit > 0 && cards.length > status.wipLimit

    // Make the column a droppable target for cards
    const { setNodeRef, isOver } = useDroppable({
      id: `droppable-${status.id}`,
      data: {
        type: 'column',
        statusId: status.id,
      },
    })

    return (
      <div
        className="flex flex-col h-full"
        data-testid={`status-column-${status.id}`}
      >
        {/* Draggable Column Header */}
        <div
          {...dragAttributes}
          {...dragListeners}
          className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Drag to reorder ${status.title} column. Use arrow keys to move in any direction.`}
        >
          <div className="flex items-center gap-2">
            {status.color && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: status.color }}
              />
            )}
            <h3 className="font-semibold text-foreground">{status.title}</h3>
          </div>
          <div className="flex items-center gap-1">
            {status.wipLimit > 0 && (
              <Badge
                variant={isOverLimit ? 'destructive' : 'secondary'}
                className="text-xs"
                data-testid="wip-limit-badge"
              >
                {cards.length}/{status.wipLimit}
              </Badge>
            )}
            {/* Column Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-accent"
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
            className={`
              space-y-3 flex-1 overflow-y-auto min-h-[100px] rounded-lg p-1
              transition-colors duration-200
              ${isOver ? 'bg-accent/50 ring-2 ring-primary/20' : ''}
            `}
          >
            <AnimatePresence>
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <RepoCard
                    card={card}
                    onEdit={onEdit}
                    onMaintenance={onMaintenance}
                    onNote={onNote}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        {isOverLimit && (
          <div
            className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md"
            data-testid="wip-limit-warning"
          >
            <p className="text-xs text-destructive font-medium">
              ⚠️ WIP limit exceeded
            </p>
          </div>
        )}

        {/* Add Repo button at column bottom (Trello-style) */}
        {onAddCard && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddCard(status.id)}
            className="w-full mt-3 justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
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

export default StatusColumn
