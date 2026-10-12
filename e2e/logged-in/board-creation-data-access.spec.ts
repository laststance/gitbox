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
 * column order, that a refused call leaves nothing behind, where its limits
 * lie, and who may call it.
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
  serviceRole: 'Data access: service role',
  refusedInput: 'Data access: refused input',
  // 51 characters, one more than a board name may have
  tooLongName: 'x'.repeat(51),
  tooManyColumns: 'Data access: 101 columns',
  // Exactly 50 characters, the longest name a board may have
  longestName: 'Data access: a board name of fifty characters here',
  lastPosition: 'Data access: board at the last position',
  afterLastPosition: 'Data access: board created after it',
  atPosition5000: 'Data access: board at position 5000',
  afterPosition5000: 'Data access: board created behind it',
  hundredColumns: 'Data access: 100 columns',
} as const

/**
 * Name of the one column sent with a call that has no board name. No board
 * can be looked up by a name that was never given, so the test looks for
 * this column instead.
 */
const COLUMN_OF_THE_NAMELESS_BOARD = 'Data access: column of a nameless board'

/** The highest value the `position` column of a board can hold. */
const LAST_BOARD_POSITION = 2147483647

/** One valid column, for calls that are refused for another reason. */
const VALID_COLUMN = { name: 'Todo', color: '#111111' }

/**
 * Calls the function refuses although the caller is signed in: the board name
 * and the columns that are sent, and the exact message the database answers
 * with.
 */
const REFUSED_CALLS = [
  {
    title: 'a board name of 51 characters',
    boardName: BOARD_NAMES.tooLongName,
    columns: [VALID_COLUMN],
    message:
      'create_board_with_status_lists: the board name must have 1 to 50 characters',
  },
  {
    title: 'a board name of spaces only',
    boardName: '   ',
    columns: [VALID_COLUMN],
    message:
      'create_board_with_status_lists: the board name must have 1 to 50 characters',
  },
  {
    title: 'a column name of 51 characters',
    boardName: BOARD_NAMES.refusedInput,
    columns: [{ name: 'y'.repeat(51), color: '#111111' }],
    message:
      'create_board_with_status_lists: 1 column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
  },
  {
    title: 'a column color that is not #RRGGBB',
    boardName: BOARD_NAMES.refusedInput,
    columns: [VALID_COLUMN, { name: 'Done', color: 'red; position: fixed' }],
    message:
      'create_board_with_status_lists: 1 column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
  },
  {
    title: 'a column that is a text instead of an object',
    boardName: BOARD_NAMES.refusedInput,
    columns: ['Todo'],
    message:
      'create_board_with_status_lists: 1 column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
  },
  {
    title: 'one column object instead of a list of columns',
    boardName: BOARD_NAMES.refusedInput,
    columns: VALID_COLUMN,
    message:
      'create_board_with_status_lists: p_columns must be an array of 1 to 100 columns',
  },
  {
    title: 'a text instead of a list of columns',
    boardName: BOARD_NAMES.refusedInput,
    columns: 'Todo',
    message:
      'create_board_with_status_lists: p_columns must be an array of 1 to 100 columns',
  },
  {
    title: 'no list of columns at all (null)',
    boardName: BOARD_NAMES.refusedInput,
    columns: null,
    message:
      'create_board_with_status_lists: p_columns must be an array of 1 to 100 columns',
  },
  {
    title: 'a column without a color',
    boardName: BOARD_NAMES.refusedInput,
    columns: [{ name: 'Todo' }],
    message:
      'create_board_with_status_lists: 1 column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
  },
] as const

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
      'create_board_with_status_lists: p_columns must be an array of 1 to 100 columns',
    )
    expect(await countBoardsNamed(BOARD_NAMES.noColumns)).toBe(0)
  })

  test('a board with 101 columns is refused and nothing is created', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const oneHundredAndOneColumns = Array.from({ length: 101 }, (_, index) => ({
      name: `Column ${index + 1}`,
      color: '#111111',
    }))

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.tooManyColumns,
      p_columns: oneHundredAndOneColumns,
    })

    // Assert
    expect(created.data).toBeNull()
    expect(created.error?.code).toBe('23514')
    expect(created.error?.message).toBe(
      'create_board_with_status_lists: p_columns must be an array of 1 to 100 columns',
    )
    expect(await countBoardsNamed(BOARD_NAMES.tooManyColumns)).toBe(0)
  })

  for (const { title, boardName, columns, message } of REFUSED_CALLS) {
    test(`${title} is refused and nothing is created`, async () => {
      // Arrange
      const testUser = createTestUserSupabaseClient()

      // Act
      const created = await testUser.rpc('create_board_with_status_lists', {
        p_name: boardName,
        p_columns: columns,
      })

      // Assert: the function stores a name without the spaces around it
      expect(created.data).toBeNull()
      expect(created.error?.code).toBe('23514')
      expect(created.error?.message).toBe(message)
      expect(await countBoardsNamed(boardName.trim())).toBe(0)
    })
  }

  test('a call without a board name (null) is refused and nothing is created', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: null,
      p_columns: [{ name: COLUMN_OF_THE_NAMELESS_BOARD, color: '#111111' }],
    })

    // Assert
    expect(created.data).toBeNull()
    expect(created.error?.code).toBe('23514')
    expect(created.error?.message).toBe(
      'create_board_with_status_lists: the board name must have 1 to 50 characters',
    )
    const columnsLeftBehind = await createServiceRoleSupabaseClient()
      .from('statuslist')
      .select('id', { count: 'exact', head: true })
      .eq('name', COLUMN_OF_THE_NAMELESS_BOARD)
    expect(columnsLeftBehind.error).toBeNull()
    expect(columnsLeftBehind.count).toBe(0)
  })

  test('a board with exactly 100 columns, the most one call may write, is created', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const oneHundredColumns = Array.from({ length: 100 }, (_, index) => ({
      name: `Column ${index + 1}`,
      color: '#111111',
    }))

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.hundredColumns,
      p_columns: oneHundredColumns,
    })

    // Assert: all of them, the last one at the right end of the row
    expect(created.error).toBeNull()
    expect(created.data.status_lists).toHaveLength(100)
    const lastColumn = await testUser
      .from('statuslist')
      .select('name, order, grid_row, grid_col')
      .eq('board_id', created.data.id)
      .order('order', { ascending: false })
      .limit(1)
    expect(lastColumn.error).toBeNull()
    expect(lastColumn.data).toEqual([
      { name: 'Column 100', order: 99, grid_row: 0, grid_col: 99 },
    ])
  })

  test('a new board goes right behind the last board of the caller', async () => {
    // Arrange: a board of the test user at position 5000, far behind every
    // board the seed or another spec gave that user
    const testUser = createTestUserSupabaseClient()
    const lastBoard = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.atPosition5000,
      p_columns: [VALID_COLUMN],
    })
    expect(lastBoard.error).toBeNull()
    const moved = await createServiceRoleSupabaseClient()
      .from('board')
      .update({ position: 5000 })
      .eq('id', lastBoard.data.id)
    expect(moved.error).toBeNull()

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.afterPosition5000,
      p_columns: [VALID_COLUMN],
    })

    // Assert
    expect(created.error).toBeNull()
    const createdBoard = await testUser
      .from('board')
      .select('name, position')
      .eq('id', created.data.id)
    expect(createdBoard.data).toEqual([
      { name: 'Data access: board created behind it', position: 5001 },
    ])
  })

  test('a board name and a column name of exactly 50 characters are accepted', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const fiftyCharacterColumnName =
      'A column name of exactly fifty characters, no more'

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.longestName,
      p_columns: [{ name: fiftyCharacterColumnName, color: '#111111' }],
    })

    // Assert
    expect(created.error).toBeNull()
    expect(created.data.name).toBe(
      'Data access: a board name of fifty characters here',
    )
    expect(created.data.name).toHaveLength(50)
    expect(created.data.status_lists[0].name).toBe(
      'A column name of exactly fifty characters, no more',
    )
    expect(created.data.status_lists[0].name).toHaveLength(50)
  })

  test('a user whose last board sits at the highest position can still create a board', async () => {
    // Arrange: a board of the test user at the top of the integer range.
    // Adding 1 to that position would overflow.
    const testUser = createTestUserSupabaseClient()
    const lastBoard = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.lastPosition,
      p_columns: [VALID_COLUMN],
    })
    expect(lastBoard.error).toBeNull()
    const moved = await createServiceRoleSupabaseClient()
      .from('board')
      .update({ position: LAST_BOARD_POSITION })
      .eq('id', lastBoard.data.id)
    expect(moved.error).toBeNull()

    // Act
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.afterLastPosition,
      p_columns: [VALID_COLUMN],
    })

    // Assert: created, at the same highest position
    expect(created.error).toBeNull()
    const createdBoard = await testUser
      .from('board')
      .select('name, position')
      .eq('id', created.data.id)
    expect(createdBoard.data).toEqual([
      { name: 'Data access: board created after it', position: 2147483647 },
    ])
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

  test('a visitor without an account is turned away by the rights of the function, before it runs', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const created = await visitor.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.visitor,
      p_columns: [{ name: 'Todo', color: '#111111' }],
    })

    // Assert: the message is the one of a missing EXECUTE right. The check
    // inside the function answers with the same code and another message
    // ("the caller is not signed in"), so the code alone would not tell
    // whether the REVOKE of the migration is in place.
    expect(created.data).toBeNull()
    expect(created.error?.code).toBe('42501')
    expect(created.error?.message).toBe(
      'permission denied for function create_board_with_status_lists',
    )
    expect(await countBoardsNamed(BOARD_NAMES.visitor)).toBe(0)
  })

  test('a caller that may run the function but is no user is refused by the function itself, and nothing is created', async () => {
    // Arrange: the service role keeps its right to execute the function, and
    // its key names no user, so auth.uid() is NULL inside the function
    const serviceRole = createServiceRoleSupabaseClient()

    // Act
    const created = await serviceRole.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.serviceRole,
      p_columns: [VALID_COLUMN],
    })

    // Assert: the message is the function's own check, its first one. The
    // code is the one of a missing EXECUTE right too (see the visitor above),
    // so the message is what tells the two apart.
    expect(created.data).toBeNull()
    expect(created.error?.code).toBe('42501')
    expect(created.error?.message).toBe(
      'create_board_with_status_lists: the caller is not signed in',
    )
    expect(await countBoardsNamed(BOARD_NAMES.serviceRole)).toBe(0)
  })
})
