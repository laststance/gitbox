'use client'

import { DndContext, DragOverlay } from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { LazyMotion, domAnimation } from 'framer-motion'
import React, { memo, useMemo } from 'react'

import { KanbanSkeleton } from '@/components/Board/KanbanSkeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useCommentState } from '@/hooks/board/useCommentState'
import {
  forgivingCollisionDetection,
  useKanbanDnD,
} from '@/hooks/board/useKanbanDnD'
import { useKanbanUndo } from '@/hooks/board/useKanbanUndo'
import { useMounted } from '@/hooks/use-mounted'
import type { CommentData } from '@/lib/actions/project-info'
import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import {
  selectStatusLists,
  selectRepoCards,
} from '@/lib/redux/slices/boardSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'
import type { CardDisplaySettings } from '@/lib/types/board-settings'
import type { RepoCardId, StatusListId } from '@/lib/types/brands'

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
  onMoveToMaintenance?: (cardId: RepoCardId) => void
  /** Callback when card is moved to another board */
  onMoveToAnotherBoard?: (cardId: RepoCardId) => void
  /** Callback when Note button is clicked (opens unified NoteModal with notes + links) */
  onNote?: (cardId: RepoCardId) => void
  /** Callback when repository is removed from board */
  onRemove?: (cardId: RepoCardId) => void
  onEditStatus?: (status: StatusListDomain) => void
  onDeleteStatus?: (statusId: StatusListId) => void
  onAddCard?: (statusId: StatusListId) => void
}

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

    // Hydration-safe mounting state: prevents SSR/CSR mismatch for dynamic grid styles
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

    // Comment state: optimistic updates + DB persistence
    const {
      comments,
      handleCommentChange,
      handleCommentColorChange,
      handleCommentDelete,
    } = useCommentState({ initialComments: initialComments ?? {} })

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

    // Show skeleton when no data loaded yet (e.g., initial hydration)
    if (statuses.length === 0) {
      return (
        <LazyMotion features={domAnimation}>
          <div className="w-full p-6">
            <KanbanSkeleton />
          </div>
        </LazyMotion>
      )
    }

    const activeCard = cards.find((c) => c.id === activeId)

    return (
      <LazyMotion features={domAnimation}>
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
      </LazyMotion>
    )
  },
)
KanbanBoard.displayName = 'KanbanBoard'
