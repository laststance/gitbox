/**
 * Board Header Inline Edit E2E Tests
 *
 * Tests for click-to-edit behavior on board title and subtitle
 * in the board header (BoardPageClient.tsx).
 *
 * Features tested:
 * - Click text → switches to input (edit mode)
 * - Enter key saves the value
 * - Escape key cancels and reverts
 * - Blur auto-saves
 * - Database persistence verification
 * - Placeholder displayed for empty subtitle
 *
 * @see InlineEditableText component
 */

import { test, expect } from '../fixtures/coverage'
import {
  querySingle,
  BOARD_IDS,
  resetBoardNames,
  resetBoardSubtitles,
} from '../helpers/db-query'

test.describe('Board Header Inline Edit (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  // Reset board name and subtitle before each test for clean state
  test.beforeEach(async ({ page }) => {
    await resetBoardNames()
    await resetBoardSubtitles()
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    // Wait for board header to render
    await expect(page.locator('[data-testid="board-title"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test.describe('Title Display', () => {
    test('should display board title on load', async ({ page }) => {
      const title = page.locator('[data-testid="board-title"]')
      await expect(title).toBeVisible()
      await expect(title).toHaveText('Test Board')
    })

    test('should display board subtitle on load', async ({ page }) => {
      const subtitle = page.locator('[data-testid="board-subtitle"]')
      await expect(subtitle).toBeVisible()
      await expect(subtitle).toHaveText('Main testing board for E2E')
    })
  })

  test.describe('Title Inline Edit', () => {
    test('should enter edit mode when clicking title', async ({ page }) => {
      const title = page.locator('[data-testid="board-title"]')
      await title.click()

      // Input should appear and be focused
      const input = page.locator('[data-testid="board-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })
      await expect(input).toBeFocused()

      // Input should have current title value
      await expect(input).toHaveValue('Test Board')
    })

    test('should save title on Enter key', async ({ page }) => {
      const title = page.locator('[data-testid="board-title"]')
      await title.click()

      const input = page.locator('[data-testid="board-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      // Clear and type new title
      await input.fill('Renamed Board')
      await input.press('Enter')

      // Should exit edit mode and show new title
      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toBeVisible()
      await expect(title).toHaveText('Renamed Board')
    })

    test('should cancel edit on Escape key', async ({ page }) => {
      const title = page.locator('[data-testid="board-title"]')
      await title.click()

      const input = page.locator('[data-testid="board-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      // Type something different
      await input.fill('This should be cancelled')
      await input.press('Escape')

      // Should exit edit mode and show original title
      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toBeVisible()
      await expect(title).toHaveText('Test Board')
    })

    test('should auto-save on blur', async ({ page }) => {
      const title = page.locator('[data-testid="board-title"]')
      await title.click()

      const input = page.locator('[data-testid="board-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('Blur Saved Title')

      // Click elsewhere to trigger blur
      await page.locator('header').click({ position: { x: 500, y: 10 } })

      // Should exit edit mode and show new title
      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toBeVisible()
      await expect(title).toHaveText('Blur Saved Title')
    })

    test('should persist renamed title in database', async ({ page }) => {
      const title = page.locator('[data-testid="board-title"]')
      await title.click()

      const input = page.locator('[data-testid="board-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      const newName = `DB Test Title ${Date.now()}`
      await input.fill(newName)
      await input.press('Enter')

      // Wait for edit mode to close
      await expect(input).not.toBeVisible({ timeout: 5000 })

      // Verify in database
      await expect(async () => {
        const board = await querySingle<{ name: string }>('board', {
          id: BOARD_IDS.testBoard,
        })
        expect(board).not.toBeNull()
        expect(board?.name).toBe(newName)
      }).toPass({ timeout: 10000 })
    })

    test('should not save when value is unchanged', async ({ page }) => {
      const title = page.locator('[data-testid="board-title"]')
      await title.click()

      const input = page.locator('[data-testid="board-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      // Press Enter without changing value
      await input.press('Enter')

      // Should exit edit mode with same title
      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toHaveText('Test Board')
    })
  })

  test.describe('Subtitle Inline Edit', () => {
    test('should enter edit mode when clicking subtitle', async ({ page }) => {
      const subtitle = page.locator('[data-testid="board-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="board-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })
      await expect(input).toBeFocused()

      await expect(input).toHaveValue('Main testing board for E2E')
    })

    test('should save subtitle on Enter key', async ({ page }) => {
      const subtitle = page.locator('[data-testid="board-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="board-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('Updated subtitle')
      await input.press('Enter')

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(subtitle).toBeVisible()
      await expect(subtitle).toHaveText('Updated subtitle')
    })

    test('should cancel subtitle edit on Escape key', async ({ page }) => {
      const subtitle = page.locator('[data-testid="board-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="board-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('This should be cancelled')
      await input.press('Escape')

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(subtitle).toHaveText('Main testing board for E2E')
    })

    test('should persist subtitle in database', async ({ page }) => {
      const subtitle = page.locator('[data-testid="board-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="board-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      const newSubtitle = `DB Subtitle ${Date.now()}`
      await input.fill(newSubtitle)
      await input.press('Enter')

      await expect(input).not.toBeVisible({ timeout: 5000 })

      // Verify in database
      await expect(async () => {
        const board = await querySingle<{ subtitle: string | null }>('board', {
          id: BOARD_IDS.testBoard,
        })
        expect(board).not.toBeNull()
        expect(board?.subtitle).toBe(newSubtitle)
      }).toPass({ timeout: 10000 })
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should enter edit mode with Enter key on focused title', async ({
      page,
    }) => {
      const title = page.locator('[data-testid="board-title"]')

      // Focus via Tab navigation
      await title.focus()
      await page.keyboard.press('Enter')

      const input = page.locator('[data-testid="board-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })
      await expect(input).toBeFocused()
    })
  })
})
