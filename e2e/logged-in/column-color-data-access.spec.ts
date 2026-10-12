/**
 * Column Color Data Access E2E Tests
 *
 * What the database itself accepts as the color of a column, asked directly
 * through the REST API the way any signed-in browser can, without the server
 * actions in front of it.
 *
 * The color of a column is printed into a style attribute, and on a shared
 * board the server prints it into the page a visitor loads. A color such as
 * `red; position: fixed; inset: 0` would add CSS declarations of the board
 * owner's choice to that page. The app checks the color it writes; the table
 * has to refuse the rest (constraint `statuslist_color_hex`).
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
const SPEC_COLUMN_NAME = 'Data access: styled column'

/**
 * A column of the Test Board in the second row of its grid, where it is in
 * nobody's way, with the given color.
 * @param color - Color to store.
 * @returns The row to insert into `statuslist`.
 */
function specColumnWithColor(color: string) {
  return {
    board_id: BOARD_IDS.testBoard,
    name: SPEC_COLUMN_NAME,
    color,
    order: 9,
    grid_row: 1,
    grid_col: 0,
  }
}

/**
 * The colors of the columns with the given name, read with the service role.
 * @param columnName - Exact column name.
 * @returns The stored colors.
 */
async function readColorsOfColumnsNamed(
  columnName: string,
): Promise<(string | null)[]> {
  const { data, error } = await createServiceRoleSupabaseClient()
    .from('statuslist')
    .select('color')
    .eq('name', columnName)
  if (error) {
    throw new Error(`readColorsOfColumnsNamed failed: ${error.message}`)
  }
  return data.map((row) => row.color)
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

test.describe('Column color data access', () => {
  // Before as well as after: a column left by an interrupted run would be
  // counted by the assertions below
  test.beforeEach(removeSpecColumn)
  test.afterEach(removeSpecColumn)

  test('the owner of a column cannot give it a color that carries CSS declarations', async () => {
    // Arrange: a column of the test user with an ordinary color
    const testUser = createTestUserSupabaseClient()
    const created = await testUser
      .from('statuslist')
      .insert(specColumnWithColor('#a1b2c3'))
    expect(created.error).toBeNull()

    // Act
    const changed = await testUser
      .from('statuslist')
      .update({ color: 'red; position: fixed; inset: 0' })
      .eq('name', SPEC_COLUMN_NAME)

    // Assert: refused by the check constraint, and the color is what it was
    expect(changed.error?.code).toBe('23514')
    expect(await readColorsOfColumnsNamed(SPEC_COLUMN_NAME)).toEqual([
      '#a1b2c3',
    ])
  })

  test('a column cannot be created with a color that is not #RRGGBB', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser
      .from('statuslist')
      .insert(specColumnWithColor('rgb(1, 2, 3)'))

    // Assert
    expect(created.error?.code).toBe('23514')
    expect(await readColorsOfColumnsNamed(SPEC_COLUMN_NAME)).toEqual([])
  })

  test('a #RRGGBB color is stored as it was sent, lower case included', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser
      .from('statuslist')
      .insert(specColumnWithColor('#a1b2c3'))

    // Assert
    expect(created.error).toBeNull()
    expect(await readColorsOfColumnsNamed(SPEC_COLUMN_NAME)).toEqual([
      '#a1b2c3',
    ])
  })
})
