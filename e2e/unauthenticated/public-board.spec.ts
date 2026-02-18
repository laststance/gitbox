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
    const response = await page.goto('/public/invalid-slug')

    expect(response?.status()).toBe(404)
  })

  test('should return 404 for non-existent valid slug', async ({ page }) => {
    // Valid format (12 hex chars) but no matching board
    const response = await page.goto('/public/aabbccddeeff')

    expect(response?.status()).toBe(404)
  })

  test('should return 404 for empty slug', async ({ page }) => {
    const response = await page.goto('/public/')

    // Next.js may return 404 for this route
    expect(response?.status()).toBe(404)
  })
})
