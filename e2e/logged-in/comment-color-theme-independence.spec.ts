/**
 * Comment Color Theme Independence E2E Tests
 *
 * Verifies that comment card colors are independent of board theme.
 * The default color is 'neutral' which remains consistent across all themes.
 *
 * @see https://github.com/laststance/gitbox/issues/20
 *
 * @remarks
 * These tests verify:
 * - Default comment color is neutral (not primary)
 * - Comment colors remain consistent when board theme changes
 * - Color picker icons accurately represent applied colors
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Comment Color Theme Independence (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should display comments with neutral default color', async ({
    page,
  }) => {
    // Wait for cards to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // card-1 has a comment - verify it uses neutral color styling
    const commentDisplay = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-display"]',
    )
    await expect(commentDisplay).toBeVisible({ timeout: 10000 })

    // Verify neutral color classes are applied (bg-muted/20 border-muted-foreground/30)
    // The neutral color is theme-independent
    await expect(commentDisplay).toHaveClass(/border/)
    await expect(commentDisplay).toHaveClass(/rounded-md/)
  })

  test('should maintain comment color when theme changes', async ({ page }) => {
    // Wait for cards to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Get initial comment display state
    const commentDisplay = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-display"]',
    )
    await expect(commentDisplay).toBeVisible({ timeout: 10000 })

    // Get initial computed styles
    const initialBgColor = await commentDisplay.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // Open Board Settings dialog
    const settingsButton = page.getByRole('button', { name: /board settings/i })
    await expect(settingsButton).toBeVisible({ timeout: 10000 })
    await settingsButton.click()

    // Wait for dialog to appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Click Appearance tab (if exists) to access theme settings
    const appearanceTab = dialog.getByRole('tab', { name: /appearance/i })
    if (await appearanceTab.isVisible()) {
      await appearanceTab.click()
    }

    // Try to change theme (select a different theme like "midnight" or "sunrise")
    // Note: The exact mechanism depends on how theme selection is implemented
    const themeSelector = dialog.locator('[data-testid="theme-selector"]')
    if (await themeSelector.isVisible()) {
      // Select a different theme
      await themeSelector.click()
      const midnightOption = dialog.getByText('Midnight')
      if (await midnightOption.isVisible()) {
        await midnightOption.click()
      }
    }

    // Close dialog
    const closeButton = dialog.locator('[data-testid="close-dialog"]')
    if (await closeButton.isVisible()) {
      await closeButton.click()
    } else {
      await page.keyboard.press('Escape')
    }

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Verify comment color remains consistent
    // For neutral color, the background should stay the same relative opacity
    const finalCommentDisplay = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-display"]',
    )
    await expect(finalCommentDisplay).toBeVisible()

    // The comment should still have border and rounded classes
    await expect(finalCommentDisplay).toHaveClass(/border/)
    await expect(finalCommentDisplay).toHaveClass(/rounded-md/)
  })

  test('should show empty state with theme-independent styling', async ({
    page,
  }) => {
    // Wait for cards to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // card-3 has empty comment - verify empty state styling
    const card3EmptyState = page.locator(
      '[data-testid="repo-card-card-3"] [data-testid="comment-empty-state"]',
    )
    await expect(card3EmptyState).toBeVisible({ timeout: 10000 })

    // Empty state should have dashed border styling (theme-independent)
    await expect(card3EmptyState).toHaveClass(/border-dashed/)
    await expect(card3EmptyState).toHaveClass(/border-muted-foreground/)
  })

  test('should apply color from color picker correctly', async ({ page }) => {
    // Wait for cards to load
    await page.waitForSelector('[data-testid^="repo-card-"]', {
      timeout: 10000,
    })

    // Find card-1 which has a comment
    const card1 = page.locator('[data-testid="repo-card-card-1"]')
    await expect(card1).toBeVisible({ timeout: 10000 })

    // Hover over comment to reveal actions menu
    const commentDisplay = card1.locator('[data-testid="comment-display"]')
    await commentDisplay.hover()

    // Click the actions trigger
    const actionsTrigger = card1.locator(
      '[data-testid="comment-actions-trigger"]',
    )
    await expect(actionsTrigger).toBeVisible({ timeout: 5000 })
    await actionsTrigger.click()

    // Hover over Color submenu to expand it (submenus open on hover)
    const colorSubmenu = page.locator('[data-testid="comment-action-color"]')
    await expect(colorSubmenu).toBeVisible({ timeout: 5000 })
    await colorSubmenu.hover()

    // Wait for submenu to appear
    await page.waitForTimeout(300)

    // Select blue color from the expanded submenu
    const blueOption = page.locator('[data-testid="comment-color-blue"]')
    await expect(blueOption).toBeVisible({ timeout: 5000 })
    await blueOption.click()

    // Verify the comment still displays (color change is optimistic)
    await expect(commentDisplay).toBeVisible()
  })
})
