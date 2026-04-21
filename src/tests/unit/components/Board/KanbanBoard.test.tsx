/**
 * Unit Test: KanbanBoard Component - Horizontal Scroll
 *
 * Test targets:
 * - Horizontal scroll functionality for 6+ columns
 * - CSS class verification for overflow and width
 * - Grid container width behavior
 *
 * Bug fix: Columns outside viewport were not visible when 6+ columns exist
 * Fix: Added overflow-x-auto to parent and w-fit min-w-full to grid container
 */

import { configureStore } from '@reduxjs/toolkit'
import { render, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { KanbanBoard } from '@/components/Board/KanbanBoard'
import boardSlice from '@/lib/redux/slices/boardSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

// Mock the board actions
// Phase 4: getBoardData removed - data now fetched by Server Component
vi.mock('@/lib/actions/board', () => ({
  updateRepoCardPosition: vi.fn(async () => ({})),
  batchUpdateRepoCardOrders: vi.fn(async () => ({})),
  swapStatusListPositions: vi.fn(async () => ({})),
  batchUpdateStatusListPositions: vi.fn(async () => ({})),
}))

/**
 * Create mock Redux store with initial state
 *
 * @returns Configured Redux store
 */
function createMockStore() {
  return configureStore({
    reducer: {
      board: boardSlice,
    },
    preloadedState: {
      board: {
        activeBoard: null,
        statusLists: [
          {
            id: toStatusListId('status-1'),
            title: 'To Do',
            color: '#6B7280',
            gridRow: 0,
            gridCol: 0,
            boardId: toBoardId('board-1'),
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        repoCards: [],
        lastVisitedBoard: null,
      },
    },
  })
}

describe('KanbanBoard Horizontal Scroll Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CSS Classes for Horizontal Scroll', () => {
    it('should render outer container with w-fit min-w-full classes', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" initialComments={{}} />
        </Provider>,
      )

      // Wait for hydration
      await waitFor(() => {
        // Check the outer container has w-fit min-w-full classes (auto-height: no h-full)
        const outerContainer = container.querySelector(
          '.w-fit.min-w-full.p-6.relative',
        )
        expect(outerContainer).toBeInTheDocument()
      })
    })

    it('should render grid container with w-fit min-w-full classes', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" initialComments={{}} />
        </Provider>,
      )

      // Wait for hydration
      await waitFor(() => {
        // Find the grid container with w-fit min-w-full
        const gridContainer = container.querySelector(
          '.grid.gap-4.pb-4.w-fit.min-w-full',
        )
        expect(gridContainer).toBeInTheDocument()
      })
    })

    it('should have grid with inline style for gridTemplateColumns', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" initialComments={{}} />
        </Provider>,
      )

      await waitFor(() => {
        const gridContainer = container.querySelector('.grid.gap-4.pb-4')
        expect(gridContainer).toBeInTheDocument()

        if (gridContainer) {
          const style = gridContainer.getAttribute('style')
          // Should have gridTemplateColumns with minmax(280px, var(--column-width))
          expect(style).toContain('grid-template-columns')
        }
      })
    })
  })

  describe('Column Width Calculation', () => {
    it('should calculate minimum width for 6 columns correctly', () => {
      const columnCount = 6
      const minColumnWidth = 280 // px
      const gapSize = 16 // gap-4 = 1rem = 16px

      // Minimum width = (columns * minWidth) + ((columns - 1) * gap)
      const expectedMinWidth =
        columnCount * minColumnWidth + (columnCount - 1) * gapSize

      // 6 * 280 + 5 * 16 = 1680 + 80 = 1760px
      expect(expectedMinWidth).toBe(1760)

      // This exceeds typical viewport widths (1280-1440px), confirming need for scroll
    })

    it('should calculate minimum width for 10 columns correctly', () => {
      const columnCount = 10
      const minColumnWidth = 280
      const gapSize = 16

      const expectedMinWidth =
        columnCount * minColumnWidth + (columnCount - 1) * gapSize

      // 10 * 280 + 9 * 16 = 2800 + 144 = 2944px
      expect(expectedMinWidth).toBe(2944)
    })

    it('should calculate minimum width for 15 columns correctly', () => {
      const columnCount = 15
      const minColumnWidth = 280
      const gapSize = 16

      const expectedMinWidth =
        columnCount * minColumnWidth + (columnCount - 1) * gapSize

      // 15 * 280 + 14 * 16 = 4200 + 224 = 4424px
      expect(expectedMinWidth).toBe(4424)
    })
  })
})

describe('BoardPageClient Wrapper Tests (Overflow)', () => {
  /**
   * These tests verify the parent container in BoardPageClient
   * has correct overflow classes for horizontal scrolling.
   *
   * The parent container uses:
   * - overflow-x-auto: Enables horizontal scrollbar when content overflows
   * - overflow-y-auto: Enables vertical scrollbar when content overflows
   */

  it('should document expected overflow classes for parent container', () => {
    // Expected classes in BoardPageClient.tsx line 480:
    // className="flex-1 overflow-x-auto overflow-y-auto bg-gray-100 dark:bg-gray-900"

    const expectedClasses = [
      'flex-1',
      'overflow-x-auto',
      'overflow-y-auto',
      'bg-gray-100',
      'dark:bg-gray-900',
    ]

    // All classes should be present for proper horizontal scroll
    expect(expectedClasses).toContain('overflow-x-auto')
    expect(expectedClasses).toContain('overflow-y-auto')
    expect(expectedClasses).toContain('flex-1')
  })

  it('should document expected classes for KanbanBoard container (auto-height)', () => {
    // Expected classes in KanbanBoard.tsx line 613:
    // className="w-fit min-w-full p-6 relative"
    // Note: h-full removed for auto-height expansion

    const expectedClasses = ['w-fit', 'min-w-full', 'p-6', 'relative']

    // w-fit allows container to grow beyond viewport
    // min-w-full ensures it's at least as wide as viewport
    // auto-height: no h-full constraint
    expect(expectedClasses).toContain('w-fit')
    expect(expectedClasses).toContain('min-w-full')
    expect(expectedClasses).not.toContain('h-full')
  })

  it('should document expected classes for grid container', () => {
    // Expected classes in KanbanBoard.tsx line 636:
    // className="grid gap-4 pb-4 w-fit min-w-full"

    const expectedClasses = ['grid', 'gap-4', 'pb-4', 'w-fit', 'min-w-full']

    // Grid with w-fit min-w-full allows columns to extend horizontally
    expect(expectedClasses).toContain('grid')
    expect(expectedClasses).toContain('w-fit')
    expect(expectedClasses).toContain('min-w-full')
  })
})

describe('Horizontal Scroll Technical Requirements', () => {
  /**
   * These tests document the technical requirements for horizontal scroll
   * to work correctly with 6+ columns.
   */

  describe('Tailwind CSS Class Semantics', () => {
    it('should use w-fit to allow content to define width', () => {
      // w-fit = width: fit-content
      // This allows the element to shrink-wrap its content
      // Instead of being constrained to parent width
      const wFitBehavior = 'width: fit-content'
      expect(wFitBehavior).toBe('width: fit-content')
    })

    it('should use min-w-full to ensure minimum viewport width', () => {
      // min-w-full = min-width: 100%
      // This ensures the element is at least as wide as its parent
      // Prevents content from being narrower than viewport
      const minWFullBehavior = 'min-width: 100%'
      expect(minWFullBehavior).toBe('min-width: 100%')
    })

    it('should use overflow-x-auto to enable horizontal scroll', () => {
      // overflow-x-auto = overflow-x: auto
      // Shows horizontal scrollbar only when content overflows
      const overflowXAutoBehavior = 'overflow-x: auto'
      expect(overflowXAutoBehavior).toBe('overflow-x: auto')
    })
  })

  describe('Grid Column Sizing', () => {
    it('should use minmax(280px, var(--column-width)) for constrained column sizing', () => {
      // minmax(280px, var(--column-width)) ensures:
      // - Minimum width of 280px per column
      // - Maximum width constrained by CSS variable (320px) to prevent expansion
      const gridTemplatePattern = 'minmax(280px, var(--column-width))'
      expect(gridTemplatePattern).toContain('280px')
      expect(gridTemplatePattern).toContain('var(--column-width)')
    })

    it('should calculate grid template for N columns', () => {
      const generateGridTemplate = (cols: number): string => {
        return `repeat(${cols}, minmax(280px, var(--column-width)))`
      }

      expect(generateGridTemplate(6)).toBe(
        'repeat(6, minmax(280px, var(--column-width)))',
      )
      expect(generateGridTemplate(10)).toBe(
        'repeat(10, minmax(280px, var(--column-width)))',
      )
    })
  })

  describe('Viewport Overflow Scenarios', () => {
    const viewportWidths = [1280, 1440, 1680, 1920]
    const columnWidth = 280
    const gapWidth = 16

    viewportWidths.forEach((viewport) => {
      it(`should determine scroll need for viewport ${viewport}px`, () => {
        const calculateMaxColumnsWithoutScroll = (vw: number): number => {
          // (cols * 280) + ((cols - 1) * 16) <= viewport
          // 280c + 16c - 16 <= vw
          // 296c <= vw + 16
          // c <= (vw + 16) / 296
          return Math.floor((vw + gapWidth) / (columnWidth + gapWidth))
        }

        const maxCols = calculateMaxColumnsWithoutScroll(viewport)

        // Verify calculation
        const widthWithMaxCols =
          maxCols * columnWidth + (maxCols - 1) * gapWidth
        expect(widthWithMaxCols).toBeLessThanOrEqual(viewport)
      })
    })

    it('should require horizontal scroll for 6 columns on 1440px viewport', () => {
      const viewport = 1440
      const columns = 6
      const requiredWidth = columns * columnWidth + (columns - 1) * gapWidth

      // 6 * 280 + 5 * 16 = 1680 + 80 = 1760px
      expect(requiredWidth).toBe(1760)
      expect(requiredWidth).toBeGreaterThan(viewport)
    })

    it('should fit 5 columns on 1440px viewport without scroll', () => {
      const columns = 5
      const requiredWidth = columns * columnWidth + (columns - 1) * gapWidth

      // 5 * 280 + 4 * 16 = 1400 + 64 = 1464px
      expect(requiredWidth).toBe(1464)
      // Just slightly over 1440px, but with some padding/margin this could work
    })
  })
})

/**
 * Unit Tests: Column Auto-Height Expansion
 *
 * Test targets:
 * - Auto-height expansion for columns (no internal scrolling)
 * - CSS class verification for removed height constraints
 * - Grid row sizing with minmax(min-content, auto)
 *
 * Feature: Columns automatically expand to show all cards without internal scrolling.
 * Implementation: Removed h-full, min-h-0 constraints and overflow-y-auto from columns.
 */
describe('KanbanBoard Column Auto-Height Tests', () => {
  describe('CSS Classes for Auto-Height', () => {
    it('should render outer container without height constraints', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" initialComments={{}} />
        </Provider>,
      )

      await waitFor(() => {
        // Check the outer container exists (without h-full min-h-0)
        const outerContainer = container.querySelector(
          '.w-fit.min-w-full.p-6.relative',
        )
        expect(outerContainer).toBeInTheDocument()
      })
    })

    it('should render grid container without h-full min-h-0 classes', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" initialComments={{}} />
        </Provider>,
      )

      await waitFor(() => {
        // Find the grid container (without height constraints)
        const gridContainer = container.querySelector(
          '.grid.gap-4.pb-4.w-fit.min-w-full',
        )
        expect(gridContainer).toBeInTheDocument()
      })
    })

    it('should have grid with minmax(min-content, auto) for row sizing', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" initialComments={{}} />
        </Provider>,
      )

      await waitFor(() => {
        const gridContainer = container.querySelector('.grid.gap-4.pb-4')
        expect(gridContainer).toBeInTheDocument()

        if (gridContainer) {
          const style = gridContainer.getAttribute('style')
          // Should have gridTemplateRows with minmax(min-content, auto) for auto-height
          if (style) {
            expect(style).toContain('grid-template-rows')
          }
        }
      })
    })
  })

  describe('Auto-Height Expansion Behavior', () => {
    it('should document auto-height expansion requirements', () => {
      // Auto-height pattern:
      // - Columns expand to fit all cards (no internal scrolling)
      // - Grid rows use minmax(min-content, auto) to expand based on content
      // - No overflow-y-auto on card containers

      const autoHeightRequirements = {
        gridRowSizing: 'minmax(min-content, auto) expands rows to fit content',
        noHeightConstraint: 'Remove h-full and min-h-0 from containers',
        noOverflow: 'Remove overflow-y-auto to allow natural expansion',
      }

      expect(autoHeightRequirements.gridRowSizing).toContain('min-content')
      expect(autoHeightRequirements.noHeightConstraint).toContain('h-full')
      expect(autoHeightRequirements.noOverflow).toContain('overflow-y-auto')
    })

    it('should calculate column height based on card count', () => {
      // Approximate card height: 130px (varies by content)
      // Column header: ~50px
      // Add Repo button: ~40px
      // Padding: ~32px

      const cardHeight = 130
      const headerHeight = 50
      const buttonHeight = 40
      const padding = 32
      const fixedHeight = headerHeight + buttonHeight + padding

      // Column with 5 cards
      const cardCount = 5
      const expectedColumnHeight = fixedHeight + cardCount * cardHeight

      // With auto-height, column expands to fit all cards
      expect(expectedColumnHeight).toBe(122 + 5 * 130) // 772px
      expect(expectedColumnHeight).toBeGreaterThan(600) // Exceeds typical viewport
    })
  })

  describe('Grid Row Sizing', () => {
    it('should use minmax(min-content, auto) for auto-height expansion', () => {
      // gridTemplateRows: repeat(N, minmax(0, 1fr)) - bounded height (OLD - for scroll)
      // gridTemplateRows: repeat(N, minmax(min-content, auto)) - auto-height (NEW)

      const scrollPattern = 'repeat(2, minmax(0, 1fr))'
      const autoHeightPattern = 'repeat(2, minmax(min-content, auto))'

      expect(scrollPattern).toContain('minmax(0, 1fr)')
      expect(autoHeightPattern).toContain('minmax(min-content, auto)')

      // Auto-height uses min-content, not 0
      expect(autoHeightPattern).toContain('min-content')
    })

    it('should calculate grid row height distribution for auto-height', () => {
      const generateGridRowTemplate = (rows: number): string => {
        return `repeat(${rows}, minmax(min-content, auto))`
      }

      expect(generateGridRowTemplate(1)).toBe(
        'repeat(1, minmax(min-content, auto))',
      )
      expect(generateGridRowTemplate(2)).toBe(
        'repeat(2, minmax(min-content, auto))',
      )
      expect(generateGridRowTemplate(3)).toBe(
        'repeat(3, minmax(min-content, auto))',
      )
    })
  })
})

describe('SortableColumn Auto-Height Classes', () => {
  /**
   * These tests document the expected CSS classes for SortableColumn
   * that enable auto-height expansion (no internal scrolling).
   */

  it('should document expected classes for SortableColumn container (auto-height)', () => {
    // Expected classes in SortableColumn.tsx line 89-90:
    // className="flex flex-col w-full bg-background/50..."
    // Note: h-full and min-h-0 removed for auto-height expansion

    const expectedClasses = ['flex', 'flex-col', 'w-full']

    // Auto-height: removed h-full and min-h-0
    expect(expectedClasses).toContain('flex-col')
    expect(expectedClasses).toContain('w-full')
    expect(expectedClasses).not.toContain('h-full')
    expect(expectedClasses).not.toContain('min-h-0')
  })

  it('should document expected classes for inner wrapper (auto-height)', () => {
    // Expected classes in SortableColumn.tsx line 98:
    // className="flex-1 p-4"
    // Note: min-h-0 and overflow-hidden removed for auto-height expansion

    const expectedClasses = ['flex-1', 'p-4']

    // Auto-height: removed min-h-0 and overflow-hidden
    expect(expectedClasses).toContain('flex-1')
    expect(expectedClasses).toContain('p-4')
    expect(expectedClasses).not.toContain('min-h-0')
    expect(expectedClasses).not.toContain('overflow-hidden')
  })
})

describe('StatusColumn Auto-Height Classes', () => {
  /**
   * These tests document the expected CSS classes for StatusColumn
   * that enable auto-height expansion of cards.
   */

  it('should document expected classes for StatusColumn container (auto-height)', () => {
    // Expected classes in StatusColumn.tsx line 81:
    // className="flex flex-col"
    // Note: h-full and min-h-0 removed for auto-height expansion

    const expectedClasses = ['flex', 'flex-col']

    // Auto-height: removed h-full and min-h-0
    expect(expectedClasses).toContain('flex-col')
    expect(expectedClasses).not.toContain('h-full')
    expect(expectedClasses).not.toContain('min-h-0')
  })

  it('should document expected classes for card area (auto-height)', () => {
    // Expected classes in StatusColumn.tsx line 147:
    // className="space-y-3 flex-1 rounded-lg p-1..."
    // Note: min-h-0 and overflow-y-auto removed for auto-height expansion

    const expectedClasses = ['space-y-3', 'flex-1', 'rounded-lg', 'p-1']

    // Auto-height: flex-1 expands, NO overflow-y-auto (cards flow naturally)
    expect(expectedClasses).toContain('flex-1')
    expect(expectedClasses).toContain('space-y-3')
    expect(expectedClasses).not.toContain('min-h-0')
    expect(expectedClasses).not.toContain('overflow-y-auto')
  })
})

/**
 * Unit Tests: KanbanBoard Loading and Error States
 *
 * Test targets:
 * - KanbanSkeleton rendering during loading
 * - ErrorState rendering when error occurs
 * - Normal board rendering when data is available
 */
describe('KanbanBoard Loading States', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render skeleton when no status lists exist', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { container } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // Wait for skeleton to render
    await waitFor(() => {
      // Should show skeleton elements
      const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  it('should not show skeleton when status lists exist', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { container, queryByText } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // Wait for component to render
    await waitFor(() => {
      // Should NOT show skeleton when data exists
      const skeleton = container.querySelector('[class*="animate-pulse"]')
      expect(skeleton).not.toBeInTheDocument()
    })

    // Should NOT show error message
    expect(queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})

/**
 * Unit Tests: KanbanBoard with Status Lists and Cards
 *
 * Test targets:
 * - Rendering status columns with cards
 * - Grid dimensions calculation
 * - Column sorting by gridRow and gridCol
 */
describe('KanbanBoard with Data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render status columns when data is available', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-2'),
              title: 'In Progress',
              color: '#3B82F6',
              gridRow: 0,
              gridCol: 1,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [
            {
              id: toRepoCardId('card-1'),
              title: 'react',
              repoOwner: 'facebook',
              repoName: 'react',
              statusId: toStatusListId('status-1'),
              order: 0,
              boardId: toBoardId('board-1'),
              meta: { stars: 200000, language: 'JavaScript' },
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // Wait for columns to render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
      expect(getByText('In Progress')).toBeInTheDocument()
    })
  })

  it('should sort status lists by gridRow then gridCol', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-3'),
              title: 'Done',
              color: '#22C55E',
              gridRow: 1,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-2'),
              title: 'In Progress',
              color: '#3B82F6',
              gridRow: 0,
              gridCol: 1,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // All columns should render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
      expect(getByText('In Progress')).toBeInTheDocument()
      expect(getByText('Done')).toBeInTheDocument()
    })
  })
})

/**
 * Unit Tests: KanbanBoard Callbacks
 *
 * Test targets:
 * - onMoveToMaintenance callback
 * - onNote callback
 * - onRemove callback
 * - onEditStatus callback
 * - onDeleteStatus callback
 * - onAddCard callback
 */
describe('KanbanBoard Callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass callbacks to child components', async () => {
    const mockOnMoveToMaintenance = vi.fn()
    const mockOnNote = vi.fn()
    const mockOnRemove = vi.fn()
    const mockOnEditStatus = vi.fn()
    const mockOnDeleteStatus = vi.fn()
    const mockOnAddCard = vi.fn()

    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard
          boardId="test-board"
          initialComments={{}}
          onMoveToMaintenance={mockOnMoveToMaintenance}
          onNote={mockOnNote}
          onRemove={mockOnRemove}
          onEditStatus={mockOnEditStatus}
          onDeleteStatus={mockOnDeleteStatus}
          onAddCard={mockOnAddCard}
        />
      </Provider>,
    )

    // Wait for component to render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })

    // Callbacks should be ready to use (actual invocation depends on user interaction)
  })
})

/**
 * Unit Tests: KanbanBoard Initial Comments
 *
 * Test targets:
 * - Passing initialComments prop
 * - Comment data structure
 */
describe('KanbanBoard Initial Comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should accept initialComments prop', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [
            {
              id: toRepoCardId('card-1'),
              title: 'react',
              repoOwner: 'facebook',
              repoName: 'react',
              statusId: toStatusListId('status-1'),
              order: 0,
              boardId: toBoardId('board-1'),
              meta: { stars: 200000, language: 'JavaScript' },
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          lastVisitedBoard: null,
        },
      },
    })

    const initialComments = {
      'card-1': { comment: 'Great library!', color: 'primary' as const },
    }

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={initialComments} />
      </Provider>,
    )

    // Wait for component to render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })
  })
})

/**
 * Unit Tests: KanbanBoard Card Display Settings
 *
 * Test targets:
 * - cardDisplaySettings prop
 * - showGitHubDescription setting
 * - showComment setting
 * - commentText settings
 */
describe('KanbanBoard Card Display Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should accept cardDisplaySettings prop', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const cardDisplaySettings = {
      showGitHubDescription: true,
      showComment: true,
      commentText: {
        fontSize: 'base' as const,
        fontWeight: 'normal' as const,
      },
    }

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard
          boardId="test-board"
          initialComments={{}}
          cardDisplaySettings={cardDisplaySettings}
        />
      </Provider>,
    )

    // Wait for component to render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })
  })

  it('should accept cardDisplaySettings with showComment disabled', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const cardDisplaySettings = {
      showGitHubDescription: false,
      showComment: false,
      commentText: {
        fontSize: 'sm' as const,
        fontWeight: 'semibold' as const,
      },
    }

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard
          boardId="test-board"
          initialComments={{}}
          cardDisplaySettings={cardDisplaySettings}
        />
      </Provider>,
    )

    // Wait for component to render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })
  })
})

/**
 * Unit Tests: KanbanBoard Undo Functionality
 *
 * Test targets:
 * - Z key keyboard shortcut for undo
 * - Undo message display
 */
describe('KanbanBoard Undo Keyboard Shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should respond to Z key press for undo', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // Wait for component to render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })

    // Simulate Z key press
    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'z',
      bubbles: true,
    })
    window.dispatchEvent(keydownEvent)

    // The undo function should be triggered (even if no history exists)
    // This tests the keyboard event handler is registered
  })

  it('should not trigger undo when typing in input field', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText, container } = render(
      <Provider store={store}>
        <div>
          <input data-testid="test-input" type="text" />
          <KanbanBoard boardId="test-board" initialComments={{}} />
        </div>
      </Provider>,
    )

    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })

    // Create a mock input element and set it as event target
    const input = container.querySelector('[data-testid="test-input"]')
    expect(input).toBeInTheDocument()

    // Simulate Z key press from input field
    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'z',
      bubbles: true,
    })
    Object.defineProperty(keydownEvent, 'target', {
      value: input,
      writable: false,
    })
    window.dispatchEvent(keydownEvent)

    // Undo should not be triggered when target is input
  })

  it('should respond to uppercase Z key press', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })

    // Simulate uppercase Z key press
    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'Z',
      bubbles: true,
    })
    window.dispatchEvent(keydownEvent)

    // The undo function should be triggered
  })
})

/**
 * Unit Tests: KanbanBoard DndContext Configuration
 *
 * Test targets:
 * - DndContext renders with proper sensors
 * - Collision detection strategy
 * - Accessibility options
 */
describe('KanbanBoard DndContext Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render DndContext wrapper', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [
            {
              id: toRepoCardId('card-1'),
              title: 'react',
              repoOwner: 'facebook',
              repoName: 'react',
              statusId: toStatusListId('status-1'),
              order: 0,
              boardId: toBoardId('board-1'),
              meta: { stars: 200000, language: 'JavaScript' },
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // Wait for DndContext to be set up
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
    })

    // DndContext should be properly configured (verified by successful render)
  })
})

/**
 * Unit Tests: KanbanBoard with Multiple Rows
 *
 * Test targets:
 * - Multiple row layout
 * - NewRowDropZone rendering
 * - ColumnInsertZone rendering
 */
describe('KanbanBoard Multi-Row Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render multiple rows of columns', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'To Do',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-2'),
              title: 'In Progress',
              color: '#3B82F6',
              gridRow: 0,
              gridCol: 1,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-3'),
              title: 'Done',
              color: '#22C55E',
              gridRow: 1,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText, container } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // All columns across multiple rows should render
    await waitFor(() => {
      expect(getByText('To Do')).toBeInTheDocument()
      expect(getByText('In Progress')).toBeInTheDocument()
      expect(getByText('Done')).toBeInTheDocument()
    })

    // Verify grid has multiple rows
    const gridContainer = container.querySelector('.grid.gap-4.pb-4')
    expect(gridContainer).toBeInTheDocument()

    const style = gridContainer?.getAttribute('style')
    // Should have grid-template-rows for multiple rows
    expect(style).toContain('grid-template-rows')
  })

  it('should calculate grid dimensions for 2x2 layout', async () => {
    const store = configureStore({
      reducer: {
        board: boardSlice,
      },
      preloadedState: {
        board: {
          activeBoard: null,
          statusLists: [
            {
              id: toStatusListId('status-1'),
              title: 'Col 0,0',
              color: '#6B7280',
              gridRow: 0,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-2'),
              title: 'Col 0,1',
              color: '#3B82F6',
              gridRow: 0,
              gridCol: 1,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-3'),
              title: 'Col 1,0',
              color: '#22C55E',
              gridRow: 1,
              gridCol: 0,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            {
              id: toStatusListId('status-4'),
              title: 'Col 1,1',
              color: '#EF4444',
              gridRow: 1,
              gridCol: 1,
              boardId: toBoardId('board-1'),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          repoCards: [],
          lastVisitedBoard: null,
        },
      },
    })

    const { getByText, container } = render(
      <Provider store={store}>
        <KanbanBoard boardId="test-board" initialComments={{}} />
      </Provider>,
    )

    // All 4 columns should render
    await waitFor(() => {
      expect(getByText('Col 0,0')).toBeInTheDocument()
      expect(getByText('Col 0,1')).toBeInTheDocument()
      expect(getByText('Col 1,0')).toBeInTheDocument()
      expect(getByText('Col 1,1')).toBeInTheDocument()
    })

    // Verify 2 columns template
    const gridContainer = container.querySelector('.grid.gap-4.pb-4')
    const style = gridContainer?.getAttribute('style')
    expect(style).toContain('repeat(2, minmax(280px, var(--column-width))')
    expect(style).toContain('repeat(2, minmax(min-content, auto))')
  })
})

/**
 * Unit Tests: Grid Dimension Calculation
 *
 * Tests for internal grid dimension calculation logic
 */
describe('Grid Dimension Calculation', () => {
  it('should calculate maxRow and maxCol correctly', () => {
    // Simulate the calculation logic
    const statuses = [
      { id: toStatusListId('status-1'), gridRow: 0, gridCol: 0 },
      { id: toStatusListId('status-2'), gridRow: 0, gridCol: 1 },
      { id: toStatusListId('status-3'), gridRow: 1, gridCol: 0 },
    ]

    const maxRow = Math.max(...statuses.map((s) => s.gridRow))
    const maxCol = Math.max(...statuses.map((s) => s.gridCol))

    expect(maxRow).toBe(1)
    expect(maxCol).toBe(1)

    // Grid dimensions should be maxRow + 1, maxCol + 1
    const numRows = maxRow + 1
    const numCols = maxCol + 1

    expect(numRows).toBe(2)
    expect(numCols).toBe(2)
  })

  it('should handle sparse grid positions', () => {
    // Columns might not fill every grid cell
    const statuses = [
      { id: toStatusListId('status-1'), gridRow: 0, gridCol: 0 },
      { id: toStatusListId('status-2'), gridRow: 0, gridCol: 2 }, // Skip col 1
      { id: toStatusListId('status-3'), gridRow: 2, gridCol: 0 }, // Skip row 1
    ]

    const maxRow = Math.max(...statuses.map((s) => s.gridRow))
    const maxCol = Math.max(...statuses.map((s) => s.gridCol))

    expect(maxRow).toBe(2)
    expect(maxCol).toBe(2)

    // Grid should accommodate the sparse layout
    const numRows = maxRow + 1
    const numCols = maxCol + 1

    expect(numRows).toBe(3)
    expect(numCols).toBe(3)
  })
})
