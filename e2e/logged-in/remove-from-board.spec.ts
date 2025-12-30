/**
 * Remove from Board E2E Tests
 *
 * Tests for removing repository cards from the Kanban board.
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Feature:
 * - OverflowMenu displays "Remove from Board" option
 * - Clicking triggers AlertDialog confirmation
 * - Confirmation removes card from board (optimistic update)
 * - Cancel closes dialog without action
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Remove from Board Feature', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should display Remove from Board option in overflow menu', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for hydration and cards to load
    await page.waitForTimeout(500)

    // Find the first repo card's overflow menu trigger
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })

    // Open the overflow menu
    await overflowMenuTrigger.click()

    // Wait for dropdown menu to appear
    const dropdownMenu = page.getByTestId('overflow-menu')
    await expect(dropdownMenu).toBeVisible({ timeout: 5000 })

    // Look for "Remove from Board" menu item with destructive styling
    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await expect(removeMenuItem).toBeVisible()

    // Verify it has destructive text styling (red)
    await expect(removeMenuItem).toHaveClass(/text-destructive/)
  })

  test('should open confirmation dialog when clicking Remove from Board', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Open overflow menu
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await overflowMenuTrigger.click()

    // Click Remove from Board
    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await removeMenuItem.click()

    // Wait for AlertDialog to appear
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 5000 })

    // Verify dialog title
    const title = alertDialog.getByText('Remove Repository from Board?')
    await expect(title).toBeVisible()

    // Verify dialog description mentions the consequences
    const description = alertDialog.getByText(/will not be deleted from GitHub/)
    await expect(description).toBeVisible()

    // Verify Cancel button exists
    const cancelButton = alertDialog.getByRole('button', { name: /cancel/i })
    await expect(cancelButton).toBeVisible()

    // Verify Remove button exists with destructive styling
    const removeButton = alertDialog.getByRole('button', { name: /^remove$/i })
    await expect(removeButton).toBeVisible()
    await expect(removeButton).toHaveClass(/bg-destructive/)
  })

  test('should close confirmation dialog when clicking Cancel', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Open overflow menu and click Remove from Board
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await overflowMenuTrigger.click()

    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await removeMenuItem.click()

    // Wait for dialog
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 5000 })

    // Click Cancel
    const cancelButton = alertDialog.getByRole('button', { name: /cancel/i })
    await cancelButton.click()

    // Dialog should close
    await expect(alertDialog).not.toBeVisible({ timeout: 5000 })
  })

  test('should remove card from board when confirming removal', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Count initial cards
    const initialCardCount = await page
      .locator('[data-testid^="repo-card-"]')
      .count()
    expect(initialCardCount).toBeGreaterThan(0)

    // Get the first card's ID to verify it's removed
    const firstCardTestId = await page
      .locator('[data-testid^="repo-card-"]')
      .first()
      .getAttribute('data-testid')

    // Open overflow menu
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await overflowMenuTrigger.click()

    // Click Remove from Board
    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await removeMenuItem.click()

    // Wait for dialog
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 5000 })

    // Click Remove to confirm
    const removeButton = alertDialog.getByRole('button', { name: /^remove$/i })
    await removeButton.click()

    // Wait for optimistic update
    await page.waitForTimeout(500)

    // Dialog should close
    await expect(alertDialog).not.toBeVisible({ timeout: 5000 })

    // Card count should decrease by 1
    const finalCardCount = await page
      .locator('[data-testid^="repo-card-"]')
      .count()
    expect(finalCardCount).toBe(initialCardCount - 1)

    // The removed card should no longer exist
    if (firstCardTestId) {
      const removedCard = page.locator(`[data-testid="${firstCardTestId}"]`)
      await expect(removedCard).not.toBeVisible()
    }
  })

  test('should show repository name in confirmation dialog', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Get the first card's repo name
    const cardTitle = await page
      .locator('[data-testid^="repo-card-"]')
      .first()
      .locator('[data-testid="repo-name"]')
      .textContent()

    // Open overflow menu and click Remove
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await overflowMenuTrigger.click()

    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await removeMenuItem.click()

    // Verify the dialog shows the repo name
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 5000 })

    // The repo name should be shown in the dialog description
    if (cardTitle) {
      const repoNameInDialog = alertDialog.getByText(cardTitle.trim())
      await expect(repoNameInDialog).toBeVisible()
    }
  })

  test('should only show Remove from Board in board context (not maintenance)', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Open overflow menu
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await overflowMenuTrigger.click()

    // Wait for dropdown menu
    const dropdownMenu = page.getByTestId('overflow-menu')
    await expect(dropdownMenu).toBeVisible({ timeout: 5000 })

    // Remove from Board should be visible (board context)
    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await expect(removeMenuItem).toBeVisible()

    // Move to Maintenance should also be visible (board context)
    const maintenanceMenuItem = page
      .locator('[data-testid^="move-to-maintenance-"]')
      .first()
    await expect(maintenanceMenuItem).toBeVisible()

    // Close the menu
    await page.keyboard.press('Escape')
  })
})

test.describe('Remove from Board - Keyboard Accessibility', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should close confirmation dialog with Escape key', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Open overflow menu
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await overflowMenuTrigger.click()

    // Click Remove from Board
    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await removeMenuItem.click()

    // Wait for dialog
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 5000 })

    // Press Escape to close
    await page.keyboard.press('Escape')

    // Dialog should close
    await expect(alertDialog).not.toBeVisible({ timeout: 5000 })
  })
})
