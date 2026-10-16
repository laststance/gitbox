/**
 * Board Data Access E2E Tests
 *
 * What the database itself hands out of boards, columns and cards, asked
 * directly through the REST API the way any holder of the public API key can.
 *
 * `anon` and `authenticated` hold the table grants
 * (`20260625140000_restore_postgrest_role_grants.sql`), so row level security
 * is all that stands between a caller and another account's rows. These are
 * the only tests that check it at the database: a page test goes through the
 * app's own queries, which filter by owner as well.
 */

import { expect, test } from '@playwright/test'

import {
  BOARD_IDS,
  CARD_IDS,
  OTHER_USER,
  STATUS_IDS,
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

test.describe('Board data access', () => {
  // Value: protects=a visitor without an account sees no row of any board, column or card; fails_when=a select policy on board, statuslist or repocard lets the anon role through again; why_new=moved from the spec of link sharing (removed), now reading the whole board table; seam=none; no_claim=other tables
  test('a visitor without an account cannot list boards, columns or cards from the tables', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const boards = await visitor.from('board').select('id')
    const columns = await visitor.from('statuslist').select('id')
    const cards = await visitor.from('repocard').select('id')

    // Assert: no error, simply nothing to see
    expect(boards.error).toBeNull()
    expect(boards.data).toEqual([])
    expect(columns.error).toBeNull()
    expect(columns.data).toEqual([])
    expect(cards.error).toBeNull()
    expect(cards.data).toEqual([])
  })

  // Value: protects=a visitor without an account cannot create a board in someone's name; fails_when=the insert policy of board stops checking auth.uid() against user_id; why_new=the anon role holds the insert grant, so only the policy refuses it; seam=none; no_claim=inserts into statuslist or repocard
  test('a visitor without an account cannot create a board', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const { data, error } = await visitor
      .from('board')
      .insert({ user_id: OTHER_USER.id, name: 'Planted by a visitor' })
      .select('id')

    // Assert: refused, and no such board exists
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
    const { data: planted } = await createServiceRoleSupabaseClient()
      .from('board')
      .select('id')
      .eq('name', 'Planted by a visitor')
    expect(planted).toEqual([])
  })

  // Value: protects=a signed-in user sees nothing of another account's board; fails_when=a select policy reads anything but the owner, as the removed sharing policy once did; why_new=moved from the spec of link sharing (removed); seam=none; no_claim=the app's own queries
  test("a signed-in user cannot read another user's board, its columns or its cards from the tables", async () => {
    // Arrange: seed.sql gives the second user a board with one column and two cards
    const testUser = createTestUserSupabaseClient()

    // Act
    const boards = await testUser
      .from('board')
      .select('id')
      .eq('id', OTHER_USER.boardId)
    const columns = await testUser
      .from('statuslist')
      .select('id')
      .eq('board_id', OTHER_USER.boardId)
    const cards = await testUser
      .from('repocard')
      .select('id')
      .eq('board_id', OTHER_USER.boardId)

    // Assert
    expect(boards.error).toBeNull()
    expect(boards.data).toEqual([])
    expect(columns.error).toBeNull()
    expect(columns.data).toEqual([])
    expect(cards.error).toBeNull()
    expect(cards.data).toEqual([])
  })

  // Value: protects=a signed-in user cannot rename, reorder or delete another account's board, column or card; fails_when=an update or delete policy of board, statuslist or repocard stops checking the owner; why_new=moved from the spec of link sharing (removed), extended to the board delete and both column writes, with every tried field read back; seam=none; no_claim=inserts
  test("a signed-in user cannot change or delete another user's board, its columns or its cards", async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act: row level security hides the rows, so each statement matches none
    const renamedBoards = await testUser
      .from('board')
      .update({ name: 'Taken over' })
      .eq('id', OTHER_USER.boardId)
      .select('id')
    const renamedColumns = await testUser
      .from('statuslist')
      .update({ name: 'Taken over' })
      .eq('id', OTHER_USER.statusId)
      .select('id')
    const movedCards = await testUser
      .from('repocard')
      .update({ order: 99 })
      .eq('id', OTHER_USER.testRepoCardId)
      .select('id')
    const deletedCards = await testUser
      .from('repocard')
      .delete()
      .eq('id', OTHER_USER.testRepoCardId)
      .select('id')
    const deletedColumns = await testUser
      .from('statuslist')
      .delete()
      .eq('id', OTHER_USER.statusId)
      .select('id')
    const deletedBoards = await testUser
      .from('board')
      .delete()
      .eq('id', OTHER_USER.boardId)
      .select('id')

    // Assert: nothing matched, and the rows are as seed.sql left them
    expect(renamedBoards.data).toEqual([])
    expect(renamedColumns.data).toEqual([])
    expect(movedCards.data).toEqual([])
    expect(deletedCards.data).toEqual([])
    expect(deletedColumns.data).toEqual([])
    expect(deletedBoards.data).toEqual([])
    const serviceRole = createServiceRoleSupabaseClient()
    const { data: board } = await serviceRole
      .from('board')
      .select('name')
      .eq('id', OTHER_USER.boardId)
      .single()
    expect(board).toEqual({ name: 'Other User Board' })
    const { data: column } = await serviceRole
      .from('statuslist')
      .select('name')
      .eq('id', OTHER_USER.statusId)
      .single()
    expect(column).toEqual({ name: 'Backlog' })
    const { data: card } = await serviceRole
      .from('repocard')
      .select('repo_name, order')
      .eq('id', OTHER_USER.testRepoCardId)
      .single()
    expect(card).toEqual({ repo_name: 'test-repo', order: 0 })
  })

  // Value: protects=the owner still reads their own board, columns and cards; fails_when=a policy change that shuts others out shuts the owner out too; why_new=moved from the spec of link sharing (removed), extended to columns and cards; seam=none; no_claim=what the app renders
  test('a signed-in user still reads their own board, its columns and its cards from the tables', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const boards = await testUser
      .from('board')
      .select('id')
      .eq('id', BOARD_IDS.testBoard)
    const columns = await testUser
      .from('statuslist')
      .select('id')
      .eq('id', STATUS_IDS.pending)
    const cards = await testUser
      .from('repocard')
      .select('id')
      .eq('id', CARD_IDS.card1)

    // Assert
    expect(boards.error).toBeNull()
    expect(boards.data).toEqual([{ id: BOARD_IDS.testBoard }])
    expect(columns.error).toBeNull()
    expect(columns.data).toEqual([{ id: STATUS_IDS.pending }])
    expect(cards.error).toBeNull()
    expect(cards.data).toEqual([{ id: CARD_IDS.card1 }])
  })
})
