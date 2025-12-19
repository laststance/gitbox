/**
 * Browser Screenshots: Kanban Board (User Story 3 - T143)
 *
 * Capture visual snapshots of Kanban board functionality for:
 * - Documentation
 * - Visual regression testing
 * - Stakeholder demos
 * - Accessibility verification
 */

import { test, expect } from '@playwright/test'

test.describe('User Story 3: Kanban Board Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Prerequisites: Logged in, test board exists
    await page.goto('http://localhost:3008')
    await page.waitForLoadState('networkidle')
  })

  test('SS-US3-01: Full Kanban board view with all columns', async ({
    page,
  }) => {
    // Full board with all status columns displayed
    await expect(page.locator('[data-testid^="status-column-"]')).toHaveCount(
      5,
      { timeout: 5000 },
    )

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-01-kanban-board-full-view.png',
      fullPage: true,
    })
  })

  test('SS-US3-02: Backlog column with repository cards', async ({ page }) => {
    // View focused on Backlog column
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    await expect(backlogColumn).toBeVisible()

    await backlogColumn.screenshot({
      path: 'tests/e2e/screenshots/us3-02-backlog-column.png',
    })
  })

  test('SS-US3-03: Repository card detail view', async ({ page }) => {
    // Individual repository card details
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible()

    await card.screenshot({
      path: 'tests/e2e/screenshots/us3-03-repo-card-detail.png',
    })
  })

  test('SS-US3-04: Card hover state', async ({ page }) => {
    // Card hover state
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible()

    await card.hover()
    await page.waitForTimeout(300) // Wait for hover animation to complete

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-04-card-hover-state.png',
    })
  })

  test('SS-US3-05: Card with overflow menu open', async ({ page }) => {
    // Overflow menu open state
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible()

    // Open menu with . key
    await card.focus()
    await page.keyboard.press('.')

    const menu = page.locator('[data-testid="overflow-menu"]')
    await expect(menu).toBeVisible({ timeout: 1000 })

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-05-overflow-menu-open.png',
    })
  })

  test('SS-US3-06: Drag operation in progress', async ({ page }) => {
    // Visual state during drag operation
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible()

    // Start drag
    await card.hover()
    await page.mouse.down()
    await page.waitForTimeout(200)

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-06-drag-in-progress.png',
      fullPage: true,
    })

    await page.mouse.up()
  })

  test('SS-US3-07: WIP limit warning displayed', async ({ page }) => {
    // WIP limit warning displayed state
    const inProgressColumn = page.locator(
      '[data-testid="status-column-in-progress"]',
    )
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')

    // Move cards up to WIP limit
    const cards = backlogColumn.locator('[data-testid^="repo-card-"]')
    for (let i = 0; i < 4; i++) {
      await cards.nth(i).dragTo(inProgressColumn)
      await page.waitForTimeout(300)
    }

    const wipWarning = page.locator('[data-testid="wip-limit-warning"]')
    if (await wipWarning.isVisible()) {
      await page.screenshot({
        path: 'tests/e2e/screenshots/us3-07-wip-limit-warning.png',
      })
    }
  })

  test('SS-US3-08: Empty column state', async ({ page }) => {
    // Empty status column
    // NOTE: Only if test data has an empty column
    const doneColumn = page.locator('[data-testid="status-column-done"]')
    const cardsInDone = doneColumn.locator('[data-testid^="repo-card-"]')

    if ((await cardsInDone.count()) === 0) {
      await doneColumn.screenshot({
        path: 'tests/e2e/screenshots/us3-08-empty-column-state.png',
      })
    }
  })

  test('SS-US3-09: Keyboard navigation focus state', async ({ page }) => {
    // Focus state with keyboard navigation
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    const focusedCard = page.locator('[data-testid^="repo-card-"]:focus')
    if (await focusedCard.isVisible()) {
      await page.screenshot({
        path: 'tests/e2e/screenshots/us3-09-keyboard-focus-state.png',
      })
    }
  })

  test('SS-US3-10: Board with 100+ repositories (virtual scroll)', async ({
    page,
  }) => {
    // View with many repositories with virtual scroll enabled
    // NOTE: Only if test data has 100+ repositories
    const allCards = page.locator('[data-testid^="repo-card-"]')
    const cardCount = await allCards.count()

    if (cardCount >= 20) {
      // Threshold where @tanstack/react-virtual becomes active
      await page.screenshot({
        path: 'tests/e2e/screenshots/us3-10-virtual-scroll-active.png',
        fullPage: true,
      })
    }
  })

  test('SS-US3-11: Mobile responsive view (iPhone)', async ({
    page,
    viewport,
  }) => {
    // Mobile view (portrait)
    await page.setViewportSize({ width: 375, height: 812 }) // iPhone X/11/12/13

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-11-mobile-portrait.png',
      fullPage: true,
    })
  })

  test('SS-US3-12: Mobile responsive view (landscape)', async ({ page }) => {
    // Mobile view (landscape)
    await page.setViewportSize({ width: 812, height: 375 }) // iPhone landscape

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-12-mobile-landscape.png',
      fullPage: true,
    })
  })

  test('SS-US3-13: Tablet responsive view (iPad)', async ({ page }) => {
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 }) // iPad portrait

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-13-tablet-portrait.png',
      fullPage: true,
    })
  })

  test('SS-US3-14: Desktop wide view (4K)', async ({ page }) => {
    // Desktop wide screen view
    await page.setViewportSize({ width: 3840, height: 2160 }) // 4K resolution

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-14-desktop-4k.png',
      fullPage: false, // Viewport only
    })
  })

  test('SS-US3-15: Dark theme comparison', async ({ page }) => {
    // Board display with dark theme
    // NOTE: If theme switching is implemented
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-15-dark-theme.png',
      fullPage: true,
    })
  })

  test('SS-US3-16: Accessibility features - High contrast', async ({
    page,
  }) => {
    // High contrast mode
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' })
    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-16-high-contrast-mode.png',
      fullPage: true,
    })
  })
})

test.describe('User Story 3: Undo Operation Screenshots', () => {
  test('SS-US3-17: Before undo (card moved)', async ({ page }) => {
    await page.goto('http://localhost:3008')
    await page.waitForLoadState('networkidle')

    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    // Move card
    await card.dragTo(todoColumn)
    await page.waitForTimeout(300)

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-17-before-undo.png',
      fullPage: true,
    })
  })

  test('SS-US3-18: After undo (card restored)', async ({ page }) => {
    await page.goto('http://localhost:3008')
    await page.waitForLoadState('networkidle')

    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    // Move card then undo
    await card.dragTo(todoColumn)
    await page.waitForTimeout(300)

    await page.keyboard.press('z')
    await page.waitForTimeout(300)

    await page.screenshot({
      path: 'tests/e2e/screenshots/us3-18-after-undo.png',
      fullPage: true,
    })
  })
})
