'use client'

import { DndContext } from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { LazyMotion, domAnimation } from 'framer-motion'
import React, { memo, useMemo } from 'react'

import { KanbanSkeleton } from '@/components/Board/KanbanSkeleton'
import { useBoardRollback } from '@/hooks/board/useBoardRollback'
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
import {
  boardContentForRender,
  selectHydratedBoardIdIfPresent,
} from '@/lib/utils/board-content-for-render'

import { KanbanDragChrome } from './KanbanDragChrome'
import { RestingColumn, SortableColumn } from './SortableColumn'

/**
 * The comments of a board rendered without any. One object for every render:
 * {@link useCommentState} adopts a new `initialComments` object during render,
 * so a fresh `{}` each time would never settle.
 */
const NO_COMMENTS: Record<string, CommentData> = {}

interface KanbanBoardProps {
  boardId?: string
  /**
   * Comments fetched by the Server Component, plus those that repositories
   * added again brought back (issue #216). Keep the object stable between
   * renders unless it changed.
   */
  initialComments?: Record<string, CommentData>
  /**
   * Comments of a refetch that was applied. The same object until the next
   * applied fetch. Absent until then.
   */
  fetchedComments?: Record<string, CommentData> | null
  /**
   * Columns fetched by the Server Component. Shown until the store holds
   * this board, including on the server and the first client render.
   */
  initialStatusLists?: StatusListDomain[]
  /**
   * Cards fetched by the Server Component. Shown with
   * {@link initialStatusLists} until the store holds this board.
   */
  initialRepoCards?: RepoCardForRedux[]
  /** Card display settings from board.settings JSON */
  cardDisplaySettings?: CardDisplaySettings
  /** Callback when card is moved to another board */
  onMoveToAnotherBoard?: (cardId: RepoCardId) => void
  /** Callback when Note button is clicked (opens unified NoteModal with notes + links) */
  onNote?: (cardId: RepoCardId) => void
  /** Read one card's repository from GitHub and rewrite its snapshot. */
  onRefresh?: (cardId: RepoCardId) => void
  /** Callback when repository is removed from board */
  onRemove?: (cardId: RepoCardId) => void
  onEditStatus?: (status: StatusListDomain) => void
  onDeleteStatus?: (statusId: StatusListId) => void
  onAddCard?: (statusId: StatusListId, opener?: HTMLElement) => void
}

export const KanbanBoard = memo<KanbanBoardProps>(
  ({
    boardId: _boardId = 'default-board',
    initialComments,
    fetchedComments = null,
    initialStatusLists,
    initialRepoCards,
    cardDisplaySettings,
    onMoveToAnotherBoard,
    onNote,
    onRefresh,
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
    const storeStatuses = useAppSelector(selectStatusLists)
    const storeCards = useAppSelector(selectRepoCards)
    const hydratedBoardId = useAppSelector(selectHydratedBoardIdIfPresent)
    // The store is empty on the server and on the first client render
    const { columns: statuses, cards } = boardContentForRender({
      boardId: _boardId,
      hydratedBoardId,
      storeColumns: storeStatuses,
      storeCards,
      pageColumns: initialStatusLists,
      pageCards: initialRepoCards,
    })

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
    } = useCommentState({
      initialComments: initialComments ?? NO_COMMENTS,
      fetchedComments,
    })

    // Failed-save rollbacks that never overwrite a board that changed meanwhile
    const { rollbackRepoCards, rollbackStatusLists } = useBoardRollback()

    // Undo hook: history stacks + Z-key shortcut (self-contained)
    const { pushCardHistory, pushColumnHistory } = useKanbanUndo({
      dispatch,
      cards,
      statuses,
      rollbackRepoCards,
      rollbackStatusLists,
    })

    // DnD hook: sensors, handlers, grid calculations
    const {
      sensors,
      columnIds,
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
      rollbackRepoCards,
      rollbackStatusLists,
    })

    // No columns from the page and none in the store for this board yet
    if (statuses.length === 0) {
      return (
        <LazyMotion features={domAnimation}>
          <div className="w-full p-6">
            <KanbanSkeleton />
          </div>
        </LazyMotion>
      )
    }

    const columns = sortedStatuses.map((status) => {
      const columnProps = {
        status,
        cards: cardsByStatus[status.id] ?? EMPTY_CARDS,
        comments,
        cardDisplaySettings,
        onMoveToBoard: onMoveToAnotherBoard,
        onNote,
        onRefresh,
        onRemove,
        onCommentChange: handleCommentChange,
        onCommentColorChange: handleCommentColorChange,
        onCommentDelete: handleCommentDelete,
        onEditStatus,
        onDeleteStatus,
        onAddCard,
        gridStyle: {
          gridRow: status.gridRow + 1, // CSS grid is 1-indexed
          gridColumn: status.gridCol + 1,
        },
      }
      // No drag ids until mount: they would not match the browser
      return isMounted ? (
        <SortableColumn key={status.id} {...columnProps} />
      ) : (
        <RestingColumn key={status.id} {...columnProps} />
      )
    })

    // The server and the first client render stop here. The columns' drag
    // ids would not match. The context below is named kanban-board, so its
    // description does not follow dnd-kit's counter.
    if (!isMounted) {
      return (
        <LazyMotion features={domAnimation}>
          <div className="relative w-fit min-w-full p-6">
            <div
              className="grid w-fit min-w-full gap-4 pb-4"
              suppressHydrationWarning
              style={{
                gridTemplateColumns:
                  'repeat(1, minmax(280px, var(--column-width)))',
                gridTemplateRows: 'repeat(1, auto)',
              }}
            >
              {columns}
            </div>
          </div>
        </LazyMotion>
      )
    }

    return (
      <LazyMotion features={domAnimation}>
        <div className="relative w-fit min-w-full p-6">
          <DndContext
            id="kanban-board"
            sensors={sensors}
            collisionDetection={forgivingCollisionDetection}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToWindowEdges]}
          >
            <KanbanDragChrome
              columnIds={columnIds}
              statuses={sortedStatuses}
              gridDimensions={gridDimensions}
              cardsByStatus={cardsByStatus}
              emptyCards={EMPTY_CARDS}
              cards={cards}
            >
              {columns}
            </KanbanDragChrome>
          </DndContext>
        </div>
      </LazyMotion>
    )
  },
)
KanbanBoard.displayName = 'KanbanBoard'
