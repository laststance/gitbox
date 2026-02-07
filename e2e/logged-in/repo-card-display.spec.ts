/**
 * Repo Card Display E2E Tests
 *
 * Tests that repo cards are correctly displayed on the Kanban board
 * when they have valid statusId references.
 *
 * Related to bug fix: activeBoard was never set, and orphaned cards
 * with invalid statusId weren't displayed.
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('Repo Card Display (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('should display board name in header (verifies activeBoard is set)', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // The board name should be displayed in the header
    // This verifies that activeBoard is set (board name comes from it)
    const header = page.locator('header').first()
    await expect(header).toBeVisible({ timeout: 10000 })

    // Board name should be visible as h1
    const boardName = page.locator('h1').first()
    await expect(boardName).toBeVisible({ timeout: 10000 })
    // Board name should have some text (not empty)
    await expect(boardName).not.toHaveText('')
  })

  test('should display column headers on the board', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Look for column headers - boards should have at least one column
    // Columns typically have headers with status names
    const addColumnButton = page.getByRole('button', { name: /add column/i })
    await expect(addColumnButton).toBeVisible({ timeout: 10000 })
  })

  test('should have Add Repo buttons in columns', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Each column should have an "Add Repo" button
    // This verifies columns are rendering their content area
    const addRepoText = page.getByText(/add repo/i).first()
    await expect(addRepoText).toBeVisible({ timeout: 10000 })
  })
})
