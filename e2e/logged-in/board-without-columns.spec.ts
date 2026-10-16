/**
 * Board Without Columns E2E Tests
 *
 * A board is created together with its columns, but nothing stops its owner
 * from deleting every one of them: "Delete Column" is offered on the last
 * column too. A board without columns can take no card, so the next time it
 * is opened the server gives it the five columns of the Software Release
 * preset (`createDefaultStatusLists`, called by `getBoardBundle`).
 * Two repairs at once are `e2e/logged-in/default-columns-once.spec.ts`.
 *
 * Nothing fetches the board again after a column is deleted, so the columns
 * are written by the one page load this test makes.
 */

import { test, expect } from '../fixtures/coverage'
import {
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Name of the board this spec creates; boards of that name are deleted afterwards. */
const BOARD_NAME = 'Board that loses its columns'

/** Delete the boards this spec created, with their columns. */
async function removeBoardsOfThisSpec(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('board')
    .delete()
    .eq('name', BOARD_NAME)
  if (error) {
    throw new Error(`removeBoardsOfThisSpec failed: ${error.message}`)
  }
}

test.describe('Board without columns', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  // Before as well as after: a board left by an interrupted run would be
  // found by name in the assertions
  test.beforeEach(removeBoardsOfThisSpec)
  test.afterEach(removeBoardsOfThisSpec)

  test('a board whose last column was deleted gets the five default columns when it is opened again', async ({
    page,
  }) => {
    // Arrange: a board of the test user with a single column
    const created = await createTestUserSupabaseClient().rpc(
      'create_board_with_status_lists',
      {
        p_name: BOARD_NAME,
        p_columns: [{ name: 'Only column', color: '#111111' }],
      },
    )
    expect(created.error).toBeNull()
    const boardId: string = created.data.id
    await page.goto(`/board/${boardId}`)
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('heading', { name: 'Only column', exact: true }),
    ).toBeVisible({ timeout: 15000 })

    // Act: delete that column through its menu, then open the board again
    await page.getByRole('button', { name: 'Column options' }).click()
    await page.getByRole('menuitem', { name: 'Delete Column' }).click()
    await page
      .getByRole('button', { name: 'Delete column Only column' })
      .click()
    await expect(page.getByText('Column deleted')).toBeVisible()
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Assert: the page shows the default columns, and they are stored once
    for (const columnName of [
      'Pending',
      'Planning',
      'Focus Development',
      'MVP Release',
      'Production Release',
    ]) {
      await expect(
        page.getByRole('heading', { name: columnName, exact: true }),
      ).toBeVisible({ timeout: 15000 })
    }
    await expect(
      page.getByRole('heading', { name: 'Only column', exact: true }),
    ).toHaveCount(0)
    const storedColumns = await createServiceRoleSupabaseClient()
      .from('statuslist')
      .select('name, color, order, grid_row, grid_col')
      .eq('board_id', boardId)
      .order('order')
    expect(storedColumns.error).toBeNull()
    expect(storedColumns.data).toEqual([
      { name: 'Pending', color: '#8B7355', order: 0, grid_row: 0, grid_col: 0 },
      {
        name: 'Planning',
        color: '#6B8E23',
        order: 1,
        grid_row: 0,
        grid_col: 1,
      },
      {
        name: 'Focus Development',
        color: '#CD853F',
        order: 2,
        grid_row: 0,
        grid_col: 2,
      },
      {
        name: 'MVP Release',
        color: '#4682B4',
        order: 3,
        grid_row: 0,
        grid_col: 3,
      },
      {
        name: 'Production Release',
        color: '#556B2F',
        order: 4,
        grid_row: 0,
        grid_col: 4,
      },
    ])
  })
})
