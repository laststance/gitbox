/**
 * Account Profile Page E2E Tests
 *
 * Tests for the Account page (/account) which displays:
 * - Profile section (avatar, username, GitHub connection info)
 * - Account Data section (boards, cards, maintenance item counts)
 * - Danger Zone section (account deletion flow)
 * - Navigation actions (Back to Boards, Sign Out)
 *
 * Requires authentication (uses storageState from auth.setup.ts)
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Account Profile Page (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/account')
    await page.waitForLoadState('networkidle')
  })

  test('should display account page with profile section', async ({ page }) => {
    // Verify page header
    await expect(
      page.getByRole('heading', { name: 'Account', level: 1 }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByText('Manage your account settings and data'),
    ).toBeVisible()

    // Verify profile section shows username
    await expect(page.getByText('@testuser')).toBeVisible()

    // Verify GitHub connection info
    await expect(page.getByText('Connected via GitHub')).toBeVisible()
  })

  test('should display account data stats', async ({ page }) => {
    // Scope to main content area to avoid matching sidebar elements
    const main = page.getByRole('main')

    // Verify stat labels are visible
    await expect(main.getByText('Boards', { exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(main.getByText('Repository Cards')).toBeVisible()
    await expect(main.getByText('Maintenance Items')).toBeVisible()

    // Verify counts are rendered as numbers (not empty)
    const statValues = main.locator('.text-2xl.font-bold')
    const count = await statValues.count()
    expect(count).toBe(3)

    for (let i = 0; i < count; i++) {
      const text = await statValues.nth(i).textContent()
      expect(text).not.toBeNull()
      expect(text!.trim()).toMatch(/^\d+$/)
    }
  })

  test('should open delete confirmation dialog', async ({ page }) => {
    // Click Delete Account button
    const deleteButton = page.getByTestId('delete-account-button')
    await expect(deleteButton).toBeVisible({ timeout: 10000 })
    await deleteButton.click()

    // Verify dialog is visible
    const dialog = page.getByTestId('delete-account-dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify confirm button is disabled (no "DELETE" typed yet)
    const confirmButton = page.getByTestId('confirm-delete-button')
    await expect(confirmButton).toBeDisabled()
  })

  test('should cancel delete account dialog', async ({ page }) => {
    // Open delete dialog
    const deleteButton = page.getByTestId('delete-account-button')
    await expect(deleteButton).toBeVisible({ timeout: 10000 })
    await deleteButton.click()

    // Verify dialog is visible
    const dialog = page.getByTestId('delete-account-dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Click cancel button
    const cancelButton = page.getByTestId('cancel-delete-button')
    await cancelButton.click()

    // Verify dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Verify still on /account page
    await expect(page).toHaveURL(/\/account/)
  })
})
