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
