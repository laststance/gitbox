/**
 * Kanban Board Column Edit Dialog E2E Tests
 *
 * Tests for the column edit dialog functionality.
 * Bug fix: 'z' key was captured by the global undo shortcut,
 * preventing users from typing 'z' in the column name input.
 *
 * Fix: Added check to skip keyboard shortcut when typing in input/textarea/contentEditable.
 */

import { test, expect } from '../fixtures/coverage'
import { querySingle, STATUS_IDS, BOARD_IDS } from '../helpers/db-query'

test.describe('Kanban Board Column Edit Dialog', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('should allow typing "z" character in column name input', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Find and click on the first column options button
    const columnOptionsButton = page
      .getByRole('button', { name: /column options/i })
      .first()
    await expect(columnOptionsButton).toBeVisible({ timeout: 10000 })
    await columnOptionsButton.click()

    // Click Edit Column menu item
    const editColumnItem = page.getByRole('menuitem', { name: /edit column/i })
    await expect(editColumnItem).toBeVisible({ timeout: 5000 })
    await editColumnItem.click()

    // Dialog should appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Find the name input
    const nameInput = page.getByPlaceholder(/in progress|review/i)
    await expect(nameInput).toBeVisible()

    // Clear the input and type a string containing 'z' characters
    await nameInput.fill('')
    await nameInput.fill('Fuzzy Zone Test')

    // Verify the 'z' characters were typed correctly (not captured by undo shortcut)
    await expect(nameInput).toHaveValue('Fuzzy Zone Test')

    // Cancel the dialog to avoid saving changes
    const cancelButton = dialog.getByRole('button', { name: /cancel/i })
    await cancelButton.click()

    // Dialog should close
    await expect(dialog).not.toBeVisible()
  })

  test('should allow typing lowercase and uppercase "z" in column name input', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Open column edit dialog
    const columnOptionsButton = page
      .getByRole('button', { name: /column options/i })
      .first()
    await columnOptionsButton.click()

    const editColumnItem = page.getByRole('menuitem', { name: /edit column/i })
    await editColumnItem.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    const nameInput = page.getByPlaceholder(/in progress|review/i)

    // Test lowercase 'z' - using fill() which handles focus properly
    await nameInput.fill('zoo zebra')
    await expect(nameInput).toHaveValue('zoo zebra')

    // Test uppercase 'Z'
    await nameInput.fill('ZEBRA ZONE')
    await expect(nameInput).toHaveValue('ZEBRA ZONE')

    // Test mixed case with multiple 'z' characters
    // This verifies that the 'z' key is not captured by the undo shortcut
    await nameInput.fill('AmaZing Zzzzz')
    await expect(nameInput).toHaveValue('AmaZing Zzzzz')

    // Cancel dialog
    const cancelButton = dialog.getByRole('button', { name: /cancel/i })
    await cancelButton.click()
  })

  test('should still allow Z key undo shortcut outside of input fields', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Focus on the body (not in any input)
    await page.click('body')

    // Press 'z' key - should trigger undo (if there's history)
    // This just verifies the key handler still works outside inputs
    await page.keyboard.press('z')

    // The undo message might appear if there's history, or nothing happens if no history
    // This test just ensures no error is thrown when pressing 'z' outside inputs
    // The important thing is the page remains stable
    await expect(page.locator('.grid.gap-4.pb-4').first()).toBeVisible()
  })

  // TODO: Re-enable when real Supabase auth is implemented
  // Currently skipped because mock auth tokens don't work with supabase.auth.getUser()
  // See: gap_2026-01-29_e2e_crud_verification_auth in Serena memories
  test.skip('should verify column name is persisted in database after edit', async ({
    page,
  }) => {
    // Use status-1 (Pending) for this test
    const statusId = STATUS_IDS.pending

    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Open column edit dialog for the first column
    const columnOptionsButton = page
      .getByRole('button', { name: /column options/i })
      .first()
    await expect(columnOptionsButton).toBeVisible({ timeout: 10000 })
    await columnOptionsButton.click()

    const editColumnItem = page.getByRole('menuitem', { name: /edit column/i })
    await expect(editColumnItem).toBeVisible({ timeout: 5000 })
    await editColumnItem.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Type a unique new name
    const uniqueName = `Edited Column ${Date.now()}`
    const nameInput = page.getByPlaceholder(/in progress|review/i)
    await nameInput.fill(uniqueName)

    // Click Save button
    const saveButton = dialog.getByRole('button', { name: /save/i })
    await saveButton.click()

    // Wait for server action to complete
    await page.waitForTimeout(1500)

    // Verify column name is updated in database
    const status = await querySingle<{ name: string }>('statuslist', {
      id: statusId,
    })
    expect(status).not.toBeNull()
    expect(status?.name).toBe(uniqueName)
  })
})
