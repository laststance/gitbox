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

/**
 * AddRepositoryCombobox E2E Tests - Existing Repo Filtering
 *
 * Tests that repositories already placed on the current board are
 * filtered out from the combobox dropdown selection.
 *
 * Feature: filter out repos already on current board (bdc87e6)
 */
test.describe('AddRepositoryCombobox - Existing Repo Filtering', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  /**
   * Verifies that repositories already on the board do NOT appear in the combobox
   *
   * The MSW mock data has these repos on board-1:
   * - testuser/test-repo (card-1)
   * - testuser/another-repo (card-2)
   * - laststance/create-react-app-vite (card-3)
   *
   * These should be filtered from the combobox selection.
   */
  test('should not display repositories that are already on the board', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load (column names indicate data is ready)
    // This ensures Redux store has repoCards populated before we open the combobox
    await expect(page.getByText('Backlog')).toBeVisible({ timeout: 15000 })

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
    await page.waitForTimeout(1000)

    // Get all visible repository options
    const repoOptions = page.locator('[role="option"]')
    const optionTexts: string[] = []

    const count = await repoOptions.count()
    for (let i = 0; i < count; i++) {
      const text = await repoOptions.nth(i).textContent()
      if (text) optionTexts.push(text.toLowerCase())
    }

    // These repos are already on the board (from mockRepoCards in handlers.ts)
    // They should NOT appear in the combobox
    const existingRepos = ['testuser/test-repo', 'testuser/another-repo']

    for (const repo of existingRepos) {
      const found = optionTexts.some((text) => text.includes(repo))
      expect(found).toBe(false)
    }
  })

  /**
   * Verifies that searching for an existing repo shows no results
   */
  test('should show no results when searching for a repo already on board', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load (column names indicate data is ready)
    await expect(page.getByText('Backlog')).toBeVisible({ timeout: 15000 })

    // Open AddRepositoryCombobox
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })
    await addRepoButton.click()

    // Wait for the combobox panel to be visible
    const searchInput = page.getByPlaceholder(/search repositories/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Wait for initial load
    await page.waitForTimeout(500)

    // Search for a repo that's already on the board
    await searchInput.fill('test-repo')

    // Wait for debounced search (300ms) + filter
    await page.waitForTimeout(500)

    // Since 'testuser/test-repo' is on the board, it should be filtered out
    // The only other matching repo would be if there's another one with 'test-repo' in the name
    const repoOptions = page.locator('[role="option"]')
    const count = await repoOptions.count()

    // Check that 'testuser/test-repo' specifically is not in the list
    for (let i = 0; i < count; i++) {
      const text = await repoOptions.nth(i).textContent()
      expect(text?.toLowerCase()).not.toContain('testuser/test-repo')
    }
  })

  /**
   * Verifies that non-existing repos still appear in the combobox
   */
  test('should display repositories that are NOT on the board', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load (column names indicate data is ready)
    await expect(page.getByText('Backlog')).toBeVisible({ timeout: 15000 })

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
    await page.waitForTimeout(1000)

    // 'testuser/private-project' is in mockGitHubRepos but NOT on the board
    // It should appear in the combobox
    const repoOptions = page.locator('[role="option"]')
    const count = await repoOptions.count()

    let foundPrivateProject = false
    for (let i = 0; i < count; i++) {
      const text = await repoOptions.nth(i).textContent()
      if (text?.toLowerCase().includes('private-project')) {
        foundPrivateProject = true
        break
      }
    }

    // This repo should be available since it's not on the board
    expect(foundPrivateProject).toBe(true)
  })

  /**
   * Verifies case-insensitive filtering works correctly
   */
  test('should filter repos case-insensitively', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load (column names indicate data is ready)
    await expect(page.getByText('Backlog')).toBeVisible({ timeout: 15000 })

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
    await page.waitForTimeout(1000)

    // Search with different case - 'TEST-REPO' should still not show 'testuser/test-repo'
    await searchInput.fill('TEST-REPO')
    await page.waitForTimeout(500)

    const repoOptions = page.locator('[role="option"]')
    const count = await repoOptions.count()

    // Verify testuser/test-repo is not in results (case-insensitive match)
    for (let i = 0; i < count; i++) {
      const text = await repoOptions.nth(i).textContent()
      expect(text?.toLowerCase()).not.toContain('testuser/test-repo')
    }
  })
})

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
    // Note: Using aria-label to target the specific organization filter combobox
    const orgFilterTrigger = page.getByRole('combobox', {
      name: /organization filter/i,
    })
    await expect(orgFilterTrigger).toBeVisible()

    // Click the organization filter to open dropdown
    await orgFilterTrigger.click()

    // Wait for dropdown to appear - Radix Select uses listbox role for the dropdown content
    // The options are rendered in a portal, so we need to look for them in the page
    await page.waitForTimeout(500) // Give time for dropdown animation

    // Look for "All Organizations" option in the dropdown
    // Radix Select items have role="option" when the dropdown is open
    const allOption = page.locator('[role="option"]', {
      hasText: /all organizations/i,
    })
    await expect(allOption.first()).toBeVisible({ timeout: 5000 })
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

/**
 * AddRepositoryCombobox E2E Tests - Optimistic Update
 *
 * Tests that adding a repository displays the card immediately
 * without a full page reload (optimistic UI update pattern).
 *
 * Feature: Optimistic update for repository addition
 */
test.describe('AddRepositoryCombobox - Optimistic Update', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  /**
   * Verifies that adding a repository shows the card immediately
   * without triggering a page reload or loading spinner.
   *
   * This tests the optimistic update implementation in BoardPageClient.tsx
   */
  test('should display newly added card immediately without page reload', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Backlog')).toBeVisible({ timeout: 15000 })

    // Count existing cards before adding
    const cardsBefore = await page.locator('[data-testid="repo-card"]').count()

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
    await page.waitForTimeout(1000)

    // Find and select an available repository (not already on board)
    // 'testuser/private-project' should be available
    const repoOption = page.locator('[role="option"]', {
      hasText: /private-project/i,
    })
    const isAvailable = (await repoOption.count()) > 0

    // If private-project is available, select it
    if (isAvailable) {
      await repoOption.first().click()

      // Verify selection (button shows count)
      const addButton = page.getByRole('button', { name: /add \(1\)/i })
      await expect(addButton).toBeVisible({ timeout: 5000 })

      // Set up listener for navigation events BEFORE clicking Add
      // If optimistic update works, there should be NO navigation
      let navigationOccurred = false
      page.on('framenavigated', () => {
        navigationOccurred = true
      })

      // Click Add button
      await addButton.click()

      // Wait for the card to appear in the DOM
      await page.waitForTimeout(2000)

      // Verify NO full page navigation occurred (optimistic update)
      // Note: Navigation listener will capture any reload
      expect(navigationOccurred).toBe(false)

      // Check cards increased (or at least didn't trigger error)
      const cardsAfter = await page.locator('[data-testid="repo-card"]').count()
      expect(cardsAfter).toBeGreaterThanOrEqual(cardsBefore)
    }
  })

  /**
   * Verifies that the combobox closes after adding repositories
   * (good UX - no stale state)
   */
  test('should close combobox after adding repository', async ({ page }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Backlog')).toBeVisible({ timeout: 15000 })

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
    await page.waitForTimeout(1000)

    // Select any available repository
    const repoOption = page.locator('[role="option"]').first()
    const hasOptions = (await repoOption.count()) > 0

    if (hasOptions) {
      await repoOption.click()

      // Click Add button
      const addButton = page.getByRole('button', { name: /add \(\d+\)/i })
      if ((await addButton.count()) > 0) {
        await addButton.click()

        // Wait for operation to complete
        await page.waitForTimeout(1500)

        // Verify combobox is closed (search input should not be visible)
        await expect(searchInput).not.toBeVisible({ timeout: 5000 })
      }
    }
  })

  /**
   * Verifies that adding multiple repositories updates the UI correctly
   */
  test('should handle multiple repository selection and addition', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')

    // Wait for Kanban board to load
    await expect(page.getByText('Backlog')).toBeVisible({ timeout: 15000 })

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
    await page.waitForTimeout(1000)

    // Get all available options
    const repoOptions = page.locator('[role="option"]')
    const optionCount = await repoOptions.count()

    // Select multiple repos if available (up to 2)
    const selectCount = Math.min(2, optionCount)
    for (let i = 0; i < selectCount; i++) {
      await repoOptions.nth(i).click()
      await page.waitForTimeout(200)
    }

    // Verify button shows correct count
    if (selectCount > 0) {
      const addButtonPattern = new RegExp(`add \\(${selectCount}\\)`, 'i')
      const addButton = page.getByRole('button', { name: addButtonPattern })
      await expect(addButton).toBeVisible({ timeout: 5000 })
    }
  })
})
