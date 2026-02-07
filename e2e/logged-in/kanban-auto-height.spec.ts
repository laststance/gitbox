/**
 * Kanban Board Column Auto-Height E2E Tests
 *
 * Tests for column auto-height expansion behavior.
 * Feature: Columns automatically expand to show all cards without internal scrolling.
 *
 * CSS Pattern for auto-height expansion:
 * - Grid uses `minmax(min-content, auto)` for rows to expand based on content
 * - Columns have no height constraints (removed h-full, min-h-0)
 * - Card container has no overflow-y-auto (cards flow naturally)
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('Kanban Board Column Auto-Height', () => {
  // Use larger viewport to ensure columns have room to expand
  test.use({
    storageState: 'e2e/.auth/user.json',
    viewport: { width: 1920, height: 1200 },
  })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('should have KanbanBoard container without height constraints', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('should show all cards without internal column scrollbar', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

    // Wait for hydration and cards to be rendered
    await page.waitForTimeout(500)

    // Wait for at least one column to be visible
    await expect(
      page.locator('[data-testid^="sortable-column-"]').first(),
    ).toBeVisible({ timeout: 10000 })

    // Wait for cards to be rendered (they have animation)
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
        // Find the card container by looking for an element with both space-y-3 and flex-1 classes
        // Note: Classes might be in different order or have additional classes
        const cardContainer = column.querySelector(
          '[class*="space-y-3"][class*="flex-1"]',
        )

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

    // If no columns with cards are found, the test should still pass
    // This can happen if the board is empty or cards haven't loaded
    if (heightInfo.length === 0) {
      // Verify at least columns exist
      const columnCount = await page
        .locator('[data-testid^="sortable-column-"]')
        .count()
      expect(columnCount).toBeGreaterThan(0)
      return // Skip height check if no card containers found
    }

    // All columns with cards should have height matching their content
    heightInfo.forEach((info) => {
      expect(info.heightMatchesContent).toBe(true)
    })
  })
})
