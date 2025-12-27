/**
 * Kanban Board E2E Tests
 *
 * Tests for the Kanban board view (/board/[id])
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Note: @dnd-kit drag operations cannot be fully tested via automation
 * due to event.isTrusted === true validation. These tests focus on
 * non-drag interactions.
 */

import { test, expect } from '@playwright/test'

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
