/**
 * Account Deletion E2E Tests
 *
 * Tests the account deletion dialog flow:
 * - Navigate to /account, open dialog
 * - Delete button disabled by default
 * - Typing "DELETE" enables the confirm button
 * - Cancel closes the dialog
 *
 * UI-only validation — no actual deletion (server action needs real session)
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Account Deletion Dialog', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('should display delete account button on account page', async ({
    page,
  }) => {
    await page.goto('/account')

    const deleteButton = page.getByTestId('delete-account-button')
    await expect(deleteButton).toBeVisible()
    await expect(deleteButton).toHaveText('Delete Account')
  })

  test('should open dialog with disabled confirm button', async ({ page }) => {
    await page.goto('/account')

    // Open the delete account dialog
    await page.getByTestId('delete-account-button').click()

    // Dialog should appear
    const dialog = page.getByTestId('delete-account-dialog')
    await expect(dialog).toBeVisible()

    // Confirm button should be disabled by default
    const confirmButton = page.getByTestId('confirm-delete-button')
    await expect(confirmButton).toBeDisabled()

    // Cancel button should be enabled
    const cancelButton = page.getByTestId('cancel-delete-button')
    await expect(cancelButton).toBeEnabled()
  })

  test('should enable confirm button after typing DELETE', async ({ page }) => {
    await page.goto('/account')

    await page.getByTestId('delete-account-button').click()
    await expect(page.getByTestId('delete-account-dialog')).toBeVisible()

    // Type "DELETE" in the confirmation input
    const input = page.getByTestId('delete-confirmation-input')
    await input.fill('DELETE')

    // Confirm button should now be enabled
    const confirmButton = page.getByTestId('confirm-delete-button')
    await expect(confirmButton).toBeEnabled()
  })

  test('should keep confirm button disabled with partial input', async ({
    page,
  }) => {
    await page.goto('/account')

    await page.getByTestId('delete-account-button').click()
    await expect(page.getByTestId('delete-account-dialog')).toBeVisible()

    // Type partial text
    const input = page.getByTestId('delete-confirmation-input')
    await input.fill('DEL')

    // Confirm button should still be disabled
    const confirmButton = page.getByTestId('confirm-delete-button')
    await expect(confirmButton).toBeDisabled()
  })

  test('should close dialog when cancel is clicked', async ({ page }) => {
    await page.goto('/account')

    await page.getByTestId('delete-account-button').click()
    const dialog = page.getByTestId('delete-account-dialog')
    await expect(dialog).toBeVisible()

    // Click cancel
    await page.getByTestId('cancel-delete-button').click()

    // Dialog should close
    await expect(dialog).not.toBeVisible()
  })
})
