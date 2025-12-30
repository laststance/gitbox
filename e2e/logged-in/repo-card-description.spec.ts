/**
 * RepoCard Description Persistence E2E Tests
 *
 * Tests that RepoCard descriptions (from meta.description) are correctly
 * displayed and persist after navigation.
 *
 * Bug Fix: RepoCard description disappears after navigation
 * - Issue: Description showed on initial load but disappeared after navigating away and back
 * - Root cause: getRepoCards() was using row.note instead of meta.description
 * - Fix: Changed to use meta.description for card descriptions
 */

import { test, expect } from '../fixtures/coverage'

test.describe('RepoCard Description Persistence', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'
  const FAVORITES_URL = '/boards/favorites'

  /**
   * Verifies that card descriptions from meta.description are displayed
   *
   * The mock data has cards with description in meta:
   * - card-1: "A test repository for GitBox"
   * - card-2: "Another test repository"
   * - card-3: "Create React App + Vite template"
   */
  test('should display card descriptions from meta.description', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })

    // Wait for cards to be rendered
    await page.waitForTimeout(1000)

    // Get all visible card descriptions (descriptions are shown under card titles)
    // These descriptions come from meta.description, not from note

    // Check for specific descriptions from mock data
    // card-1: "A test repository for GitBox"
    const description1 = page.getByText('A test repository for GitBox')
    await expect(description1).toBeVisible({ timeout: 10000 })

    // card-2: "Another test repository"
    const description2 = page.getByText('Another test repository')
    await expect(description2).toBeVisible({ timeout: 10000 })

    // card-3: "Create React App + Vite template"
    const description3 = page.getByText('Create React App + Vite template')
    await expect(description3).toBeVisible({ timeout: 10000 })
  })

  /**
   * Verifies that descriptions persist after navigating away and back
   *
   * This is the main regression test for the bug:
   * 1. Load board (descriptions visible)
   * 2. Navigate to favorites
   * 3. Navigate back to board
   * 4. Descriptions should still be visible
   */
  test('should persist descriptions after navigation to favorites and back', async ({
    page,
  }) => {
    // Step 1: Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Verify descriptions are visible initially
    const description1 = page.getByText('A test repository for GitBox')
    await expect(description1).toBeVisible({ timeout: 10000 })

    // Step 2: Navigate to favorites page
    const favoritesLink = page.getByRole('link', { name: /favorites/i })
    await favoritesLink.click()
    await expect(page).toHaveURL(/\/boards\/favorites/)
    await page.waitForLoadState('domcontentloaded')

    // Step 3: Navigate back to board
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Step 4: Verify descriptions are still visible after navigation
    // This was the bug - descriptions would disappear after navigation
    await expect(description1).toBeVisible({ timeout: 10000 })

    const description2 = page.getByText('Another test repository')
    await expect(description2).toBeVisible({ timeout: 10000 })

    const description3 = page.getByText('Create React App + Vite template')
    await expect(description3).toBeVisible({ timeout: 10000 })
  })

  /**
   * Verifies that descriptions persist after browser refresh
   */
  test('should persist descriptions after page refresh', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Verify descriptions are visible initially
    const description1 = page.getByText('A test repository for GitBox')
    await expect(description1).toBeVisible({ timeout: 10000 })

    // Refresh the page
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Verify descriptions are still visible after refresh
    await expect(description1).toBeVisible({ timeout: 10000 })

    const description2 = page.getByText('Another test repository')
    await expect(description2).toBeVisible({ timeout: 10000 })
  })

  /**
   * Verifies that descriptions are correctly associated with their cards
   *
   * Each card should show the correct description from meta.description,
   * not from note field or topics.
   */
  test('should show correct description for each card', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Find the card containers by their data-testid
    const cards = page.locator('[data-testid^="repo-card-"]')
    const cardCount = await cards.count()

    // Should have multiple cards
    expect(cardCount).toBeGreaterThan(0)

    // Verify card-1 (test-repo) has correct description
    const card1 = page.locator('[data-testid="repo-card-card-1"]')
    const card1Visible = (await card1.count()) > 0

    if (card1Visible) {
      // The card should contain its description
      // Note: Description is NOT the same as note
      // Description comes from meta.description (GitHub repo description)
      const descriptionInCard = card1.getByText('A test repository for GitBox')
      await expect(descriptionInCard).toBeVisible({ timeout: 5000 })
    }

    // Verify card-2 (another-repo) has correct description
    const card2 = page.locator('[data-testid="repo-card-card-2"]')
    const card2Visible = (await card2.count()) > 0

    if (card2Visible) {
      const descriptionInCard = card2.getByText('Another test repository')
      await expect(descriptionInCard).toBeVisible({ timeout: 5000 })
    }
  })

  /**
   * Verifies that empty descriptions don't cause rendering issues
   *
   * Cards with null/undefined/empty meta.description should render
   * without errors and not show any placeholder text.
   */
  test('should handle cards without descriptions gracefully', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // The page should load without errors
    // All cards with descriptions should be visible
    const cards = page.locator('[data-testid^="repo-card-"]')
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThan(0)

    // No error messages should be visible
    const errorElements = page.locator('[role="alert"]')
    const errorCount = await errorElements.count()

    // If there are any alerts, they should not contain error messages
    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent()
        expect(errorText?.toLowerCase()).not.toContain('error')
      }
    }
  })
})
