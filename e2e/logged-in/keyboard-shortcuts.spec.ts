/**
 * Keyboard Shortcuts E2E Tests
 *
 * Tests for keyboard shortcuts on the Kanban board (/board/[id])
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Features tested:
 * - ? key toggles shortcuts help dialog
 * - Escape closes shortcuts help dialog
 * - ? key disabled when focused on input/textarea elements
 * - . key opens overflow menu on focused card
 * - Enter key opens NoteModal on focused card
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('Keyboard Shortcuts (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Wait for board content to fully render
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Dismiss any open modals and ensure keyboard focus is on the page
    await page.keyboard.press('Escape')
  })

  test('should open shortcuts help dialog with ? key', async ({ page }) => {
    // Press ? key to open shortcuts help
    await page.keyboard.press('?')

    // Shortcuts help modal should be visible
    const modal = page.locator('[data-testid="shortcuts-help-modal"]')
    await expect(modal).toBeVisible({ timeout: 10000 })

    // Should display "Keyboard Shortcuts" heading
    const heading = modal.getByRole('heading', {
      name: /keyboard shortcuts/i,
    })
    await expect(heading).toBeVisible()
  })

  test('should close shortcuts help dialog with ? or Escape', async ({
    page,
  }) => {
    const modal = page.locator('[data-testid="shortcuts-help-modal"]')

    // Open with ?
    await page.keyboard.press('?')
    await expect(modal).toBeVisible({ timeout: 10000 })

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible({ timeout: 5000 })

    // Open again with ?
    await page.keyboard.press('?')
    await expect(modal).toBeVisible({ timeout: 10000 })

    // Close with ? (toggle off)
    await page.keyboard.press('?')
    await expect(modal).not.toBeVisible({ timeout: 5000 })
  })

  test('should NOT trigger ? shortcut when input is focused', async ({
    page,
  }) => {
    // Wait for cards to load
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Dismiss any open modals first
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog'))
      .not.toBeVisible({ timeout: 5000 })
      .catch(() => {})

    // Focus on an input element (Board Settings dialog has a textbox)
    const settingsButton = page.getByRole('button', {
      name: /board settings/i,
    })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Focus the Board name input
    const input = dialog.getByRole('textbox', { name: 'Board name' })
    await input.focus()
    await expect(input).toBeFocused()

    // Press ? while input is focused — should type into the input, not trigger shortcut
    await page.keyboard.press('?')

    // Close the settings dialog first to check shortcuts modal is NOT there
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Shortcuts help modal should NOT be visible
    const shortcutsModal = page.locator('[data-testid="shortcuts-help-modal"]')
    await expect(shortcutsModal).not.toBeVisible()
  })

  test('should open overflow menu with . key on focused card', async ({
    page,
  }) => {
    // Wait for cards to load
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Focus the card (the inner Card element has tabIndex)
    const focusableCard = card.locator('[tabindex="0"]').first()
    await focusableCard.focus()

    // Press . to open overflow menu
    await page.keyboard.press('.')

    // Verify overflow menu (dropdown with role="menu") appears
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible({ timeout: 5000 })
  })

  test('should open NoteModal with Enter key on focused card', async ({
    page,
  }) => {
    // Wait for cards to load
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Focus the card (the inner Card element has tabIndex)
    const focusableCard = card.locator('[tabindex="0"]').first()
    await focusableCard.focus()

    // Press Enter to open NoteModal
    await page.keyboard.press('Enter')

    // NoteModal dialog should appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Should have "Project Note" heading
    const heading = dialog.getByRole('heading', { name: /project note/i })
    await expect(heading).toBeVisible()
  })
})
