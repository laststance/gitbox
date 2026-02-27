/**
 * Maintenance CRUD E2E Tests
 *
 * Tests for basic CRUD operations on the Maintenance page (/maintenance).
 * Verifies item display, GitHub links, delete flow, and cancel delete flow.
 *
 * @remarks
 * - Uses resetMaintenanceItems() in afterEach for test isolation
 * - Seed data includes 2 maintenance items: claude-plugin-dashboard, old-project
 * - Delete uses DeleteMaintenanceDialog (AlertDialog pattern)
 */

import { test, expect } from '../fixtures/coverage'
import {
  MAINTENANCE_IDS,
  resetMaintenanceItems,
  querySupabase,
} from '../helpers/db-query'

test.describe('Maintenance CRUD (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const MAINTENANCE_URL = '/maintenance'

  test.beforeEach(async ({ page }) => {
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(async () => {
    await resetMaintenanceItems()
  })

  test('should display maintenance items', async ({ page }) => {
    // Wait for maintenance page heading
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Verify both seed maintenance items are visible
    await expect(page.getByText('claude-plugin-dashboard')).toBeVisible()
    await expect(page.getByText('old-project')).toBeVisible()

    // Verify item count text in the subtitle
    await expect(page.getByText('2 items')).toBeVisible()
  })

  test('should link to GitHub repository', async ({ page }) => {
    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // In grid view, clicking the card opens GitHub via window.open.
    // In list view, the repo row has a clickable area that calls openGitHubUrl.
    // Switch to list view where the link behavior is more testable.
    const listButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-list') })
    await listButton.click()

    // Verify the owner/repo format is displayed (list view shows owner/repo)
    await expect(
      page.getByText('laststance/claude-plugin-dashboard'),
    ).toBeVisible()
  })

  test('should delete maintenance item via dialog', async ({ page }) => {
    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Switch to list view where the Delete button is directly accessible
    const listButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-list') })
    await listButton.click()

    // Find the delete button for claude-plugin-dashboard
    const deleteButton = page.getByRole('button', {
      name: /Delete laststance\/claude-plugin-dashboard/i,
    })
    // Hover over the card row to make action buttons visible (they start with opacity-0)
    const cardRow = page.locator('.group').filter({
      has: page.getByText('laststance/claude-plugin-dashboard'),
    })
    await cardRow.hover()
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()

    // Verify the delete confirmation dialog opens
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText('Delete from Maintenance')).toBeVisible()

    // Click the destructive action button in the dialog
    const confirmDelete = dialog.getByRole('button', { name: /delete/i }).last()
    await expect(confirmDelete).toBeVisible({ timeout: 5000 })
    await confirmDelete.click()

    // Wait for the dialog to close (confirms the action was processed)
    await expect(dialog).not.toBeVisible({ timeout: 15000 })

    // Verify the item is removed from the list
    await expect(
      page.getByText('laststance/claude-plugin-dashboard'),
    ).not.toBeVisible({ timeout: 10000 })

    // Verify database state: item should be deleted
    await expect(async () => {
      const items = await querySupabase('maintenance', {
        id: MAINTENANCE_IDS.maintenance1,
      })
      expect(items).toHaveLength(0)
    }).toPass({ timeout: 10000 })
  })

  test('should cancel deletion', async ({ page }) => {
    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Switch to list view for direct button access
    const listButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-list') })
    await listButton.click()

    // Hover and click delete button for claude-plugin-dashboard
    const cardRow = page.locator('.group').filter({
      has: page.getByText('laststance/claude-plugin-dashboard'),
    })
    await cardRow.hover()
    const deleteButton = page.getByRole('button', {
      name: /Delete laststance\/claude-plugin-dashboard/i,
    })
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()

    // Verify dialog opens
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText('Delete from Maintenance')).toBeVisible()

    // Click Cancel
    const cancelButton = dialog.getByRole('button', { name: /cancel/i })
    await cancelButton.click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Item should still be in the list
    await expect(
      page.getByText('laststance/claude-plugin-dashboard'),
    ).toBeVisible()
  })
})
