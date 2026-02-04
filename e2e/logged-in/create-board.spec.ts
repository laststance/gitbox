/**
 * Create Board Page E2E Tests
 *
 * Tests for the board creation page (/boards/new)
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Features tested:
 * - Page rendering and form elements
 * - Form validation
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Create Board Page (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const CREATE_BOARD_URL = '/boards/new'

  test.beforeEach(async ({ page }) => {
    await page.goto(CREATE_BOARD_URL)
    await page.waitForLoadState('networkidle')
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

    test('should display Cancel and Create Board buttons', async ({ page }) => {
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      const createButton = page.getByRole('button', { name: /create board/i })

      await expect(cancelButton).toBeVisible()
      await expect(createButton).toBeVisible()
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
      await page.waitForLoadState('networkidle')

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
