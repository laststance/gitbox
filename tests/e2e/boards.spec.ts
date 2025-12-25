/**
 * Boards Page E2E Tests
 *
 * Tests for the authenticated boards list page
 * Requires authentication (uses storageState from auth.setup.ts)
 */

import { test, expect } from '@playwright/test'

test.describe('Boards Page (Authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('should display the boards list page', async ({ page }) => {
    await page.goto('/boards')

    // Should show the boards page (not redirected to login)
    await expect(page).toHaveURL(/\/boards/)

    // Wait for main heading to appear
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('should display user avatar or profile indicator', async ({ page }) => {
    await page.goto('/boards')

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Look for user info section (Test User text or avatar)
    const userIndicator = page.locator(
      'img[alt="Test User"], :text("Test User")',
    )
    await expect(userIndicator.first()).toBeVisible({ timeout: 10000 })
  })

  test('should have option to create new board', async ({ page }) => {
    await page.goto('/boards')

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Look for create board link (it's a link, not a button based on the snapshot)
    const createLink = page.getByRole('link', { name: /create board/i })
    await expect(createLink).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to board detail when clicking a board', async ({
    page,
  }) => {
    await page.goto('/boards')

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Click on the first board link/card
    const boardLink = page.locator('a[href*="/board/"]').first()
    await expect(boardLink).toBeVisible({ timeout: 10000 })
    await boardLink.click()

    // Should navigate to board detail page
    await expect(page).toHaveURL(/\/board\//)
  })

  test('should open create board modal or navigate to new board page', async ({
    page,
  }) => {
    await page.goto('/boards')

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Click create board link
    const createLink = page.getByRole('link', { name: /create board/i })
    await createLink.click()

    // Should navigate to /boards/new
    await expect(page).toHaveURL(/\/boards\/new/)
  })
})
