'use client'

import type {
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
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getBoardData,
  updateRepoCardPosition,
  batchUpdateRepoCardOrders,
  batchUpdateStatusListOrders,
} from '@/lib/actions/board'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import {
  setStatusLists,
  setRepoCards,
  setLoading,
  setError,
  selectStatusLists,
  selectRepoCards,
  selectBoardLoading,
  selectBoardError,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

import { SortableColumn, COLUMN_DRAG_TYPE } from './SortableColumn'

/**
 * Drag type identifier for active drag detection
 */
type DragType = 'column' | 'card' | null

// Types: Using Domain types for type-safe state management

interface KanbanBoardProps {
  boardId?: string
  onEditProjectInfo?: (cardId: string) => void
  onMoveToMaintenance?: (cardId: string) => void
  /** Callback when Note button is clicked on a card */
  onNote?: (cardId: string) => void
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, colIndex) => (
        <div
          key={colIndex}
          className="bg-background/50 backdrop-blur-sm rounded-xl p-4 border border-border"
        >
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <div className="space-y-3">
            {[...Array(2)].map((_, cardIndex) => (
              <motion.div
                key={cardIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cardIndex * 0.1 }}
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

// Error State Component
const ErrorState = memo(({ message }: { message: string }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <AlertCircle className="w-16 h-16 text-destructive mb-4" />
      <h3 className="text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h3>
      <p className="text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  )
})
ErrorState.displayName = 'ErrorState'

// Main Kanban Board Component
export const KanbanBoard = memo<KanbanBoardProps>(
  ({
    boardId = 'default-board',
    onEditProjectInfo,
    onMoveToMaintenance,
    onNote,
    onEditStatus,
    onDeleteStatus,
    onAddCard,
  }) => {
    // Redux state (auto-synced to LocalStorage)
    const dispatch = useAppDispatch()
    const statuses = useAppSelector(selectStatusLists)
    const cards = useAppSelector(selectRepoCards)
    const loading = useAppSelector(selectBoardLoading)
    const error = useAppSelector(selectBoardError)

    // Local state (temporary state not migrated to Redux)
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
    const [activeDragType, setActiveDragType] = useState<DragType>(null)
    // History stack for undo functionality (max 10 entries)
    const [history, setHistory] = useState<RepoCardForRedux[][]>([])
    const [columnHistory, setColumnHistory] = useState<StatusListDomain[][]>([])
    const [undoMessage, setUndoMessage] = useState<string | null>(null)

    // Memoized sorted statuses for consistent rendering
    const sortedStatuses = useMemo(
      () => [...statuses].sort((a, b) => a.order - b.order),
      [statuses],
    )

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

    // Fetch board data from Supabase
    useEffect(() => {
      const fetchData = async () => {
        if (!boardId || boardId === 'default-board') {
          dispatch(setError('Valid board ID is required'))
          return
        }

        try {
          dispatch(setLoading(true))
          dispatch(setError(null))

          // Fetch data from Supabase (getBoardData already includes default StatusList creation)
          const { statusLists, repoCards } = await getBoardData(boardId)

          dispatch(setStatusLists(statusLists))
          dispatch(setRepoCards(repoCards))
        } catch (err) {
          console.error('Board data fetch error:', err)
          dispatch(setError('Failed to fetch board data. Please try again.'))
        } finally {
          dispatch(setLoading(false))
        }
      }

      fetchData()
    }, [boardId, dispatch])

    /**
     * Undo functionality: Reverts the last drag & drop operation
     * Supports both card and column operations
     * Requirements: <200ms response time
     */
    const handleUndo = useCallback(() => {
      // Try column undo first, then card undo
      if (columnHistory.length > 0) {
        const previousState = columnHistory[columnHistory.length - 1]
        dispatch(setStatusLists(previousState))
        setColumnHistory((prev) => prev.slice(0, -1))
        setUndoMessage('Column order restored')
        setTimeout(() => setUndoMessage(null), 2000)
        return
      }

      if (history.length > 0) {
        const previousState = history[history.length - 1]
        dispatch(setRepoCards(previousState))
        setHistory((prev) => prev.slice(0, -1))
        setUndoMessage('Card operation undone')
        setTimeout(() => setUndoMessage(null), 2000)
      }
    }, [history, columnHistory, dispatch])

    // Keyboard shortcut: Z key to execute undo
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
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

    /**
     * Handle drag end event
     * Processes both column and card reordering
     */
    const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setActiveDragType(null)

      if (!over) return

      // Handle column reordering
      if (active.data.current?.type === COLUMN_DRAG_TYPE) {
        if (active.id === over.id) return

        const oldIndex = sortedStatuses.findIndex((s) => s.id === active.id)
        const newIndex = sortedStatuses.findIndex((s) => s.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Save current state to column history (max 10 entries)
          setColumnHistory((prev) => {
            const newHistory = [...prev, statuses]
            return newHistory.slice(-10)
          })

          // Create reordered array with updated order values
          const reordered = arrayMove(sortedStatuses, oldIndex, newIndex)
          const updatedStatuses = reordered.map((status, index) => ({
            ...status,
            order: index,
          }))

          // Optimistic UI update
          dispatch(setStatusLists(updatedStatuses))

          // Sync to Supabase (background)
          try {
            const updates = updatedStatuses.map((status) => ({
              id: status.id,
              order: status.order,
            }))
            await batchUpdateStatusListOrders(updates)
          } catch (error) {
            console.error('Failed to sync column order:', error)
            // Revert on error
            dispatch(setStatusLists(statuses))
          }
        }
        return
      }

      // Handle card reordering
      const activeCard = cards.find((c) => c.id === active.id)
      if (!activeCard) return

      // Determine target status ID from over element
      let targetStatusId: string
      const overData = over.data.current

      if (overData?.type === 'column' && overData?.statusId) {
        // Dropped on a column droppable
        targetStatusId = overData.statusId
      } else {
        // Dropped on a card or column
        const overCard = cards.find((c) => c.id === over.id)
        if (overCard) {
          targetStatusId = overCard.statusId
        } else {
          // Check if dropped on droppable column
          const overId = over.id.toString()
          if (overId.startsWith('droppable-')) {
            targetStatusId = overId.replace('droppable-', '')
          } else {
            // Assume it's a column ID directly
            const overStatus = statuses.find((s) => s.id === overId)
            targetStatusId = overStatus ? overId : activeCard.statusId
          }
        }
      }

      // Save current state to history (max 10 entries)
      setHistory((prev) => {
        const newHistory = [...prev, cards]
        return newHistory.slice(-10)
      })

      if (activeCard.statusId === targetStatusId) {
        // Reordering within the same column
        const columnCards = cards.filter((c) => c.statusId === targetStatusId)
        const oldIndex = columnCards.findIndex((c) => c.id === active.id)
        const newIndex = columnCards.findIndex((c) => c.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(columnCards, oldIndex, newIndex)
          const otherCards = cards.filter((c) => c.statusId !== targetStatusId)

          // Optimistic UI update
          dispatch(setRepoCards([...otherCards, ...reordered]))

          // Sync to Supabase (background)
          const updates = reordered.map((card, index) => ({
            id: card.id,
            statusId: targetStatusId,
            order: index,
          }))

          try {
            await batchUpdateRepoCardOrders(updates)
          } catch (error) {
            console.error('Failed to sync card order:', error)
            // Revert on error (restore from history)
            dispatch(setRepoCards(cards))
          }
        }
      } else {
        // Moving to a different column
        const updatedCards = cards.map((c) =>
          c.id === activeCard.id ? { ...c, statusId: targetStatusId } : c,
        )

        // Optimistic UI update
        dispatch(setRepoCards(updatedCards))

        // Sync to Supabase (background)
        try {
          const targetColumnCards = updatedCards.filter(
            (c) => c.statusId === targetStatusId,
          )
          const newOrder = targetColumnCards.findIndex(
            (c) => c.id === activeCard.id,
          )

          await updateRepoCardPosition(activeCard.id, targetStatusId, newOrder)
        } catch (error) {
          console.error('Failed to sync card position:', error)
          // Revert on error
          dispatch(setRepoCards(cards))
        }
      }
    }

    if (loading) {
      return (
        <div className="w-full p-6">
          <KanbanSkeleton />
        </div>
      )
    }

    if (error) {
      return (
        <div className="w-full p-6">
          <ErrorState message={error} />
        </div>
      )
    }

    const activeCard = cards.find((c) => c.id === activeId)

    return (
      <div className="w-full h-full p-6 relative">
        {/* Undo message display */}
        {undoMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg"
          >
            {undoMessage}
          </motion.div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          {/* Column-level SortableContext for horizontal reordering */}
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {sortedStatuses.map((status) => (
                <SortableColumn
                  key={status.id}
                  status={status}
                  cards={cards.filter((c) => c.statusId === status.id)}
                  onEdit={onEditProjectInfo}
                  onMaintenance={onMoveToMaintenance}
                  onNote={onNote}
                  onEditStatus={onEditStatus}
                  onDeleteStatus={onDeleteStatus}
                  onAddCard={onAddCard}
                />
              ))}
            </div>
          </SortableContext>

          {/* DragOverlay for both column and card previews */}
          <DragOverlay>
            {activeDragType === 'column' && activeId ? (
              // Column drag preview (Trello-style: no drag handle icon)
              <div className="min-w-[280px] bg-background/80 backdrop-blur-sm rounded-xl p-4 border-2 border-primary shadow-2xl opacity-90">
                <h3 className="font-semibold text-foreground">
                  {sortedStatuses.find((s) => s.id === activeId)?.title}
                </h3>
              </div>
            ) : activeCard ? (
              // Card drag preview
              <Card className="cursor-grabbing shadow-2xl rotate-3 opacity-90">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-foreground">
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

export default KanbanBoard
