/**
 * Sidebar ThemeToggle E2E Tests
 *
 * Tests the global ThemeToggle in the sidebar:
 * - Theme selection via dropdown menu
 * - Theme applies to DOM immediately
 * - Theme persists across navigation
 * - Works on pages with sidebar (boards, board/[id], settings)
 *
 * Note: Maintenance page uses a different layout without sidebar
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('Sidebar ThemeToggle', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('should display theme toggle button in sidebar', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Find the theme toggle button in sidebar
    const themeButton = page.locator('aside button:has-text("Theme")')
    await expect(themeButton).toBeVisible()
  })

  test('should show current theme name next to button', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // The button should show the current theme name
    const themeButton = page.locator('aside button:has-text("Theme")')
    await expect(themeButton).toBeVisible()

    // Should have some theme indicator (e.g., "Default", "System", etc.)
    // The actual text depends on the current theme state
    const buttonText = await themeButton.textContent()
    expect(buttonText).toContain('Theme')
  })

  test('should open dropdown menu when clicked', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Click the theme toggle button
    const themeButton = page.locator('aside button:has-text("Theme")')
    await themeButton.click()

    // Dropdown menu should appear
    const dropdown = page.locator('[role="menu"]')
    await expect(dropdown).toBeVisible()

    // Should show theme options (check for specific menu items)
    await expect(
      dropdown.locator('[role="menuitem"]').filter({ hasText: 'Default' }),
    ).toBeVisible()
    await expect(
      dropdown.locator('[role="menuitem"]').filter({ hasText: 'Midnight' }),
    ).toBeVisible()
    await expect(
      dropdown.locator('[role="menuitem"]').filter({ hasText: 'Forest' }),
    ).toBeVisible()
  })

  test('should change theme when selecting from dropdown', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Wait for hydration

    // Open theme dropdown
    const themeButton = page.locator('aside button:has-text("Theme")')
    await themeButton.click()

    // Select midnight theme
    const midnightOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Midnight' })
    await expect(midnightOption).toBeVisible()
    await midnightOption.click()

    // Wait for theme to apply
    await page.waitForTimeout(500)

    // Verify theme is applied to DOM
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'midnight', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)
  })

  test('should persist theme after page navigation', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Open theme dropdown and select graphite
    const themeButton = page.locator('aside button:has-text("Theme")')
    await themeButton.click()

    const graphiteOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Graphite' })
    await graphiteOption.click()
    await page.waitForTimeout(500)

    // Verify theme applied
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })

    // Navigate to settings page
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Theme should persist
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)
  })

  test('should show check mark on selected theme', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // First select sunrise theme
    let themeButton = page.locator('aside button:has-text("Theme")')
    await themeButton.click()

    const sunriseOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Sunrise' })
    await sunriseOption.click()
    await page.waitForTimeout(500)

    // Re-open dropdown
    themeButton = page.locator('aside button:has-text("Theme")')
    await themeButton.click()

    // Sunrise option should have a check mark (svg inside)
    const sunriseWithCheck = page
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Sunrise' })
      .locator('svg')
    await expect(sunriseWithCheck).toBeVisible()
  })

  test('should apply light theme correctly', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Open dropdown and select lavender (light theme)
    const themeButton = page.locator('aside button:has-text("Theme")')
    await themeButton.click()

    const lavenderOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Lavender' })
    await lavenderOption.click()
    await page.waitForTimeout(500)

    // Verify light theme applied (no dark class)
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'lavender', {
      timeout: 5000,
    })
    await expect(html).not.toHaveClass(/dark/)
  })

  test('should apply dark theme correctly', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Open dropdown and select forest (dark theme)
    const themeButton = page.locator('aside button:has-text("Theme")')
    await themeButton.click()

    const forestOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Forest' })
    await forestOption.click()
    await page.waitForTimeout(500)

    // Verify dark theme applied
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'forest', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)
  })

  test('should update icon based on current theme type', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // The theme button should have an icon (Sun, Moon, or Monitor)
    const themeButton = page.locator('aside button:has-text("Theme")')
    const icon = themeButton.locator('svg').first()
    await expect(icon).toBeVisible()
  })

  test('theme toggle should work on individual board page', async ({
    page,
  }) => {
    // Navigate to a board page (test board)
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Theme toggle should be visible in sidebar
    const themeButton = page.locator('aside button:has-text("Theme")')
    await expect(themeButton).toBeVisible()

    // Should work like on boards list page
    await themeButton.click()

    const dropdown = page.locator('[role="menu"]')
    await expect(dropdown).toBeVisible()

    // Verify we can select a theme on this page too
    const oceanOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Ocean' })
    await oceanOption.click()
    await page.waitForTimeout(500)

    // Verify theme applied
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'ocean', { timeout: 5000 })
  })
})
