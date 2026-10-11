/**
 * Board Creation Data Access E2E Tests
 *
 * What the database itself does when a board is created, asked directly
 * through the REST API the way any signed-in browser can, without the server
 * action in front of it.
 *
 * A board and its columns are written by one function,
 * `create_board_with_status_lists(p_name, p_columns)`, so a board never
 * exists without columns. The unit tests of `createBoard` replace this
 * function with a stub; only a real database can show that it keeps the
 * column order, that a refused call leaves nothing behind, and who may call
 * it.
 *
 * These tests talk to the database, not to a page.
 */

import { expect, test } from '@playwright/test'

import {
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Names of the boards this spec creates, or tries to. Each test uses its own. */
const BOARD_NAMES = {
  threeColumns: 'Data access: three columns',
  noColumns: 'Data access: no columns',
  namelessColumn: 'Data access: nameless column',
  visitor: 'Data access: visitor',
} as const

/**
 * Number of boards with the given name, counted with the service role so row
 * level security cannot hide one.
 * @param boardName - Exact board name.
 * @returns How many boards carry that name.
 */
async function countBoardsNamed(boardName: string): Promise<number> {
  const { count, error } = await createServiceRoleSupabaseClient()
    .from('board')
    .select('id', { count: 'exact', head: true })
    .eq('name', boardName)
  if (error) {
    throw new Error(`countBoardsNamed failed: ${error.message}`)
  }
  return count ?? 0
}

test.describe('Board creation data access', () => {
  test.afterEach(async () => {
    // Later specs count the seed boards; take away what this spec created
    const { error } = await createServiceRoleSupabaseClient()
      .from('board')
      .delete()
      .in('name', Object.values(BOARD_NAMES))
    if (error) {
      throw new Error(`cleanup of created boards failed: ${error.message}`)
    }
  })

  test('a board gets its columns in the order they were sent, side by side in one row', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.threeColumns,
      p_columns: [
        { name: 'Todo', color: '#111111' },
        { name: 'Doing', color: '#222222' },
        { name: 'Done', color: '#333333' },
      ],
    })

    // Assert: the answer lists the columns in order ...
    expect(created.error).toBeNull()
    expect(created.data.name).toBe('Data access: three columns')
    expect(
      created.data.status_lists.map(
        (column: { name: string; color: string }) => ({
          name: column.name,
          color: column.color,
        }),
      ),
    ).toEqual([
      { name: 'Todo', color: '#111111' },
      { name: 'Doing', color: '#222222' },
      { name: 'Done', color: '#333333' },
    ])

    // ... and the rows place them next to each other: the board page puts a
    // column where grid_row and grid_col say
    const columns = await testUser
      .from('statuslist')
      .select('name, order, grid_row, grid_col')
      .eq('board_id', created.data.id)
      .order('order', { ascending: true })
    expect(columns.error).toBeNull()
    expect(columns.data).toEqual([
      { name: 'Todo', order: 0, grid_row: 0, grid_col: 0 },
      { name: 'Doing', order: 1, grid_row: 0, grid_col: 1 },
      { name: 'Done', order: 2, grid_row: 0, grid_col: 2 },
    ])
  })

  test('a board without columns is refused and nothing is created', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.noColumns,
      p_columns: [],
    })

    // Assert
    expect(created.data).toBeNull()
    expect(created.error?.code).toBe('23514')
    expect(created.error?.message).toBe(
      'create_board_with_status_lists: p_columns must be an array with at least one column',
    )
    expect(await countBoardsNamed(BOARD_NAMES.noColumns)).toBe(0)
  })

  test('a column without a name refuses the whole board, the valid column before it included', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.namelessColumn,
      p_columns: [{ name: 'Todo', color: '#111111' }, { color: '#222222' }],
    })

    // Assert
    expect(created.data).toBeNull()
    expect(created.error?.code).toBe('23514')
    expect(created.error?.message).toBe(
      'create_board_with_status_lists: 1 column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
    )
    expect(await countBoardsNamed(BOARD_NAMES.namelessColumn)).toBe(0)
  })

  test('a visitor without an account cannot create a board', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const created = await visitor.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.visitor,
      p_columns: [{ name: 'Todo', color: '#111111' }],
    })

    // Assert
    expect(created.data).toBeNull()
    expect(created.error?.code).toBe('42501')
    expect(await countBoardsNamed(BOARD_NAMES.visitor)).toBe(0)
  })
})
