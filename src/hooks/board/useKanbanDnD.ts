/**
 * useKanbanDnD Hook
 *
 * Extracts all drag-and-drop logic from KanbanBoard:
 * - Sensor configuration (Mouse, Touch, Keyboard)
 * - Custom collision detection (forgivingCollisionDetection)
 * - Drag start/end handlers with column sub-handlers
 * - Grid dimension calculations and insertion zone detection
 * - Active drag state (activeId, activeDragType)
 *
 * @example
 * const dnd = useKanbanDnD({ statuses, cards, cardsByStatus, EMPTY_CARDS, dispatch, pushCardHistory, pushColumnHistory })
 * <DndContext sensors={dnd.sensors} collisionDetection={forgivingCollisionDetection}
 *   onDragStart={dnd.handleDragStart} onDragEnd={dnd.handleDragEnd}>
 *   <SortableContext items={dnd.columnIds}>...</SortableContext>
 * </DndContext>
 */

import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import * as Sentry from '@sentry/nextjs'
import { useState, useCallback, useMemo } from 'react'

import { COLUMN_INSERT_DROP_TYPE } from '@/components/Board/ColumnInsertZone'
import { NEW_ROW_DROP_TYPE } from '@/components/Board/NewRowDropZone'
import { COLUMN_DRAG_TYPE } from '@/components/Board/SortableColumn'
import {
  updateRepoCardPosition,
  batchUpdateRepoCardOrders,
  swapStatusListPositions,
  batchUpdateStatusListPositions,
  updateStatusListPosition,
} from '@/lib/actions/board'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import { setStatusLists, setRepoCards } from '@/lib/redux/slices/boardSlice'
import type { AppDispatch } from '@/lib/redux/store'
import type { StatusListId } from '@/lib/types/brands'

/**
 * Custom collision detection algorithm for more forgiving column swap.
 *
 * Combines `pointerWithin` (priority) with `closestCenter` (fallback):
 * - pointerWithin: Triggers when pointer is INSIDE a droppable (very forgiving)
 * - closestCenter: Falls back to center-distance calculation when pointer is outside all droppables
 *
 * @param args - Collision detection arguments from @dnd-kit
 * @returns Array of collision results, prioritizing pointer-based collisions
 */
export const forgivingCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) {
    return pointerCollisions
  }
  return closestCenter(args)
}

/** Drag type identifier for active drag detection */
type DragType = 'column' | 'card' | null

interface UseKanbanDnDParams {
  /** Status lists (columns) from Redux */
  statuses: StatusListDomain[]
  /** All repo cards from Redux */
  cards: RepoCardForRedux[]
  /** Cards grouped by statusId for efficient lookup */
  cardsByStatus: Record<string, RepoCardForRedux[]>
  /** Stable empty array reference for fallback */
  EMPTY_CARDS: RepoCardForRedux[]
  /** Redux dispatch function */
  dispatch: AppDispatch
  /** Push a card snapshot to the undo history stack */
  pushCardHistory: (snapshot: RepoCardForRedux[]) => void
  /** Push a column snapshot to the undo history stack */
  pushColumnHistory: (snapshot: StatusListDomain[]) => void
}

interface UseKanbanDnDReturn {
  /** ID of the currently dragged item */
  activeId: UniqueIdentifier | null
  /** Type of the currently dragged item */
  activeDragType: DragType
  /** Configured sensors for Mouse, Touch, and Keyboard */
  sensors: ReturnType<typeof useSensors>
  /** Sorted column IDs for SortableContext */
  columnIds: string[]
  /** Empty grid positions available during column drag */
  insertionZones: Array<{ gridRow: number; gridCol: number }>
  /** Handle drag start — detects column vs card drag */
  handleDragStart: (event: DragStartEvent) => void
  /** Handle drag end — dispatches to column/card sub-handlers */
  handleDragEnd: (event: DragEndEvent) => Promise<void>
  /** Grid dimensions for CSS grid template */
  gridDimensions: { maxRow: number; maxCol: number }
  /** Statuses sorted by gridRow then gridCol for rendering */
  sortedStatuses: StatusListDomain[]
}

/**
 * Hook for all Kanban board drag-and-drop logic.
 *
 * @param params - Board state and dispatch
 * @returns DnD state and handlers for DndContext
 *
 * @example
 * const { sensors, handleDragStart, handleDragEnd, columnIds } = useKanbanDnD({
 *   statuses, cards, cardsByStatus, EMPTY_CARDS, dispatch,
 *   pushCardHistory, pushColumnHistory,
 * })
 */
export function useKanbanDnD(params: UseKanbanDnDParams): UseKanbanDnDReturn {
  const {
    statuses,
    cards,
    cardsByStatus,
    EMPTY_CARDS,
    dispatch,
    pushCardHistory,
    pushColumnHistory,
  } = params

  // Active drag state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [activeDragType, setActiveDragType] = useState<DragType>(null)

  // Sorted statuses for consistent rendering (by gridRow, then gridCol)
  const sortedStatuses = useMemo(
    () =>
      [...statuses].sort((a, b) => {
        if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow
        return a.gridCol - b.gridCol
      }),
    [statuses],
  )

  // Grid dimensions for CSS grid template
  const gridDimensions = useMemo(() => {
    if (statuses.length === 0) return { maxRow: 0, maxCol: 0 }
    const maxRow = Math.max(...statuses.map((s) => s.gridRow))
    const maxCol = Math.max(...statuses.map((s) => s.gridCol))
    return { maxRow, maxCol }
  }, [statuses])

  // Insertion zones: empty grid positions during column drag
  const insertionZones = useMemo(() => {
    if (activeDragType !== 'column') return []

    const zones: Array<{ gridRow: number; gridCol: number }> = []
    const { maxRow, maxCol } = gridDimensions
    const occupiedPositions = new Set(
      statuses
        .filter((s) => s.id !== activeId)
        .map((s) => `${s.gridRow}-${s.gridCol}`),
    )

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

  // Column IDs for SortableContext
  const columnIds = useMemo(
    () => sortedStatuses.map((s) => s.id),
    [sortedStatuses],
  )

  // Sensor configuration
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

  /** Save current column state to undo history (max 10 entries) */
  const recordColumnHistory = useCallback(() => {
    pushColumnHistory(statuses)
  }, [statuses, pushColumnHistory])

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

      const updates: Array<{ id: string; gridRow: number; gridCol: number }> = [
        { id: activeStatus.id, gridRow: targetRow, gridCol: targetCol },
      ]

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

  /** Handle drag start — detects column vs card drag */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id)
    setActiveDragType(
      active.data.current?.type === COLUMN_DRAG_TYPE ? 'column' : 'card',
    )
  }, [])

  /** Handle drag end — dispatches to column/card sub-handlers */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
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

      // Resolve target column. Target statuses come from several untyped sources
      // (`over.data.current`, stringified drop IDs), so each branch validates the
      // resolved ID against the known `statuses` list before branding it.
      const overData = over.data.current
      const resolveTargetStatusId = (): StatusListId => {
        const matchStatus = (id: string): StatusListId | null => {
          const status = statuses.find((s) => s.id === id)
          return status ? status.id : null
        }

        if (
          overData?.type === 'column' &&
          typeof overData.statusId === 'string'
        ) {
          const matched = matchStatus(overData.statusId)
          if (matched) return matched
        }

        const overCard = cards.find((c) => c.id === over.id)
        if (overCard) return overCard.statusId

        const overId = over.id.toString()
        const stripped = overId.startsWith('droppable-')
          ? overId.slice('droppable-'.length)
          : overId
        return matchStatus(stripped) ?? activeCard.statusId
      }
      const targetStatusId = resolveTargetStatusId()

      // Save card history for undo
      pushCardHistory(cards)

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
    },
    [
      statuses,
      cards,
      cardsByStatus,
      EMPTY_CARDS,
      dispatch,
      pushCardHistory,
      handleNewRowDrop,
      handleColumnInsertDrop,
      handleColumnSwap,
    ],
  )

  return {
    activeId,
    activeDragType,
    sensors,
    columnIds,
    insertionZones,
    handleDragStart,
    handleDragEnd,
    gridDimensions,
    sortedStatuses,
  }
}
