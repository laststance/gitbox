/**
 * Theme Persistence E2E Tests
 *
 * Tests theme selection persistence via Redux Storage Middleware
 * Verifies theme survives page reload and is correctly applied to DOM
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Theme Persistence (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('should persist midnight theme after page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Wait for hydration to complete
    await page.waitForTimeout(1000)

    // Select midnight theme (dark theme)
    const midnightButton = page.locator('button').filter({
      has: page.locator('span:text-is("Midnight")'),
    })
    await expect(midnightButton).toBeVisible()
    await midnightButton.click()

    // Wait for theme to be applied
    await page.waitForTimeout(500)

    // Verify theme is applied immediately
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'midnight', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait for Redux hydration after reload
    await page.waitForTimeout(1000)

    // Verify theme persists after reload
    await expect(html).toHaveAttribute('data-theme', 'midnight', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)
  })

  test('should persist sunrise theme after page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select sunrise theme (light theme)
    const sunriseButton = page.locator('button').filter({
      has: page.locator('span:text-is("Sunrise")'),
    })
    await expect(sunriseButton).toBeVisible()
    await sunriseButton.click()
    await page.waitForTimeout(500)

    // Verify theme is applied
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'sunrise', {
      timeout: 5000,
    })

    // Should NOT have dark class (light theme)
    await expect(html).not.toHaveClass(/dark/)

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    await expect(html).toHaveAttribute('data-theme', 'sunrise', {
      timeout: 5000,
    })
    await expect(html).not.toHaveClass(/dark/)
  })

  test('should persist system theme after page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select system theme
    const systemButton = page.locator('button').filter({
      has: page.locator('span:text-is("System")'),
    })
    await expect(systemButton).toBeVisible()
    await systemButton.click()
    await page.waitForTimeout(500)

    // System theme should NOT have data-theme attribute (or empty)
    const html = page.locator('html')
    // System theme removes the data-theme attribute
    const dataTheme = await html.getAttribute('data-theme')
    expect(dataTheme === null || dataTheme === '').toBe(true)

    // Reload and verify system theme persists
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const dataThemeAfterReload = await html.getAttribute('data-theme')
    expect(dataThemeAfterReload === null || dataThemeAfterReload === '').toBe(
      true,
    )
  })

  test('should persist theme when navigating between pages', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select graphite theme (dark theme)
    const graphiteButton = page.locator('button').filter({
      has: page.locator('span:text-is("Graphite")'),
    })
    await expect(graphiteButton).toBeVisible()
    await graphiteButton.click()
    await page.waitForTimeout(500)

    // Verify theme applied
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)

    // Navigate to boards page
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Theme should persist on boards page
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)

    // Navigate back to settings
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Theme should still be graphite
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)
  })

  test('should respect system dark mode preference', async ({ page }) => {
    // Emulate dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select system theme
    const systemButton = page.locator('button').filter({
      has: page.locator('span:text-is("System")'),
    })
    await expect(systemButton).toBeVisible()
    await systemButton.click()
    await page.waitForTimeout(500)

    // Should have dark class (following system preference)
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
    // Should not have data-theme set for system theme
    const dataTheme = await html.getAttribute('data-theme')
    expect(dataTheme === null || dataTheme === '').toBe(true)
  })

  test('should respect system light mode preference', async ({ page }) => {
    // Emulate light color scheme
    await page.emulateMedia({ colorScheme: 'light' })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select system theme
    const systemButton = page.locator('button').filter({
      has: page.locator('span:text-is("System")'),
    })
    await expect(systemButton).toBeVisible()
    await systemButton.click()
    await page.waitForTimeout(500)

    // Should NOT have dark class (following system preference)
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)
    // Should not have data-theme set for system theme
    const dataTheme = await html.getAttribute('data-theme')
    expect(dataTheme === null || dataTheme === '').toBe(true)
  })
})
