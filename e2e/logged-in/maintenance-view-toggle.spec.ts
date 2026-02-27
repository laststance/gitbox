/**
 * Maintenance View Toggle E2E Tests
 *
 * Tests for view mode switching (grid/list) and search filtering
 * on the Maintenance page (/maintenance).
 *
 * @remarks
 * - Default view is grid mode (Grid3X3 icon selected)
 * - List view shows owner/repo format (e.g., "laststance/claude-plugin-dashboard")
 * - Grid view shows repo_name only (e.g., "claude-plugin-dashboard")
 * - Search input has placeholder "Search repositories..."
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Maintenance View Toggle (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const MAINTENANCE_URL = '/maintenance'

  test.beforeEach(async ({ page }) => {
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')

    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })
  })

  test('should toggle between grid and list view', async ({ page }) => {
    // Default view is grid - verify repo_name is shown (grid shows just name)
    await expect(page.getByText('claude-plugin-dashboard')).toBeVisible()

    // Click list view button (svg.lucide-list icon)
    const listButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-list') })
    await listButton.click()

    // List view should show owner/repo format
    await expect(
      page.getByText('laststance/claude-plugin-dashboard'),
    ).toBeVisible()

    // Click grid view button (svg.lucide-grid-3x3 icon)
    const gridButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-grid-3x3') })
    await gridButton.click()

    // Should be back in grid view - verify grid layout is rendered
    // Grid view uses a CSS grid container
    const gridContainer = page.locator('.grid.gap-6')
    await expect(gridContainer).toBeVisible()
  })

  test('should show same items in both views', async ({ page }) => {
    // Count items in grid view using the .group cards
    const gridCards = page.locator('main .group')
    const gridCount = await gridCards.count()
    expect(gridCount).toBeGreaterThan(0)

    // Switch to list view
    const listButton = page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-list') })
    await listButton.click()

    // Count items in list view
    const listCards = page.locator('main .group')
    const listCount = await listCards.count()

    // Both views should show the same number of items
    expect(listCount).toBe(gridCount)
  })

  test('should search filter items', async ({ page }) => {
    // Find search input by placeholder
    const searchInput = page.getByPlaceholder('Search repositories...')
    await expect(searchInput).toBeVisible()

    // Type search term that matches one item
    await searchInput.fill('claude')

    // "claude-plugin-dashboard" should be visible
    await expect(page.getByText('claude-plugin-dashboard')).toBeVisible()

    // "old-project" should NOT be visible (filtered out)
    await expect(page.getByText('old-project')).not.toBeVisible()
  })
})
