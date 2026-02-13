/**
 * Kanban Column Width E2E Tests
 *
 * Tests for column width constraints to prevent columns from expanding
 * to fill available space when fewer columns exist on the board.
 *
 * Bug fix: Columns expanded horizontally when fewer columns existed.
 * Fix: Changed from minmax(280px, 1fr) to minmax(280px, var(--column-width))
 * where --column-width is defined as 320px CSS variable.
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('Kanban Column Width Constraints', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('CSS variable --column-width should be defined as 320px', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for hydration - grid appears after isMounted is true
    await expect(
      page.locator('[data-testid^="status-column-"]').first(),
    ).toBeVisible({ timeout: 10000 })

    const columnWidth = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--column-width')
        .trim()
    })

    expect(columnWidth).toBe('320px')
  })

  test('grid should use CSS variable for column sizing', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for hydration - grid appears after isMounted is true
    await expect(page.locator('.grid.gap-4.pb-4').first()).toBeVisible({
      timeout: 10000,
    })

    const gridStyle = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-4.pb-4')
      if (!grid) return null
      return grid.getAttribute('style')
    })

    expect(gridStyle).not.toBeNull()
    expect(gridStyle).toContain('var(--column-width)')
  })

  test('columns should not expand beyond max-width when few columns exist', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for hydration - columns appear after isMounted is true
    await expect(
      page.locator('[data-testid^="sortable-column-"]').first(),
    ).toBeVisible({ timeout: 10000 })

    // Get all sortable columns (the wrapper divs that contain status columns)
    const columns = page.locator('[data-testid^="sortable-column-"]')
    const columnCount = await columns.count()

    expect(columnCount).toBeGreaterThan(0)

    // Each column should have computed width <= 320px (plus some tolerance for borders/padding)
    // The column width is constrained by CSS Grid minmax(280px, var(--column-width))
    for (let i = 0; i < Math.min(columnCount, 3); i++) {
      const column = columns.nth(i)
      const box = await column.boundingBox()

      // Column should exist and have reasonable width
      expect(box).not.toBeNull()
      // Max width should be around 320px (allowing for small variations)
      expect(box!.width).toBeLessThanOrEqual(360) // 320px + tolerance
      expect(box!.width).toBeGreaterThanOrEqual(280) // Min width
    }
  })

  test('column width should remain consistent regardless of column count', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for hydration - columns appear after isMounted is true
    await expect(
      page.locator('[data-testid^="sortable-column-"]').first(),
    ).toBeVisible({ timeout: 10000 })

    // Get column widths
    const columns = page.locator('[data-testid^="sortable-column-"]')
    const columnCount = await columns.count()

    if (columnCount > 1) {
      const firstColumnBox = await columns.first().boundingBox()
      const lastColumnBox = await columns.last().boundingBox()

      // All columns should have similar widths (constrained by CSS variable)
      expect(firstColumnBox).not.toBeNull()
      expect(lastColumnBox).not.toBeNull()

      // Width difference should be minimal (within 10px)
      const widthDiff = Math.abs(firstColumnBox!.width - lastColumnBox!.width)
      expect(widthDiff).toBeLessThanOrEqual(10)
    }
  })
})
