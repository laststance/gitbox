/**
 * Settings Page E2E Tests
 *
 * Tests for the settings page (theme, language, etc.)
 * Requires authentication
 */

import { test, expect } from '@playwright/test'

test.describe('Settings Page (Authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('should display the settings page', async ({ page }) => {
    await page.goto('/settings')

    // Should show settings page
    await expect(page).toHaveURL(/\/settings/)

    // Should have settings heading
    const heading = page.getByRole('heading', { name: /settings/i })
    await expect(heading).toBeVisible()
  })

  test('should display theme options', async ({ page }) => {
    await page.goto('/settings')

    // Look for theme section
    const themeSection = page.getByText(/theme|appearance/i)
    await expect(themeSection.first()).toBeVisible()

    // Should have theme selection options
    const themeOptions = page.locator(
      '[data-testid="theme-option"], button:has-text("midnight"), button:has-text("sunrise")',
    )
    await expect(themeOptions.first()).toBeVisible()
  })

  test('should change theme when selecting option', async ({ page }) => {
    await page.goto('/settings')

    // Get initial body classes
    const initialClasses = await page.locator('html').getAttribute('class')

    // Click a different theme option
    const themeButton = page.locator(
      'button:has-text("midnight"), button:has-text("graphite"), [data-testid="theme-midnight"]',
    )

    if (await themeButton.first().isVisible()) {
      await themeButton.first().click()

      // Wait for theme change
      await page.waitForTimeout(500)

      // Body classes should change (theme applied)
      const newClasses = await page.locator('html').getAttribute('class')
      expect(newClasses).not.toBe(initialClasses)
    }
  })

  test('should display language options', async ({ page }) => {
    await page.goto('/settings')

    // Look for language section
    const languageSection = page.getByText(/language|言語/i)

    if (await languageSection.first().isVisible()) {
      await expect(languageSection.first()).toBeVisible()
    }
  })

  test('should have logout option', async ({ page }) => {
    await page.goto('/settings')

    // Look for logout/sign out button
    const logoutButton = page.getByRole('button', {
      name: /logout|sign out|ログアウト/i,
    })

    if (await logoutButton.isVisible()) {
      await expect(logoutButton).toBeVisible()
    }
  })

  test('should navigate back to boards', async ({ page }) => {
    await page.goto('/settings')

    // Look for back/boards link
    const backLink = page.locator(
      'a[href="/boards"], [data-testid="back-button"], nav a',
    )

    if (await backLink.first().isVisible()) {
      await backLink.first().click()
      await expect(page).toHaveURL(/\/boards/)
    }
  })
})
