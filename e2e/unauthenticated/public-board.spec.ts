/**
 * Public Board E2E Tests
 *
 * Tests for the public board sharing feature (unauthenticated).
 * Validates 404 handling for invalid/non-existent slugs.
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Public Board', () => {
  test('should return 404 for invalid slug format', async ({ page }) => {
    // Slug must be exactly 12 hex chars — "invalid" doesn't match
    await page.goto('/public/invalid-slug')

    // Next.js App Router may stream 200 status before notFound() throws,
    // so verify the 404 page content instead of the HTTP status code
    await expect(page.locator('h1')).toContainText('404')
  })

  test('should return 404 for non-existent valid slug', async ({ page }) => {
    // Valid format (12 hex chars) but no matching board
    await page.goto('/public/aabbccddeeff')

    await expect(page.locator('h1')).toContainText('404')
  })

  test('tells a visitor that a shared board link is not available and offers the home page', async ({
    page,
  }) => {
    // Arrange / Act: valid format (12 hex chars) but no matching board
    await page.goto('/public/aabbccddeeff')

    // Assert: the shared board's own 404, not the root one whose "Go to
    // Boards" only leads a visitor without an account to the login page
    await expect(
      page.getByText("This shared board isn't available."),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to Boards' })).toHaveCount(
      0,
    )
  })

  test('should return 404 for empty slug', async ({ page }) => {
    await page.goto('/public/')

    // Next.js returns 404 for this route (no [slug] param)
    await expect(page.locator('h1')).toContainText('404')
  })
})
