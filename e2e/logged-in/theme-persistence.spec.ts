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

    // Wait for hydration by asserting the settings page content is ready
    const html = page.locator('html')

    // Select midnight theme (dark theme)
    const midnightButton = page.locator('button').filter({
      has: page.locator('span:text-is("Midnight")'),
    })
    await expect(midnightButton).toBeVisible()
    await midnightButton.click()

    // Verify theme is applied immediately
    await expect(html).toHaveAttribute('data-theme', 'midnight', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)

    // Wait for localStorage write before reloading
    await expect(async () => {
      const theme = await page.evaluate(() => {
        const state = localStorage.getItem('gitbox-state')
        return state ? JSON.parse(state)?.state?.settings?.theme : null
      })
      expect(theme).toBe('midnight')
    }).toPass({ timeout: 5000 })

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify theme persists after reload via localStorage check
    await expect(async () => {
      const theme = await page.evaluate(() => {
        const state = localStorage.getItem('gitbox-state')
        return state ? JSON.parse(state)?.state?.settings?.theme : null
      })
      expect(theme).toBe('midnight')
    }).toPass({ timeout: 5000 })

    // Verify theme persists in DOM after reload
    await expect(html).toHaveAttribute('data-theme', 'midnight', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)
  })

  test('should persist sunrise theme after page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Wait for hydration by asserting theme button is visible
    const sunriseButton = page.locator('button').filter({
      has: page.locator('span:text-is("Sunrise")'),
    })
    await expect(sunriseButton).toBeVisible()

    // Select sunrise theme (light theme)
    await sunriseButton.click()

    // Verify theme is applied
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'sunrise', {
      timeout: 5000,
    })

    // Should NOT have dark class (light theme)
    await expect(html).not.toHaveClass(/dark/)

    // Wait for localStorage write before reloading
    await expect(async () => {
      const theme = await page.evaluate(() => {
        const state = localStorage.getItem('gitbox-state')
        return state ? JSON.parse(state)?.state?.settings?.theme : null
      })
      expect(theme).toBe('sunrise')
    }).toPass({ timeout: 5000 })

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify theme persists via localStorage
    await expect(async () => {
      const theme = await page.evaluate(() => {
        const state = localStorage.getItem('gitbox-state')
        return state ? JSON.parse(state)?.state?.settings?.theme : null
      })
      expect(theme).toBe('sunrise')
    }).toPass({ timeout: 5000 })

    await expect(html).toHaveAttribute('data-theme', 'sunrise', {
      timeout: 5000,
    })
    await expect(html).not.toHaveClass(/dark/)
  })

  test('should persist system theme after page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Wait for hydration by asserting theme button is visible
    const systemButton = page.locator('button').filter({
      has: page.locator('span:text-is("System")'),
    })
    await expect(systemButton).toBeVisible()

    // Select system theme
    await systemButton.click()

    // System theme should NOT have data-theme attribute (or empty)
    const html = page.locator('html')
    await expect(async () => {
      const dataTheme = await html.getAttribute('data-theme')
      expect(dataTheme === null || dataTheme === '').toBe(true)
    }).toPass({ timeout: 5000 })

    // Reload and verify system theme persists
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify system theme persists via localStorage
    await expect(async () => {
      const dataThemeAfterReload = await html.getAttribute('data-theme')
      expect(dataThemeAfterReload === null || dataThemeAfterReload === '').toBe(
        true,
      )
    }).toPass({ timeout: 5000 })
  })

  test('should persist theme when navigating between pages', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Wait for hydration by asserting theme button is visible
    const graphiteButton = page.locator('button').filter({
      has: page.locator('span:text-is("Graphite")'),
    })
    await expect(graphiteButton).toBeVisible()

    // Select graphite theme (dark theme)
    await graphiteButton.click()

    // Verify theme applied
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)

    // Wait for localStorage write before navigating
    await expect(async () => {
      const theme = await page.evaluate(() => {
        const state = localStorage.getItem('gitbox-state')
        return state ? JSON.parse(state)?.state?.settings?.theme : null
      })
      expect(theme).toBe('graphite')
    }).toPass({ timeout: 5000 })

    // Navigate to boards page
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Theme should persist on boards page
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)

    // Navigate back to settings
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

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

    // Wait for hydration by asserting theme button is visible
    const systemButton = page.locator('button').filter({
      has: page.locator('span:text-is("System")'),
    })
    await expect(systemButton).toBeVisible()

    // Select system theme
    await systemButton.click()

    // Should have dark class (following system preference)
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
    // Should not have data-theme set for system theme
    await expect(async () => {
      const dataTheme = await html.getAttribute('data-theme')
      expect(dataTheme === null || dataTheme === '').toBe(true)
    }).toPass({ timeout: 5000 })
  })

  test('should respect system light mode preference', async ({ page }) => {
    // Emulate light color scheme
    await page.emulateMedia({ colorScheme: 'light' })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Wait for hydration by asserting theme button is visible
    const systemButton = page.locator('button').filter({
      has: page.locator('span:text-is("System")'),
    })
    await expect(systemButton).toBeVisible()

    // Select system theme
    await systemButton.click()

    // Should NOT have dark class (following system preference)
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)
    // Should not have data-theme set for system theme
    await expect(async () => {
      const dataTheme = await html.getAttribute('data-theme')
      expect(dataTheme === null || dataTheme === '').toBe(true)
    }).toPass({ timeout: 5000 })
  })
})
