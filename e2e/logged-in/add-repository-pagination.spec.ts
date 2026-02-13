/**
 * AddRepositoryCombobox E2E Tests - Pagination
 *
 * Tests for the pagination feature in AddRepositoryCombobox.
 * These tests verify the UI behavior when repositories are loaded.
 *
 * Note: The actual GitHub API pagination is tested in unit tests at
 * tests/unit/lib/actions/github-pagination.test.ts
 *
 * Bug Fix: GitHub API pagination (2025-12-30)
 * - Previously, only the first 100 repos were fetched from GitHub API
 * - Now uses fetchAll: true to paginate through all available repos
 *
 * @see lib/actions/github.ts
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('AddRepositoryCombobox - Pagination UI', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  /**
   * Verifies the combobox loads and displays available repositories
   *
   * This test ensures the repository loading mechanism works correctly
   * and repositories are displayed in the combobox.
   */
  test('should load and display repositories in combobox', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for the combobox panel to be visible
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Wait for repository list to load
    await expect(page.locator('[role="option"]').first()).toBeVisible({
      timeout: 10000,
    })
  })

  /**
   * Verifies search functionality works correctly
   *
   * This test ensures the search/filter mechanism works
   * to help users find specific repositories.
   */
  test('should filter repositories when searching', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for the combobox panel to be visible
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Wait for repository list to load (at least one option should appear)
    await expect(page.locator('[role="option"]').first()).toBeVisible({
      timeout: 10000,
    })

    // Search for a specific term
    await searchInput.fill('private')

    // Wait for search to filter — results should contain the search term
    await expect(async () => {
      const filteredCount = await page.locator('[role="option"]').count()
      expect(filteredCount).toBeGreaterThan(0)
      // Verify the first visible option matches the search term
      const firstOptionText = await page
        .locator('[role="option"]')
        .first()
        .textContent()
      expect(firstOptionText?.toLowerCase()).toContain('private')
    }).toPass({ timeout: 5000 })
  })

  /**
   * Verifies the organization filter dropdown is present and functional
   *
   * This tests the UI component that allows filtering by organization,
   * which works in conjunction with the pagination feature.
   */
  test('should display organization filter dropdown', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for the combobox panel to be visible
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Verify organization filter selector is present
    const orgFilterTrigger = page.getByRole('combobox', {
      name: /organization filter/i,
    })
    await expect(orgFilterTrigger).toBeVisible()
  })

  /**
   * Verifies that selecting a repository adds it to selection
   *
   * This test ensures the selection mechanism works correctly.
   */
  test('should allow selecting repositories', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for the combobox panel to be visible
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Wait for repository list to load (at least one option should appear)
    await expect(page.locator('[role="option"]').first()).toBeVisible({
      timeout: 10000,
    })

    // Get all repository options
    const repoOptions = page.locator('[role="option"]')
    const optionCount = await repoOptions.count()

    if (optionCount > 0) {
      // Click the first available option
      await repoOptions.first().click()

      // Verify the Add button shows a count
      const addButton = page.getByRole('button', { name: /add \(\d+\)/i })
      await expect(addButton).toBeVisible({ timeout: 5000 })
    }
  })

  /**
   * Verifies Cancel button closes the combobox
   */
  test('should close combobox when clicking Cancel', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for the combobox panel to be visible
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Click Cancel button
    const cancelButton = page.getByRole('button', { name: /cancel/i })
    await expect(cancelButton).toBeVisible()
    await cancelButton.click()

    // Verify combobox is closed
    await expect(searchInput).not.toBeVisible({ timeout: 5000 })
  })

  /**
   * Verifies the combobox can be reopened after closing
   */
  test('should allow reopening combobox after closing', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for Kanban board to load
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for the combobox panel to be visible
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Close via Cancel
    const cancelButton = page.getByRole('button', { name: /cancel/i })
    await cancelButton.click()
    await expect(searchInput).not.toBeVisible({ timeout: 5000 })

    // Reopen
    await addRepoButton.click()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })
})
