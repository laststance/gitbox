/**
 * Board Settings Subtitle E2E Tests
 *
 * Tests for subtitle editing and visibility toggle in Board Settings dialog.
 * Covers:
 * - Subtitle text editing from General tab
 * - Subtitle visibility toggle (show/hide in header)
 * - Persistence of settings in database
 */

import { test, expect } from '../fixtures/coverage'
import {
  BOARD_IDS,
  querySingle,
  resetBoardSubtitles,
  resetBoardSettings,
} from '../helpers/db-query'

test.describe('Board Settings Subtitle (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test.beforeEach(async ({ page }) => {
    await resetBoardSubtitles()
    await resetBoardSettings()
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(async () => {
    await resetBoardSubtitles()
    await resetBoardSettings()
  })

  test.describe('General Tab - Subtitle Edit', () => {
    test('should display subtitle input in General tab', async ({ page }) => {
      // Open Board Settings dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await expect(settingsButton).toBeVisible({ timeout: 10000 })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // General tab should be active by default
      // Should show subtitle input
      const subtitleInput = dialog.getByTestId('subtitle-input')
      await expect(subtitleInput).toBeVisible()
    })

    test('should show current subtitle in input', async ({ page }) => {
      // Open Board Settings dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await expect(settingsButton).toBeVisible({ timeout: 10000 })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Subtitle input should have the current subtitle text from seed
      const subtitleInput = dialog.getByTestId('subtitle-input')
      await expect(subtitleInput).toHaveValue('Main testing board for E2E')
    })

    test('should show character count for subtitle', async ({ page }) => {
      // Open Board Settings dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await expect(settingsButton).toBeVisible({ timeout: 10000 })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Should display character count (current/100)
      await expect(dialog.getByText(/\/100/)).toBeVisible()
    })

    test('should save subtitle and update header', async ({ page }) => {
      // Open Board Settings dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await expect(settingsButton).toBeVisible({ timeout: 10000 })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Clear and type new subtitle
      const subtitleInput = dialog.getByTestId('subtitle-input')
      await subtitleInput.clear()
      await subtitleInput.fill('Updated test subtitle')

      // Click save
      const saveButton = dialog.getByTestId('save-subtitle')
      await saveButton.click()

      // Should show success toast
      await expect(page.getByText('Subtitle updated')).toBeVisible({
        timeout: 5000,
      })

      // Verify in header - the subtitle should be updated
      const boardSubtitle = page.getByTestId('board-subtitle')
      await expect(boardSubtitle).toContainText('Updated test subtitle')

      // Verify in database
      await expect(async () => {
        const board = await querySingle<{ subtitle: string }>('board', {
          id: BOARD_IDS.testBoard,
        })
        expect(board).not.toBeNull()
        expect(board?.subtitle).toBe('Updated test subtitle')
      }).toPass({ timeout: 10000 })
    })
  })

  test.describe('General Tab - Subtitle Visibility Toggle', () => {
    test('should display Show Subtitle toggle in General tab', async ({
      page,
    }) => {
      // Open Board Settings dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await expect(settingsButton).toBeVisible({ timeout: 10000 })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Should show the toggle
      const toggle = dialog.getByTestId('toggle-show-subtitle')
      await expect(toggle).toBeVisible()

      // Should show the label
      await expect(dialog.getByText('Show Subtitle')).toBeVisible()
    })

    test('should hide subtitle in header when toggled off', async ({
      page,
    }) => {
      // Subtitle should be visible initially
      const boardSubtitle = page.getByTestId('board-subtitle')
      await expect(boardSubtitle).toBeVisible({ timeout: 10000 })

      // Open Board Settings dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Toggle subtitle off
      const toggle = dialog.getByTestId('toggle-show-subtitle')
      await toggle.click()

      // Should show success toast
      await expect(page.getByText('Subtitle is now hidden')).toBeVisible({
        timeout: 5000,
      })

      // Close dialog
      const closeButton = dialog
        .getByRole('button', { name: /^close$/i })
        .first()
      await closeButton.click()
      await expect(dialog).not.toBeVisible({ timeout: 5000 })

      // Subtitle should be hidden from header
      await expect(boardSubtitle).not.toBeVisible({ timeout: 5000 })

      // Verify in database settings
      await expect(async () => {
        const board = await querySingle<{
          settings: { showSubtitle?: boolean }
        }>('board', { id: BOARD_IDS.testBoard })
        expect(board).not.toBeNull()
        expect(board?.settings?.showSubtitle).toBe(false)
      }).toPass({ timeout: 10000 })
    })

    test('should show subtitle in header when toggled on after being off', async ({
      page,
    }) => {
      // First, toggle off via the dialog
      const settingsButton = page.getByRole('button', {
        name: /board settings/i,
      })
      await expect(settingsButton).toBeVisible({ timeout: 10000 })
      await settingsButton.click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      // Toggle off
      const toggle = dialog.getByTestId('toggle-show-subtitle')
      await toggle.click()
      await expect(page.getByText('Subtitle is now hidden')).toBeVisible({
        timeout: 5000,
      })

      // Toggle back on
      await toggle.click()
      await expect(page.getByText('Subtitle is now visible')).toBeVisible({
        timeout: 5000,
      })

      // Close dialog
      const closeButton = dialog
        .getByRole('button', { name: /^close$/i })
        .first()
      await closeButton.click()
      await expect(dialog).not.toBeVisible({ timeout: 5000 })

      // Subtitle should be visible again
      const boardSubtitle = page.getByTestId('board-subtitle')
      await expect(boardSubtitle).toBeVisible({ timeout: 5000 })
    })
  })
})
