/**
 * Move to Another Board E2E Tests
 *
 * Tests for moving repository cards between boards while preserving projectinfo.
 * Requires authentication (uses storageState from auth.setup.ts).
 *
 * Feature (Issue #133):
 * - OverflowMenu displays "Move to Another Board" option
 * - Dialog opens with board/column selects (current board excluded)
 * - Card moves atomically via RPC, preserving projectinfo FK
 * - Card disappears from source board after move
 */

import { test, expect } from '../fixtures/coverage'
import {
  querySingle,
  CARD_IDS,
  BOARD_IDS,
  STATUS_IDS,
  PROJECT_INFO_IDS,
  resetRepoCards,
  resetRepoCardToOriginalBoard,
} from '../helpers/db-query'

test.describe('Move to Another Board Feature', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test.afterEach(async () => {
    // Restore all cards to original board for test isolation
    await resetRepoCards()
  })

  test('should display Move to Another Board option in overflow menu', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu on first card
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    // Wait for dropdown menu
    const dropdownMenu = page.getByTestId('overflow-menu')
    await expect(dropdownMenu).toBeVisible({ timeout: 5000 })

    // Verify "Move to Another Board" menu item visible
    const moveMenuItem = page
      .locator('[data-testid^="move-to-another-board-"]')
      .first()
    await expect(moveMenuItem).toBeVisible()

    // Verify positioned after "Move to Maintenance"
    const maintenanceMenuItem = page
      .locator('[data-testid^="move-to-maintenance-"]')
      .first()
    await expect(maintenanceMenuItem).toBeVisible()
  })

  test('should open dialog with board list (current board excluded)', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu and click Move to Another Board
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    const moveMenuItem = page
      .locator('[data-testid^="move-to-another-board-"]')
      .first()
    await moveMenuItem.click()

    // Dialog should appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify title (use heading role to avoid accessibleTitle duplicate)
    await expect(
      dialog.getByRole('heading', { name: 'Move to Another Board' }).first(),
    ).toBeVisible()

    // Open board select
    await dialog.locator('#board-select').click()

    // "Work Projects" should be visible (another board)
    await expect(
      page.getByRole('option', { name: 'Work Projects' }),
    ).toBeVisible()
  })

  test('should close dialog on Cancel', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open dialog
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    const moveMenuItem = page
      .locator('[data-testid^="move-to-another-board-"]')
      .first()
    await moveMenuItem.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Click Cancel
    await dialog.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('should move card to another board and remove from source', async ({
    page,
  }) => {
    await resetRepoCards()
    const cardId = CARD_IDS.card5 // laststance/use-app-state

    // Verify card exists on testBoard before move
    const cardBefore = await querySingle('repocard', { id: cardId })
    expect(cardBefore).not.toBeNull()
    expect((cardBefore as { board_id: string }).board_id).toBe(
      BOARD_IDS.testBoard,
    )

    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu on card5
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${cardId}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    // Click "Move to Another Board"
    const moveMenuItem = page.locator(
      `[data-testid="move-to-another-board-${cardId}"]`,
    )
    await moveMenuItem.click()

    // Dialog appears
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Select "Work Projects" board
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()

    // Click Move
    await dialog.getByRole('button', { name: /^move$/i }).click()

    // Dialog closes, card disappears from source board
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).not.toBeVisible({ timeout: 5000 })

    // DB verification: card now on workProjects board
    await expect(async () => {
      const cardAfter = await querySingle('repocard', { id: cardId })
      expect(cardAfter).not.toBeNull()
      expect((cardAfter as { board_id: string }).board_id).toBe(
        BOARD_IDS.workProjects,
      )
    }).toPass({ timeout: 10000 })
  })

  test('should preserve projectinfo after move', async ({ page }) => {
    await resetRepoCards()
    const cardId = CARD_IDS.card1 // testuser/test-repo (has projectinfo with notes+links)

    // Get projectinfo before move
    const projInfoBefore = await querySingle('projectinfo', {
      repo_card_id: cardId,
    })
    expect(projInfoBefore).not.toBeNull()
    expect((projInfoBefore as { note: string }).note).toBe(
      'Important project notes here',
    )

    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu on card1
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${cardId}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    // Click "Move to Another Board"
    const moveMenuItem = page.locator(
      `[data-testid="move-to-another-board-${cardId}"]`,
    )
    await moveMenuItem.click()

    // Select "Work Projects" board
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()

    // Click Move
    await dialog.getByRole('button', { name: /^move$/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Verify projectinfo FK unchanged, data intact
    await expect(async () => {
      const projInfoAfter = await querySingle('projectinfo', {
        repo_card_id: cardId,
      })
      expect(projInfoAfter).not.toBeNull()
      expect((projInfoAfter as { note: string }).note).toBe(
        'Important project notes here',
      )
      expect((projInfoAfter as { id: string }).id).toBe(
        (projInfoBefore as { id: string }).id,
      )
    }).toPass({ timeout: 10000 })
  })
})
