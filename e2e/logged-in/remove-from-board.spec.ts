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
import {
  querySingle,
  CARD_IDS,
  BOARD_IDS,
  STATUS_IDS,
  resetRepoCards,
} from '../helpers/db-query'

test.describe('Remove from Board Feature', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('should display Remove from Board option in overflow menu', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

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

    // Open overflow menu
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
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

    // Verify dialog description states what is kept: the note, links and
    // comment stay with the repository (Issue #216)
    await expect(
      alertDialog.getByText(
        /Its note, links and comment are kept: they come back when you add the repository to a board again\./,
      ),
    ).toBeVisible()
    await expect(
      alertDialog.getByText(/The repository on GitHub is not affected\./),
    ).toBeVisible()

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

    // Open overflow menu and click Remove from Board
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
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

    // Wait for cards to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({ timeout: 10000 })

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

    // Dialog should close after optimistic update
    await expect(alertDialog).not.toBeVisible({ timeout: 5000 })

    // Card count should decrease by 1 (wait for optimistic UI update)
    await expect(async () => {
      const finalCardCount = await page
        .locator('[data-testid^="repo-card-"]')
        .count()
      expect(finalCardCount).toBe(initialCardCount - 1)
    }).toPass({ timeout: 10000 })

    // The removed card should no longer exist
    if (firstCardTestId) {
      const removedCard = page.locator(`[data-testid="${firstCardTestId}"]`)
      await expect(removedCard).not.toBeVisible()
    }
  })

  test('should verify card is deleted from database after removal', async ({
    page,
  }) => {
    // Ensure card-5 exists (may have been deleted by prior tests on same shard)
    await resetRepoCards()

    const cardId = CARD_IDS.card5

    // Verify card exists before removal
    const cardBefore = await querySingle('repocard', { id: cardId })
    expect(cardBefore).not.toBeNull()

    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Find the specific card's overflow menu
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${CARD_IDS.card5}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    // Click Remove from Board
    const removeMenuItem = page.locator(
      `[data-testid="remove-from-board-${CARD_IDS.card5}"]`,
    )
    await removeMenuItem.click()

    // Confirm removal
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 5000 })
    const removeButton = alertDialog.getByRole('button', { name: /^remove$/i })
    await removeButton.click()

    // Wait for dialog to close (confirms action was triggered)
    await expect(alertDialog).not.toBeVisible({ timeout: 5000 })

    // Poll database until card is deleted (server action may be async)
    await expect(async () => {
      const cardAfter = await querySingle('repocard', { id: cardId })
      expect(cardAfter).toBeNull()
    }).toPass({ timeout: 10000 })

    // Restore card-5 for subsequent tests on same shard
    await resetRepoCards()
  })

  test('should show repository name in confirmation dialog', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for cards to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({ timeout: 10000 })

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

  test('should offer Move to Another Board next to Remove from Board in the card menu', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for cards to load
    await expect(
      page.locator('[data-testid^="overflow-menu-trigger-"]').first(),
    ).toBeVisible({ timeout: 10000 })

    // Open overflow menu
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await overflowMenuTrigger.click()

    // Wait for dropdown menu
    const dropdownMenu = page.getByTestId('overflow-menu')
    await expect(dropdownMenu).toBeVisible({ timeout: 5000 })

    // Remove from Board should be visible
    const removeMenuItem = page
      .locator('[data-testid^="remove-from-board-"]')
      .first()
    await expect(removeMenuItem).toBeVisible()

    // Move to Another Board, the way to keep the note, should be visible too
    const moveMenuItem = page
      .locator('[data-testid^="move-to-another-board-"]')
      .first()
    await expect(moveMenuItem).toBeVisible()

    // Close the menu
    await page.keyboard.press('Escape')
  })
})

test.describe('Remove from Board - Keyboard Accessibility', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('should close confirmation dialog with Escape key', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for cards to load
    await expect(
      page.locator('[data-testid^="overflow-menu-trigger-"]').first(),
    ).toBeVisible({ timeout: 10000 })

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

  test('puts the keyboard focus on the next card of the column after a confirmed removal', async ({
    page,
  }) => {
    // Arrange: Planning holds card-1, card-4 and card-5, top to bottom
    await resetRepoCards()
    const cardId = CARD_IDS.card1
    await page.goto(BOARD_URL)
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${cardId}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 15000 })
    await overflowMenuTrigger.click()
    await page.locator(`[data-testid="remove-from-board-${cardId}"]`).click()

    // Act
    await page.locator(`[data-testid="confirm-remove-${cardId}"]`).click()

    // Assert: card-4 has the focus, also once card-1 has left the page
    const nextCard = page.locator(`[data-repo-card-id="${CARD_IDS.card4}"]`)
    await expect(nextCard).toBeFocused({ timeout: 10000 })
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).toHaveCount(0, { timeout: 10000 })
    await expect(nextCard).toBeFocused()

    // Cleanup: wait for the delete to land so the reset is not undone by it
    await expect(async () => {
      expect(await querySingle('repocard', { id: cardId })).toBeNull()
    }).toPass({ timeout: 10000 })
    await resetRepoCards()
  })

  test("puts the keyboard focus on the column's Add Repo button after its only card was removed", async ({
    page,
  }) => {
    // Arrange: Pending holds card-3 and nothing else
    await resetRepoCards()
    const cardId = CARD_IDS.card3
    await page.goto(BOARD_URL)
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${cardId}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 15000 })
    await overflowMenuTrigger.click()
    await page.locator(`[data-testid="remove-from-board-${cardId}"]`).click()

    // Act
    await page.locator(`[data-testid="confirm-remove-${cardId}"]`).click()

    // Assert: the button of that column has the focus, also once the card
    // has left the page. A card of another column would be the wrong place.
    const addRepoButtonOfPending = page.locator(
      `[data-status-column-id="${STATUS_IDS.pending}"] [data-column-add-repo]`,
    )
    await expect(addRepoButtonOfPending).toBeFocused({ timeout: 10000 })
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).toHaveCount(0, { timeout: 10000 })
    await expect(addRepoButtonOfPending).toBeFocused()
    await expect(addRepoButtonOfPending).toHaveText('Add Repo')

    // Cleanup: wait for the delete to land so the reset is not undone by it
    await expect(async () => {
      expect(await querySingle('repocard', { id: cardId })).toBeNull()
    }).toPass({ timeout: 10000 })
    await resetRepoCards()
  })

  test('puts the keyboard focus back on the card when the removal is cancelled', async ({
    page,
  }) => {
    // Arrange
    const cardId = CARD_IDS.card1
    await page.goto(BOARD_URL)
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${cardId}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 15000 })
    await overflowMenuTrigger.click()
    await page.locator(`[data-testid="remove-from-board-${cardId}"]`).click()
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 5000 })

    // Act
    await alertDialog.getByRole('button', { name: 'Cancel' }).click()

    // Assert
    await expect(alertDialog).toBeHidden({ timeout: 5000 })
    await expect(page.locator(`[data-repo-card-id="${cardId}"]`)).toBeFocused({
      timeout: 10000,
    })
  })
})
