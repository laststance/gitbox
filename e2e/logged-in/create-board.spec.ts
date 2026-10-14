/**
 * Create Board Page E2E Tests
 *
 * Tests for the board creation page (/boards/new)
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Features tested:
 * - Page rendering and form elements
 * - Form validation
 * - A submitted form opens the new board with the columns of its preset
 */

import { test, expect } from '../fixtures/coverage'
import { createServiceRoleSupabaseClient } from '../helpers/db-query'

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

  test.describe('Preset Selection', () => {
    test('should show Web App preset pre-selected', async ({ page }) => {
      // Web App card should have selected styling (border-primary)
      const webAppCard = page.getByRole('radio', { name: /web app/i })
      await expect(webAppCard).toBeVisible({ timeout: 10000 })
      await expect(webAppCard).toBeChecked()
    })

    test('should display all 6 preset cards', async ({ page }) => {
      const presetLabels = [
        'Software Release',
        'Web App',
        'Electron Desktop',
        'CLI Tool',
        'Mobile',
        'macOS',
      ]
      for (const label of presetLabels) {
        await expect(page.getByText(label, { exact: true })).toBeVisible()
      }
    })

    test('should switch preset on click', async ({ page }) => {
      // Click CLI Tool preset
      const cliCard = page.getByRole('radio', { name: /cli tool/i })
      await cliCard.click()
      await expect(cliCard).toBeChecked()

      // Verify CLI Tool column names are visible
      await expect(page.getByText('Command', { exact: true })).toBeVisible()
      await expect(page.getByText('Linter', { exact: true })).toBeVisible()

      // Web App should no longer be checked
      const webAppCard = page.getByRole('radio', { name: /web app/i })
      await expect(webAppCard).not.toBeChecked()
    })
  })

  test.describe('Submitting the form', () => {
    /** Name of the board this group creates. No other spec uses it. */
    const CREATED_BOARD_NAME = 'Create board spec: CLI tools'

    test.afterEach(async () => {
      // Later specs count the seed boards; take the created one away again
      const { error } = await createServiceRoleSupabaseClient()
        .from('board')
        .delete()
        .eq('name', CREATED_BOARD_NAME)
      if (error) {
        throw new Error(`cleanup of the created board failed: ${error.message}`)
      }
    })

    test('a created board opens with the five columns of its preset, left to right in the order of the preset', async ({
      page,
    }) => {
      // Arrange
      await page
        .getByPlaceholder(/e\.g\., AI Experiments/i)
        .fill(CREATED_BOARD_NAME)
      await page.getByRole('radio', { name: /cli tool/i }).click()

      // Act
      await page.getByRole('button', { name: 'Create Board' }).click()

      // Assert: the new board opens ...
      await expect(page).toHaveURL(/\/board\/[0-9a-f-]{36}$/, {
        timeout: 15000,
      })
      await expect(page.getByTestId('board-title')).toHaveText(
        CREATED_BOARD_NAME,
        { timeout: 15000 },
      )
      const columns = page.locator('[data-testid^="status-column-"]')
      await expect(columns).toHaveCount(5)

      // ... and its columns stand side by side. A column is placed by its
      // grid fields, so columns created without them would pile up in one cell.
      const placedColumns = await columns.evaluateAll((columnElements) =>
        columnElements.map((columnElement) => {
          const box = columnElement.getBoundingClientRect()
          return {
            title: columnElement.querySelector('h2')?.textContent ?? '',
            left: Math.round(box.left),
            top: Math.round(box.top),
          }
        }),
      )
      const titlesLeftToRight = [...placedColumns]
        .sort((first, second) => first.left - second.left)
        .map((column) => column.title)
      expect(titlesLeftToRight).toEqual([
        'Command',
        'Framework',
        'Generator',
        'Linter',
        'Config',
      ])
      expect(new Set(placedColumns.map((column) => column.left)).size).toBe(5)
      expect(new Set(placedColumns.map((column) => column.top)).size).toBe(1)
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
