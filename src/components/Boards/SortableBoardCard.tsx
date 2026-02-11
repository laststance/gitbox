/**
 * Sortable Board Card Component
 *
 * Wraps BoardCard with @dnd-kit useSortable hook to enable
 * board reordering via drag & drop on the /boards page.
 *
 * Uses a drag handle (GripVertical icon) to avoid conflicts
 * with BoardCard's interactive elements (Link, Star, DropdownMenu).
 */

'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { memo } from 'react'

import type { Tables } from '@/lib/supabase/types'

import { BoardCard } from './BoardCard'

type Board = Tables<'board'>

interface SortableBoardCardProps {
  board: Board
  onRename: (boardId: string, newName: string) => void
  onDelete: (boardId: string) => void
  onToggleFavorite?: (boardId: string, isFavorite: boolean) => void
}

/**
 * Sortable wrapper for BoardCard with drag handle.
 *
 * The drag handle approach is used instead of full-card drag because
 * BoardCard contains interactive elements (Link, Star, DropdownMenu)
 * that would conflict with drag gestures.
 *
 * @example
 * <SortableContext items={boardIds} strategy={rectSortingStrategy}>
 *   {boards.map(board => (
 *     <SortableBoardCard key={board.id} board={board} ... />
 *   ))}
 * </SortableContext>
 */
export const SortableBoardCard = memo(function SortableBoardCard({
  board,
  onRename,
  onDelete,
  onToggleFavorite,
}: SortableBoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: board.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/sortable relative ${isDragging ? 'z-50 scale-[1.02] opacity-50 shadow-2xl' : ''} ${isOver && !isDragging ? 'ring-primary ring-2 ring-offset-2' : ''} transition-all duration-200`}
      data-testid={`sortable-board-card-${board.id}`}
    >
      {/* Drag handle — visible on hover, positioned at left edge */}
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground absolute top-1/2 left-0 z-20 flex h-8 w-6 -translate-x-full -translate-y-1/2 cursor-grab items-center justify-center rounded-l-md opacity-0 transition-opacity group-hover/sortable:opacity-100 active:cursor-grabbing md:hover:opacity-100"
        aria-label={`Drag to reorder ${board.name}`}
        data-testid={`drag-handle-${board.id}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <BoardCard
        board={board}
        onRename={onRename}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  )
})
