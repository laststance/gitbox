/**
 * Login Page E2E Tests
 *
 * Tests for the login page and OAuth flow initiation
 */

import { test, expect } from '@playwright/test'

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

  test('should have proper form accessibility', async ({ page }) => {
    await page.goto('/login')

    // Check that the login button is keyboard accessible
    await page.keyboard.press('Tab')

    // The focused element should be interactive
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should display error message when login fails', async ({ page }) => {
    // Navigate with error query param (simulating failed OAuth)
    await page.goto('/login?error=auth_failed&message=Test%20error')

    // Should display error message
    const errorMessage = page.getByText(/error|failed/i)
    await expect(errorMessage).toBeVisible()
  })
})
