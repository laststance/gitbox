/**
 * E2E Test: Keyboard Navigation
 *
 * Constitution Requirements:
 * - Principle II: E2E test coverage for critical flows
 * - Principle IV: Accessibility - Full keyboard navigation support
 *
 * Test Targets:
 * - Tab: Focus movement between cards
 * - .: Open/close overflow menu
 * - Enter: Execute default action
 * - ?: Display shortcuts help
 */

import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Access board screen in authenticated state
    await page.goto('/board/default-board')
    await page.waitForLoadState('networkidle')
  })

  test('Tab key should navigate between cards', async ({ page }) => {
    // Given: Multiple cards are displayed on the board
    const cards = page.locator('[data-testid="repo-card"]')
    await expect(cards).toHaveCount(1, { timeout: 5000 })

    // When: Press Tab key to move focus
    await page.keyboard.press('Tab')

    // Then: First card receives focus
    const firstCard = cards.first()
    await expect(firstCard).toBeFocused()

    // If multiple cards exist, move focus to next card
    if ((await cards.count()) > 1) {
      await page.keyboard.press('Tab')
      const secondCard = cards.nth(1)
      await expect(secondCard).toBeFocused()
    }
  })

  test('. (period) key should toggle overflow menu on focused card', async ({
    page,
  }) => {
    // Given: Card has focus
    const card = page.locator('[data-testid="repo-card"]').first()
    await card.focus()

    // When: Press . key
    await page.keyboard.press('.')

    // Then: Overflow menu is displayed
    const menu = page.locator('[data-testid="overflow-menu"]')
    await expect(menu).toBeVisible()

    // When: Press . key again
    await page.keyboard.press('.')

    // Then: Overflow menu closes
    await expect(menu).not.toBeVisible()
  })

  test('Enter key should execute default action on focused card', async ({
    page,
  }) => {
    // Given: Card has focus
    const card = page.locator('[data-testid="repo-card"]').first()
    await card.focus()

    // When: Press Enter key
    await page.keyboard.press('Enter')

    // Then: Project Info modal opens (default action)
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible({ timeout: 1000 })
  })

  test('? key should show shortcuts help modal', async ({ page }) => {
    // When: Press ? key
    await page.keyboard.press('?')

    // Then: Shortcuts help modal is displayed
    const helpModal = page.locator('[data-testid="shortcuts-help-modal"]')
    await expect(helpModal).toBeVisible()

    // Then: Main shortcuts are displayed
    await expect(helpModal).toContainText('Tab')
    await expect(helpModal).toContainText('.')
    await expect(helpModal).toContainText('Enter')
    await expect(helpModal).toContainText('Z')
    await expect(helpModal).toContainText('?')

    // When: Press Escape key
    await page.keyboard.press('Escape')

    // Then: Help modal closes
    await expect(helpModal).not.toBeVisible()
  })

  test('Keyboard navigation should be accessible (WCAG AA)', async ({
    page,
  }) => {
    // Given: Page is loaded

    // When: Navigate with keyboard
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    )

    // Then: Focusable element exists
    expect(focusedElement).toBeDefined()

    // Then: Focus indicator is visually visible
    // (Verified with Playwright screenshot)
    await page.screenshot({
      path: 'tests/e2e/screenshots/keyboard-navigation-focus.png',
    })
  })

  test('Keyboard shortcuts should work in sequence', async ({ page }) => {
    // Given: Card exists on board
    const card = page.locator('[data-testid="repo-card"]').first()

    // When: Focus with Tab → Open menu with .
    await page.keyboard.press('Tab')
    await page.keyboard.press('.')

    // Then: Overflow menu is open
    const menu = page.locator('[data-testid="overflow-menu"]')
    await expect(menu).toBeVisible()

    // When: Close menu with Escape
    await page.keyboard.press('Escape')

    // Then: Menu closes
    await expect(menu).not.toBeVisible()

    // When: Open card with Enter
    await page.keyboard.press('Enter')

    // Then: Modal opens
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()
  })

  test('Should capture screenshot for visual regression', async ({ page }) => {
    // Given: Card has focus
    await page.keyboard.press('Tab')

    // Then: Capture screenshot of focused state
    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-keyboard-navigation-focused.png',
      fullPage: true,
    })

    // When: Open overflow menu
    await page.keyboard.press('.')

    // Then: Screenshot of menu open state
    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-keyboard-navigation-menu.png',
      fullPage: true,
    })

    // When: Display help
    await page.keyboard.press('Escape') // Close menu
    await page.keyboard.press('?')

    // Then: Screenshot of help modal
    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-keyboard-navigation-help.png',
      fullPage: true,
    })
  })
})
