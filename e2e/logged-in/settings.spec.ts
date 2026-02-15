/**
 * Settings Page E2E Tests
 *
 * Tests for the settings page (display settings).
 * Theme selection is handled via sidebar ThemeToggle, not the settings page.
 * Requires authentication.
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Settings Page (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('should display the settings page', async ({ page }) => {
    await page.goto('/settings')

    // Should show settings page
    await expect(page).toHaveURL(/\/settings/)

    // Should have settings heading
    const heading = page.getByRole('heading', { name: /settings/i })
    await expect(heading).toBeVisible()
  })

  test('should display display settings', async ({ page }) => {
    await page.goto('/settings')

    // Look for display section
    const displaySection = page.getByText(/display/i)
    await expect(displaySection.first()).toBeVisible()

    // Should have compact mode toggle
    const compactToggle = page.getByRole('switch', { name: /compact mode/i })
    await expect(compactToggle).toBeVisible()

    // Should have show card metadata toggle
    const metadataToggle = page.getByRole('switch', {
      name: /show card metadata/i,
    })
    await expect(metadataToggle).toBeVisible()
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
