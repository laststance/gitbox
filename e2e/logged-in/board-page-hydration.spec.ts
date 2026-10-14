/**
 * Board page hydration E2E Test
 *
 * The board's columns and cards used to be kept in localStorage. On the
 * next visit the store held them while React hydrated the page, the server
 * had rendered the page without columns, and React threw the server's markup
 * away with error #418 ("Hydration failed"). They are not stored any more,
 * and a copy that an earlier version left behind is not read back.
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_IDS, STATUS_IDS } from '../helpers/db-query'

test.describe('Board page hydration', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('a board opens without a React hydration error in a browser that still holds a board of an earlier version', async ({
    page,
  }) => {
    // Arrange: the state an earlier version stored, with one column of the board
    await page.addInitScript(
      ({ boardId, statusId }) => {
        if (sessionStorage.getItem('gitbox-e2e-old-board-seeded')) return
        sessionStorage.setItem('gitbox-e2e-old-board-seeded', 'true')
        localStorage.setItem(
          'gitbox-state',
          JSON.stringify({
            version: 0,
            state: {
              settings: {
                theme: 'system',
                compactMode: false,
                showCardMetadata: true,
                organizationFilter: 'all',
                sidebarCollapsed: false,
              },
              board: {
                statusLists: [
                  {
                    id: statusId,
                    title: 'Stored by an earlier version',
                    color: '#6B7280',
                    gridRow: 0,
                    gridCol: 0,
                    boardId,
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                  },
                ],
                repoCards: [],
              },
              draft: { notes: {} },
            },
          }),
        )
      },
      { boardId: BOARD_IDS.testBoard, statusId: STATUS_IDS.pending },
    )
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    // Act
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await expect(page.locator('[data-status-column-id]').first()).toBeVisible()
    await page.waitForLoadState('networkidle')

    // Assert: the server's markup was kept, and the stored column is nowhere
    expect(pageErrors).toEqual([])
    await expect(page.getByText('Stored by an earlier version')).toHaveCount(0)
  })

  test('the columns and cards of a board are not written to localStorage', async ({
    page,
  }) => {
    // Arrange
    await page.addInitScript(() => {
      if (sessionStorage.getItem('gitbox-e2e-storage-cleared')) return
      localStorage.removeItem('gitbox-state')
      sessionStorage.setItem('gitbox-e2e-storage-cleared', 'true')
    })
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await expect(page.locator('[data-status-column-id]').first()).toBeVisible()

    // Act: a change the app stores (the sidebar state)
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()

    // Assert
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const stored = localStorage.getItem('gitbox-state')
          return stored === null
            ? null
            : Object.keys(JSON.parse(stored).state).sort()
        }),
      )
      .toEqual(['draft', 'settings'])
  })
})
