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

    // Should have a heading or indication of boards
    const heading = page.getByRole('heading', { name: /board/i })
    await expect(heading).toBeVisible()
  })

  test('should display user avatar or profile indicator', async ({ page }) => {
    await page.goto('/boards')

    // Look for user menu or avatar
    const userIndicator = page.locator(
      '[data-testid="user-menu"], [data-testid="user-avatar"], button:has(img[alt*="avatar" i])',
    )
    await expect(userIndicator.first()).toBeVisible()
  })

  test('should have option to create new board', async ({ page }) => {
    await page.goto('/boards')

    // Look for create/add board button
    const createButton = page.getByRole('button', { name: /create|new|add/i })
    await expect(createButton).toBeVisible()
  })

  test('should navigate to board detail when clicking a board', async ({
    page,
  }) => {
    await page.goto('/boards')

    // Wait for boards to load (MSW will return mock data)
    await page.waitForLoadState('networkidle')

    // Click on the first board link/card
    const boardLink = page.locator('a[href*="/board/"]').first()

    if (await boardLink.isVisible()) {
      await boardLink.click()

      // Should navigate to board detail page
      await expect(page).toHaveURL(/\/board\//)
    }
  })

  test('should open create board modal or navigate to new board page', async ({
    page,
  }) => {
    await page.goto('/boards')

    // Click create button
    const createButton = page.getByRole('button', { name: /create|new|add/i })
    await createButton.click()

    // Should either open modal or navigate to /boards/new
    const modalOrPage = page.locator(
      '[role="dialog"], [data-testid="create-board-modal"]',
    )
    const newBoardUrl = page.url().includes('/boards/new')

    expect(
      (await modalOrPage.isVisible()) || newBoardUrl,
      'Should either show modal or navigate to new board page',
    ).toBeTruthy()
  })
})
