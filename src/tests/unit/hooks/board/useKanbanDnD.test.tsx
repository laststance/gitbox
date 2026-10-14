/**
 * Unit Tests: useKanbanDnD Hook, what the board remembers of a drag
 *
 * The board draws the drop zones of a column drag from what this hook
 * remembers: handleDragStart sets it, and each way a drag can finish has to
 * clear it. dnd-kit reports a cancelled drag (Escape, a window that is resized
 * or hidden, a touch the browser takes over) to onDragCancel and not to
 * onDragEnd. While the hook had no handler for it, the zones stayed on the
 * board until the next drag ended.
 *
 * @see src/hooks/board/useKanbanDnD.ts
 * @see e2e/logged-in/kanban-dnd/column-dnd.spec.ts for the board in a browser
 */

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { COLUMN_DRAG_TYPE } from '@/components/Board/SortableColumn'
import { useKanbanDnD } from '@/hooks/board/useKanbanDnD'
import type { StatusListDomain } from '@/lib/models/domain'
import { toBoardId, toStatusListId } from '@/lib/types/brands'

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

/** What dnd-kit hands to onDragStart when the first column is picked up. */
const COLUMN_DRAG_START: DragStartEvent = {
  activatorEvent: new Event('mousedown'),
  active: {
    id: 'status-1',
    data: { current: { type: COLUMN_DRAG_TYPE } },
    rect: { current: { initial: null, translated: null } },
  },
}

/** What dnd-kit hands to onDragEnd when that column is dropped on nothing. */
const COLUMN_DROP_ON_NOTHING: DragEndEvent = {
  ...COLUMN_DRAG_START,
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
  // Value: protects=a column drag shows where the column can go; fails_when=the hook forgets what is dragged, or offers no place; why_new=the hook had no unit test, and the two tests below need this state to be there first; seam=the hook alone, with the event dnd-kit hands it; no_claim=that the board draws the zones, see column-dnd.spec.ts
  test('remembers the column that is picked up and offers its own place and the free one', () => {
    // Arrange
    const { result } = renderBoardDrag()

    // Act
    act(() => result.current.handleDragStart(COLUMN_DRAG_START))

    // Assert
    expect(result.current.activeDragType).toBe('column')
    expect(result.current.activeId).toBe('status-1')
    expect(result.current.insertionZones).toEqual([
      { gridRow: 0, gridCol: 0 },
      { gridRow: 0, gridCol: 2 },
    ])
  })

  // Value: protects=Escape during a column drag takes the drop zones off the board; fails_when=a cancelled drag leaves what handleDragStart set, as it did while the hook had no handler for it; why_new=the handler is new; seam=the hook alone, with the events dnd-kit hands it; no_claim=that the board passes the handler to dnd-kit, see column-dnd.spec.ts
  test('forgets the column and its drop zones when the drag is cancelled', () => {
    // Arrange
    const { result } = renderBoardDrag()
    act(() => result.current.handleDragStart(COLUMN_DRAG_START))

    // Act
    act(() => result.current.handleDragCancel())

    // Assert
    expect(result.current.activeDragType).toBeNull()
    expect(result.current.activeId).toBeNull()
    expect(result.current.insertionZones).toEqual([])
  })

  // Value: protects=a column dropped outside every place leaves no drop zones behind; fails_when=handleDragEnd returns before it clears what handleDragStart set; why_new=the hook had no unit test, and the cancelled drag is told from the finished one here; seam=the hook alone, with the event dnd-kit hands it; no_claim=a drop on a place, which saves and is tested in column-dnd.spec.ts
  test('forgets the column and its drop zones when the column is dropped on nothing', async () => {
    // Arrange
    const { result } = renderBoardDrag()
    act(() => result.current.handleDragStart(COLUMN_DRAG_START))

    // Act
    await act(async () => result.current.handleDragEnd(COLUMN_DROP_ON_NOTHING))

    // Assert
    expect(result.current.activeDragType).toBeNull()
    expect(result.current.activeId).toBeNull()
    expect(result.current.insertionZones).toEqual([])
  })
})
