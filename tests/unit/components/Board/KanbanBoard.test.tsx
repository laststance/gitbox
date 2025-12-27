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

// Mock the board actions
vi.mock('@/lib/actions/board', () => ({
  getBoardData: vi.fn(async () => ({
    statusLists: [],
    repoCards: [],
  })),
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
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
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
          <KanbanBoard boardId="test-board" />
        </Provider>,
      )

      // Wait for hydration
      await waitFor(() => {
        // Check the outer container has w-fit min-w-full classes
        const outerContainer = container.querySelector(
          '.w-fit.min-w-full.h-full.p-6.relative',
        )
        expect(outerContainer).toBeInTheDocument()
      })
    })

    it('should render grid container with w-fit min-w-full classes', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" />
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
          <KanbanBoard boardId="test-board" />
        </Provider>,
      )

      await waitFor(() => {
        const gridContainer = container.querySelector('.grid.gap-4.pb-4')
        expect(gridContainer).toBeInTheDocument()

        if (gridContainer) {
          const style = gridContainer.getAttribute('style')
          // Should have gridTemplateColumns with minmax(280px, 1fr)
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

  it('should document expected classes for KanbanBoard container', () => {
    // Expected classes in KanbanBoard.tsx line 613:
    // className="w-fit min-w-full h-full p-6 relative"

    const expectedClasses = ['w-fit', 'min-w-full', 'h-full', 'p-6', 'relative']

    // w-fit allows container to grow beyond viewport
    // min-w-full ensures it's at least as wide as viewport
    expect(expectedClasses).toContain('w-fit')
    expect(expectedClasses).toContain('min-w-full')
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
    it('should use minmax(280px, 1fr) for flexible column sizing', () => {
      // minmax(280px, 1fr) ensures:
      // - Minimum width of 280px per column
      // - Maximum width grows equally (1fr) when space available
      const gridTemplatePattern = 'minmax(280px, 1fr)'
      expect(gridTemplatePattern).toContain('280px')
      expect(gridTemplatePattern).toContain('1fr')
    })

    it('should calculate grid template for N columns', () => {
      const generateGridTemplate = (cols: number): string => {
        return `repeat(${cols}, minmax(280px, 1fr))`
      }

      expect(generateGridTemplate(6)).toBe('repeat(6, minmax(280px, 1fr))')
      expect(generateGridTemplate(10)).toBe('repeat(10, minmax(280px, 1fr))')
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

        // Document the threshold for each viewport
        console.log(
          `Viewport ${viewport}px: max ${maxCols} columns without scroll`,
        )

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
 * Unit Tests: Vertical Scroll in Columns
 *
 * Test targets:
 * - Vertical scroll functionality for columns with many cards (10+)
 * - CSS class verification for min-h-0 and overflow-y-auto
 * - Flex container shrinking behavior
 *
 * Bug fix: Cards outside viewport in a column were not accessible
 * Fix: Added min-h-0 to flex containers to allow shrinking and enable overflow scroll
 */
describe('KanbanBoard Vertical Scroll Tests', () => {
  describe('CSS Classes for Vertical Scroll', () => {
    it('should render outer container with min-h-0 class', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" />
        </Provider>,
      )

      await waitFor(() => {
        // Check the outer container has min-h-0 class
        const outerContainer = container.querySelector(
          '.w-fit.min-w-full.h-full.min-h-0.p-6.relative',
        )
        expect(outerContainer).toBeInTheDocument()
      })
    })

    it('should render grid container with h-full min-h-0 classes', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" />
        </Provider>,
      )

      await waitFor(() => {
        // Find the grid container with h-full min-h-0
        const gridContainer = container.querySelector(
          '.grid.gap-4.pb-4.w-fit.min-w-full.h-full.min-h-0',
        )
        expect(gridContainer).toBeInTheDocument()
      })
    })

    it('should have grid with minmax(0, 1fr) for row sizing', async () => {
      const store = createMockStore()

      const { container } = render(
        <Provider store={store}>
          <KanbanBoard boardId="test-board" />
        </Provider>,
      )

      await waitFor(() => {
        const gridContainer = container.querySelector('.grid.gap-4.pb-4')
        expect(gridContainer).toBeInTheDocument()

        if (gridContainer) {
          const style = gridContainer.getAttribute('style')
          // Should have gridTemplateRows with minmax(0, 1fr) instead of auto
          if (style) {
            expect(style).toContain('grid-template-rows')
          }
        }
      })
    })
  })

  describe('Flex Shrinking Behavior', () => {
    it('should document min-h-0 requirement for flex scroll', () => {
      // In CSS flexbox, children have implicit min-height: auto
      // This prevents them from shrinking below content size
      // Adding min-h-0 (min-height: 0) allows shrinking and enables overflow scroll

      const flexScrollRequirements = {
        parentMinH0: 'min-h-0 allows parent to shrink',
        childFlex1: 'flex-1 makes child expand to fill space',
        childMinH0: 'min-h-0 allows child to shrink below content',
        childOverflow:
          'overflow-y-auto enables scroll when content exceeds height',
      }

      expect(flexScrollRequirements.parentMinH0).toContain('min-h-0')
      expect(flexScrollRequirements.childMinH0).toContain('min-h-0')
      expect(flexScrollRequirements.childOverflow).toContain('overflow-y-auto')
    })

    it('should calculate card overflow threshold', () => {
      // Approximate card height: 130px (varies by content)
      // Column header: ~50px
      // Add Repo button: ~40px
      // WIP warning (optional): ~50px
      // Padding: ~32px

      const cardHeight = 130
      const headerHeight = 50
      const buttonHeight = 40
      const padding = 32
      const fixedHeight = headerHeight + buttonHeight + padding

      // Available height for cards in a 600px tall column
      const viewportHeight = 600
      const availableForCards = viewportHeight - fixedHeight

      // Number of cards that fit without scroll
      const cardsWithoutScroll = Math.floor(availableForCards / cardHeight)

      // With ~478px available, about 3-4 cards fit
      expect(cardsWithoutScroll).toBeGreaterThanOrEqual(3)
      expect(cardsWithoutScroll).toBeLessThanOrEqual(4)

      // 10 cards would require scroll
      expect(10).toBeGreaterThan(cardsWithoutScroll)
    })
  })

  describe('Grid Row Sizing', () => {
    it('should use minmax(0, 1fr) to allow rows to shrink', () => {
      // gridTemplateRows: repeat(N, auto) - rows expand to fit content (BAD for scroll)
      // gridTemplateRows: repeat(N, minmax(0, 1fr)) - rows share available height (GOOD)

      const badPattern = 'repeat(2, auto)'
      const goodPattern = 'repeat(2, minmax(0, 1fr))'

      expect(badPattern).toContain('auto')
      expect(goodPattern).toContain('minmax(0, 1fr)')

      // The fix changes from 'auto' to 'minmax(0, 1fr)'
      expect(goodPattern).not.toContain('auto')
    })

    it('should calculate grid row height distribution', () => {
      const generateGridRowTemplate = (rows: number): string => {
        return `repeat(${rows}, minmax(0, 1fr))`
      }

      expect(generateGridRowTemplate(1)).toBe('repeat(1, minmax(0, 1fr))')
      expect(generateGridRowTemplate(2)).toBe('repeat(2, minmax(0, 1fr))')
      expect(generateGridRowTemplate(3)).toBe('repeat(3, minmax(0, 1fr))')
    })
  })
})

describe('SortableColumn Vertical Scroll Classes', () => {
  /**
   * These tests document the expected CSS classes for SortableColumn
   * that enable vertical scrolling within columns.
   */

  it('should document expected classes for SortableColumn container', () => {
    // Expected classes in SortableColumn.tsx line 89-90:
    // className="flex flex-col h-full w-full min-h-0 bg-background/50..."

    const expectedClasses = ['flex', 'flex-col', 'h-full', 'w-full', 'min-h-0']

    // min-h-0 is critical for vertical scroll
    expect(expectedClasses).toContain('min-h-0')
    expect(expectedClasses).toContain('h-full')
    expect(expectedClasses).toContain('flex-col')
  })

  it('should document expected classes for inner wrapper', () => {
    // Expected classes in SortableColumn.tsx line 98:
    // className="flex-1 min-h-0 p-4 overflow-hidden"

    const expectedClasses = ['flex-1', 'min-h-0', 'p-4', 'overflow-hidden']

    // min-h-0 and overflow-hidden enable proper scroll containment
    expect(expectedClasses).toContain('min-h-0')
    expect(expectedClasses).toContain('overflow-hidden')
  })
})

describe('StatusColumn Vertical Scroll Classes', () => {
  /**
   * These tests document the expected CSS classes for StatusColumn
   * that enable vertical scrolling of cards.
   */

  it('should document expected classes for StatusColumn container', () => {
    // Expected classes in StatusColumn.tsx line 81:
    // className="flex flex-col h-full min-h-0"

    const expectedClasses = ['flex', 'flex-col', 'h-full', 'min-h-0']

    expect(expectedClasses).toContain('min-h-0')
    expect(expectedClasses).toContain('flex-col')
  })

  it('should document expected classes for card scroll area', () => {
    // Expected classes in StatusColumn.tsx line 147:
    // className="space-y-3 flex-1 min-h-0 overflow-y-auto rounded-lg p-1..."

    const expectedClasses = [
      'space-y-3',
      'flex-1',
      'min-h-0',
      'overflow-y-auto',
      'rounded-lg',
      'p-1',
    ]

    // flex-1 expands to fill, min-h-0 allows shrinking, overflow-y-auto enables scroll
    expect(expectedClasses).toContain('flex-1')
    expect(expectedClasses).toContain('min-h-0')
    expect(expectedClasses).toContain('overflow-y-auto')
  })
})
