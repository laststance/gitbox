/**
 * Page Title E2E Tests - Authenticated Pages
 *
 * Verifies that page titles follow the correct format:
 * - Template: "{PageTitle} | GitBox"
 * - No duplicate "GitBox" in titles
 *
 * Requires authentication (uses storageState from auth.setup.ts)
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Page Titles (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('boards page title should be "My Boards | GitBox"', async ({ page }) => {
    await page.goto('/boards')
    await expect(page).toHaveTitle('My Boards | GitBox')
  })

  test('favorites page title should be "Favorites | GitBox"', async ({
    page,
  }) => {
    await page.goto('/boards/favorites')
    await expect(page).toHaveTitle('Favorites | GitBox')
  })

  test('create board page title should be "Create Board | GitBox"', async ({
    page,
  }) => {
    await page.goto('/boards/new')
    await expect(page).toHaveTitle('Create Board | GitBox')
  })

  test('settings page title should be "Settings | GitBox"', async ({
    page,
  }) => {
    await page.goto('/settings')
    await expect(page).toHaveTitle('Settings | GitBox')
  })

  test('maintenance page title should be "Maintenance | GitBox"', async ({
    page,
  }) => {
    await page.goto('/maintenance')
    await expect(page).toHaveTitle('Maintenance | GitBox')
  })

  test('account page title should be "Account | GitBox"', async ({ page }) => {
    await page.goto('/account')
    await expect(page).toHaveTitle('Account | GitBox')
  })

  test('board detail page title should be "{BoardName} | GitBox"', async ({
    page,
  }) => {
    // Navigate to boards first to get a board ID
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Click first board
    const boardLink = page.locator('a[href*="/board/"]').first()
    await boardLink.click()

    // Wait for navigation
    await expect(page).toHaveURL(/\/board\//)

    // Title should follow the pattern "{BoardName} | GitBox"
    // MSW mock returns "Test Board" as the default board name
    const title = await page.title()

    // Verify format: should have exactly one " | GitBox" suffix
    expect(title).toMatch(/^.+ \| GitBox$/)

    // Verify no duplicate GitBox
    const gitboxCount = (title.match(/GitBox/gi) || []).length
    expect(gitboxCount).toBe(1)
  })

  test('no authenticated page should have duplicate GitBox in title', async ({
    page,
  }) => {
    const authenticatedPages = [
      '/boards',
      '/boards/favorites',
      '/boards/new',
      '/settings',
      '/maintenance',
      '/account',
    ]

    for (const path of authenticatedPages) {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      const title = await page.title()
      const gitboxCount = (title.match(/GitBox/gi) || []).length

      expect(gitboxCount, `${path} has duplicate GitBox: "${title}"`).toBe(1)
    }
  })
})
