/**
 * Landing Page E2E Tests
 *
 * Tests for the public landing page (unauthenticated)
 */

import { test, expect } from './fixtures/coverage'

test.describe('Landing Page', () => {
  test('should display the landing page with hero section', async ({
    page,
  }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/GitBox/)

    // Check for main heading
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()

    // Check for login/get started button (it's a button, not a link)
    const loginButton = page.getByRole('button', {
      name: /get started|sign in|github/i,
    })
    await expect(loginButton.first()).toBeVisible()
  })

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/')

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Check for navigation links
    const navLinks = page.getByRole('link', {
      name: /features|how it works|github/i,
    })
    await expect(navLinks.first()).toBeVisible()

    // Navigation should have multiple links
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)
  })

  test('should navigate to login when clicking sign in', async ({ page }) => {
    await page.goto('/')

    // Find and click the sign in button in the header
    const loginButton = page
      .getByRole('button', {
        name: /sign in with github/i,
      })
      .first()
    await loginButton.click()

    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Page should still be functional
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
  })
})
