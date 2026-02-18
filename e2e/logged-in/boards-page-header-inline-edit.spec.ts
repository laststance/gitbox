/**
 * Boards Page Header Inline Edit E2E Tests
 *
 * Tests for click-to-edit behavior on the /boards page title and subtitle.
 * The header text is stored in the user_settings table and falls back to
 * defaults ("My Boards" / "Manage your GitHub repositories in Kanban format")
 * when the user has not customized them.
 *
 * Features tested:
 * - Default title/subtitle display
 * - Click text → switches to input (edit mode)
 * - Enter key saves the value
 * - Escape key cancels and reverts
 * - Blur auto-saves
 * - Database persistence verification
 * - Clearing title reverts to default
 *
 * @see BoardsPageHeader component
 * @see InlineEditableText component
 */

import { test, expect } from '../fixtures/coverage'
import {
  querySingle,
  resetUserSettings,
  TEST_USER_ID,
} from '../helpers/db-query'

test.describe('Boards Page Header Inline Edit (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARDS_URL = '/boards'

  // Reset user settings before each test for clean state
  test.beforeEach(async ({ page }) => {
    await resetUserSettings()
    await page.goto(BOARDS_URL)
    await page.waitForLoadState('networkidle')
    // Wait for header to render
    await expect(page.locator('[data-testid="boards-page-title"]')).toBeVisible(
      { timeout: 10000 },
    )
  })

  test.describe('Default Display', () => {
    test('should display default title "My Boards" on load', async ({
      page,
    }) => {
      const title = page.locator('[data-testid="boards-page-title"]')
      await expect(title).toBeVisible()
      await expect(title).toHaveText('My Boards')
    })

    test('should display default subtitle on load', async ({ page }) => {
      const subtitle = page.locator('[data-testid="boards-page-subtitle"]')
      await expect(subtitle).toBeVisible()
      await expect(subtitle).toHaveText(
        'Manage your GitHub repositories in Kanban format',
      )
    })
  })

  test.describe('Title Inline Edit', () => {
    test('should enter edit mode when clicking title', async ({ page }) => {
      const title = page.locator('[data-testid="boards-page-title"]')
      await title.click()

      const input = page.locator('[data-testid="boards-page-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })
      await expect(input).toBeFocused()
      await expect(input).toHaveValue('My Boards')
    })

    test('should save title on Enter key', async ({ page }) => {
      const title = page.locator('[data-testid="boards-page-title"]')
      await title.click()

      const input = page.locator('[data-testid="boards-page-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('My Projects')
      await input.press('Enter')

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toBeVisible()
      await expect(title).toHaveText('My Projects')
    })

    test('should cancel edit on Escape key', async ({ page }) => {
      const title = page.locator('[data-testid="boards-page-title"]')
      await title.click()

      const input = page.locator('[data-testid="boards-page-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('This should be cancelled')
      await input.press('Escape')

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toBeVisible()
      await expect(title).toHaveText('My Boards')
    })

    test('should auto-save on blur', async ({ page }) => {
      const title = page.locator('[data-testid="boards-page-title"]')
      await title.click()

      const input = page.locator('[data-testid="boards-page-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('Blur Saved Title')

      // Click elsewhere to trigger blur
      await page.locator('main').click({ position: { x: 500, y: 400 } })

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toBeVisible()
      await expect(title).toHaveText('Blur Saved Title')
    })

    test('should persist custom title in database', async ({ page }) => {
      const title = page.locator('[data-testid="boards-page-title"]')
      await title.click()

      const input = page.locator('[data-testid="boards-page-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      const newTitle = `DB Test Title ${Date.now()}`
      await input.fill(newTitle)
      await input.press('Enter')

      await expect(input).not.toBeVisible({ timeout: 5000 })

      // Verify in database
      await expect(async () => {
        const settings = await querySingle<{
          boards_page_title: string | null
        }>('user_settings', { user_id: TEST_USER_ID })
        expect(settings).not.toBeNull()
        expect(settings?.boards_page_title).toBe(newTitle)
      }).toPass({ timeout: 10000 })
    })

    test('should not save when value is unchanged', async ({ page }) => {
      const title = page.locator('[data-testid="boards-page-title"]')
      await title.click()

      const input = page.locator('[data-testid="boards-page-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      // Press Enter without changing value
      await input.press('Enter')

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(title).toHaveText('My Boards')
    })
  })

  test.describe('Subtitle Inline Edit', () => {
    test('should enter edit mode when clicking subtitle', async ({ page }) => {
      const subtitle = page.locator('[data-testid="boards-page-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="boards-page-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })
      await expect(input).toBeFocused()

      await expect(input).toHaveValue(
        'Manage your GitHub repositories in Kanban format',
      )
    })

    test('should save subtitle on Enter key', async ({ page }) => {
      const subtitle = page.locator('[data-testid="boards-page-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="boards-page-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('Track my open-source work')
      await input.press('Enter')

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(subtitle).toBeVisible()
      await expect(subtitle).toHaveText('Track my open-source work')
    })

    test('should cancel subtitle edit on Escape key', async ({ page }) => {
      const subtitle = page.locator('[data-testid="boards-page-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="boards-page-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      await input.fill('This should be cancelled')
      await input.press('Escape')

      await expect(input).not.toBeVisible({ timeout: 5000 })
      await expect(subtitle).toHaveText(
        'Manage your GitHub repositories in Kanban format',
      )
    })

    test('should persist subtitle in database', async ({ page }) => {
      const subtitle = page.locator('[data-testid="boards-page-subtitle"]')
      await subtitle.click()

      const input = page.locator('[data-testid="boards-page-subtitle-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })

      const newSubtitle = `DB Subtitle ${Date.now()}`
      await input.fill(newSubtitle)
      await input.press('Enter')

      await expect(input).not.toBeVisible({ timeout: 5000 })

      // Verify in database
      await expect(async () => {
        const settings = await querySingle<{
          boards_page_subtitle: string | null
        }>('user_settings', { user_id: TEST_USER_ID })
        expect(settings).not.toBeNull()
        expect(settings?.boards_page_subtitle).toBe(newSubtitle)
      }).toPass({ timeout: 10000 })
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should enter edit mode with Enter key on focused title', async ({
      page,
    }) => {
      const title = page.locator('[data-testid="boards-page-title"]')

      await title.focus()
      await page.keyboard.press('Enter')

      const input = page.locator('[data-testid="boards-page-title-input"]')
      await expect(input).toBeVisible({ timeout: 5000 })
      await expect(input).toBeFocused()
    })
  })
})
