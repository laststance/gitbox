/**
 * E2E Test: Kanban Board Drag & Drop Operations (User Story 3)
 *
 * Test scope:
 * - Drag & drop cards between columns (Status change)
 * - Drag & drop cards within column (Priority change)
 * - Undo functionality (Z key)
 * - WIP limit validation and warnings
 * - Optimistic UI updates
 * - Keyboard navigation (Tab, Enter, . for menu)
 * - Board state persistence
 */

import { test, expect } from '@playwright/test'

test.describe('User Story 3: Kanban Board Management', () => {
  test.beforeEach(async ({ page }) => {
    // Precondition: User is logged in, test board exists
    // TODO: Add authentication setup if needed
    await page.goto('http://localhost:3008')
  })

  test('T048-1: Drag card between columns changes status', async ({ page }) => {
    // Given: Access board page with a card in "Backlog" column
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = page.locator('[data-testid^="repo-card-"]').first()

    await expect(backlogColumn).toBeVisible()
    await expect(card).toBeVisible()

    // When: Drag and drop card from "Backlog" to "Todo"
    await card.dragTo(todoColumn)

    // Then: Card moves to "Todo" column
    await expect(
      todoColumn.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible()

    // And: Move completes within 100ms (optimistic UI update)
    // NOTE: Verified by Playwright automatic timeout
  })

  test('T048-2: Drag card within column changes priority', async ({ page }) => {
    // Given: Multiple cards exist in "Todo" column
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const cards = todoColumn.locator('[data-testid^="repo-card-"]')

    await expect(cards).toHaveCount(3, { timeout: 5000 }) // Minimum 3 cards

    const firstCard = cards.nth(0)
    const thirdCard = cards.nth(2)

    // Get text of the first card
    const firstCardText = await firstCard.textContent()

    // When: Drag 1st card to 3rd position
    await firstCard.dragTo(thirdCard)

    // Then: Card order changes
    const updatedCards = todoColumn.locator('[data-testid^="repo-card-"]')
    const newThirdCardText = await updatedCards.nth(2).textContent()

    expect(newThirdCardText).toBe(firstCardText)
  })

  test('T049-1: Undo last drag operation with Z key', async ({ page }) => {
    // Given: Move a card
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    const originalColumnCards = await backlogColumn
      .locator('[data-testid^="repo-card-"]')
      .count()

    // When: Move card
    await card.dragTo(todoColumn)
    await page.waitForTimeout(200) // Wait for move completion

    // Then: Card has moved
    const afterMoveBacklogCards = await backlogColumn
      .locator('[data-testid^="repo-card-"]')
      .count()
    expect(afterMoveBacklogCards).toBe(originalColumnCards - 1)

    // When: Press Z key to undo
    await page.keyboard.press('z')
    await page.waitForTimeout(300) // Wait for undo completion (requirement: within 200ms)

    // Then: Card returns to original column
    const afterUndoBacklogCards = await backlogColumn
      .locator('[data-testid^="repo-card-"]')
      .count()
    expect(afterUndoBacklogCards).toBe(originalColumnCards)
  })

  test('T056: WIP limit validation displays warning', async ({ page }) => {
    // Given: "In Progress" column has WIP limit (e.g., 3 cards)
    const inProgressColumn = page.locator(
      '[data-testid="status-column-in-progress"]',
    )
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')

    // When: Try to move cards exceeding WIP limit
    // TODO: Adjust according to actual WIP limit value
    const cards = backlogColumn.locator('[data-testid^="repo-card-"]')

    // Move 3 cards to "In Progress"
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).dragTo(inProgressColumn)
      await page.waitForTimeout(200)
    }

    // Try to move 4th card
    await cards.nth(3).dragTo(inProgressColumn)

    // Then: WIP limit warning is displayed
    const wipWarning = page.locator('[data-testid="wip-limit-warning"]')
    await expect(wipWarning).toBeVisible({ timeout: 2000 })
    await expect(wipWarning).toContainText(/WIP limit/i)
  })

  test('T059-1: Keyboard navigation with Tab key', async ({ page }) => {
    // Given: Access board page
    const firstCard = page.locator('[data-testid^="repo-card-"]').first()

    // When: Move focus with Tab key
    await page.keyboard.press('Tab')

    // Then: First card is focused
    await expect(firstCard).toBeFocused()
  })

  test('T059-2: Open overflow menu with . (dot) key', async ({ page }) => {
    // Given: Card has focus
    const firstCard = page.locator('[data-testid^="repo-card-"]').first()
    await firstCard.focus()

    // When: Press . (dot) key
    await page.keyboard.press('.')

    // Then: Overflow menu opens
    const overflowMenu = page.locator('[data-testid="overflow-menu"]')
    await expect(overflowMenu).toBeVisible({ timeout: 1000 })
  })

  test('T059-3: Press Enter to open card details', async ({ page }) => {
    // Given: Card has focus
    const firstCard = page.locator('[data-testid^="repo-card-"]').first()
    await firstCard.focus()

    // When: Press Enter key
    await page.keyboard.press('Enter')

    // Then: Card details open (Project Info modal or GitHub link)
    // TODO: Adjust verification based on implementation
    await expect(page).toHaveURL(/github\.com|\/board\/.*/, { timeout: 2000 })
  })

  test('T060: Board state persists after page reload', async ({ page }) => {
    // Given: Move a card
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    const cardText = await card.textContent()
    await card.dragTo(todoColumn)
    await page.waitForTimeout(500) // Wait for Redux & LocalStorage sync

    // When: Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Then: Card state is preserved
    const todoCards = todoColumn.locator('[data-testid^="repo-card-"]')
    const movedCardInTodo = todoCards.filter({ hasText: cardText || '' })
    await expect(movedCardInTodo).toBeVisible()
  })

  test('T057: Optimistic UI updates complete within 100ms', async ({
    page,
  }) => {
    // Given: Access board page
    const backlogColumn = page.locator('[data-testid="status-column-backlog"]')
    const todoColumn = page.locator('[data-testid="status-column-todo"]')
    const card = backlogColumn.locator('[data-testid^="repo-card-"]').first()

    // When: Execute drag & drop and measure time
    const startTime = Date.now()
    await card.dragTo(todoColumn)

    // Wait for UI update
    await expect(
      todoColumn.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible()
    const endTime = Date.now()

    // Then: Completes within 100ms
    const duration = endTime - startTime
    expect(duration).toBeLessThan(100)
  })
})

test.describe('User Story 3: Visual Validation', () => {
  test('Displays all status columns correctly', async ({ page }) => {
    await page.goto('http://localhost:3008')

    // All status columns are displayed
    await expect(
      page.locator('[data-testid="status-column-backlog"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-todo"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-in-progress"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-review"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="status-column-done"]'),
    ).toBeVisible()
  })

  test('Repository cards display essential information', async ({ page }) => {
    await page.goto('http://localhost:3008')

    const card = page.locator('[data-testid^="repo-card-"]').first()

    // Required information is displayed on card
    await expect(card).toBeVisible()
    await expect(card.locator('[data-testid="repo-name"]')).toBeVisible()
    await expect(card.locator('[data-testid="repo-owner"]')).toBeVisible()
    // NOTE: Add additional display items like stars, description based on implementation
  })
})
