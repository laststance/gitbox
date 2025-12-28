/**
 * Board Settings Dialog E2E Tests
 *
 * Tests for the Board Settings feature accessed from Kanban board (/board/[id])
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Features tested:
 * - Dialog open/close behavior
 * - Tab navigation (General, Theme, Danger Zone)
 * - Board rename functionality
 * - Theme selection
 * - Delete confirmation flow
 */

import { test, expect } from './fixtures/coverage'

test.describe('Board Settings Dialog (Authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('domcontentloaded')
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

    test('should switch to Theme tab', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Click Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Theme tab should be active
      await expect(themeTab).toHaveAttribute('aria-selected', 'true')

      // Should show theme content
      await expect(dialog.getByText('Light Themes')).toBeVisible()
      await expect(dialog.getByText('Dark Themes')).toBeVisible()
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

  test.describe('Theme Tab', () => {
    test('should display all 14 theme options', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Check for light themes (7)
      await expect(
        dialog.getByRole('button', { name: /select default theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select sunrise theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select sandstone theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select mint theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select sky theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select lavender theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select rose theme/i }),
      ).toBeVisible()

      // Check for dark themes (7)
      await expect(
        dialog.getByRole('button', { name: /select dark theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select midnight theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select graphite theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select forest theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select ocean theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select plum theme/i }),
      ).toBeVisible()
      await expect(
        dialog.getByRole('button', { name: /select rust theme/i }),
      ).toBeVisible()
    })

    test('should allow selecting a theme', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Select midnight theme
      const midnightButton = dialog.getByRole('button', {
        name: /select midnight theme/i,
      })
      await midnightButton.click()

      // Should be marked as pressed
      await expect(midnightButton).toHaveAttribute('aria-pressed', 'true')
    })

    test('should show Save Theme button', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Save Theme button should be visible
      const saveButton = dialog.getByRole('button', { name: /save theme/i })
      await expect(saveButton).toBeVisible()
    })

    test('should save "default" theme without error (regression test)', async ({
      page,
    }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Select default theme
      const defaultButton = dialog.getByRole('button', {
        name: /select default theme/i,
      })
      await defaultButton.click()
      await expect(defaultButton).toHaveAttribute('aria-pressed', 'true')

      // Save theme
      const saveButton = dialog.getByRole('button', { name: /save theme/i })
      await saveButton.click()

      // Wait for action to complete
      await page.waitForTimeout(1000)

      // The key regression test: should NOT show "Invalid theme" error
      // This was the bug - 'default' was rejected as invalid
      await expect(page.getByText(/invalid theme/i)).not.toBeVisible()
    })

    test('should save "dark" theme without error (regression test)', async ({
      page,
    }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Select dark theme
      const darkButton = dialog.getByRole('button', {
        name: /select dark theme/i,
      })
      await darkButton.click()
      await expect(darkButton).toHaveAttribute('aria-pressed', 'true')

      // Save theme
      const saveButton = dialog.getByRole('button', { name: /save theme/i })
      await saveButton.click()

      // Wait for action to complete
      await page.waitForTimeout(1000)

      // The key regression test: should NOT show "Invalid theme" error
      // This was the bug - 'dark' was rejected as invalid
      await expect(page.getByText(/invalid theme/i)).not.toBeVisible()
    })

    test('should save "midnight" theme without error', async ({ page }) => {
      // Open dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Go to Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Select midnight theme
      const midnightButton = dialog.getByRole('button', {
        name: /select midnight theme/i,
      })
      await midnightButton.click()
      await expect(midnightButton).toHaveAttribute('aria-pressed', 'true')

      // Save theme
      const saveButton = dialog.getByRole('button', { name: /save theme/i })
      await saveButton.click()

      // Wait for action to complete
      await page.waitForTimeout(1000)

      // Should NOT show error toast
      await expect(page.getByText(/invalid theme/i)).not.toBeVisible()
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

      // Click on Theme tab
      const themeTab = dialog.getByRole('tab', { name: /theme/i })
      await themeTab.click()

      // Theme should now be selected
      await expect(themeTab).toHaveAttribute('aria-selected', 'true')
    })
  })
})
