/**
 * Board Settings Dialog E2E Tests
 *
 * Tests for the Board Settings feature accessed from Kanban board (/board/[id])
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Features tested:
 * - Dialog open/close behavior
 * - Tab navigation (General, Card Display, Danger Zone)
 * - Board rename functionality
 * - Card display settings
 * - Delete confirmation flow
 *
 * Note: Theme selection moved to global sidebar ThemeToggle
 * (see sidebar-theme-toggle.spec.ts)
 */

import { test, expect } from '../fixtures/coverage'
import { querySingle, BOARD_IDS, resetBoardNames } from '../helpers/db-query'

test.describe('Board Settings Dialog (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test.describe('Dialog Open/Close', () => {
    test('should open board settings dialog when clicking settings button', async ({
      page,
    }) => {
      // Find and click Board Settings button
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await expect(settingsButton).toBeVisible({ timeout: 10000 })
      await settingsButton.click()

      // Dialog should appear
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Should show dialog title
      await expect(page.getByText(/Configure settings for/)).toBeVisible()
    })

    test('should close dialog when clicking Close button', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Click Close button (in footer) - there are 2 Close buttons (X and footer)
      // Use .first() to get the footer button (outline variant)
      const closeButton = dialog
        .getByRole('button', { name: /^close$/i })
        .first()
      await closeButton.click()

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 5000 })
    })

    test('should close dialog when clicking X button', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Click X close button (top-right corner)
      // The X button has sr-only text "Close"
      const closeButtons = dialog
        .locator('button')
        .filter({ hasText: /close/i })
      const xButton = closeButtons.first()
      await xButton.click()

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Tab Navigation', () => {
    test('should show General tab by default', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // General tab should be active
      const generalTab = dialog.getByRole('tab', { name: /general/i })
      await expect(generalTab).toHaveAttribute('aria-selected', 'true')

      // Should show Rename Board content
      await expect(dialog.getByText('Rename Board')).toBeVisible()
    })

    test('should switch to Cards tab', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Click Cards tab
      const cardsTab = dialog.getByRole('tab', { name: /cards/i })
      await cardsTab.click()

      // Cards tab should be active
      await expect(cardsTab).toHaveAttribute('aria-selected', 'true')

      // Should show card settings content
      await expect(dialog.getByText('Card Visibility')).toBeVisible()
    })

    test('should switch to Danger Zone tab', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Click Danger Zone tab
      const dangerTab = dialog.getByRole('tab', { name: /danger zone/i })
      await dangerTab.click()

      // Danger Zone tab should be active
      await expect(dangerTab).toHaveAttribute('aria-selected', 'true')

      // Should show delete content
      await expect(
        dialog.getByRole('heading', { name: /delete board/i }),
      ).toBeVisible()
      await expect(
        dialog.getByText(/Once you delete this board, there is no going back/),
      ).toBeVisible()
    })
  })

  test.describe('General Tab - Rename', () => {
    test('should display current board name in input', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Input should have current board name
      const input = dialog.getByRole('textbox')
      await expect(input).toBeVisible()

      // Value should not be empty
      const value = await input.inputValue()
      expect(value.length).toBeGreaterThan(0)
    })

    test('should show character count', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Should show character count (format: X/50)
      await expect(dialog.getByText(/\d+\/50/)).toBeVisible()
    })

    test('should update character count when typing', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Clear and type new name
      const input = dialog.getByRole('textbox')
      await input.fill('Test')

      // Character count should update to 4/50
      await expect(dialog.getByText('4/50')).toBeVisible()
    })

    test('should disable Rename button when name is empty', async ({
      page,
    }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Clear name
      const input = dialog.getByRole('textbox')
      await input.fill('')

      // Rename button should be disabled (aria-label is "Rename board to [name]")
      // When empty, button text is "Rename"
      const renameButton = dialog
        .getByRole('button', { name: /rename/i })
        .first()
      await expect(renameButton).toBeDisabled()
    })
  })

  test.describe('Danger Zone Tab - Delete', () => {
    test('should open confirmation dialog when clicking delete', async ({
      page,
    }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Danger Zone tab
      const dangerTab = dialog.getByRole('tab', { name: /danger zone/i })
      await dangerTab.click()

      // Click Delete Board button
      const deleteButton = dialog.getByRole('button', { name: /delete board/i })
      await deleteButton.click()

      // Confirmation dialog should appear
      await expect(
        page.getByText(/Are you sure you want to delete/),
      ).toBeVisible({ timeout: 5000 })
    })

    test('should close confirmation dialog when clicking Cancel', async ({
      page,
    }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Danger Zone tab
      const dangerTab = dialog.getByRole('tab', { name: /danger zone/i })
      await dangerTab.click()

      // Click Delete Board button
      const deleteButton = dialog.getByRole('button', { name: /delete board/i })
      await deleteButton.click()

      // Confirmation should appear
      await expect(
        page.getByText(/Are you sure you want to delete/),
      ).toBeVisible({ timeout: 5000 })

      // Click Cancel
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await cancelButton.click()

      // Confirmation should close
      await expect(
        page.getByText(/Are you sure you want to delete/),
      ).not.toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Database Verification', () => {
    test.afterEach(async () => {
      await resetBoardNames()
    })

    test('should verify board name is persisted in database after rename', async ({
      page,
    }) => {
      // Use testBoard for this test
      const boardId = BOARD_IDS.testBoard

      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Type a unique new name
      const uniqueName = `Renamed Board ${Date.now()}`
      const input = dialog.getByRole('textbox')
      await input.fill(uniqueName)

      // Click Rename button
      const renameButton = dialog
        .getByRole('button', { name: /rename/i })
        .first()
      await renameButton.click()

      // Wait for server action to complete
      await page.waitForTimeout(1500)

      // Verify board name is updated in database
      const board = await querySingle<{ name: string }>('board', {
        id: boardId,
      })
      expect(board).not.toBeNull()
      expect(board?.name).toBe(uniqueName)
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper tab panel accessibility', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Tablist should exist
      const tablist = dialog.getByRole('tablist')
      await expect(tablist).toBeVisible()

      // Tabs should have proper attributes
      const generalTab = dialog.getByRole('tab', { name: /general/i })
      await expect(generalTab).toHaveAttribute('aria-controls', 'panel-general')

      // Tab panel should exist
      const tabpanel = dialog.getByRole('tabpanel')
      await expect(tabpanel).toBeVisible()
    })

    test('should support keyboard navigation between tabs', async ({
      page,
    }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Focus on General tab
      const generalTab = dialog.getByRole('tab', { name: /general/i })
      await generalTab.focus()

      // General should be selected
      await expect(generalTab).toHaveAttribute('aria-selected', 'true')

      // Click on Danger Zone tab
      const dangerTab = dialog.getByRole('tab', { name: /danger zone/i })
      await dangerTab.click()

      // Danger Zone should now be selected
      await expect(dangerTab).toHaveAttribute('aria-selected', 'true')
    })
  })
})
