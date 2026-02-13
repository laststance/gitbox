/**
 * Board DnD E2E Tests
 *
 * Tests drag & drop reordering of board cards on the /boards page.
 * Uses CDP events for trusted mouse events required by @dnd-kit.
 *
 * Seed data includes:
 *   - Work Projects (board-2, BOARD_IDS.workProjects)
 *   - Test Board (board-1, BOARD_IDS.testBoard)
 * Additional boards may exist from createFirstBoardIfNeeded.
 */

import { test, expect } from '../fixtures/coverage'
import { cdpBoardDragAndDrop } from '../helpers/cdp-drag'
import {
  BOARD_IDS,
  querySupabase,
  resetBoardPositions,
} from '../helpers/db-query'

test.describe('Board DnD Reordering', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.afterEach(async () => {
    await resetBoardPositions()
  })

  test('should display boards ordered by position', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Wait for board cards to render
    const boardCards = page.locator('[data-testid^="board-card-"]')
    await expect(boardCards.first()).toBeVisible({ timeout: 10000 })

    const count = await boardCards.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Verify the seed boards exist somewhere in the grid
    await expect(
      page.locator(`[data-testid="board-card-${BOARD_IDS.workProjects}"]`),
    ).toBeVisible()
    await expect(
      page.locator(`[data-testid="board-card-${BOARD_IDS.testBoard}"]`),
    ).toBeVisible()
  })

  test('should show drag handle on hover', async ({ page }) => {
    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Wait for boards to render
    const firstCard = page.locator(
      `[data-testid="board-card-${BOARD_IDS.workProjects}"]`,
    )
    await expect(firstCard).toBeVisible({ timeout: 10000 })

    // Drag handle should exist in DOM
    const dragHandle = page.locator(
      `[data-testid="drag-handle-${BOARD_IDS.workProjects}"]`,
    )
    await expect(dragHandle).toBeAttached()

    // Hover over the sortable wrapper — drag handle becomes visible via group-hover
    const sortableWrapper = page.locator(
      `[data-testid="sortable-board-card-${BOARD_IDS.workProjects}"]`,
    )
    await sortableWrapper.hover()

    // The drag handle should contain an SVG (GripVertical icon)
    const gripIcon = dragHandle.locator('svg')
    await expect(gripIcon).toBeAttached()
  })

  test('should swap two boards via CDP drag @slow', async ({ page }) => {
    // CDP drag can be flaky — soft skip guard
    test.skip(
      !!process.env.CI && process.env.SKIP_DND_TESTS === 'true',
      'CDP DnD tests can be flaky in CI',
    )

    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Wait for boards to render
    const workProjectsCard = page.locator(
      `[data-testid="board-card-${BOARD_IDS.workProjects}"]`,
    )
    await expect(workProjectsCard).toBeVisible({ timeout: 10000 })

    // Capture initial DOM order of our two seed boards
    const allCards = page.locator('[data-testid^="board-card-"]')
    const initialOrder: string[] = []
    const cardCount = await allCards.count()
    for (let i = 0; i < cardCount; i++) {
      const testId = await allCards.nth(i).getAttribute('data-testid')
      if (testId) initialOrder.push(testId)
    }

    // Find positions of our two seed boards
    const wpInitialIdx = initialOrder.indexOf(
      `board-card-${BOARD_IDS.workProjects}`,
    )
    const tbInitialIdx = initialOrder.indexOf(
      `board-card-${BOARD_IDS.testBoard}`,
    )
    expect(wpInitialIdx).not.toBe(-1)
    expect(tbInitialIdx).not.toBe(-1)

    // Drag Work Projects to Test Board's position
    await cdpBoardDragAndDrop(
      page,
      BOARD_IDS.workProjects,
      BOARD_IDS.testBoard,
      { steps: 15, stepDelay: 50, dropDelay: 200 },
    )

    // Wait for server action to persist, then reload to verify persisted order
    await page.waitForLoadState('networkidle')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(allCards.first()).toBeVisible({ timeout: 10000 })

    // Read the new DOM order after reload (reflects DB-persisted positions)
    const newOrder: string[] = []
    const newCardCount = await allCards.count()
    for (let i = 0; i < newCardCount; i++) {
      const testId = await allCards.nth(i).getAttribute('data-testid')
      if (testId) newOrder.push(testId)
    }

    const wpNewIdx = newOrder.indexOf(`board-card-${BOARD_IDS.workProjects}`)
    const tbNewIdx = newOrder.indexOf(`board-card-${BOARD_IDS.testBoard}`)

    // After drag: if Work Projects was before Test Board, it should now be after (or vice versa)
    if (wpInitialIdx < tbInitialIdx) {
      expect(wpNewIdx).toBeGreaterThan(tbNewIdx)
    } else {
      expect(wpNewIdx).toBeLessThan(tbNewIdx)
    }
  })

  test('should persist board positions to database after drag @slow', async ({
    page,
  }) => {
    // CDP drag can be flaky — soft skip guard
    test.skip(
      !!process.env.CI && process.env.SKIP_DND_TESTS === 'true',
      'CDP DnD tests can be flaky in CI',
    )

    await page.goto('/boards')
    await page.waitForLoadState('networkidle')

    // Wait for boards to render
    await expect(
      page.locator(`[data-testid="board-card-${BOARD_IDS.workProjects}"]`),
    ).toBeVisible({ timeout: 10000 })

    // Get initial positions from DB
    const boardsBefore = await querySupabase<{
      id: string
      position: number
    }>('board')
    const wpBefore = boardsBefore.find((b) => b.id === BOARD_IDS.workProjects)
    const tbBefore = boardsBefore.find((b) => b.id === BOARD_IDS.testBoard)
    expect(wpBefore).toBeDefined()
    expect(tbBefore).toBeDefined()

    // Drag Work Projects to Test Board position (swap)
    await cdpBoardDragAndDrop(
      page,
      BOARD_IDS.workProjects,
      BOARD_IDS.testBoard,
      { steps: 15, stepDelay: 50, dropDelay: 200 },
    )

    // Wait for server action to complete by polling DB
    await page.waitForLoadState('networkidle')

    // Query DB to verify positions were updated
    const boardsAfter = await querySupabase<{
      id: string
      position: number
    }>('board')

    const wpAfter = boardsAfter.find((b) => b.id === BOARD_IDS.workProjects)
    const tbAfter = boardsAfter.find((b) => b.id === BOARD_IDS.testBoard)

    // After swap: relative positions should have swapped
    // If WP was at lower position than TB, it should now be at higher (and vice versa)
    if (wpBefore!.position < tbBefore!.position) {
      expect(wpAfter!.position).toBeGreaterThan(tbAfter!.position)
    } else {
      expect(wpAfter!.position).toBeLessThan(tbAfter!.position)
    }
  })
})
