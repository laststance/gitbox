/**
 * Command Palette E2E Tests
 *
 * Tests for the Command Palette feature accessed via Cmd/Ctrl+K on the Kanban board.
 * Requires authentication (uses storageState from auth.setup.ts).
 *
 * Features tested:
 * - Open/close behavior (keyboard shortcut, Escape, backdrop click)
 * - Command filtering by search text
 * - Navigation via command selection
 * - No results state
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

/** Platform-aware modifier key for keyboard shortcuts */
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

test.describe('Command Palette (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should open command palette with Cmd+K and close with Escape', async ({
    page,
  }) => {
    // Open command palette
    await page.keyboard.press(`${MOD}+k`)

    // Backdrop should be visible
    const backdrop = page.getByTestId('command-palette-backdrop')
    await expect(backdrop).toBeVisible({ timeout: 5000 })

    // Search input should be visible and focused
    const searchInput = page.getByPlaceholder('Search commands...')
    await expect(searchInput).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')

    // Backdrop should disappear
    await expect(backdrop).not.toBeVisible({ timeout: 5000 })
  })

  test('should filter commands by search text', async ({ page }) => {
    // Open command palette
    await page.keyboard.press(`${MOD}+k`)

    const backdrop = page.getByTestId('command-palette-backdrop')
    await expect(backdrop).toBeVisible({ timeout: 5000 })

    // Type search query
    const searchInput = page.getByPlaceholder('Search commands...')
    await searchInput.fill('boards')

    // "Go to Boards" should be visible (unique to command palette)
    await expect(page.getByText('Go to Boards')).toBeVisible()

    // Unrelated command "Go to Maintenance" should be filtered out (unique to palette)
    await expect(page.getByText('Go to Maintenance')).not.toBeVisible()

    // Verify filtered command count: only "Go to Boards" should match "boards"
    const commandButtons = page.locator('[data-index]')
    await expect(commandButtons).toHaveCount(1)
  })

  test('should navigate to settings via command palette', async ({ page }) => {
    // Open command palette
    await page.keyboard.press(`${MOD}+k`)

    const backdrop = page.getByTestId('command-palette-backdrop')
    await expect(backdrop).toBeVisible({ timeout: 5000 })

    // Type "settings" to filter
    const searchInput = page.getByPlaceholder('Search commands...')
    await searchInput.fill('settings')

    // Press Enter to select first match ("Go to Settings")
    await page.keyboard.press('Enter')

    // Should navigate to settings page
    await page.waitForURL('**/settings', { timeout: 10000 })
    expect(page.url()).toContain('/settings')
  })

  test('should show no results for nonsense query', async ({ page }) => {
    // Open command palette
    await page.keyboard.press(`${MOD}+k`)

    const backdrop = page.getByTestId('command-palette-backdrop')
    await expect(backdrop).toBeVisible({ timeout: 5000 })

    // Type nonsense query
    const searchInput = page.getByPlaceholder('Search commands...')
    await searchInput.fill('xyznonexistent')

    // "No commands found" message should appear
    await expect(page.getByText('No commands found')).toBeVisible()
  })

  test('should close palette when clicking backdrop', async ({ page }) => {
    // Open command palette
    await page.keyboard.press(`${MOD}+k`)

    const backdrop = page.getByTestId('command-palette-backdrop')
    await expect(backdrop).toBeVisible({ timeout: 5000 })

    // Click the backdrop to close
    await backdrop.click({ position: { x: 10, y: 10 } })

    // Backdrop should disappear
    await expect(backdrop).not.toBeVisible({ timeout: 5000 })
  })
})
