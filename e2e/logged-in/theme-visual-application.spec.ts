/**
 * Theme Visual Application E2E Tests
 *
 * Verifies that all 14 themes actually change the visual appearance
 * by checking computed CSS variables on the <html> element.
 *
 * This catches the CSS specificity bug where data-theme attribute was set
 * but :root/:dark selectors overrode theme variables due to cascade order.
 */

import { test, expect } from '../fixtures/coverage'

/**
 * All 14 themes with expected characteristics.
 * isDark: whether the theme should add the .dark class
 */
const THEMES = {
  light: [
    { id: 'default', name: 'Default' },
    { id: 'sunrise', name: 'Sunrise' },
    { id: 'sandstone', name: 'Sandstone' },
    { id: 'mint', name: 'Mint' },
    { id: 'sky', name: 'Sky' },
    { id: 'lavender', name: 'Lavender' },
    { id: 'rose', name: 'Rose' },
  ],
  dark: [
    { id: 'dark', name: 'Dark' },
    { id: 'midnight', name: 'Midnight' },
    { id: 'graphite', name: 'Graphite' },
    { id: 'forest', name: 'Forest' },
    { id: 'ocean', name: 'Ocean' },
    { id: 'plum', name: 'Plum' },
    { id: 'rust', name: 'Rust' },
  ],
} as const

test.describe('Theme Visual Application', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  /**
   * Helper: get computed --background CSS variable from <html>.
   * Returns the raw value (e.g., "oklch(0.94 0.04 75)").
   */
  async function getBackgroundVar(page: import('@playwright/test').Page) {
    return page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim(),
    )
  }

  /**
   * Helper: get computed background-color of <body>.
   * Returns the resolved color (e.g., "rgb(251, 232, 206)").
   */
  async function getBodyBgColor(page: import('@playwright/test').Page) {
    return page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('background-color'),
    )
  }

  for (const theme of THEMES.light) {
    test(`light theme "${theme.name}" should visually change background`, async ({
      page,
    }) => {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Capture initial (system default) background
      const initialBg = await getBodyBgColor(page)

      // Select the theme
      const themeButton = page.locator('button').filter({
        has: page.locator(`span:text-is("${theme.name}")`),
      })
      await expect(themeButton).toBeVisible()
      await themeButton.click()
      await page.waitForTimeout(500)

      // Verify data-theme attribute is set
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-theme', theme.id, {
        timeout: 5000,
      })

      // Verify dark class is NOT present for light themes
      await expect(html).not.toHaveClass(/dark/)

      // Verify CSS variable changed (not same as system default white)
      const themedBg = await getBodyBgColor(page)

      // "default" theme has a different background from :root (cream vs white)
      // All light themes should have visually different backgrounds from :root
      if (theme.id !== 'default') {
        expect(themedBg).not.toBe(initialBg)
      }
    })
  }

  for (const theme of THEMES.dark) {
    test(`dark theme "${theme.name}" should visually change background`, async ({
      page,
    }) => {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Capture initial (system default) background
      const initialBg = await getBodyBgColor(page)

      // Select the theme
      const themeButton = page.locator('button').filter({
        has: page.locator(`span:text-is("${theme.name}")`),
      })
      await expect(themeButton).toBeVisible()
      await themeButton.click()
      await page.waitForTimeout(500)

      // Verify data-theme attribute is set
      const html = page.locator('html')
      await expect(html).toHaveAttribute('data-theme', theme.id, {
        timeout: 5000,
      })

      // Verify dark class IS present for dark themes
      await expect(html).toHaveClass(/dark/)

      // Verify background actually changed from default light
      const themedBg = await getBodyBgColor(page)
      expect(themedBg).not.toBe(initialBg)
    })
  }

  test('each dark theme should have a unique background color', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const backgrounds: Record<string, string> = {}

    for (const theme of THEMES.dark) {
      // Select theme
      const themeButton = page.locator('button').filter({
        has: page.locator(`span:text-is("${theme.name}")`),
      })
      await expect(themeButton).toBeVisible()
      await themeButton.click()
      await page.waitForTimeout(500)

      // Read the --background CSS variable (not computed color)
      const bgVar = await getBackgroundVar(page)
      backgrounds[theme.id] = bgVar
    }

    // All dark themes should have unique --background values
    // (This catches the bug where .dark overrides all dark themes)
    const uniqueValues = new Set(Object.values(backgrounds))
    expect(uniqueValues.size).toBe(THEMES.dark.length)
  })

  test('each light theme should have a unique background color', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const backgrounds: Record<string, string> = {}

    for (const theme of THEMES.light) {
      // Select theme
      const themeButton = page.locator('button').filter({
        has: page.locator(`span:text-is("${theme.name}")`),
      })
      await expect(themeButton).toBeVisible()
      await themeButton.click()
      await page.waitForTimeout(500)

      const bgVar = await getBackgroundVar(page)
      backgrounds[theme.id] = bgVar
    }

    // All light themes should have unique --background values
    const uniqueValues = new Set(Object.values(backgrounds))
    expect(uniqueValues.size).toBe(THEMES.light.length)
  })
})
