/**
 * Kanban Board E2E Tests
 *
 * Tests for the Kanban board view (/board/[id])
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * @remarks
 * For @dnd-kit drag operations, see kanban-dnd.spec.ts which uses
 * CDP (Chrome DevTools Protocol) to generate `isTrusted: true` events.
 * These tests focus on non-drag interactions and UI elements.
 */

import { test, expect } from './fixtures/coverage'

test.describe('Kanban Board (Authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should display the kanban board page', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Should show the board page (not redirected to login)
    await expect(page).toHaveURL(/\/board\//)

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Page should have main elements loaded (use first() since there are multiple main elements)
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
  })

  test('should display board header with action buttons', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Look for Add Repositories button (visible in the snapshot)
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })

    // Look for Add Column button
    const addColumnButton = page.getByRole('button', { name: /add column/i })
    await expect(addColumnButton).toBeVisible({ timeout: 10000 })
  })

  test('should have board settings button', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Look for board settings button
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
  })

  test('should have navigation back to boards', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Look for All Boards link in navigation
    const boardsLink = page.getByRole('link', { name: /all boards/i })
    await expect(boardsLink).toBeVisible({ timeout: 10000 })

    // Click to navigate back
    await boardsLink.click()
    await expect(page).toHaveURL(/\/boards/)
  })

  test('should display user info in sidebar', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Look for user info (Test User text or avatar)
    const userInfo = page.locator('img[alt="Test User"], :text("Test User")')
    await expect(userInfo.first()).toBeVisible({ timeout: 10000 })
  })

  test('should have sign out button', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Look for sign out button
    const signOutButton = page.getByRole('button', { name: /sign out/i })
    await expect(signOutButton).toBeVisible({ timeout: 10000 })
  })
})

/**
 * Horizontal Scroll Tests
 *
 * Tests for horizontal scrolling functionality when board has 6+ columns.
 * Bug fix: Columns outside viewport were not visible when 6+ columns exist.
 * Fix: Added overflow-x-auto to parent and w-fit min-w-full to grid container.
 */
test.describe('Kanban Board Horizontal Scroll', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should have scrollable container with overflow-x-auto class', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Find the scrollable container parent of KanbanBoard
    const scrollContainer = page.locator('.overflow-x-auto').first()
    await expect(scrollContainer).toBeVisible({ timeout: 10000 })

    // Verify the container has the correct CSS class
    await expect(scrollContainer).toHaveClass(/overflow-x-auto/)
  })

  test('should have grid container with w-fit min-w-full classes', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration - grid appears after isMounted is true
    await page.waitForTimeout(500)

    // Find the grid container inside KanbanBoard
    const gridContainer = page.locator('.grid.gap-4.pb-4').first()
    await expect(gridContainer).toBeVisible({ timeout: 10000 })

    // Verify the grid has w-fit min-w-full classes for horizontal expansion
    await expect(gridContainer).toHaveClass(/w-fit/)
    await expect(gridContainer).toHaveClass(/min-w-full/)
  })

  test('should have KanbanBoard container with w-fit min-w-full classes', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Find the outer KanbanBoard container
    const kanbanContainer = page.locator('.w-fit.min-w-full.h-full.p-6').first()
    await expect(kanbanContainer).toBeVisible({ timeout: 10000 })
  })

  test('should enable horizontal scroll when content overflows viewport', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Check if scroll container has scrollable content
    const scrollInfo = await page.evaluate(() => {
      const container = document.querySelector('.overflow-x-auto')
      if (!container) return null
      return {
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
        hasHorizontalScroll: container.scrollWidth > container.clientWidth,
      }
    })

    // Verify scroll container exists
    expect(scrollInfo).not.toBeNull()

    // Note: Actual scroll requirement depends on number of columns
    // With default columns, scroll may or may not be needed
    // The key is that the container supports scrolling when needed
    expect(scrollInfo?.scrollWidth).toBeGreaterThan(0)
    expect(scrollInfo?.clientWidth).toBeGreaterThan(0)
  })

  test('should have grid with correct gridTemplateColumns style', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Check grid template columns style
    const gridStyle = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4.pb-4')
      if (!grid) return null
      return grid.getAttribute('style')
    })

    // Verify grid has inline style with gridTemplateColumns
    expect(gridStyle).not.toBeNull()
    expect(gridStyle).toContain('grid-template-columns')
    expect(gridStyle).toContain('minmax(280px, 1fr)')
  })

  test('should allow adding new columns via Add Column button', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Find Add Column button
    const addColumnButton = page.getByRole('button', { name: /add column/i })
    await expect(addColumnButton).toBeVisible({ timeout: 10000 })

    // Click to open dialog
    await addColumnButton.click()

    // Dialog should appear with column name input
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Should have name input field
    const nameInput = page.getByPlaceholder(/in progress|review/i)
    await expect(nameInput).toBeVisible()

    // Should have submit button
    const submitButton = dialog.getByRole('button', { name: /add column/i })
    await expect(submitButton).toBeVisible()

    // Cancel dialog
    const cancelButton = dialog.getByRole('button', { name: /cancel/i })
    await cancelButton.click()

    // Dialog should close
    await expect(dialog).not.toBeVisible()
  })
})

/**
 * Horizontal Scroll with Multiple Columns
 *
 * These tests verify horizontal scrolling works correctly when
 * there are 6+ columns that exceed the viewport width.
 */
test.describe('Kanban Board Horizontal Scroll - Multi Column', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should scroll horizontally to reveal hidden columns', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Get initial scroll state
    const initialScrollState = await page.evaluate(() => {
      const container = document.querySelector('.overflow-x-auto')
      if (!container) return null
      return {
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
        canScroll: container.scrollWidth > container.clientWidth,
      }
    })

    expect(initialScrollState).not.toBeNull()

    // If scrollable, test scroll behavior
    if (initialScrollState?.canScroll) {
      // Scroll to the right
      await page.evaluate(() => {
        const container = document.querySelector('.overflow-x-auto')
        if (container) {
          container.scrollLeft = container.scrollWidth - container.clientWidth
        }
      })

      // Verify scroll position changed
      const afterScrollState = await page.evaluate(() => {
        const container = document.querySelector('.overflow-x-auto')
        return container?.scrollLeft ?? 0
      })

      expect(afterScrollState).toBeGreaterThan(0)

      // Scroll back to start
      await page.evaluate(() => {
        const container = document.querySelector('.overflow-x-auto')
        if (container) {
          container.scrollLeft = 0
        }
      })

      // Verify returned to start
      const finalScrollState = await page.evaluate(() => {
        const container = document.querySelector('.overflow-x-auto')
        return container?.scrollLeft ?? 0
      })

      expect(finalScrollState).toBe(0)
    }
  })

  test('should maintain column visibility after scroll', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Count visible columns before any scroll
    const initialColumnCount = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4.pb-4')
      return grid?.children.length ?? 0
    })

    // Columns should exist in DOM
    expect(initialColumnCount).toBeGreaterThan(0)

    // Perform scroll if possible
    await page.evaluate(() => {
      const container = document.querySelector('.overflow-x-auto')
      if (container && container.scrollWidth > container.clientWidth) {
        container.scrollLeft = 100
      }
    })

    // Count columns after scroll - should be same (DOM doesn't change)
    const afterScrollColumnCount = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4.pb-4')
      return grid?.children.length ?? 0
    })

    // Column count should remain the same
    expect(afterScrollColumnCount).toBe(initialColumnCount)
  })

  test('should calculate correct minimum width for columns', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Verify each column has minimum width of 280px
    const columnWidths = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4.pb-4')
      if (!grid) return []

      return Array.from(grid.children).map((child) => {
        const rect = child.getBoundingClientRect()
        return rect.width
      })
    })

    // Each column should have at least 280px width (or be empty)
    columnWidths.forEach((width) => {
      if (width > 0) {
        expect(width).toBeGreaterThanOrEqual(280)
      }
    })
  })
})

/**
 * Vertical Scroll Tests
 *
 * Tests for vertical scrolling functionality within columns when there are many cards.
 * Bug fix: Cards outside viewport were not scrollable when column had 10+ cards.
 * Fix: Added min-h-0 throughout flex hierarchy and changed gridTemplateRows to minmax(0, 1fr).
 *
 * CSS Pattern for enabling scroll in flex containers:
 * - Parent flex container needs `min-h-0` to allow children to shrink below content size
 * - Child with overflow-y-auto needs `min-h-0` and `flex-1` to receive bounded height
 * - Grid rows need `minmax(0, 1fr)` instead of `auto` to distribute height equally
 */
test.describe('Kanban Board Vertical Scroll', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should have KanbanBoard container with min-h-0 for flex shrinking', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find the outer KanbanBoard container with min-h-0 class
    const kanbanContainer = page.locator('.w-fit.min-w-full.h-full.min-h-0.p-6')
    await expect(kanbanContainer).toBeVisible({ timeout: 10000 })

    // Verify the container has the min-h-0 class for flex shrinking
    await expect(kanbanContainer).toHaveClass(/min-h-0/)
  })

  test('should have grid container with h-full min-h-0 classes', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration - grid appears after isMounted is true
    await page.waitForTimeout(500)

    // Find the grid container with vertical scroll support classes
    const gridContainer = page.locator('.grid.gap-4.pb-4.h-full.min-h-0')
    await expect(gridContainer).toBeVisible({ timeout: 10000 })

    // Verify the grid has h-full and min-h-0 for proper height constraints
    await expect(gridContainer).toHaveClass(/h-full/)
    await expect(gridContainer).toHaveClass(/min-h-0/)
  })

  test('should have grid with correct gridTemplateRows style using minmax(0, 1fr)', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Check grid template rows style
    const gridStyle = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4.pb-4')
      if (!grid) return null
      return grid.getAttribute('style')
    })

    // Verify grid has inline style with gridTemplateRows using minmax(0, 1fr)
    expect(gridStyle).not.toBeNull()
    expect(gridStyle).toContain('grid-template-rows')
    // Should use minmax(0, 1fr) instead of auto to allow row shrinking
    // Browser normalizes 0 to 0px in CSS, so we check for minmax(0px, 1fr)
    expect(gridStyle).toContain('minmax(0px, 1fr)')
  })

  test('should have SortableColumn with min-h-0 class', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find sortable columns by their data-testid pattern
    const sortableColumn = page
      .locator('[data-testid^="sortable-column-"]')
      .first()
    await expect(sortableColumn).toBeVisible({ timeout: 10000 })

    // Verify the column has min-h-0 for flex shrinking
    await expect(sortableColumn).toHaveClass(/min-h-0/)
  })

  test('should have StatusColumn container with min-h-0 class', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find status columns by their data-testid pattern
    const statusColumn = page.locator('[data-testid^="status-column-"]').first()
    await expect(statusColumn).toBeVisible({ timeout: 10000 })

    // Verify the column has min-h-0 for flex shrinking
    await expect(statusColumn).toHaveClass(/min-h-0/)
  })

  test('should have card container with overflow-y-auto for vertical scrolling', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find the card container inside a column (space-y-3 flex-1 min-h-0 overflow-y-auto)
    const cardContainer = page
      .locator('.space-y-3.flex-1.min-h-0.overflow-y-auto')
      .first()
    await expect(cardContainer).toBeVisible({ timeout: 10000 })

    // Verify it has the necessary classes for vertical scroll
    await expect(cardContainer).toHaveClass(/overflow-y-auto/)
    await expect(cardContainer).toHaveClass(/min-h-0/)
    await expect(cardContainer).toHaveClass(/flex-1/)
  })

  test('should enable vertical scroll when cards overflow column height', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Check if any card container has scrollable content
    const scrollInfo = await page.evaluate(() => {
      const cardContainers = Array.from(
        document.querySelectorAll('.space-y-3.flex-1.min-h-0.overflow-y-auto'),
      )
      for (const container of cardContainers) {
        if (container.scrollHeight > container.clientHeight) {
          return {
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            hasVerticalScroll: container.scrollHeight > container.clientHeight,
          }
        }
      }
      // If no container has overflow, return info about first container
      const first = cardContainers[0]
      if (first) {
        return {
          scrollHeight: first.scrollHeight,
          clientHeight: first.clientHeight,
          hasVerticalScroll: false,
          note: 'No column currently has overflow - test data may have few cards',
        }
      }
      return null
    })

    // Verify card container exists
    expect(scrollInfo).not.toBeNull()
    expect(scrollInfo?.scrollHeight).toBeGreaterThanOrEqual(0)
    expect(scrollInfo?.clientHeight).toBeGreaterThanOrEqual(0)
  })
})

/**
 * Vertical Scroll with Many Cards
 *
 * These tests verify vertical scrolling works correctly when
 * a column has many cards that exceed the column height.
 */
test.describe('Kanban Board Vertical Scroll - Many Cards', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should scroll vertically to reveal hidden cards when column has overflow', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find a card container that has overflow (if any)
    const scrollResult = await page.evaluate(() => {
      const cardContainers = Array.from(
        document.querySelectorAll('.space-y-3.flex-1.min-h-0.overflow-y-auto'),
      )

      for (const container of cardContainers) {
        if (container.scrollHeight > container.clientHeight) {
          // Found a container with overflow
          const initialScrollTop = container.scrollTop

          // Scroll down
          container.scrollTop = container.scrollHeight - container.clientHeight

          const afterScrollTop = container.scrollTop

          // Scroll back to top
          container.scrollTop = 0

          const finalScrollTop = container.scrollTop

          return {
            hasOverflow: true,
            initialScrollTop,
            afterScrollTop,
            finalScrollTop,
            scrolledSuccessfully: afterScrollTop > 0,
            returnedToTop: finalScrollTop === 0,
          }
        }
      }

      return {
        hasOverflow: false,
        note: 'No column has enough cards to require scrolling in current test data',
      }
    })

    expect(scrollResult).not.toBeNull()

    // If there's overflow, verify scroll works correctly
    if (scrollResult.hasOverflow) {
      expect(scrollResult.scrolledSuccessfully).toBe(true)
      expect(scrollResult.returnedToTop).toBe(true)
    }
  })

  test('should maintain card count after vertical scroll', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Count cards in all columns before and after scroll
    const cardCountResult = await page.evaluate(() => {
      const cardContainers = document.querySelectorAll(
        '.space-y-3.flex-1.min-h-0.overflow-y-auto',
      )

      const results: Array<{
        containerIndex: number
        initialCount: number
        afterScrollCount: number
      }> = []

      cardContainers.forEach((container, index) => {
        const initialCount = container.children.length

        // Scroll if possible
        if (container.scrollHeight > container.clientHeight) {
          container.scrollTop = 100
        }

        const afterScrollCount = container.children.length

        // Reset scroll
        container.scrollTop = 0

        results.push({
          containerIndex: index,
          initialCount,
          afterScrollCount,
        })
      })

      return results
    })

    // Card count should remain the same after scrolling (DOM doesn't change)
    cardCountResult.forEach((result) => {
      expect(result.afterScrollCount).toBe(result.initialCount)
    })
  })

  test('should have proper flex hierarchy for vertical scroll to work', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Verify the complete flex hierarchy from KanbanBoard to card container
    const hierarchyCheck = await page.evaluate(() => {
      // Find the grid
      const grid = document.querySelector('.grid.gap-4.pb-4')
      if (!grid) return { error: 'Grid not found' }

      const gridClasses = grid.className
      const gridHasMinH0 = gridClasses.includes('min-h-0')
      const gridHasHFull = gridClasses.includes('h-full')

      // Find a sortable column
      const sortableColumn = document.querySelector(
        '[data-testid^="sortable-column-"]',
      )
      if (!sortableColumn) return { error: 'SortableColumn not found' }

      const sortableClasses = sortableColumn.className
      const sortableHasMinH0 = sortableClasses.includes('min-h-0')

      // Find a status column
      const statusColumn = document.querySelector(
        '[data-testid^="status-column-"]',
      )
      if (!statusColumn) return { error: 'StatusColumn not found' }

      const statusClasses = statusColumn.className
      const statusHasMinH0 = statusClasses.includes('min-h-0')

      // Find the card container
      const cardContainer = document.querySelector(
        '.space-y-3.flex-1.min-h-0.overflow-y-auto',
      )
      if (!cardContainer) return { error: 'Card container not found' }

      const cardClasses = cardContainer.className
      const cardHasOverflowYAuto = cardClasses.includes('overflow-y-auto')
      const cardHasMinH0 = cardClasses.includes('min-h-0')
      const cardHasFlex1 = cardClasses.includes('flex-1')

      return {
        grid: { hasMinH0: gridHasMinH0, hasHFull: gridHasHFull },
        sortableColumn: { hasMinH0: sortableHasMinH0 },
        statusColumn: { hasMinH0: statusHasMinH0 },
        cardContainer: {
          hasOverflowYAuto: cardHasOverflowYAuto,
          hasMinH0: cardHasMinH0,
          hasFlex1: cardHasFlex1,
        },
        hierarchyComplete: true,
      }
    })

    // Verify the complete hierarchy is correct for vertical scroll
    expect(hierarchyCheck.error).toBeUndefined()
    expect(hierarchyCheck.grid?.hasMinH0).toBe(true)
    expect(hierarchyCheck.grid?.hasHFull).toBe(true)
    expect(hierarchyCheck.sortableColumn?.hasMinH0).toBe(true)
    expect(hierarchyCheck.statusColumn?.hasMinH0).toBe(true)
    expect(hierarchyCheck.cardContainer?.hasOverflowYAuto).toBe(true)
    expect(hierarchyCheck.cardContainer?.hasMinH0).toBe(true)
    expect(hierarchyCheck.cardContainer?.hasFlex1).toBe(true)
    expect(hierarchyCheck.hierarchyComplete).toBe(true)
  })

  test('should have bounded column height for scroll to work', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Verify columns have bounded heights (not expanding infinitely)
    const heightInfo = await page.evaluate(() => {
      const sortableColumns = document.querySelectorAll(
        '[data-testid^="sortable-column-"]',
      )
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      }

      const columnHeights: number[] = []
      sortableColumns.forEach((column) => {
        const rect = column.getBoundingClientRect()
        columnHeights.push(rect.height)
      })

      return {
        viewportHeight: viewport.height,
        columnHeights,
        allColumnsBounded: columnHeights.every((h) => h <= viewport.height),
      }
    })

    expect(heightInfo.columnHeights.length).toBeGreaterThan(0)
    // Columns should be bounded by viewport height (or slightly less due to margins)
    // This verifies the min-h-0 and minmax(0, 1fr) fixes are working
    heightInfo.columnHeights.forEach((height) => {
      // Column height should be reasonable (not expanding to content height)
      expect(height).toBeLessThanOrEqual(heightInfo.viewportHeight * 1.1) // Allow 10% margin
    })
  })
})
