'use client'

import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import * as Sentry from '@sentry/nextjs'
import { motion, useReducedMotion } from 'framer-motion'
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMounted } from '@/hooks/use-mounted'
import {
  updateRepoCardPosition,
  batchUpdateRepoCardOrders,
  swapStatusListPositions,
  batchUpdateStatusListPositions,
} from '@/lib/actions/board'
import {
  updateComment,
  updateCommentColor,
  deleteComment,
  type CommentData,
} from '@/lib/actions/project-info'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import {
  setStatusLists,
  setRepoCards,
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { CommentColor } from '@/lib/supabase/types'
import type { CardDisplaySettings } from '@/lib/types/board-settings'

import { ColumnInsertZone, COLUMN_INSERT_DROP_TYPE } from './ColumnInsertZone'
import { NewRowDropZone, NEW_ROW_DROP_TYPE } from './NewRowDropZone'
import { SortableColumn, COLUMN_DRAG_TYPE } from './SortableColumn'

/**
 * Drag type identifier for active drag detection
 */
type DragType = 'column' | 'card' | null

/**
 * Custom collision detection algorithm for more forgiving column swap.
 *
 * Combines `pointerWithin` (priority) with `closestCenter` (fallback):
 * - pointerWithin: Triggers when pointer is INSIDE a droppable (very forgiving)
 * - closestCenter: Falls back to center-distance calculation when pointer is outside all droppables
 *
 * This makes horizontal column swapping much easier - users don't need to
 * precisely target the center of the target column.
 *
 * @param args - Collision detection arguments from @dnd-kit
 * @returns Array of collision results, prioritizing pointer-based collisions
 */
const forgivingCollisionDetection: CollisionDetection = (args) => {
  // First, check if pointer is inside any droppable (most forgiving)
  const pointerCollisions = pointerWithin(args)

  // If pointer is inside a droppable, use that result
  if (pointerCollisions.length > 0) {
    return pointerCollisions
  }

  // Fallback: Use closestCenter when pointer is outside all droppables
  return closestCenter(args)
}

// Types: Using Domain types for type-safe state management

interface KanbanBoardProps {
  boardId?: string
  /** Initial comments fetched by Server Component (Phase 4) */
  initialComments?: Record<string, CommentData>
  /** Card display settings from board.settings JSON */
  cardDisplaySettings?: CardDisplaySettings
  onMoveToMaintenance?: (cardId: string) => void
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
    onNote,
    onRemove,
    onEditStatus,
    onDeleteStatus,
    onAddCard,
  }) => {
    // Note: _boardId is no longer used for data fetching (Phase 4 refactoring)
    // Data is now fetched by Server Component and passed via props/Redux
    // Kept for backwards compatibility and potential future use (e.g., refresh)
    const prefersReducedMotion = useReducedMotion()
    // Redux state (auto-synced to LocalStorage)
    const dispatch = useAppDispatch()
    const statuses = useAppSelector(selectStatusLists)
    const cards = useAppSelector(selectRepoCards)

    // Local state (temporary state not migrated to Redux)
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
    const [activeDragType, setActiveDragType] = useState<DragType>(null)
    // History stack for undo functionality (max 10 entries)
    const [history, setHistory] = useState<RepoCardForRedux[][]>([])
    // Comments map: cardId → comment data (text + color) from projectinfo
    // Phase 4: Initialized with server-fetched data (no client-side fetch needed)
    const [comments, setComments] = useState<Record<string, CommentData>>(
      initialComments ?? {},
    )

    // Hydration-safe mounting state: prevents SSR/CSR mismatch for dynamic grid styles
    // Uses useSyncExternalStore-based hook for proper SSR support
    const isMounted = useMounted()
    const [columnHistory, setColumnHistory] = useState<StatusListDomain[][]>([])
    const [undoMessage, setUndoMessage] = useState<string | null>(null)

    // Memoized sorted statuses for consistent rendering (by gridRow, then gridCol)
    const sortedStatuses = useMemo(
      () =>
        [...statuses].sort((a, b) => {
          if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow
          return a.gridCol - b.gridCol
        }),
      [statuses],
    )

    // Calculate grid dimensions for CSS grid template
    const gridDimensions = useMemo(() => {
      if (statuses.length === 0) return { maxRow: 0, maxCol: 0 }
      const maxRow = Math.max(...statuses.map((s) => s.gridRow))
      const maxCol = Math.max(...statuses.map((s) => s.gridCol))
      return { maxRow, maxCol }
    }, [statuses])

    /**
     * Calculate insertion zones (empty grid positions) during column drag
     * These zones allow dropping a column into an empty grid cell
     */
    const insertionZones = useMemo(() => {
      // Only calculate when dragging a column
      if (activeDragType !== 'column') return []

      const zones: Array<{ gridRow: number; gridCol: number }> = []
      const { maxRow, maxCol } = gridDimensions

      // Build a set of occupied positions for quick lookup
      const occupiedPositions = new Set(
        statuses
          .filter((s) => s.id !== activeId) // Exclude the dragged column
          .map((s) => `${s.gridRow}-${s.gridCol}`),
      )

      // Find empty positions in each row (up to maxCol + 1 for adding at end)
      for (let row = 0; row <= maxRow; row++) {
        for (let col = 0; col <= maxCol + 1; col++) {
          const posKey = `${row}-${col}`
          if (!occupiedPositions.has(posKey)) {
            zones.push({ gridRow: row, gridCol: col })
          }
        }
      }

      return zones
    }, [activeDragType, gridDimensions, statuses, activeId])

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

    // Column IDs for SortableContext
    const columnIds = useMemo(
      () => sortedStatuses.map((s) => s.id),
      [sortedStatuses],
    )

    const sensors = useSensors(
      useSensor(MouseSensor, {
        activationConstraint: {
          distance: 8,
        },
      }),
      useSensor(TouchSensor, {
        activationConstraint: {
          delay: 200,
          tolerance: 6,
        },
      }),
      useSensor(KeyboardSensor),
    )

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
        try {
          await updateComment(cardId, newComment)
        } catch (error) {
          // Revert on error
          Sentry.captureException(error, {
            extra: { context: 'Update comment', cardId },
          })
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
            extra: { context: 'Update comment color', cardId, color },
          })
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
      } catch (error) {
        Sentry.captureException(error, {
          extra: { context: 'Delete comment', cardId },
        })
      }
    }, [])

    /**
     * Undo functionality: Reverts the last drag & drop operation
     * Supports both card and column operations
     * Requirements: <200ms response time
     */
    const handleUndo = useCallback(() => {
      // Try column undo first, then card undo
      if (columnHistory.length > 0) {
        const previousState = columnHistory[columnHistory.length - 1]
        if (previousState) {
          dispatch(setStatusLists(previousState))
          setColumnHistory((prev) => prev.slice(0, -1))
          setUndoMessage('Column order restored')
          setTimeout(() => setUndoMessage(null), 2000)

          // P1-8: Sync reverted column positions to DB
          const updates = previousState.map((s) => ({
            id: s.id,
            gridRow: s.gridRow,
            gridCol: s.gridCol,
          }))
          batchUpdateStatusListPositions(updates).catch((error) => {
            Sentry.captureException(error, {
              tags: { action: 'undoColumnPositions' },
            })
            toast.error('Failed to sync undo to database')
          })
        }
        return
      }

      if (history.length > 0) {
        const previousState = history[history.length - 1]
        if (previousState) {
          dispatch(setRepoCards(previousState))
          setHistory((prev) => prev.slice(0, -1))
          setUndoMessage('Card operation undone')
          setTimeout(() => setUndoMessage(null), 2000)

          // P1-8: Sync reverted card positions to DB
          const updates = previousState.map((c, index) => ({
            id: c.id,
            statusId: c.statusId,
            order: c.order ?? index,
          }))
          batchUpdateRepoCardOrders(updates).catch((error) => {
            Sentry.captureException(error, {
              tags: { action: 'undoCardPositions' },
            })
            toast.error('Failed to sync undo to database')
          })
        }
      }
    }, [history, columnHistory, dispatch])

    // Keyboard shortcut: Z key to execute undo
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Skip if user is typing in an input field, textarea, or contentEditable element
        const target = event.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }

        // Z key (both uppercase and lowercase, no Cmd/Ctrl required)
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault()
          handleUndo()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleUndo]) // Depends on handleUndo

    /**
     * Handle drag start event
     * Detects whether column or card is being dragged
     */
    const handleDragStart = (event: DragStartEvent) => {
      const { active } = event
      setActiveId(active.id)

      // Determine drag type from data
      const dragData = active.data.current
      if (dragData?.type === COLUMN_DRAG_TYPE) {
        setActiveDragType('column')
      } else {
        setActiveDragType('card')
      }
    }

    /** Save current column state to undo history (max 10 entries) */
    const recordColumnHistory = useCallback(() => {
      setColumnHistory((prev) => [...prev, statuses].slice(-10))
    }, [statuses])

    /** Handle column dropped on NewRowDropZone */
    const handleNewRowDrop = useCallback(
      async (
        activeStatus: StatusListDomain,
        targetRow: number,
        targetCol: number,
      ) => {
        recordColumnHistory()

        const updatedStatuses = statuses.map((status) =>
          status.id === activeStatus.id
            ? { ...status, gridRow: targetRow, gridCol: targetCol }
            : status,
        )
        dispatch(setStatusLists(updatedStatuses))

        try {
          const { updateStatusListPosition } =
            await import('@/lib/actions/board')
          await updateStatusListPosition(activeStatus.id, targetRow, targetCol)
        } catch (error) {
          Sentry.captureException(error, {
            tags: { action: 'moveColumnToNewRow' },
          })
          dispatch(setStatusLists(statuses))
        }
      },
      [statuses, dispatch, recordColumnHistory],
    )

    /** Handle column dropped on ColumnInsertZone (empty grid position) */
    const handleColumnInsertDrop = useCallback(
      async (
        activeStatus: StatusListDomain,
        targetRow: number,
        targetCol: number,
      ) => {
        if (
          activeStatus.gridRow === targetRow &&
          activeStatus.gridCol === targetCol
        ) {
          return
        }

        recordColumnHistory()

        const updates: Array<{ id: string; gridRow: number; gridCol: number }> =
          [{ id: activeStatus.id, gridRow: targetRow, gridCol: targetCol }]

        // Shift columns at targetCol and beyond if position is occupied
        const columnAtTarget = statuses.find(
          (s) =>
            s.id !== activeStatus.id &&
            s.gridRow === targetRow &&
            s.gridCol === targetCol,
        )
        if (columnAtTarget) {
          for (const col of statuses.filter(
            (s) =>
              s.id !== activeStatus.id &&
              s.gridRow === targetRow &&
              s.gridCol >= targetCol,
          )) {
            updates.push({
              id: col.id,
              gridRow: col.gridRow,
              gridCol: col.gridCol + 1,
            })
          }
        }

        const updateMap = new Map(updates.map((u) => [u.id, u]))
        const updatedStatuses = statuses.map((status) => {
          const update = updateMap.get(status.id)
          return update
            ? { ...status, gridRow: update.gridRow, gridCol: update.gridCol }
            : status
        })
        dispatch(setStatusLists(updatedStatuses))

        try {
          await batchUpdateStatusListPositions(updates)
        } catch (error) {
          Sentry.captureException(error, { tags: { action: 'insertColumn' } })
          dispatch(setStatusLists(statuses))
        }
      },
      [statuses, dispatch, recordColumnHistory],
    )

    /** Handle column swap (drop on another column) */
    const handleColumnSwap = useCallback(
      async (activeStatus: StatusListDomain, overStatus: StatusListDomain) => {
        recordColumnHistory()

        const updatedStatuses = statuses.map((status) => {
          if (status.id === activeStatus.id) {
            return {
              ...status,
              gridRow: overStatus.gridRow,
              gridCol: overStatus.gridCol,
            }
          }
          if (status.id === overStatus.id) {
            return {
              ...status,
              gridRow: activeStatus.gridRow,
              gridCol: activeStatus.gridCol,
            }
          }
          return status
        })
        dispatch(setStatusLists(updatedStatuses))

        try {
          await swapStatusListPositions(activeStatus.id, overStatus.id)
        } catch (error) {
          Sentry.captureException(error, {
            tags: { action: 'swapColumnPositions' },
          })
          dispatch(setStatusLists(statuses))
        }
      },
      [statuses, dispatch, recordColumnHistory],
    )

    /**
     * Handle drag end event
     * Dispatches to sub-handlers for column and card operations
     */
    const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setActiveDragType(null)

      if (!over) return

      // Column drag operations
      if (active.data.current?.type === COLUMN_DRAG_TYPE) {
        if (active.id === over.id) return

        const activeStatus = statuses.find((s) => s.id === active.id)
        const overData = over.data.current

        if (overData?.type === NEW_ROW_DROP_TYPE && activeStatus) {
          await handleNewRowDrop(
            activeStatus,
            overData.gridRow as number,
            overData.gridCol as number,
          )
          return
        }
        if (overData?.type === COLUMN_INSERT_DROP_TYPE && activeStatus) {
          await handleColumnInsertDrop(
            activeStatus,
            overData.gridRow as number,
            overData.gridCol as number,
          )
          return
        }

        const overStatus = statuses.find((s) => s.id === over.id)
        if (activeStatus && overStatus) {
          await handleColumnSwap(activeStatus, overStatus)
        }
        return
      }

      // Card drag operations
      const activeCard = cards.find((c) => c.id === active.id)
      if (!activeCard) return

      // Resolve target column
      let targetStatusId: string
      const overData = over.data.current
      if (overData?.type === 'column' && overData?.statusId) {
        targetStatusId = overData.statusId
      } else {
        const overCard = cards.find((c) => c.id === over.id)
        if (overCard) {
          targetStatusId = overCard.statusId
        } else {
          const overId = over.id.toString()
          if (overId.startsWith('droppable-')) {
            targetStatusId = overId.replace('droppable-', '')
          } else {
            const overStatus = statuses.find((s) => s.id === overId)
            targetStatusId = overStatus ? overId : activeCard.statusId
          }
        }
      }

      // Save card history for undo
      setHistory((prev) => [...prev, cards].slice(-10))

      if (activeCard.statusId === targetStatusId) {
        // Reorder within same column
        const columnCards = cardsByStatus[targetStatusId] ?? EMPTY_CARDS
        const oldIndex = columnCards.findIndex((c) => c.id === active.id)
        const newIndex = columnCards.findIndex((c) => c.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(columnCards, oldIndex, newIndex)
          const otherCards = cards.filter((c) => c.statusId !== targetStatusId)
          dispatch(setRepoCards([...otherCards, ...reordered]))

          const updates = reordered.map((card, index) => ({
            id: card.id,
            statusId: targetStatusId,
            order: index,
          }))
          try {
            await batchUpdateRepoCardOrders(updates)
          } catch (error) {
            Sentry.captureException(error, {
              tags: { action: 'syncCardOrder' },
            })
            dispatch(setRepoCards(cards))
          }
        }
      } else {
        // Move to different column
        const updatedCards = cards.map((c) =>
          c.id === activeCard.id ? { ...c, statusId: targetStatusId } : c,
        )
        dispatch(setRepoCards(updatedCards))

        try {
          const targetColumnCards = updatedCards.filter(
            (c) => c.statusId === targetStatusId,
          )
          const newOrder = targetColumnCards.findIndex(
            (c) => c.id === activeCard.id,
          )
          await updateRepoCardPosition(activeCard.id, targetStatusId, newOrder)
        } catch (error) {
          Sentry.captureException(error, {
            tags: { action: 'syncCardPosition' },
          })
          dispatch(setRepoCards(cards))
        }
      }
    }

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
        {/* Undo message display */}
        {undoMessage && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : undefined }}
            className="bg-primary text-primary-foreground absolute top-4 left-1/2 z-50 -translate-x-1/2 transform rounded-lg px-4 py-2 shadow-lg"
          >
            {undoMessage}
          </motion.div>
        )}

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
