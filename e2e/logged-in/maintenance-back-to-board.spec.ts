/**
 * Maintenance Page - Back to Board Navigation E2E Tests
 *
 * Tests for the "Back to Board" link on the Maintenance page.
 * The link appears when the user has previously visited a board,
 * allowing quick navigation back to their last viewed board.
 *
 * @remarks
 * localStorage key: 'gitbox:lastVisitedBoard'
 * Stored data: { id: string, name: string }
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('Maintenance Page - Back to Board Navigation', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`
  const MAINTENANCE_URL = '/maintenance'

  test('should not show Back to Board link when no board has been visited', async ({
    page,
  }) => {
    // Clear any existing localStorage before navigating
    await page.goto(MAINTENANCE_URL)
    await page.evaluate(() => {
      localStorage.removeItem('gitbox:lastVisitedBoard')
    })

    // Reload to apply clean state
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Back to Board link should NOT be visible
    const backLink = page.getByRole('link', { name: /back/i })
    await expect(backLink).not.toBeVisible()
  })

  test('should show Back to Board link after visiting a board', async ({
    page,
  }) => {
    // First, visit a board to set localStorage
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for board to load (confirms localStorage is set)
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })

    // Verify localStorage was set
    const storedBoard = await page.evaluate(() => {
      return localStorage.getItem('gitbox:lastVisitedBoard')
    })
    expect(storedBoard).not.toBeNull()
    const parsedBoard = JSON.parse(storedBoard!)
    expect(parsedBoard).toHaveProperty('id')
    expect(parsedBoard).toHaveProperty('name')

    // Navigate to maintenance page
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Back to Board link should be visible
    const backLink = page.getByRole('link', { name: /back/i })
    await expect(backLink).toBeVisible()
  })

  test('should display board name in Back to Board link', async ({ page }) => {
    // First, visit a board to set localStorage
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for board to load
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })

    // Get the board name from localStorage
    const storedBoard = await page.evaluate(() => {
      return localStorage.getItem('gitbox:lastVisitedBoard')
    })
    const parsedBoard = JSON.parse(storedBoard!)
    const boardName = parsedBoard.name

    // Navigate to maintenance page
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // On desktop, link should include board name
    // Check for "Back to {boardName}" text
    const backToText = page.getByText(new RegExp(`Back to ${boardName}`, 'i'))
    await expect(backToText).toBeVisible()
  })

  test('should navigate to board when clicking Back to Board link', async ({
    page,
  }) => {
    // First, visit a board to set localStorage
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for board to load
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })

    // Navigate to maintenance page
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Click the Back to Board link
    const backLink = page.getByRole('link', { name: /back/i })
    await expect(backLink).toBeVisible()
    await backLink.click()

    // Should navigate to the board page
    await expect(page).toHaveURL(new RegExp(BOARD_IDS.testBoard))
    await page.waitForLoadState('networkidle')

    // Board should be visible
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })
  })

  test('should update localStorage when visiting different boards', async ({
    page,
  }) => {
    // Visit first board
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })

    // Check first board in localStorage
    const firstBoard = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('gitbox:lastVisitedBoard')!)
    })
    expect(firstBoard.id).toBe(BOARD_IDS.testBoard)

    // Visit second board
    await page.goto(`/board/${BOARD_IDS.workProjects}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })

    // Check second board in localStorage
    const secondBoard = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('gitbox:lastVisitedBoard')!)
    })
    expect(secondBoard.id).toBe(BOARD_IDS.workProjects)

    // Navigate to maintenance and verify link goes to second board
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Click back link
    const backLink = page.getByRole('link', { name: /back/i })
    await backLink.click()

    // Should navigate to second board
    await expect(page).toHaveURL(new RegExp(BOARD_IDS.workProjects))
  })

  test('should show shortened text on mobile viewport', async ({ page }) => {
    // First, visit a board to set localStorage
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Navigate to maintenance page
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // On mobile, should show just "Back" (the sm:hidden span is hidden)
    const backLink = page.getByRole('link', { name: /back/i })
    await expect(backLink).toBeVisible()

    // The link should contain "Back" text
    await expect(backLink).toContainText('Back')
  })
})
