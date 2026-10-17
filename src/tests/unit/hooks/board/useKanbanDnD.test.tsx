/**
 * Unit Tests: useKanbanDnD Hook
 *
 * The board no longer asks this hook what is being dragged. dnd-kit keeps
 * that, and a child of the context reads it. A drop on nothing still saves
 * nothing.
 *
 * @see src/hooks/board/useKanbanDnD.ts
 * @see src/components/Board/kanban-drag-subject.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { DragEndEvent } from '@dnd-kit/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { COLUMN_DRAG_TYPE } from '@/components/Board/SortableColumn'
import { useKanbanDnD } from '@/hooks/board/useKanbanDnD'
import { swapStatusListPositions } from '@/lib/actions/board'
import type { RepoCardForRedux, StatusListDomain } from '@/lib/models/domain'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

vi.mock('@/lib/actions/board', () => ({
  updateRepoCardPosition: vi.fn(async () => undefined),
  batchUpdateRepoCardOrders: vi.fn(async () => undefined),
  swapStatusListPositions: vi.fn(async () => undefined),
  batchUpdateStatusListPositions: vi.fn(async () => undefined),
  updateStatusListPosition: vi.fn(async () => undefined),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

/** A column of board-1 in the first grid row. */
function makeColumn(id: string, gridCol: number): StatusListDomain {
  return {
    id: toStatusListId(id),
    title: `Column ${id}`,
    color: '#6B7280',
    gridRow: 0,
    gridCol,
    boardId: toBoardId('board-1'),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** Two columns side by side: the grid has one free place, to their right. */
const TWO_COLUMNS = [makeColumn('status-1', 0), makeColumn('status-2', 1)]

/** What dnd-kit hands to onDragEnd when that column is dropped on nothing. */
const COLUMN_DROP_ON_NOTHING: DragEndEvent = {
  activatorEvent: new Event('mousedown'),
  active: {
    id: 'status-1',
    data: { current: { type: COLUMN_DRAG_TYPE } },
    rect: { current: { initial: null, translated: null } },
  },
  collisions: null,
  delta: { x: 0, y: 0 },
  over: null,
}

/**
 * Renders the hook for a board of two columns and no cards.
 * @returns The rendered hook.
 */
function renderBoardDrag() {
  return renderHook(() =>
    useKanbanDnD({
      statuses: TWO_COLUMNS,
      cards: [],
      cardsByStatus: {},
      EMPTY_CARDS: [],
      dispatch: vi.fn(),
      pushCardHistory: vi.fn(),
      pushColumnHistory: vi.fn(),
      rollbackRepoCards: vi.fn(),
      rollbackStatusLists: vi.fn(),
    }),
  )
}

describe('useKanbanDnD, what the board remembers of a drag', () => {
  // Value: protects=the hook does not keep a copy of the dragged item; fails_when=activeId or activeDragType comes back, so a drag that ends without onDragEnd can leave the zones up; why_new=the copy was the bug; seam=the hook source; no_claim=that the board reads useDndContext, see KanbanDragChrome
  test('does not store what is being dragged', () => {
    // Arrange
    const source = readFileSync(
      join(process.cwd(), 'src/hooks/board/useKanbanDnD.ts'),
      'utf8',
    )

    // Assert
    expect(source).not.toContain('activeId')
    expect(source).not.toContain('activeDragType')
    expect(source).not.toContain('handleDragStart')
    expect(source).not.toContain('handleDragCancel')
  })

  // Value: protects=a column dropped outside every place saves nothing; fails_when=the end handler treats "no target" as a move; why_new=the copy-clearing asserts were removed with the copy; seam=the hook alone, with the event dnd-kit hands it; no_claim=a drop on a place, which saves and is tested in column-dnd.spec.ts
  test('saves nothing when the column is dropped on nothing', async () => {
    // Arrange
    const { result } = renderBoardDrag()

    // Act
    await act(async () => result.current.handleDragEnd(COLUMN_DROP_ON_NOTHING))

    // Assert
    expect(swapStatusListPositions).not.toHaveBeenCalled()
  })
})

/** A card of board-1 in the first column. */
function makeCard(id: string, order: number): RepoCardForRedux {
  return {
    id: toRepoCardId(id),
    title: `laststance/${id}`,
    statusId: toStatusListId('status-1'),
    boardId: toBoardId('board-1'),
    repoOwner: 'laststance',
    repoName: id,
    order,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** What dnd-kit hands to onDragEnd when one card is dropped on another. */
function cardDrop(activeId: string, overId: string): DragEndEvent {
  const item = (id: string) => ({
    id,
    data: { current: { type: 'card' } },
    rect: { current: { initial: null, translated: null } },
  })
  return {
    activatorEvent: new Event('mousedown'),
    active: item(activeId),
    collisions: null,
    delta: { x: 0, y: 0 },
    over: {
      ...item(overId),
      rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
      disabled: false,
    },
  }
}

describe('useKanbanDnD, a card dropped where it already was', () => {
  // Value: protects=dropping a card on itself does not take the place of an
  //   earlier drag in the undo history;
  //   fails_when=the hook remembers the board before a drag that changed nothing;
  //   why_new=the history was saved before the hook knew the card had not moved;
  //   seam=none
  test('does not remember a card dropped on itself', async () => {
    // Arrange
    const pushCardHistory = vi.fn()
    const cards = [makeCard('card-1', 0), makeCard('card-2', 1)]
    const { result } = renderHook(() =>
      useKanbanDnD({
        statuses: TWO_COLUMNS,
        cards,
        cardsByStatus: { 'status-1': cards },
        EMPTY_CARDS: [],
        dispatch: vi.fn(),
        pushCardHistory,
        pushColumnHistory: vi.fn(),
        rollbackRepoCards: vi.fn(),
        rollbackStatusLists: vi.fn(),
      }),
    )

    // Act
    await act(async () =>
      result.current.handleDragEnd(cardDrop('card-1', 'card-1')),
    )

    // Assert
    expect(pushCardHistory).not.toHaveBeenCalled()
  })

  // Value: protects=a card dropped on the one below it is remembered, so Z can
  //   put it back;
  //   fails_when=the hook stops remembering every card drag;
  //   why_new=the no-op drop and a real reorder share one handler;
  //   seam=none
  test('remembers a card dropped on the card below it', async () => {
    // Arrange
    const pushCardHistory = vi.fn()
    const cards = [makeCard('card-1', 0), makeCard('card-2', 1)]
    const { result } = renderHook(() =>
      useKanbanDnD({
        statuses: TWO_COLUMNS,
        cards,
        cardsByStatus: { 'status-1': cards },
        EMPTY_CARDS: [],
        dispatch: vi.fn(),
        pushCardHistory,
        pushColumnHistory: vi.fn(),
        rollbackRepoCards: vi.fn(),
        rollbackStatusLists: vi.fn(),
      }),
    )

    // Act
    await act(async () =>
      result.current.handleDragEnd(cardDrop('card-1', 'card-2')),
    )

    // Assert
    expect(pushCardHistory).toHaveBeenCalledWith(cards)
  })
})
