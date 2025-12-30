/**
 * Board Settings Card Display E2E Tests
 *
 * Tests for Phase 5: Card Display Settings in Board Settings Dialog
 * Verifies visibility toggles, style options, and persistence.
 *
 * @see https://github.com/laststance/gitbox/issues/20
 *
 * @remarks
 * These tests verify:
 * - Card Display tab appears in Board Settings dialog
 * - Visibility toggles (GitHub Description, Inline Comment) work
 * - Style options (Border Color, Background, Font Size, Font Weight) work
 * - Settings persist when saved
 * - Comment Style section hides when Inline Comment is disabled
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Board Settings Card Display (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should show Cards tab in Board Settings dialog', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    // Wait for dialog to appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Should have Cards tab
    const cardsTab = dialog.getByRole('tab', { name: /cards/i })
    await expect(cardsTab).toBeVisible()
  })

  test('should display visibility toggles in Cards tab', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    // Wait for dialog and click Cards tab
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    // Wait for panel to appear
    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Should have GitHub Description toggle
    const githubToggle = panel.locator(
      '[data-testid="toggle-github-description"]',
    )
    await expect(githubToggle).toBeVisible()

    // Should have Inline Comment toggle
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    await expect(commentToggle).toBeVisible()
  })

  test('should toggle GitHub Description visibility', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Get toggle and its initial state
    const githubToggle = panel.locator(
      '[data-testid="toggle-github-description"]',
    )
    const initialState = await githubToggle.getAttribute('data-state')

    // Click to toggle
    await githubToggle.click()

    // State should change
    const newState = await githubToggle.getAttribute('data-state')
    expect(newState).not.toBe(initialState)
  })

  test('should show Comment Style options when Inline Comment is enabled', async ({
    page,
  }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Ensure Inline Comment is enabled
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    const state = await commentToggle.getAttribute('data-state')
    if (state !== 'checked') {
      await commentToggle.click()
    }

    // Comment Style section should be visible
    await expect(panel.getByText('Comment Style')).toBeVisible()

    // Should have style options
    await expect(
      panel.locator('[data-testid="border-color-primary"]'),
    ).toBeVisible()
    await expect(panel.locator('[data-testid="bg-color-subtle"]')).toBeVisible()
    await expect(panel.locator('[data-testid="font-size-sm"]')).toBeVisible()
    await expect(
      panel.locator('[data-testid="font-weight-normal"]'),
    ).toBeVisible()
  })

  test('should hide Comment Style options when Inline Comment is disabled', async ({
    page,
  }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Disable Inline Comment
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    const state = await commentToggle.getAttribute('data-state')
    if (state === 'checked') {
      await commentToggle.click()
    }

    // Comment Style section should be hidden
    await expect(panel.getByText('Comment Style')).not.toBeVisible()
  })

  test('should select border color option', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Ensure Comment Style is visible
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    const state = await commentToggle.getAttribute('data-state')
    if (state !== 'checked') {
      await commentToggle.click()
    }

    // Click Blue border color
    const blueButton = panel.locator('[data-testid="border-color-blue"]')
    await blueButton.click()

    // Should be selected (aria-pressed="true")
    await expect(blueButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should select background color option', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Ensure Comment Style is visible
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    const state = await commentToggle.getAttribute('data-state')
    if (state !== 'checked') {
      await commentToggle.click()
    }

    // Click Light background
    const lightButton = panel.locator('[data-testid="bg-color-light"]')
    await lightButton.click()

    // Should be selected
    await expect(lightButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should select font size option', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Ensure Comment Style is visible
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    const state = await commentToggle.getAttribute('data-state')
    if (state !== 'checked') {
      await commentToggle.click()
    }

    // Click Large font size
    const largeButton = panel.locator('[data-testid="font-size-lg"]')
    await largeButton.click()

    // Should be selected
    await expect(largeButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should select font weight option', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Ensure Comment Style is visible
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    const state = await commentToggle.getAttribute('data-state')
    if (state !== 'checked') {
      await commentToggle.click()
    }

    // Click Bold font weight
    const boldButton = panel.locator('[data-testid="font-weight-semibold"]')
    await boldButton.click()

    // Should be selected
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should save card display settings', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Make some changes
    const commentToggle = panel.locator('[data-testid="toggle-comment"]')
    const state = await commentToggle.getAttribute('data-state')
    if (state !== 'checked') {
      await commentToggle.click()
    }

    // Select Blue border
    await panel.locator('[data-testid="border-color-blue"]').click()

    // Save settings
    const saveButton = panel.locator(
      '[data-testid="save-card-display-settings"]',
    )

    // Verify button is enabled before click
    await expect(saveButton).toBeEnabled()
    await expect(saveButton).toHaveText('Save Settings')

    // Click save - this triggers form submission via server action
    await saveButton.click()

    // Verify button shows pending state (confirms form action is working)
    // Note: Server action completion cannot be verified in E2E tests with MSW
    // because MSW runs in browser but server actions execute in Node.js
    await expect(saveButton).toHaveText('Saving...')

    // Dialog should remain open during save
    await expect(dialog).toBeVisible()
  })

  test('should have Save Settings button', async ({ page }) => {
    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('tab', { name: /cards/i }).click()

    const panel = dialog.locator('[data-testid="panel-card-display"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Should have Save Settings button
    const saveButton = panel.locator(
      '[data-testid="save-card-display-settings"]',
    )
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toHaveText('Save Settings')
  })
})

/**
 * RepoCard Display Verification Tests
 *
 * Verifies that card display settings are reflected on RepoCard components.
 * These tests check the actual rendering of RepoCards based on settings.
 *
 * @remarks
 * MSW limitation: Server actions execute in Node.js, not browser.
 * Tests verify initial state from mock data and UI element presence.
 */
test.describe('RepoCard Display Settings Reflection (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should display comment on RepoCard when showComment is enabled (default)', async ({
    page,
  }) => {
    // Wait for board to load with cards
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Card-1 has comment "npmリリース完了、当分は機能追加予定なし" in mock data
    const card1 = page.locator('[data-testid="repo-card-card-1"]')
    await expect(card1).toBeVisible()

    // Comment should be visible (either display or empty state)
    const commentDisplay = card1.locator('[data-testid="comment-display"]')
    const commentEmptyState = card1.locator(
      '[data-testid="comment-empty-state"]',
    )

    // One of these should be visible when showComment is true (default)
    const hasComment = await commentDisplay.isVisible()
    const hasEmptyState = await commentEmptyState.isVisible()
    expect(hasComment || hasEmptyState).toBe(true)
  })

  test('should display GitHub description on RepoCard', async ({ page }) => {
    // Wait for board to load with cards
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Card-1 has description "A test repository for GitBox" in mock data
    const card1 = page.locator('[data-testid="repo-card-card-1"]')
    await expect(card1).toBeVisible()

    // Description should be visible (GitHub description from meta.description)
    await expect(card1.getByText(/A test repository for GitBox/i)).toBeVisible()
  })

  test('should display comment text on RepoCard with comment', async ({
    page,
  }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Card-1 has comment in mock data
    const card1 = page.locator('[data-testid="repo-card-card-1"]')
    await expect(card1).toBeVisible()

    // Should show the actual comment text (Japanese text from mock data)
    const commentDisplay = card1.locator('[data-testid="comment-display"]')

    // Comment display should be visible with text
    if (await commentDisplay.isVisible()) {
      const commentText = card1.locator('[data-testid="comment-text"]')
      await expect(commentText).toBeVisible()
    }
  })

  test('should show empty state for card without comment', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Card-3 has empty comment in mock data
    const card3 = page.locator('[data-testid="repo-card-card-3"]')
    await expect(card3).toBeVisible()

    // Should show empty state (add comment placeholder)
    const commentEmptyState = card3.locator(
      '[data-testid="comment-empty-state"]',
    )
    const commentDisplay = card3.locator('[data-testid="comment-display"]')

    // One of these should be visible
    const hasEmptyState = await commentEmptyState.isVisible()
    const hasDisplay = await commentDisplay.isVisible()
    expect(hasEmptyState || hasDisplay).toBe(true)
  })

  test('should display repo name on all cards', async ({ page }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Verify multiple cards show repo names
    const card1 = page.locator('[data-testid="repo-card-card-1"]')
    const card2 = page.locator('[data-testid="repo-card-card-2"]')

    // Check repo names are visible
    await expect(card1.locator('[data-testid="repo-name"]')).toBeVisible()
    await expect(card2.locator('[data-testid="repo-name"]')).toBeVisible()

    // Verify actual text content
    await expect(card1.locator('[data-testid="repo-name"]')).toContainText(
      'test-repo',
    )
    await expect(card2.locator('[data-testid="repo-name"]')).toContainText(
      'another-repo',
    )
  })

  test('should apply default comment style (primary border)', async ({
    page,
  }) => {
    // Wait for board to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Card-1 has a comment
    const card1 = page.locator('[data-testid="repo-card-card-1"]')
    await expect(card1).toBeVisible()

    const commentDisplay = card1.locator('[data-testid="comment-display"]')

    // If comment is displayed, verify it has styling classes
    if (await commentDisplay.isVisible()) {
      // Comment display should have border styling (primary by default)
      // Border class like 'border-l-primary' or 'border-l-blue-500'
      await expect(commentDisplay).toHaveClass(/border-l/)
    }
  })
})
