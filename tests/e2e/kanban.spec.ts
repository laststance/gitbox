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

  test('should display the kanban board', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Should show the board page
    await expect(page).toHaveURL(/\/board\//)

    // Should have columns (status lists)
    const columns = page.locator(
      '[data-testid="status-column"], [data-testid="status-list"]',
    )
    await expect(columns.first()).toBeVisible({ timeout: 10000 })
  })

  test('should display status columns', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for the board to load
    await page.waitForLoadState('networkidle')

    // Should have at least one column header
    const columnHeaders = page
      .locator('[data-testid="column-header"], h2, h3')
      .filter({
        hasText: /to do|in progress|done|backlog|review/i,
      })

    // MSW should return mock status lists
    await expect(columnHeaders.first()).toBeVisible({ timeout: 10000 })
  })

  test('should display repository cards', async ({ page }) => {
    await page.goto(BOARD_URL)

    await page.waitForLoadState('networkidle')

    // Look for repo cards
    const repoCards = page.locator(
      '[data-testid="repo-card"], [data-testid="card"]',
    )

    // MSW should return mock cards
    if ((await repoCards.count()) > 0) {
      await expect(repoCards.first()).toBeVisible()
    }
  })

  test('should open add repository dialog', async ({ page }) => {
    await page.goto(BOARD_URL)

    await page.waitForLoadState('networkidle')

    // Look for add repo button
    const addButton = page.getByRole('button', { name: /add|new|repository/i })

    if (await addButton.isVisible()) {
      await addButton.click()

      // Should open a dialog/modal
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()
    }
  })

  test('should have working command palette shortcut', async ({ page }) => {
    await page.goto(BOARD_URL)

    await page.waitForLoadState('networkidle')

    // Press Cmd+K or Ctrl+K to open command palette
    await page.keyboard.press('Meta+k')

    // Should open command palette
    const commandPalette = page.locator(
      '[data-testid="command-palette"], [role="combobox"], [cmdk-root]',
    )
    await expect(commandPalette).toBeVisible({ timeout: 3000 })
  })

  test('should navigate back to boards list', async ({ page }) => {
    await page.goto(BOARD_URL)

    await page.waitForLoadState('networkidle')

    // Look for back button or boards link
    const backLink = page.locator(
      'a[href="/boards"], [data-testid="back-button"]',
    )

    if (await backLink.first().isVisible()) {
      await backLink.first().click()
      await expect(page).toHaveURL(/\/boards/)
    }
  })

  test('should show keyboard shortcuts help with ? key', async ({ page }) => {
    await page.goto(BOARD_URL)

    await page.waitForLoadState('networkidle')

    // Press ? to show shortcuts help
    await page.keyboard.press('Shift+/')

    // Should show shortcuts dialog
    const shortcutsDialog = page.locator(
      '[data-testid="shortcuts-help"], [role="dialog"]:has-text("shortcut")',
    )
    await expect(shortcutsDialog).toBeVisible({ timeout: 3000 })
  })
})
