/**
 * Board Grid Component
 *
 * A grid of board cards with optimistic UI updates for rename/delete/reorder operations.
 * Supports drag & drop reordering via @dnd-kit when enableDnD is true.
 */

'use client'

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { memo, useCallback, useMemo, useOptimistic, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { updateBoardPositions } from '@/lib/actions/board'
import type { Tables } from '@/lib/supabase/types'

import { BoardCard } from './BoardCard'
import { SortableBoardCard } from './SortableBoardCard'

type Board = Tables<'board'>

/**
 * Action types for optimistic updates
 */
type OptimisticAction =
  | { type: 'rename'; boardId: string; newName: string }
  | { type: 'delete'; boardId: string }
  | { type: 'toggleFavorite'; boardId: string; isFavorite: boolean }
  | { type: 'reorder'; boards: Board[] }

interface BoardGridProps {
  /** Initial boards data from server */
  initialBoards: Board[]
  /** Enable drag & drop reordering (default: true, disabled on favorites page) */
  enableDnD?: boolean
}

/**
 * Board Grid with optimistic updates and DnD reordering
 *
 * Displays a grid of board cards and handles optimistic UI updates
 * for rename, delete, favorite, and reorder operations.
 *
 * @example
 * // In Server Component with DnD (default)
 * <BoardGrid initialBoards={boards} />
 *
 * // Without DnD (e.g., favorites page)
 * <BoardGrid initialBoards={boards} enableDnD={false} />
 */
export const BoardGrid = memo(function BoardGrid({
  initialBoards,
  enableDnD = true,
}: BoardGridProps) {
  // Local state persists board mutations (reorder, delete, rename, favorite)
  // across renders. useOptimistic alone reverts when no transition is pending
  // and this project doesn't use revalidatePath for Supabase operations.
  const [localBoards, setLocalBoards] = useState(initialBoards)

  const [optimisticBoards, updateOptimisticBoards] = useOptimistic(
    localBoards,
    (state: Board[], action: OptimisticAction): Board[] => {
      switch (action.type) {
        case 'rename':
          return state.map((board) =>
            board.id === action.boardId
              ? { ...board, name: action.newName }
              : board,
          )
        case 'delete':
          return state.filter((board) => board.id !== action.boardId)
        case 'toggleFavorite':
          return state.map((board) =>
            board.id === action.boardId
              ? { ...board, is_favorite: action.isFavorite }
              : board,
          )
        case 'reorder':
          return action.boards
        default:
          return state
      }
    },
  )

  // DnD state: track which board is currently being dragged
  const [activeBoard, setActiveBoard] = useState<Board | null>(null)

  // Memoize board IDs for SortableContext
  const boardIds = useMemo(
    () => optimisticBoards.map((b) => b.id),
    [optimisticBoards],
  )

  // DnD sensors: same config as KanbanBoard
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleRename = useCallback(
    (boardId: string, newName: string) => {
      updateOptimisticBoards({ type: 'rename', boardId, newName })
      setLocalBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, name: newName } : b)),
      )
    },
    [updateOptimisticBoards],
  )

  const handleDelete = useCallback(
    (boardId: string) => {
      updateOptimisticBoards({ type: 'delete', boardId })
      setLocalBoards((prev) => prev.filter((b) => b.id !== boardId))
    },
    [updateOptimisticBoards],
  )

  const handleToggleFavorite = useCallback(
    (boardId: string, isFavorite: boolean) => {
      updateOptimisticBoards({ type: 'toggleFavorite', boardId, isFavorite })
      setLocalBoards((prev) =>
        prev.map((b) =>
          b.id === boardId ? { ...b, is_favorite: isFavorite } : b,
        ),
      )
    },
    [updateOptimisticBoards],
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const board = optimisticBoards.find((b) => b.id === event.active.id)
      setActiveBoard(board ?? null)
    },
    [optimisticBoards],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveBoard(null)

      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = localBoards.findIndex((b) => b.id === active.id)
      const newIndex = localBoards.findIndex((b) => b.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      // Compute new order
      const reordered = arrayMove(localBoards, oldIndex, newIndex)

      // Assign sequential positions
      const reorderedWithPositions = reordered.map((board, index) => ({
        ...board,
        position: index,
      }))

      // Persist in local state (persists across renders unlike useOptimistic)
      const previousBoards = localBoards
      setLocalBoards(reorderedWithPositions)

      // Sync to Supabase
      try {
        await updateBoardPositions(
          reorderedWithPositions.map((b) => ({
            id: b.id,
            position: b.position,
          })),
        )
      } catch {
        // Revert local state on error
        setLocalBoards(previousBoards)
        toast.error('Failed to update board order')
      }
    },
    [localBoards],
  )

  const handleDragCancel = useCallback(() => {
    setActiveBoard(null)
  }, [])

  if (optimisticBoards.length === 0) {
    return <EmptyState />
  }

  // Without DnD (favorites page) — render plain grid
  if (!enableDnD) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {optimisticBoards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            onRename={handleRename}
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>
    )
  }

  // With DnD — wrap in DndContext + SortableContext
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={boardIds} strategy={rectSortingStrategy}>
        <div className="grid gap-6 pl-6 sm:grid-cols-2 lg:grid-cols-3">
          {optimisticBoards.map((board) => (
            <SortableBoardCard
              key={board.id}
              board={board}
              onRename={handleRename}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay: static clone of the dragged board card */}
      <DragOverlay>
        {activeBoard ? (
          <div className="scale-105 rotate-2 opacity-90 shadow-2xl">
            <BoardCard
              board={activeBoard}
              onRename={handleRename}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
})

// ========================================
// Empty State Component
// ========================================

/**
 * Empty state displayed when there are no boards.
 */
const EmptyState = memo(function EmptyState() {
  return (
    <div className="border-border bg-muted flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12">
      <svg
        className="text-muted-foreground h-12 w-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
        />
      </svg>
      <h3 className="text-foreground mt-4 text-lg font-medium">
        No boards yet
      </h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Get started by creating your first board
      </p>
      <Button asChild className="mt-6">
        <Link href="/boards/new" className="gap-2">
          <Plus className="h-5 w-5" />
          Create Board
        </Link>
      </Button>
    </div>
  )
})
