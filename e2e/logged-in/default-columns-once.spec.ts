/**
 * Default Columns Once, And One First Board
 *
 * Two requests used to each decide to write the same rows. A board with no
 * column got ten columns when two views repaired it at once, and two first
 * sign-ins of one account each created a "First Board". The repairs and the
 * first board are database functions now: one locks the board row, the other
 * locks the user. These tests talk to the database, not to a page. One view
 * of a board that lost its columns is board-without-columns.spec.ts.
 */

import { expect, test } from '@playwright/test'

import {
  createAnonSupabaseClient,
  createAuthenticatedSupabaseClient,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
  OTHER_USER,
  TEST_USER_ID,
} from '../helpers/db-query'

/** How many calls run at once, so the writes overlap. */
const OVERLAPPING_CALLS = 8

/** The five columns createDefaultStatusLists sends, in preset order. */
const SOFTWARE_RELEASE_COLUMNS = [
  { name: 'Pending', color: '#8B7355' },
  { name: 'Planning', color: '#6B8E23' },
  { name: 'Focus Development', color: '#CD853F' },
  { name: 'MVP Release', color: '#4682B4' },
  { name: 'Production Release', color: '#556B2F' },
]

/** Boards this spec creates. afterEach deletes them by these names. */
const BOARD_NAMES = {
  empty: 'Default columns once',
  alreadyHasOne: 'Default columns leave the one already there',
  badColor: 'Default columns refused color',
  positionRace: Array.from(
    { length: OVERLAPPING_CALLS },
    (_, index) => `Position race ${index}`,
  ),
} as const

/** A board id no row has. */
const MISSING_BOARD_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

/** Password of a user this spec creates and then deletes. */
const THROWAWAY_PASSWORD = 'throwaway-password-1'

/**
 * How many columns a board has, counted with the service role.
 *
 * @param boardId - Board whose columns are counted.
 * @returns The number of columns.
 */
async function countColumns(boardId: string): Promise<number> {
  const { count, error } = await createServiceRoleSupabaseClient()
    .from('statuslist')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId)
  if (error) {
    throw new Error(`countColumns failed: ${error.message}`)
  }
  return count ?? 0
}

/**
 * How many boards a user has, counted with the service role.
 *
 * @param userId - Owner whose boards are counted.
 * @returns The number of boards.
 */
async function countBoardsOf(userId: string): Promise<number> {
  const { count, error } = await createServiceRoleSupabaseClient()
    .from('board')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    throw new Error(`countBoardsOf failed: ${error.message}`)
  }
  return count ?? 0
}

/**
 * A signed-in client for a user that has no board yet.
 *
 * The seed user already has boards, so the first-board function would only
 * show its "do nothing" answer. GoTrue creates this user; the caller deletes
 * them, and the boards go with the account.
 *
 * @returns The new user's id and a client whose `auth.uid()` is that user.
 */
async function signInUserWithNoBoard(): Promise<{
  userId: string
  client: ReturnType<typeof createAuthenticatedSupabaseClient>
}> {
  const admin = createServiceRoleSupabaseClient()
  const email = `first-board-${crypto.randomUUID()}@gitbox.dev`
  const created = await admin.auth.admin.createUser({
    email,
    password: THROWAWAY_PASSWORD,
    email_confirm: true,
  })
  if (created.error) {
    throw new Error(`createUser failed: ${created.error.message}`)
  }
  const userId = created.data.user?.id
  if (typeof userId !== 'string') {
    throw new Error('createUser returned no id')
  }

  const signedIn = await createAnonSupabaseClient().auth.signInWithPassword({
    email,
    password: THROWAWAY_PASSWORD,
  })
  const accessToken = signedIn.data.session?.access_token
  if (signedIn.error || typeof accessToken !== 'string') {
    await admin.auth.admin.deleteUser(userId)
    throw new Error(`signIn failed: ${signedIn.error?.message ?? 'no session'}`)
  }

  return {
    userId,
    client: createAuthenticatedSupabaseClient(accessToken),
  }
}

test.describe('Default columns once, and one first board', () => {
  test.afterEach(async () => {
    const { error } = await createServiceRoleSupabaseClient()
      .from('board')
      .delete()
      .in('name', [
        BOARD_NAMES.empty,
        BOARD_NAMES.alreadyHasOne,
        BOARD_NAMES.badColor,
        ...BOARD_NAMES.positionRace,
      ])
    if (error) {
      throw new Error(`cleanup of created boards failed: ${error.message}`)
    }
  })

  test('eight repairs of one empty board at once leave its five default columns', async () => {
    // Arrange: a board whose only column was deleted
    const testUser = createTestUserSupabaseClient()
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.empty,
      p_columns: [{ name: 'Only column', color: '#111111' }],
    })
    expect(created.error).toBeNull()
    const boardId: string = created.data.id
    const removed = await testUser
      .from('statuslist')
      .delete()
      .eq('board_id', boardId)
    expect(removed.error).toBeNull()
    expect(await countColumns(boardId)).toBe(0)

    // Act
    const repairs = await Promise.all(
      Array.from({ length: OVERLAPPING_CALLS }, async () =>
        testUser.rpc('ensure_default_status_lists', {
          p_board_id: boardId,
          p_columns: SOFTWARE_RELEASE_COLUMNS,
        }),
      ),
    )

    // Assert: one set of columns, each in its own cell
    for (const repair of repairs) {
      expect(repair.error).toBeNull()
    }
    expect(await countColumns(boardId)).toBe(5)
    const stored = await testUser
      .from('statuslist')
      .select('name, grid_row, grid_col')
      .eq('board_id', boardId)
      .order('grid_col', { ascending: true })
    expect(stored.error).toBeNull()
    expect(stored.data).toEqual([
      { name: 'Pending', grid_row: 0, grid_col: 0 },
      { name: 'Planning', grid_row: 0, grid_col: 1 },
      { name: 'Focus Development', grid_row: 0, grid_col: 2 },
      { name: 'MVP Release', grid_row: 0, grid_col: 3 },
      { name: 'Production Release', grid_row: 0, grid_col: 4 },
    ])
  })

  test('a board that already has a column is not given the default ones', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.alreadyHasOne,
      p_columns: [{ name: 'Only column', color: '#111111' }],
    })
    expect(created.error).toBeNull()
    const boardId: string = created.data.id

    // Act
    const repair = await testUser.rpc('ensure_default_status_lists', {
      p_board_id: boardId,
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert: the column that was there is the column that is returned
    expect(repair.error).toBeNull()
    expect(repair.data).toEqual([
      expect.objectContaining({
        name: 'Only column',
        color: '#111111',
        grid_col: 0,
      }),
    ])
    expect(await countColumns(boardId)).toBe(1)
  })

  test('a color the table would refuse inserts nothing on an empty board', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const created = await testUser.rpc('create_board_with_status_lists', {
      p_name: BOARD_NAMES.badColor,
      p_columns: [{ name: 'Only column', color: '#111111' }],
    })
    expect(created.error).toBeNull()
    const boardId: string = created.data.id
    const removed = await testUser
      .from('statuslist')
      .delete()
      .eq('board_id', boardId)
    expect(removed.error).toBeNull()

    // Act
    const repair = await testUser.rpc('ensure_default_status_lists', {
      p_board_id: boardId,
      p_columns: [{ name: 'Pending', color: 'red' }],
    })

    // Assert
    expect(repair.data).toBeNull()
    expect(repair.error?.code).toBe('23514')
    expect(repair.error?.message).toBe(
      'ensure_default_status_lists: 1 column(s) lack a name of 1 to 50 characters or a #RRGGBB color',
    )
    expect(await countColumns(boardId)).toBe(0)
  })

  test("another user's board is not found, and its columns stay", async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()
    const columnsBefore = await countColumns(OTHER_USER.boardId)

    // Act
    const repair = await testUser.rpc('ensure_default_status_lists', {
      p_board_id: OTHER_USER.boardId,
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert: the same answer as a board that does not exist
    expect(repair.data).toBeNull()
    expect(repair.error?.code).toBe('P0002')
    expect(repair.error?.message).toBe(
      'ensure_default_status_lists: board not found',
    )
    expect(await countColumns(OTHER_USER.boardId)).toBe(columnsBefore)
  })

  test('a board that does not exist is not found', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const repair = await testUser.rpc('ensure_default_status_lists', {
      p_board_id: MISSING_BOARD_ID,
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert
    expect(repair.data).toBeNull()
    expect(repair.error?.code).toBe('P0002')
    expect(repair.error?.message).toBe(
      'ensure_default_status_lists: board not found',
    )
  })

  test('a visitor without an account cannot ask for the default columns', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const repair = await visitor.rpc('ensure_default_status_lists', {
      p_board_id: MISSING_BOARD_ID,
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert
    expect(repair.data).toBeNull()
    expect(repair.error?.code).toBe('42501')
    expect(repair.error?.message).toBe(
      'permission denied for function ensure_default_status_lists',
    )
  })

  test('a caller that may run the repair but is no user is refused before it locks a board', async () => {
    // Arrange
    const serviceRole = createServiceRoleSupabaseClient()

    // Act
    const repair = await serviceRole.rpc('ensure_default_status_lists', {
      p_board_id: MISSING_BOARD_ID,
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert
    expect(repair.data).toBeNull()
    expect(repair.error?.code).toBe('42501')
    expect(repair.error?.message).toBe(
      'ensure_default_status_lists: the caller is not signed in',
    )
  })

  test('eight creates at once land on eight positions', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const created = await Promise.all(
      BOARD_NAMES.positionRace.map(async (name) =>
        testUser.rpc('create_board_with_status_lists', {
          p_name: name,
          p_columns: [{ name: 'Only column', color: '#111111' }],
        }),
      ),
    )

    // Assert
    for (const board of created) {
      expect(board.error).toBeNull()
    }
    const stored = await createServiceRoleSupabaseClient()
      .from('board')
      .select('position')
      .in('name', [...BOARD_NAMES.positionRace])
    expect(stored.error).toBeNull()
    expect(stored.data).toHaveLength(OVERLAPPING_CALLS)
    const positions = new Set(stored.data?.map((board) => board.position))
    expect(positions.size).toBe(OVERLAPPING_CALLS)
  })

  test('a user who already has a board is not given a First Board', async () => {
    // Arrange: the seed user has boards
    const testUser = createTestUserSupabaseClient()
    const boardsBefore = await countBoardsOf(TEST_USER_ID)

    // Act
    const firstBoard = await testUser.rpc('create_first_board_if_needed', {
      p_name: 'First Board',
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert
    expect(firstBoard.error).toBeNull()
    expect(firstBoard.data).toBeNull()
    expect(await countBoardsOf(TEST_USER_ID)).toBe(boardsBefore)
  })

  test('eight first sign-ins of a new account at once leave one First Board', async () => {
    // Arrange
    const { userId, client } = await signInUserWithNoBoard()
    const admin = createServiceRoleSupabaseClient()

    try {
      // Act
      const calls = await Promise.all(
        Array.from({ length: OVERLAPPING_CALLS }, async () =>
          client.rpc('create_first_board_if_needed', {
            p_name: 'First Board',
            p_columns: SOFTWARE_RELEASE_COLUMNS,
          }),
        ),
      )

      // Assert: one call created the board, the rest found it
      for (const call of calls) {
        expect(call.error).toBeNull()
      }
      const created = calls.filter((call) => call.data !== null)
      expect(created).toHaveLength(1)
      expect(created[0]?.data.name).toBe('First Board')
      expect(await countBoardsOf(userId)).toBe(1)
      const boardId: string = created[0]?.data.id
      expect(await countColumns(boardId)).toBe(5)
    } finally {
      await admin.auth.admin.deleteUser(userId)
    }
  })

  test('a new account is refused a first board whose name is too long, and gets no board', async () => {
    // Arrange
    const { userId, client } = await signInUserWithNoBoard()
    const admin = createServiceRoleSupabaseClient()

    try {
      // Act
      const firstBoard = await client.rpc('create_first_board_if_needed', {
        p_name: 'x'.repeat(51),
        p_columns: SOFTWARE_RELEASE_COLUMNS,
      })

      // Assert: the called function's own check, and the lock did not insert
      expect(firstBoard.data).toBeNull()
      expect(firstBoard.error?.code).toBe('23514')
      expect(firstBoard.error?.message).toBe(
        'create_board_with_status_lists: the board name must have 1 to 50 characters',
      )
      expect(await countBoardsOf(userId)).toBe(0)
    } finally {
      await admin.auth.admin.deleteUser(userId)
    }
  })

  test('a visitor without an account cannot ask for a first board', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const firstBoard = await visitor.rpc('create_first_board_if_needed', {
      p_name: 'First Board',
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert
    expect(firstBoard.data).toBeNull()
    expect(firstBoard.error?.code).toBe('42501')
    expect(firstBoard.error?.message).toBe(
      'permission denied for function create_first_board_if_needed',
    )
  })

  test('a caller that may run the first-board function but is no user is refused, and nothing is created', async () => {
    // Arrange
    const serviceRole = createServiceRoleSupabaseClient()

    // Act
    const firstBoard = await serviceRole.rpc('create_first_board_if_needed', {
      p_name: 'First Board',
      p_columns: SOFTWARE_RELEASE_COLUMNS,
    })

    // Assert
    expect(firstBoard.data).toBeNull()
    expect(firstBoard.error?.code).toBe('42501')
    expect(firstBoard.error?.message).toBe(
      'create_first_board_if_needed: the caller is not signed in',
    )
  })
})
