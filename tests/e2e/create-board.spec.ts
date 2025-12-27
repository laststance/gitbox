/**
 * Create Board Page E2E Tests
 *
 * Tests for the board creation page (/boards/new)
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Features tested:
 * - Page rendering and form elements
 * - Theme selection and live preview
 * - Form validation
 */

import { test, expect } from './fixtures/coverage'

test.describe('Create Board Page (Authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  const CREATE_BOARD_URL = '/boards/new'

  test.beforeEach(async ({ page }) => {
    await page.goto(CREATE_BOARD_URL)
    await page.waitForLoadState('domcontentloaded')
  })

  test.describe('Page Rendering', () => {
    test('should display create board page heading', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /create new board/i })
      await expect(heading).toBeVisible({ timeout: 10000 })
    })

    test('should display board name input', async ({ page }) => {
      const input = page.getByPlaceholder(/e\.g\., AI Experiments/i)
      await expect(input).toBeVisible({ timeout: 10000 })
    })

    test('should display theme selection section', async ({ page }) => {
      // Theme label text (Label component, not associated with input)
      await expect(page.getByText('Theme', { exact: true })).toBeVisible({
        timeout: 10000,
      })
      // Light and Dark sections - use paragraph selector for specificity
      await expect(page.locator('p:has-text("Light")')).toBeVisible()
      await expect(page.locator('p:has-text("Dark")')).toBeVisible()
    })

    test('should display Cancel and Create Board buttons', async ({ page }) => {
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      const createButton = page.getByRole('button', { name: /create board/i })

      await expect(cancelButton).toBeVisible()
      await expect(createButton).toBeVisible()
    })
  })

  test.describe('Theme Selection', () => {
    test('should have Default theme selected by default', async ({ page }) => {
      // Check for Default button with selection styling
      const defaultButton = page.locator('button:has-text("Default")').first()
      await expect(defaultButton).toBeVisible()
      await expect(defaultButton).toHaveClass(/border-primary/)
    })

    test('should display all 7 light theme options', async ({ page }) => {
      const lightThemes = [
        'Default',
        'Sunrise',
        'Sandstone',
        'Mint',
        'Sky',
        'Lavender',
        'Rose',
      ]

      for (const themeName of lightThemes) {
        const themeButton = page
          .locator(`button:has-text("${themeName}")`)
          .first()
        await expect(themeButton).toBeVisible()
      }
    })

    test('should display all 7 dark theme options', async ({ page }) => {
      const darkThemes = [
        'Dark',
        'Midnight',
        'Graphite',
        'Forest',
        'Ocean',
        'Plum',
        'Rust',
      ]

      for (const themeName of darkThemes) {
        const themeButton = page
          .locator(`button:has-text("${themeName}")`)
          .first()
        await expect(themeButton).toBeVisible()
      }
    })
  })

  test.describe('Theme Preview', () => {
    test('should apply Default theme to page on load', async ({ page }) => {
      // Wait for React to apply theme via useEffect
      // The theme is applied after the component mounts
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-theme') === 'default',
        { timeout: 10000 },
      )

      const dataTheme = await page.locator('html').getAttribute('data-theme')
      expect(dataTheme).toBe('default')
    })

    test('should apply dark theme when dark theme is selected', async ({
      page,
    }) => {
      // Wait for initial theme to be applied
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-theme') !== null,
        { timeout: 10000 },
      )

      // Click on Midnight theme
      const midnightButton = page.locator('button:has-text("Midnight")').first()
      await midnightButton.click()

      // Wait for theme change
      await page.waitForFunction(
        () =>
          document.documentElement.getAttribute('data-theme') === 'midnight',
        { timeout: 5000 },
      )

      // Check that data-theme attribute is set to "midnight"
      const dataTheme = await page.locator('html').getAttribute('data-theme')
      expect(dataTheme).toBe('midnight')

      // Check that dark class is added
      const hasDarkClass = await page
        .locator('html')
        .evaluate((el) => el.classList.contains('dark'))
      expect(hasDarkClass).toBe(true)
    })

    test('should apply light theme when light theme is selected', async ({
      page,
    }) => {
      // Wait for initial theme
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-theme') !== null,
        { timeout: 10000 },
      )

      // First select a dark theme
      const midnightButton = page.locator('button:has-text("Midnight")').first()
      await midnightButton.click()

      // Wait for dark theme
      await page.waitForFunction(
        () => document.documentElement.classList.contains('dark'),
        { timeout: 5000 },
      )

      // Now select a light theme
      const sunriseButton = page.locator('button:has-text("Sunrise")').first()
      await sunriseButton.click()

      // Wait for sunrise theme
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-theme') === 'sunrise',
        { timeout: 5000 },
      )

      // Check that data-theme is now sunrise
      const dataTheme = await page.locator('html').getAttribute('data-theme')
      expect(dataTheme).toBe('sunrise')

      // Check that dark class is removed
      const hasDarkClass = await page
        .locator('html')
        .evaluate((el) => el.classList.contains('dark'))
      expect(hasDarkClass).toBe(false)
    })

    test('should cycle through multiple themes', async ({ page }) => {
      // Wait for initial theme to be applied
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-theme') !== null,
        { timeout: 10000 },
      )

      const themeSequence = [
        { name: 'Sunrise', id: 'sunrise', isDark: false },
        { name: 'Midnight', id: 'midnight', isDark: true },
        { name: 'Mint', id: 'mint', isDark: false },
        { name: 'Forest', id: 'forest', isDark: true },
        { name: 'Default', id: 'default', isDark: false },
      ]

      for (const theme of themeSequence) {
        const themeButton = page
          .locator(`button:has-text("${theme.name}")`)
          .first()
        await themeButton.click()

        // Wait for theme to be applied
        await page.waitForFunction(
          (expectedTheme) =>
            document.documentElement.getAttribute('data-theme') ===
            expectedTheme,
          theme.id,
          { timeout: 5000 },
        )

        // Verify data-theme attribute
        const dataTheme = await page.locator('html').getAttribute('data-theme')
        expect(dataTheme).toBe(theme.id)

        // Verify dark class
        const hasDarkClass = await page
          .locator('html')
          .evaluate((el) => el.classList.contains('dark'))
        expect(hasDarkClass).toBe(theme.isDark)
      }
    })

    test('should visually update page background when theme changes', async ({
      page,
    }) => {
      // Wait for initial theme to be applied
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-theme') !== null,
        { timeout: 10000 },
      )

      // Get initial background color
      const initialBg = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor
      })

      // Select a dark theme (Midnight)
      const midnightButton = page.locator('button:has-text("Midnight")').first()
      await midnightButton.click()

      // Wait for theme change to be applied
      await page.waitForFunction(
        () =>
          document.documentElement.getAttribute('data-theme') === 'midnight',
        { timeout: 5000 },
      )

      // Get new background color
      const darkBg = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor
      })

      // Background should have changed
      expect(darkBg).not.toBe(initialBg)
    })
  })

  test.describe('Form Validation', () => {
    test('should display character count', async ({ page }) => {
      await expect(page.getByText('0/50 characters')).toBeVisible()
    })

    test('should update character count when typing', async ({ page }) => {
      const input = page.getByPlaceholder(/e\.g\., AI Experiments/i)
      await input.fill('Test Board')

      await expect(page.getByText('10/50 characters')).toBeVisible()
    })

    test('should respect max length of 50 characters', async ({ page }) => {
      const input = page.getByPlaceholder(/e\.g\., AI Experiments/i)
      const longText = 'a'.repeat(60)
      await input.fill(longText)

      // Input should be truncated to 50 characters
      const value = await input.inputValue()
      expect(value.length).toBe(50)
    })
  })

  test.describe('Navigation', () => {
    test('should go back when Cancel is clicked', async ({ page }) => {
      // Navigate to boards first, then to create
      await page.goto('/boards')
      await page.waitForLoadState('domcontentloaded')

      const createLink = page.getByRole('link', { name: /create board/i })
      await createLink.click()
      await expect(page).toHaveURL(/\/boards\/new/)

      // Click Cancel
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await cancelButton.click()

      // Should go back to boards page
      await expect(page).toHaveURL(/\/boards/)
    })
  })
})
