/**
 * SSR Hydration E2E Tests - Board Page
 *
 * Verifies that the authenticated board page SSR and hydration
 * work correctly with the useMounted hook (useSyncExternalStore pattern).
 *
 * Tests for Phase 1 refactoring:
 * - KanbanBoard grid styles with isMounted
 * - No hydration mismatch for dynamic grid templates
 *
 * @remarks
 * The KanbanBoard component uses isMounted to delay rendering
 * dynamic grid styles until client-side hydration is complete,
 * preventing SSR/CSR mismatch errors.
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

test.describe('SSR Hydration - Board Page (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test('board page should not have hydration mismatch errors', async ({
    page,
  }) => {
    // Collect console messages for hydration errors
    const hydrationErrors: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      // Check for React hydration-related errors
      if (
        text.includes('Hydration') ||
        text.includes('hydration') ||
        text.includes('mismatch') ||
        text.includes('did not match') ||
        text.includes('server-rendered HTML')
      ) {
        hydrationErrors.push(text)
      }
    })

    // Navigate to board page
    await page.goto(BOARD_URL)

    // Wait for hydration to complete
    await page.waitForLoadState('networkidle')

    // No hydration errors should occur
    expect(hydrationErrors).toHaveLength(0)
  })

  test('kanban board grid should render after mount', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // The board content area should be visible
    const boardContent = page.locator('main').first()
    await expect(boardContent).toBeVisible({ timeout: 10000 })

    // Grid container should have proper CSS grid applied after hydration
    // Note: suppressHydrationWarning is used, so no mismatch error expected
    const gridContainer = page.locator('.grid.gap-4').first()

    // Wait for grid to be visible (rendered after mount)
    await expect(gridContainer).toBeVisible({ timeout: 10000 })
  })

  test('board page should display action buttons after hydration', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Action buttons should be visible after hydration
    const addRepoButton = page.getByRole('button', {
      name: /add repositories/i,
    })
    await expect(addRepoButton).toBeVisible({ timeout: 10000 })

    const addColumnButton = page.getByRole('button', { name: /add column/i })
    await expect(addColumnButton).toBeVisible({ timeout: 10000 })
  })

  test('board page should not flash or flicker during hydration', async ({
    page,
  }) => {
    // Navigate to board page
    await page.goto(BOARD_URL)

    // Main layout should be visible quickly (SSR)
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 3000 })

    // Wait for full hydration
    await page.waitForLoadState('networkidle')

    // Main should still be visible (no flashing)
    await expect(main).toBeVisible()
  })

  test('board header should render without hydration issues', async ({
    page,
  }) => {
    const hydrationErrors: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('Hydration') || text.includes('mismatch')) {
        hydrationErrors.push(text)
      }
    })

    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Header elements should be visible
    const allBoardsLink = page.getByRole('link', { name: /all boards/i })
    await expect(allBoardsLink).toBeVisible({ timeout: 10000 })

    // No hydration errors
    expect(hydrationErrors).toHaveLength(0)
  })
})
