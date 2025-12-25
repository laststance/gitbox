/**
 * Landing Page E2E Tests
 *
 * Tests for the public landing page (unauthenticated)
 */

import { test, expect } from '@playwright/test'

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

    // Check for login/get started button
    const loginButton = page.getByRole('link', {
      name: /get started|sign in|github/i,
    })
    await expect(loginButton).toBeVisible()
  })

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/')

    // Check for keyboard accessibility
    await page.keyboard.press('Tab')

    // Verify focus is visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should navigate to login when clicking sign in', async ({ page }) => {
    await page.goto('/')

    // Find and click the login button
    const loginButton = page.getByRole('link', {
      name: /get started|sign in|github/i,
    })
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
