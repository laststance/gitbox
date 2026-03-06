/**
 * Theme Persistence E2E Tests
 *
 * Tests theme selection persistence via Redux Storage Middleware.
 * Theme is selected via sidebar ThemeToggle dropdown.
 * Verifies theme survives page reload and is correctly applied to DOM.
 */

import { test, expect } from '../fixtures/coverage'

/**
 * Helper: select a theme via the sidebar ThemeToggle dropdown.
 * @param page - Playwright page
 * @param themeName - Display name of the theme (e.g., "Midnight", "Sunrise")
 */
async function selectThemeFromSidebar(
  page: import('@playwright/test').Page,
  themeName: string,
) {
  const themeButton = page.locator('aside button:has-text("Theme")')
  await expect(themeButton).toBeVisible()
  await themeButton.click()

  const menuItem = page
    .locator('[role="menuitem"]')
    .filter({ hasText: themeName })
  await expect(menuItem).toBeVisible()
  await menuItem.click()
}

test.describe('Theme Persistence (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('should persist midnight theme after page reload', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    const html = page.locator('html')

    // Select midnight theme (dark theme) via sidebar
    await selectThemeFromSidebar(page, 'Midnight')

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
    }).toPass({ timeout: 10000 })

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
    }).toPass({ timeout: 10000 })

    // Verify theme persists in DOM after reload
    await expect(html).toHaveAttribute('data-theme', 'midnight', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)
  })

  test('should persist sunrise theme after page reload', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Select sunrise theme (light theme) via sidebar
    await selectThemeFromSidebar(page, 'Sunrise')

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
    }).toPass({ timeout: 10000 })

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
    }).toPass({ timeout: 10000 })

    await expect(html).toHaveAttribute('data-theme', 'sunrise', {
      timeout: 5000,
    })
    await expect(html).not.toHaveClass(/dark/)
  })

  test('should persist system theme after page reload', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Select system theme via sidebar
    await selectThemeFromSidebar(page, 'System')

    // System theme should NOT have data-theme attribute (or empty)
    const html = page.locator('html')
    await expect(async () => {
      const dataTheme = await html.getAttribute('data-theme')
      expect(dataTheme === null || dataTheme === '').toBe(true)
    }).toPass({ timeout: 10000 })

    // Reload and verify system theme persists
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify system theme persists via localStorage
    await expect(async () => {
      const dataThemeAfterReload = await html.getAttribute('data-theme')
      expect(dataThemeAfterReload === null || dataThemeAfterReload === '').toBe(
        true,
      )
    }).toPass({ timeout: 10000 })
  })

  test('should persist theme when navigating between pages', async ({
    page,
  }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Select graphite theme (dark theme) via sidebar
    await selectThemeFromSidebar(page, 'Graphite')

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
    }).toPass({ timeout: 10000 })

    // Navigate to settings page
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Theme should persist on settings page
    await expect(html).toHaveAttribute('data-theme', 'graphite', {
      timeout: 5000,
    })
    await expect(html).toHaveClass(/dark/)

    // Navigate back to boards
    await page.goto('/boards')
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

    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Select system theme via sidebar
    await selectThemeFromSidebar(page, 'System')

    // Should have dark class (following system preference)
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
    // Should not have data-theme set for system theme
    await expect(async () => {
      const dataTheme = await html.getAttribute('data-theme')
      expect(dataTheme === null || dataTheme === '').toBe(true)
    }).toPass({ timeout: 10000 })
  })

  test('should respect system light mode preference', async ({ page }) => {
    // Emulate light color scheme
    await page.emulateMedia({ colorScheme: 'light' })

    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Select system theme via sidebar
    await selectThemeFromSidebar(page, 'System')

    // Should NOT have dark class (following system preference)
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)
    // Should not have data-theme set for system theme
    await expect(async () => {
      const dataTheme = await html.getAttribute('data-theme')
      expect(dataTheme === null || dataTheme === '').toBe(true)
    }).toPass({ timeout: 10000 })
  })
})
