/**
 * Account Profile Page E2E Tests
 *
 * Tests for the Account page (/account) which displays:
 * - Profile section (avatar, username, GitHub connection info)
 * - Account Data section (boards and repository card counts)
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

    // Verify counts are rendered as numbers (not empty)
    const statValues = main.locator('.text-2xl.font-bold')
    const count = await statValues.count()
    expect(count).toBe(2)

    for (let i = 0; i < count; i++) {
      const text = await statValues.nth(i).textContent()
      expect(text).not.toBeNull()
      expect(text!.trim()).toMatch(/^\d+$/)
    }
  })

  test('shows Profile, Account Data and Danger Zone as page sections', async ({
    page,
  }) => {
    // Arrange
    const main = page.getByRole('main')
    await expect(
      page.getByRole('heading', { name: 'Account', level: 1 }),
    ).toBeVisible({ timeout: 10000 })

    // Assert
    await expect(main.locator('section')).toHaveCount(3)
    await expect(
      main.getByRole('heading', { name: 'Profile', level: 2 }),
    ).toBeVisible()
    await expect(
      main.getByRole('heading', { name: 'Account Data', level: 2 }),
    ).toBeVisible()
    await expect(
      main.getByRole('heading', { name: 'Danger Zone', level: 2 }),
    ).toBeVisible()
  })

  test('shows the Boards and Repository Cards numbers in one row without a tile border', async ({
    page,
  }) => {
    // Arrange
    const boardsCell = page.getByTestId('account-stat-boards')
    const cardsCell = page.getByTestId('account-stat-cards')
    await expect(boardsCell).toBeVisible({ timeout: 10000 })
    await expect(cardsCell).toBeVisible()

    // Act
    const boardsBox = await boardsCell.boundingBox()
    const cardsBox = await cardsCell.boundingBox()

    // Assert: one row, the second cell to the right of the first, no tile border
    expect(boardsBox).not.toBeNull()
    expect(cardsBox).not.toBeNull()
    expect(cardsBox!.y).toBe(boardsBox!.y)
    expect(cardsBox!.x).toBeGreaterThanOrEqual(boardsBox!.x + boardsBox!.width)
    expect(Math.round(cardsBox!.width)).toBe(Math.round(boardsBox!.width))
    expect(await boardsCell.getAttribute('class')).not.toMatch(
      /(?:^|\s)border(?:-|\s|$)/,
    )
    expect(await cardsCell.getAttribute('class')).not.toMatch(
      /(?:^|\s)border(?:-|\s|$)/,
    )
  })

  test('keeps both Account Data labels visible on a 375-wide screen', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/account')
    const boardsLabel = page.getByRole('main').getByText('Boards', {
      exact: true,
    })
    const cardsLabel = page.getByRole('main').getByText('Repository Cards')

    // Assert
    await expect(boardsLabel).toBeVisible({ timeout: 10000 })
    await expect(cardsLabel).toBeVisible()
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
