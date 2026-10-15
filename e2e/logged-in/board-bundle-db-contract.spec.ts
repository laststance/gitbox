/**
 * Board bundle database contract
 *
 * getBoardBundle turns one PostgREST embed into the board page. These tests
 * hit the local database as the signed-in test user and lock what that embed
 * actually returns:
 * - a missing board is no row and no error (the page calls notFound())
 * - a board with no columns is an empty list, not an error (the page then
 *   creates the default columns; the browser path is board-without-columns)
 * - 1001 cards come back from one embed as 1000, which is why a full page is
 *   read again by getBoardBundle
 * - an embed PostgREST cannot resolve is an error, which getBoardBundle throws
 *   instead of treating as a missing board
 *
 */

import { test, expect } from '../fixtures/coverage'
import { BOARD_BUNDLE_SELECT } from '../../src/lib/constants/board-bundle'
import {
  TEST_USER_ID,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

const CAP_BOARD_NAME = 'Board at the card cap'
const EMPTY_BOARD_NAME = 'Board with its columns removed'
const CARDS_ON_THE_CAPPED_BOARD = 1001

/** Ids created in this process, so cleanup can name them exactly. */
const createdBoardIds: string[] = []

/**
 * Delete the boards this file creates. Cards go with the board.
 *
 * Ids cover the boards this process created. The name filter covers a board
 * left by a killed run, and it is limited to the test user so another
 * account's board of the same name stays.
 */
async function removeBoardsOfThisSpec(): Promise<void> {
  const service = createServiceRoleSupabaseClient()
  if (createdBoardIds.length > 0) {
    const byId = await service.from('board').delete().in('id', createdBoardIds)
    if (byId.error) {
      throw new Error(`removeBoardsOfThisSpec failed: ${byId.error.message}`)
    }
    createdBoardIds.length = 0
  }
  const byName = await service
    .from('board')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .in('name', [CAP_BOARD_NAME, EMPTY_BOARD_NAME])
  if (byName.error) {
    throw new Error(`removeBoardsOfThisSpec failed: ${byName.error.message}`)
  }
}

test.describe('Board bundle database contract', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(removeBoardsOfThisSpec)
  test.afterEach(removeBoardsOfThisSpec)

  test('a missing board is no row and no error', async () => {
    // Arrange
    const missingBoardId = '00000000-0000-0000-0000-000000000999'

    // Act
    const { data, error } = await createTestUserSupabaseClient()
      .from('board')
      .select(BOARD_BUNDLE_SELECT)
      .eq('id', missingBoardId)
      .eq('user_id', TEST_USER_ID)
      .maybeSingle()

    // Assert: null data is the not-found path; an error would be a 500
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  test('a board with no columns comes back with an empty column list', async () => {
    // Arrange: the test user's board, then every column removed
    const created = await createTestUserSupabaseClient().rpc(
      'create_board_with_status_lists',
      {
        p_name: EMPTY_BOARD_NAME,
        p_columns: [{ name: 'Only column', color: '#111111' }],
      },
    )
    expect(created.error).toBeNull()
    const boardId: string = created.data.id
    createdBoardIds.push(boardId)
    const removed = await createServiceRoleSupabaseClient()
      .from('statuslist')
      .delete()
      .eq('board_id', boardId)
    expect(removed.error).toBeNull()

    // Act
    const { data, error } = await createTestUserSupabaseClient()
      .from('board')
      .select(BOARD_BUNDLE_SELECT)
      .eq('id', boardId)
      .eq('user_id', TEST_USER_ID)
      .maybeSingle()

    // Assert
    expect(error).toBeNull()
    expect(data?.statuslist).toEqual([])
    expect(data?.repocard).toEqual([])
  })

  test('a board with 1001 cards returns the first 1000 and drops the highest order', async () => {
    test.setTimeout(60_000)
    // Arrange
    const created = await createTestUserSupabaseClient().rpc(
      'create_board_with_status_lists',
      {
        p_name: CAP_BOARD_NAME,
        p_columns: [{ name: 'Repositories', color: '#6B7280' }],
      },
    )
    expect(created.error).toBeNull()
    const boardId: string = created.data.id
    createdBoardIds.push(boardId)
    const statusId: string = created.data.status_lists[0].id
    const service = createServiceRoleSupabaseClient()
    const cards = Array.from(
      { length: CARDS_ON_THE_CAPPED_BOARD },
      (_, order) => ({
        board_id: boardId,
        status_id: statusId,
        repo_owner: 'bundlecap',
        repo_name: `card-${order}`,
        order,
        meta: {},
      }),
    )
    for (let start = 0; start < cards.length; start += 250) {
      const inserted = await service
        .from('repocard')
        .insert(cards.slice(start, start + 250))
      expect(inserted.error).toBeNull()
    }
    const stored = await service
      .from('repocard')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', boardId)
    expect(stored.count).toBe(CARDS_ON_THE_CAPPED_BOARD)

    // Act: the same embed getBoardBundle sends, ordered so the cap drops the end
    const { data, error } = await createTestUserSupabaseClient()
      .from('board')
      .select(BOARD_BUNDLE_SELECT)
      .eq('id', boardId)
      .eq('user_id', TEST_USER_ID)
      .order('order', { ascending: true, referencedTable: 'repocard' })
      .maybeSingle()

    // Assert
    expect(error).toBeNull()
    const orders = (data?.repocard ?? []).map(
      (card: { order: number }) => card.order,
    )
    expect(orders).toEqual(Array.from({ length: 1000 }, (_, order) => order))
  })

  test('an embed PostgREST cannot resolve is an error, not a missing board', async () => {
    // Arrange: `not_a_real_embed` is not a table or a relationship

    // Act
    const { data, error } = await createTestUserSupabaseClient()
      .from('board')
      .select('*, not_a_real_embed(*)')
      .limit(1)

    // Assert: getBoardBundle throws on this shape instead of returning null
    expect(error).not.toBeNull()
    expect(error?.message).toContain('not_a_real_embed')
    expect(data).toBeNull()
  })
})
