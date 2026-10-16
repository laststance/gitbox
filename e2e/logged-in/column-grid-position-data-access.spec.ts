/**
 * Column Grid Position Data Access E2E Tests
 *
 * What the database itself accepts as the row and column of a column, asked
 * directly through the REST API the way any signed-in browser can, without
 * the server actions in front of it.
 *
 * The board page builds one drop zone per cell out to the furthest column.
 * A column at the far end of the integer range hangs that page. The app
 * checks the position it writes; the table has to refuse the rest
 * (constraint `statuslist_grid_position_bounds`, rows and columns 0 through
 * 999).
 *
 * These tests talk to the database, not to a page.
 */

import { expect, test } from '@playwright/test'

import {
  BOARD_IDS,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Name of the column this spec creates, or tries to. */
const SPEC_COLUMN_NAME = 'Data access: grid bound'

/**
 * A column of the Test Board, out of the way of the seeded columns, at the
 * given place.
 * @param gridRow - Row to store.
 * @param gridCol - Column to store.
 * @returns The row to insert into `statuslist`.
 */
function specColumnAt(gridRow: number, gridCol: number) {
  return {
    board_id: BOARD_IDS.testBoard,
    name: SPEC_COLUMN_NAME,
    color: '#6B7280',
    order: 9,
    grid_row: gridRow,
    grid_col: gridCol,
  }
}

/**
 * The places of the columns with the given name, read with the service role.
 * @param columnName - Exact column name.
 * @returns The stored places.
 */
async function readPlacesOfColumnsNamed(
  columnName: string,
): Promise<Array<{ grid_row: number; grid_col: number }>> {
  const { data, error } = await createServiceRoleSupabaseClient()
    .from('statuslist')
    .select('grid_row, grid_col')
    .eq('name', columnName)
  if (error) {
    throw new Error(`readPlacesOfColumnsNamed failed: ${error.message}`)
  }
  return data
}

/** Take away the column this spec creates; later specs count the columns of the Test Board. */
async function removeSpecColumn(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('statuslist')
    .delete()
    .eq('name', SPEC_COLUMN_NAME)
  if (error) {
    throw new Error(`removeSpecColumn failed: ${error.message}`)
  }
}

test.describe('Column grid position data access', () => {
  // Before as well as after: a column left by an interrupted run would be
  // counted by the assertions below
  test.beforeEach(removeSpecColumn)
  test.afterEach(removeSpecColumn)

  test('the owner of a column cannot put it past row 999', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser
      .from('statuslist')
      .insert(specColumnAt(1000, 0))

    // Assert
    expect(created.error?.code).toBe('23514')
    expect(await readPlacesOfColumnsNamed(SPEC_COLUMN_NAME)).toEqual([])
  })

  test('the owner of a column cannot put it past column 999', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser
      .from('statuslist')
      .insert(specColumnAt(0, 1000))

    // Assert
    expect(created.error?.code).toBe('23514')
    expect(await readPlacesOfColumnsNamed(SPEC_COLUMN_NAME)).toEqual([])
  })

  test('the owner of a column cannot give it a negative place', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser
      .from('statuslist')
      .insert(specColumnAt(-1, 0))

    // Assert
    expect(created.error?.code).toBe('23514')
    expect(await readPlacesOfColumnsNamed(SPEC_COLUMN_NAME)).toEqual([])
  })

  test('a column may sit at row 999 and column 999, and cannot be moved past it', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const created = await testUser
      .from('statuslist')
      .insert(specColumnAt(999, 999))
    expect(created.error).toBeNull()

    // Act
    const changed = await testUser
      .from('statuslist')
      .update({ grid_row: 1000 })
      .eq('name', SPEC_COLUMN_NAME)

    // Assert: refused, and the place is what it was
    expect(changed.error?.code).toBe('23514')
    expect(await readPlacesOfColumnsNamed(SPEC_COLUMN_NAME)).toEqual([
      { grid_row: 999, grid_col: 999 },
    ])
  })
})
