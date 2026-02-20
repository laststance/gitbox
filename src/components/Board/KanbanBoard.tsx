'use client'

import { DndContext, DragOverlay } from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import * as Sentry from '@sentry/nextjs'
import { motion, useReducedMotion } from 'framer-motion'
import React, { useState, memo, useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  forgivingCollisionDetection,
  useKanbanDnD,
} from '@/hooks/board/useKanbanDnD'
import { useKanbanUndo } from '@/hooks/board/useKanbanUndo'
import { useMounted } from '@/hooks/use-mounted'
import {
  updateComment,
  updateCommentColor,
  deleteComment,
  type CommentData,
} from '@/lib/actions/project-info'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import {
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { CommentColor } from '@/lib/supabase/types'
import type { CardDisplaySettings } from '@/lib/types/board-settings'

import { ColumnInsertZone } from './ColumnInsertZone'
import { NewRowDropZone } from './NewRowDropZone'
import { SortableColumn } from './SortableColumn'

// Types: Using Domain types for type-safe state management

interface KanbanBoardProps {
  boardId?: string
  /** Initial comments fetched by Server Component (Phase 4) */
  initialComments?: Record<string, CommentData>
  /** Card display settings from board.settings JSON */
  cardDisplaySettings?: CardDisplaySettings
  onMoveToMaintenance?: (cardId: string) => void
  /** Callback when card is moved to another board */
  onMoveToAnotherBoard?: (cardId: string) => void
  /** Callback when Note button is clicked (opens unified NoteModal with notes + links) */
  onNote?: (cardId: string) => void
  /** Callback when repository is removed from board */
  onRemove?: (cardId: string) => void
  onEditStatus?: (status: StatusListDomain) => void
  onDeleteStatus?: (statusId: string) => void
  onAddCard?: (statusId: string) => void
}

/**
 * Kanban Board Component
 *
 * The main Kanban board displaying status columns and repository cards.
 * - Drag-and-drop card reordering via @dnd-kit
 * - Board data loading from Supabase
 * - Optimistic UI updates with Supabase sync
 * - Undo functionality (Z key shortcut)
 * - Redux state management with localStorage sync
 */
// Loading Skeleton Component
const KanbanSkeleton = memo(() => {
  const prefersReducedMotion = useReducedMotion()
  return (
    <div className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(5)].map((_, colIndex) => (
        <div
          key={colIndex}
          className="bg-background/50 border-border rounded-xl border p-4 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <div className="space-y-3">
            {[...Array(2)].map((_, cardIndex) => (
              <motion.div
                key={cardIndex}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : cardIndex * 0.1,
                  duration: prefersReducedMotion ? 0 : undefined,
                }}
              >
                <Skeleton className="h-32 w-full rounded-lg" />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})
KanbanSkeleton.displayName = 'KanbanSkeleton'

// Main Kanban Board Component
export const KanbanBoard = memo<KanbanBoardProps>(
  ({
    boardId: _boardId = 'default-board',
    initialComments,
    cardDisplaySettings,
    onMoveToMaintenance,
    onMoveToAnotherBoard,
    onNote,
    onRemove,
    onEditStatus,
    onDeleteStatus,
    onAddCard,
  }) => {
    // Note: _boardId is no longer used for data fetching (Phase 4 refactoring)
    // Data is now fetched by Server Component and passed via props/Redux
    // Kept for backwards compatibility and potential future use (e.g., refresh)
    // Redux state (auto-synced to LocalStorage)
    const dispatch = useAppDispatch()
    const statuses = useAppSelector(selectStatusLists)
    const cards = useAppSelector(selectRepoCards)

    // Comments map: cardId → comment data (text + color) from projectinfo
    // Phase 4: Initialized with server-fetched data (no client-side fetch needed)
    const [comments, setComments] = useState<Record<string, CommentData>>(
      initialComments ?? {},
    )

    // Hydration-safe mounting state: prevents SSR/CSR mismatch for dynamic grid styles
    // Uses useSyncExternalStore-based hook for proper SSR support
    const isMounted = useMounted()

    // Memoize cards grouped by status to avoid re-creating arrays on every render.
    // Without this, each SortableColumn receives a new array ref, defeating memo().
    const EMPTY_CARDS: RepoCardForRedux[] = useMemo(() => [], [])
    const cardsByStatus = useMemo(() => {
      const grouped: Record<string, RepoCardForRedux[]> = {}
      for (const card of cards) {
        ;(grouped[card.statusId] ??= []).push(card)
      }
      return grouped
    }, [cards])

    // Undo hook: history stacks + Z-key shortcut (self-contained)
    const { pushCardHistory, pushColumnHistory } = useKanbanUndo({ dispatch })

    // DnD hook: sensors, handlers, grid calculations
    const {
      activeId,
      activeDragType,
      sensors,
      columnIds,
      insertionZones,
      handleDragStart,
      handleDragEnd,
      gridDimensions,
      sortedStatuses,
    } = useKanbanDnD({
      statuses,
      cards,
      cardsByStatus,
      EMPTY_CARDS,
      dispatch,
      pushCardHistory,
      pushColumnHistory,
    })

    // Phase 4: Data fetching removed - now handled by Server Component
    // BoardPage (Server) → fetchBoardInitialData() → BoardPageClient → useLayoutEffect hydrates Redux
    // Comments are initialized via initialComments prop, no client-side fetch needed

    /**
     * Handle comment change from inline edit
     * Performs optimistic update and persists to database
     *
     * @param cardId - The repo card ID
     * @param newComment - The new comment text
     */
    const handleCommentChange = useCallback(
      async (cardId: string, newComment: string) => {
        // Optimistic update: Update local state immediately (preserve color)
        setComments((prev) => ({
          ...prev,
          [cardId]: {
            comment: newComment,
            color: prev[cardId]?.color ?? 'primary',
          },
        }))

        // Persist to database
        const result = await updateComment(cardId, newComment)
        if (!result.success) {
          // Could implement rollback here if needed
        }
      },
      [],
    )

    /**
     * Handle comment color change from CommentActionsMenu
     *
     * @param cardId - The card ID to update
     * @param color - The new color value
     */
    const handleCommentColorChange = useCallback(
      async (cardId: string, color: CommentColor) => {
        // Optimistic update: Update local state immediately
        setComments((prev) => ({
          ...prev,
          [cardId]: {
            comment: prev[cardId]?.comment ?? '',
            color,
          },
        }))

        // Persist to database
        try {
          await updateCommentColor(cardId, color)
        } catch (error) {
          Sentry.captureException(error, {
            tags: { action: 'updateCommentColor' },
          })
          toast.error('Failed to update comment color')
        }
      },
      [],
    )

    /**
     * Handle comment delete from CommentActionsMenu
     * Clears the comment text only, card remains
     *
     * @param cardId - The card ID to delete comment from
     */
    const handleCommentDelete = useCallback(async (cardId: string) => {
      // Optimistic update: Clear comment text, reset color to default
      setComments((prev) => ({
        ...prev,
        [cardId]: {
          comment: '',
          color: 'primary',
        },
      }))

      // Persist to database
      try {
        await deleteComment(cardId)
        toast.success('Comment deleted')
      } catch (error) {
        Sentry.captureException(error, { tags: { action: 'deleteComment' } })
        toast.error('Failed to delete comment')
      }
    }, [])

    // Show skeleton when no data loaded yet (e.g., initial hydration)
    if (statuses.length === 0) {
      return (
        <div className="w-full p-6">
          <KanbanSkeleton />
        </div>
      )
    }

    const activeCard = cards.find((c) => c.id === activeId)

    return (
      <div className="relative w-fit min-w-full p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={forgivingCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          {/* Column-level SortableContext for 2D grid reordering */}
          <SortableContext items={columnIds} strategy={rectSortingStrategy}>
            <div
              className="grid w-fit min-w-full gap-4 pb-4"
              suppressHydrationWarning
              style={
                isMounted
                  ? {
                      // Add extra column when dragging to allow insertion at end
                      gridTemplateColumns: `repeat(${gridDimensions.maxCol + 1 + (activeDragType === 'column' ? 1 : 0)}, minmax(280px, var(--column-width)))`,
                      // Use minmax(min-content, auto) for auto-height expansion (columns grow to fit cards)
                      gridTemplateRows: `repeat(${gridDimensions.maxRow + 1 + (activeDragType === 'column' ? 1 : 0)}, minmax(min-content, auto))`,
                    }
                  : {
                      // Stable initial styles for SSR hydration
                      gridTemplateColumns:
                        'repeat(1, minmax(280px, var(--column-width)))',
                      gridTemplateRows: 'repeat(1, auto)',
                    }
              }
            >
              {/* Render columns only after hydration to prevent SSR mismatch */}
              {isMounted &&
                sortedStatuses.map((status) => (
                  <SortableColumn
                    key={status.id}
                    status={status}
                    cards={cardsByStatus[status.id] ?? EMPTY_CARDS}
                    comments={comments}
                    cardDisplaySettings={cardDisplaySettings}
                    onMaintenance={onMoveToMaintenance}
                    onMoveToBoard={onMoveToAnotherBoard}
                    onNote={onNote}
                    onRemove={onRemove}
                    onCommentChange={handleCommentChange}
                    onCommentColorChange={handleCommentColorChange}
                    onCommentDelete={handleCommentDelete}
                    onEditStatus={onEditStatus}
                    onDeleteStatus={onDeleteStatus}
                    onAddCard={onAddCard}
                    gridStyle={{
                      gridRow: status.gridRow + 1, // CSS grid is 1-indexed
                      gridColumn: status.gridCol + 1,
                    }}
                  />
                ))}

              {/* Column Insert Zones - empty grid positions during column drag */}
              {isMounted &&
                insertionZones.map((zone) => (
                  <ColumnInsertZone
                    key={`insert-${zone.gridRow}-${zone.gridCol}`}
                    gridRow={zone.gridRow}
                    gridCol={zone.gridCol}
                    activeColumnId={activeId?.toString()}
                  />
                ))}

              {/* New Row Drop Zone - only visible during column drag */}
              {isMounted && activeDragType === 'column' && (
                <NewRowDropZone
                  targetRow={gridDimensions.maxRow + 1}
                  columnCount={gridDimensions.maxCol + 1 + 1} // +1 for expanded grid
                />
              )}
            </div>
          </SortableContext>

          {/* DragOverlay for both column and card previews */}
          <DragOverlay>
            {activeDragType === 'column' && activeId ? (
              // Column drag preview for 2D grid layout
              <div className="bg-background/80 border-primary w-70 max-w-full rotate-2 rounded-xl border-2 p-4 opacity-90 shadow-2xl backdrop-blur-sm">
                <h3 className="text-foreground font-semibold">
                  {sortedStatuses.find((s) => s.id === activeId)?.title}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  {(cardsByStatus[activeId as string] ?? EMPTY_CARDS).length}{' '}
                  cards
                </p>
              </div>
            ) : activeCard ? (
              // Card drag preview
              <Card className="rotate-3 cursor-grabbing opacity-90 shadow-2xl">
                <CardContent className="p-4">
                  <h4 className="text-foreground font-semibold">
                    {activeCard.title}
                  </h4>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    )
  },
)
KanbanBoard.displayName = 'KanbanBoard'
