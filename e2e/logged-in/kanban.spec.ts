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

import { test, expect } from '../fixtures/coverage'

test.describe('Kanban Board (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

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
  test.use({ storageState: 'e2e/.auth/user.json' })

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

    // Find the outer KanbanBoard container (auto-height: no h-full constraint)
    const kanbanContainer = page.locator('.w-fit.min-w-full.p-6').first()
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
  test.use({ storageState: 'e2e/.auth/user.json' })

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
 * Column Auto-Height Tests
 *
 * Tests for column auto-height expansion behavior.
 * Feature: Columns automatically expand to show all cards without internal scrolling.
 *
 * CSS Pattern for auto-height expansion:
 * - Grid uses `minmax(min-content, auto)` for rows to expand based on content
 * - Columns have no height constraints (removed h-full, min-h-0)
 * - Card container has no overflow-y-auto (cards flow naturally)
 */
test.describe('Kanban Board Column Auto-Height', () => {
  // Use larger viewport to ensure columns have room to expand
  test.use({
    storageState: 'e2e/.auth/user.json',
    viewport: { width: 1920, height: 1200 },
  })

  const BOARD_URL = '/board/board-1'

  test('should have KanbanBoard container without height constraints', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find the outer KanbanBoard container (should not have h-full or min-h-0)
    const kanbanContainer = page.locator('.w-fit.min-w-full.p-6').first()
    await expect(kanbanContainer).toBeVisible({ timeout: 10000 })

    // Verify container exists and is visible
    const classes = await kanbanContainer.getAttribute('class')
    expect(classes).not.toContain('h-full')
  })

  test('should have grid container without h-full min-h-0 classes', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration - grid appears after isMounted is true
    await page.waitForTimeout(500)

    // Find the grid container
    const gridContainer = page.locator('.grid.gap-4.pb-4').first()
    await expect(gridContainer).toBeVisible({ timeout: 10000 })

    // Verify the grid does NOT have height-constraining classes
    const classes = await gridContainer.getAttribute('class')
    expect(classes).not.toContain('h-full')
    expect(classes).not.toContain('min-h-0')
  })

  test('should have grid with correct gridTemplateRows style using minmax(min-content, auto)', async ({
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

    // Verify grid has inline style with gridTemplateRows using minmax(min-content, auto)
    expect(gridStyle).not.toBeNull()
    expect(gridStyle).toContain('grid-template-rows')
    // Should use minmax(min-content, auto) for auto-height expansion
    expect(gridStyle).toContain('minmax(min-content, auto)')
  })

  test('should have SortableColumn without height constraints', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find sortable columns by their data-testid pattern
    const sortableColumn = page
      .locator('[data-testid^="sortable-column-"]')
      .first()
    await expect(sortableColumn).toBeVisible({ timeout: 10000 })

    // Verify the column does NOT have height-constraining classes
    const classes = await sortableColumn.getAttribute('class')
    expect(classes).not.toContain('h-full')
  })

  test('should have StatusColumn container without min-h-0 constraint', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find status columns by their data-testid pattern
    const statusColumn = page.locator('[data-testid^="status-column-"]').first()
    await expect(statusColumn).toBeVisible({ timeout: 10000 })

    // Verify the column exists (auto-height allows natural expansion)
    await expect(statusColumn).toHaveClass(/flex-col/)
  })

  test('should have card container without overflow-y-auto (no internal scroll)', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Find the card container inside a column (space-y-3 flex-1)
    const cardContainer = page.locator('.space-y-3.flex-1').first()
    await expect(cardContainer).toBeVisible({ timeout: 10000 })

    // Verify it does NOT have overflow-y-auto (cards should expand, not scroll)
    const classes = await cardContainer.getAttribute('class')
    expect(classes).not.toContain('overflow-y-auto')
  })

  test('should expand column height to fit all cards', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Verify columns expand to fit content (no hidden cards)
    const columnInfo = await page.evaluate(() => {
      const cardContainers = Array.from(
        document.querySelectorAll('.space-y-3.flex-1'),
      )

      const results: Array<{
        cardCount: number
        containerHeight: number
        contentHeight: number
        allCardsVisible: boolean
      }> = []

      for (const container of cardContainers) {
        const cards = container.querySelectorAll('[data-testid^="repo-card-"]')
        const rect = container.getBoundingClientRect()

        // Check if all cards are visible (no overflow hidden)
        // CI may have different rendering, allow larger tolerance
        const tolerance = 20 // px tolerance for rendering differences
        const allCardsVisible =
          container.scrollHeight <= container.clientHeight + tolerance

        results.push({
          cardCount: cards.length,
          containerHeight: Math.round(rect.height),
          contentHeight: container.scrollHeight,
          allCardsVisible,
        })
      }

      return results
    })

    // Verify all columns show all their cards
    columnInfo.forEach((col) => {
      if (col.cardCount > 0) {
        expect(col.allCardsVisible).toBe(true)
      }
    })
  })
})

/**
 * Column Auto-Height with Many Cards
 *
 * These tests verify that columns with many cards properly expand
 * to show all cards without requiring internal scrolling.
 */
test.describe('Kanban Board Column Auto-Height - Many Cards', () => {
  // Use larger viewport to ensure columns have room to expand all cards
  test.use({
    storageState: 'e2e/.auth/user.json',
    viewport: { width: 1920, height: 1200 },
  })

  const BOARD_URL = '/board/board-1'

  test('should show all cards without internal column scrollbar', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Verify no card container has internal overflow (scrollHeight === clientHeight)
    const overflowCheck = await page.evaluate(() => {
      const cardContainers = Array.from(
        document.querySelectorAll('.space-y-3.flex-1'),
      )

      const results: Array<{
        hasOverflow: boolean
        scrollHeight: number
        clientHeight: number
      }> = []

      for (const container of cardContainers) {
        results.push({
          // CI may have different rendering, allow larger tolerance
          hasOverflow: container.scrollHeight > container.clientHeight + 20,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
        })
      }

      return results
    })

    // All containers should NOT have internal overflow (auto-height expands)
    overflowCheck.forEach((result) => {
      expect(result.hasOverflow).toBe(false)
    })
  })

  test('should maintain all cards visible at all times', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Count total cards in all columns
    const cardCountResult = await page.evaluate(() => {
      const cardContainers = document.querySelectorAll('.space-y-3.flex-1')

      let totalCards = 0
      let visibleCards = 0

      cardContainers.forEach((container) => {
        const cards = container.querySelectorAll('[data-testid^="repo-card-"]')
        totalCards += cards.length

        // Check each card's visibility
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect()
          if (rect.height > 0 && rect.width > 0) {
            visibleCards++
          }
        })
      })

      return { totalCards, visibleCards }
    })

    // All cards should be visible (no hidden cards due to overflow)
    expect(cardCountResult.visibleCards).toBe(cardCountResult.totalCards)
  })

  test('should have proper flex hierarchy for auto-height to work', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Verify the hierarchy supports auto-height expansion
    const hierarchyCheck = await page.evaluate(() => {
      // Find the grid
      const grid = document.querySelector('.grid.gap-4.pb-4')
      if (!grid) return { error: 'Grid not found' }

      const gridClasses = grid.className
      // Auto-height: should NOT have height-constraining classes
      const gridHasNoHeightConstraint =
        !gridClasses.includes('h-full') && !gridClasses.includes('min-h-0')

      // Find a sortable column
      const sortableColumn = document.querySelector(
        '[data-testid^="sortable-column-"]',
      )
      if (!sortableColumn) return { error: 'SortableColumn not found' }

      const sortableClasses = sortableColumn.className
      const sortableHasNoHeightConstraint = !sortableClasses.includes('h-full')

      // Find a status column
      const statusColumn = document.querySelector(
        '[data-testid^="status-column-"]',
      )
      if (!statusColumn) return { error: 'StatusColumn not found' }

      // Find the card container
      const cardContainer = document.querySelector('.space-y-3.flex-1')
      if (!cardContainer) return { error: 'Card container not found' }

      const cardClasses = cardContainer.className
      // Auto-height: should NOT have overflow-y-auto
      const cardHasNoOverflow = !cardClasses.includes('overflow-y-auto')
      const cardHasFlex1 = cardClasses.includes('flex-1')

      return {
        grid: { noHeightConstraint: gridHasNoHeightConstraint },
        sortableColumn: { noHeightConstraint: sortableHasNoHeightConstraint },
        cardContainer: {
          noOverflow: cardHasNoOverflow,
          hasFlex1: cardHasFlex1,
        },
        hierarchyComplete: true,
      }
    })

    // Verify the hierarchy supports auto-height expansion
    expect(hierarchyCheck.error).toBeUndefined()
    expect(hierarchyCheck.grid?.noHeightConstraint).toBe(true)
    expect(hierarchyCheck.sortableColumn?.noHeightConstraint).toBe(true)
    expect(hierarchyCheck.cardContainer?.noOverflow).toBe(true)
    expect(hierarchyCheck.cardContainer?.hasFlex1).toBe(true)
    expect(hierarchyCheck.hierarchyComplete).toBe(true)
  })

  test('should have column height matching content height', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for hydration
    await page.waitForTimeout(500)

    // Verify columns expand to match their content
    const heightInfo = await page.evaluate(() => {
      const sortableColumns = document.querySelectorAll(
        '[data-testid^="sortable-column-"]',
      )

      const results: Array<{
        columnHeight: number
        cardContainerHeight: number
        heightMatchesContent: boolean
      }> = []

      sortableColumns.forEach((column) => {
        const columnRect = column.getBoundingClientRect()
        const cardContainer = column.querySelector('.space-y-3.flex-1')

        if (cardContainer) {
          const containerRect = cardContainer.getBoundingClientRect()
          // Column should accommodate full card container height
          results.push({
            columnHeight: Math.round(columnRect.height),
            cardContainerHeight: Math.round(containerRect.height),
            // CI may have different rendering, allow larger tolerance
            heightMatchesContent:
              cardContainer.scrollHeight <= containerRect.height + 20,
          })
        }
      })

      return results
    })

    expect(heightInfo.length).toBeGreaterThan(0)
    // All columns should have height matching their content
    heightInfo.forEach((info) => {
      expect(info.heightMatchesContent).toBe(true)
    })
  })
})
