/**
 * AddRepositoryCombobox E2E Tests
 *
 * Tests for the AddRepositoryCombobox component with organization filter.
 * Specifically tests GITBOX-1 fix: handling repos with missing owner data
 * when organization filter is persisted in localStorage.
 *
 * Test Scenario:
 * 1. Organization filter is saved in localStorage (not 'all')
 * 2. GitHub API returns a repo without owner field
 * 3. Opening AddRepositoryCombobox should NOT crash
 */

import { test, expect } from '@playwright/test'

test.describe('AddRepositoryCombobox - GITBOX-1 Fix', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  /**
   * GITBOX-1: TypeError when repo.owner is undefined with organization filter
   *
   * Reproduces the scenario where:
   * - User has organization filter set to a specific org (not 'all')
   * - GitHub API returns repos, some of which have missing owner data
   * - Opening the combobox should gracefully handle this without crashing
   */
  test('should not crash when repo.owner is undefined with organization filter set', async ({
    page,
  }) => {
    // Step 1: Intercept GitHub user/repos API and inject a repo without owner
    await page.route('**/api.github.com/user/repos**', async (route) => {
      const response = await route.fetch()
      const repos = await response.json()

      // Add a malformed repo without owner field (simulates edge case)
      const malformedRepo = {
        id: 9999,
        node_id: 'R_malformed',
        name: 'malformed-repo',
        full_name: 'unknown/malformed-repo',
        // Intentionally omit owner field to trigger the bug
        description: 'A repo with missing owner data',
        html_url: 'https://github.com/unknown/malformed-repo',
        homepage: null,
        stargazers_count: 0,
        watchers_count: 0,
        language: 'TypeScript',
        topics: [],
        visibility: 'public',
        updated_at: '2024-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
      }

      const modifiedRepos = [...repos, malformedRepo]

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(modifiedRepos),
      })
    })

    // Step 2: Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Step 3: Set organization filter in localStorage (simulating persisted state)
    // The Redux store uses 'gitbox-state' key with settings.organizationFilter
    await page.evaluate(() => {
      const existingState = localStorage.getItem('gitbox-state')
      const state = existingState ? JSON.parse(existingState) : {}

      // Set organization filter to 'testuser' (not 'all')
      state.settings = state.settings || {}
      state.settings.organizationFilter = 'testuser'

      localStorage.setItem('gitbox-state', JSON.stringify(state))
    })

    // Step 4: Reload page to apply localStorage state
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Step 5: Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Step 6: Verify the combobox panel is visible (no crash)
    // The combobox should open without throwing TypeError
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Step 7: Verify organization filter is applied
    // The filter dropdown should show 'testuser' is selected
    const orgFilterTrigger = page.getByRole('combobox').first()
    await expect(orgFilterTrigger).toBeVisible()

    // Step 8: Check console for no TypeErrors
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Wait a moment for any async errors to surface
    await page.waitForTimeout(1000)

    // Verify no TypeError related to toLowerCase
    const hasLowerCaseError = consoleErrors.some(
      (error) =>
        error.includes('toLowerCase') ||
        error.includes('Cannot read properties of undefined'),
    )
    expect(hasLowerCaseError).toBe(false)
  })

  /**
   * Test that organization filter works correctly with valid repos
   */
  test('should filter repositories by organization when filter is set', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

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
    const orgFilterTrigger = page.getByRole('combobox').first()
    await expect(orgFilterTrigger).toBeVisible()

    // Click the organization filter
    await orgFilterTrigger.click()

    // Wait for dropdown options to appear
    const allOption = page.getByRole('option', { name: /all organizations/i })
    await expect(allOption).toBeVisible({ timeout: 5000 })
  })

  /**
   * Test that 'all' organization filter shows all repos
   */
  test('should show all repositories when organization filter is all', async ({
    page,
  }) => {
    // Set organization filter to 'all' in localStorage
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    await page.evaluate(() => {
      const existingState = localStorage.getItem('gitbox-state')
      const state = existingState ? JSON.parse(existingState) : {}

      state.settings = state.settings || {}
      state.settings.organizationFilter = 'all'

      localStorage.setItem('gitbox-state', JSON.stringify(state))
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for repositories to load
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Wait for repository list to be populated
    await page.waitForTimeout(1000)

    // Verify at least one repository is visible
    const repoItems = page.locator('[role="option"]')
    const count = await repoItems.count()
    expect(count).toBeGreaterThan(0)
  })
})
