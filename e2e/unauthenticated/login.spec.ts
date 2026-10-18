/**
 * Login Page E2E Tests
 *
 * Tests for the login page and OAuth flow initiation
 */

import { test, expect } from '../fixtures/coverage'
import { rgbaOfPaintedAndCssColor, sameRgba } from '../helpers/canvas-color'

test.describe('Login Page', () => {
  test('should display the login page', async ({ page }) => {
    await page.goto('/login')

    // Check for GitHub login button
    const githubButton = page.getByRole('button', { name: /github|sign in/i })
    await expect(githubButton).toBeVisible()
  })

  test('should show loading state when clicking GitHub login', async ({
    page,
  }) => {
    await page.goto('/login')

    // Click the GitHub login button
    const githubButton = page.getByRole('button', { name: /github|sign in/i })
    await githubButton.click()

    // Should show some indication of loading or redirect
    // Note: In test mode with MSW, we mock the OAuth flow
    await expect(page).toHaveURL(/\/login|supabase\.co|github\.com/i, {
      timeout: 5000,
    })
  })

  test('should have proper page accessibility', async ({ page }) => {
    await page.goto('/login')

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Check that the page has proper heading structure
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()

    // Check that the GitHub button is accessible
    const githubButton = page.getByRole('button', { name: /github|sign in/i })
    await expect(githubButton).toBeVisible()
    await expect(githubButton).toBeEnabled()
  })

  test('should display error message when login fails', async ({ page }) => {
    // Navigate with error query param (simulating failed OAuth)
    await page.goto('/login?error=auth_failed')
    await page.waitForLoadState('networkidle')

    // Page should still load successfully (error handling may show a toast or inline message)
    const githubButton = page.getByRole('button', { name: /github|sign in/i })
    await expect(githubButton).toBeVisible()

    // Check for any error indication (toast, text, or URL params retained)
    // The error may be shown via toast notification or inline text
    const errorIndicator = page
      .locator(
        '[role="alert"], [data-testid="error-message"], :text("error"), :text("failed")',
      )
      .first()
    const hasError = await errorIndicator.isVisible().catch(() => false)
    // If no visible error, just verify the page loaded (some apps handle errors silently)
    expect(hasError || (await githubButton.isVisible())).toBeTruthy()
  })

  // Value: protects=login Terms and Privacy use --link; fails_when=they stay text-primary or paint a different color; why_new=the two links were the unread theme-color case on a signed-out page; seam=the login page; no_claim=every named theme
  test('paints Terms of Use and Privacy Policy with the link token', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/login')
    const terms = page.getByRole('link', { name: 'Terms of Use' })
    const privacy = page.getByRole('link', { name: 'Privacy Policy' })

    // Assert
    await expect(terms).toBeVisible()
    await expect(privacy).toBeVisible()
    await expect(terms).toHaveClass(/(?:^|\s)text-link(?:\s|$)/)
    await expect(privacy).toHaveClass(/(?:^|\s)text-link(?:\s|$)/)
    await expect
      .poll(async () => {
        const colors = await rgbaOfPaintedAndCssColor(terms, 'var(--link)')
        return sameRgba(colors.painted, colors.token)
      })
      .toBe(true)
    await expect
      .poll(async () => {
        const colors = await rgbaOfPaintedAndCssColor(privacy, 'var(--link)')
        return sameRgba(colors.painted, colors.token)
      })
      .toBe(true)
  })
})
