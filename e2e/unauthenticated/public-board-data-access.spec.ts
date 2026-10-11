/**
 * Public Board Data Access E2E Tests
 *
 * What the database itself hands out for shared boards, asked directly
 * through the REST API the way any holder of the public API key can.
 *
 * Shared boards used to be readable straight from the tables by everyone:
 * all of them could be listed without knowing a share link, and every row
 * carried the owner's account id. Now the tables answer their owner only and
 * a shared board is read through `get_public_board(p_slug)`.
 *
 * These tests talk to the database, not to a page: the app's public board
 * page never showed the owner's id, so no page test can catch this.
 */

import { expect, test } from '@playwright/test'

import {
  BOARD_IDS,
  OTHER_USER,
  PUBLIC_BOARD_SLUG,
  TEST_USER_ID,
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Share slug of the board seed.sql gives the second user. */
const OTHER_USER_PUBLIC_BOARD_SLUG = 'f6e5d4c3b2a1'

/** A board this spec creates and deletes itself: private, yet with a slug. */
const PRIVATE_BOARD_WITH_SLUG = {
  id: '00000000-0000-0000-0000-00000000f215',
  slug: 'fedcba987654',
} as const

/** A shared board this spec creates and deletes itself, with cards added out of order. */
const BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER = {
  id: '00000000-0000-0000-0000-00000000f216',
  columnId: '00000000-0000-0000-0000-00000000f217',
  slug: 'abcdef123456',
} as const

test.describe('Public board data access', () => {
  test('a visitor without an account cannot list boards, columns or cards from the tables', async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const boards = await visitor
      .from('board')
      .select('id')
      .eq('is_public', true)
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

  test("a signed-in user cannot read another user's public board from the tables", async () => {
    // Arrange: seed.sql gives the second user a public board with two cards
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

  test("a signed-in user cannot change or delete another user's public board or its cards", async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act: row level security hides the rows, so each statement matches none
    const renamedBoards = await testUser
      .from('board')
      .update({ name: 'Taken over' })
      .eq('id', OTHER_USER.boardId)
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

    // Assert: nothing matched, and the rows are as seed.sql left them
    expect(renamedBoards.data).toEqual([])
    expect(movedCards.data).toEqual([])
    expect(deletedCards.data).toEqual([])
    const serviceRole = createServiceRoleSupabaseClient()
    const { data: board } = await serviceRole
      .from('board')
      .select('name')
      .eq('id', OTHER_USER.boardId)
      .single()
    expect(board).toEqual({ name: 'Other User Public Board' })
    const { data: card } = await serviceRole
      .from('repocard')
      .select('repo_name')
      .eq('id', OTHER_USER.testRepoCardId)
      .single()
    expect(card).toEqual({ repo_name: 'test-repo' })
  })

  test('a signed-in user still reads their own boards from the tables', async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const boards = await testUser
      .from('board')
      .select('id')
      .eq('id', BOARD_IDS.testBoard)

    // Assert
    expect(boards.error).toBeNull()
    expect(boards.data).toEqual([{ id: BOARD_IDS.testBoard }])
  })

  test("a share link's lookup returns the board, its columns and its cards without the owner's account id", async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const { data: sharedBoard, error } = await visitor.rpc('get_public_board', {
      p_slug: PUBLIC_BOARD_SLUG,
    })

    // Assert: every key is listed, so a field added to the function by
    // mistake fails here
    expect(error).toBeNull()
    expect(Object.keys(sharedBoard).sort()).toEqual([
      'board',
      'repocard',
      'statuslist',
    ])
    expect(Object.keys(sharedBoard.board).sort()).toEqual(['name', 'subtitle'])
    expect(sharedBoard.statuslist.length).toBeGreaterThan(0)
    expect(sharedBoard.statuslist[0].board_id).toBe(BOARD_IDS.testBoard)
    expect(Object.keys(sharedBoard.statuslist[0]).sort()).toEqual([
      'board_id',
      'color',
      'created_at',
      'grid_col',
      'grid_row',
      'id',
      'name',
      'order',
      'updated_at',
    ])
    expect(sharedBoard.repocard.length).toBeGreaterThan(0)
    expect(Object.keys(sharedBoard.repocard[0]).sort()).toEqual([
      'board_id',
      'created_at',
      'id',
      'meta',
      'order',
      'repo_name',
      'repo_owner',
      'status_id',
      'updated_at',
    ])
    expect(JSON.stringify(sharedBoard)).not.toContain(TEST_USER_ID)
  })

  test("a share link's lookup works for another user's public board too", async () => {
    // Arrange
    const testUser = createTestUserSupabaseClient()

    // Act
    const { data: sharedBoard, error } = await testUser.rpc(
      'get_public_board',
      { p_slug: OTHER_USER_PUBLIC_BOARD_SLUG },
    )

    // Assert
    expect(error).toBeNull()
    expect(sharedBoard.board.name).toBe('Other User Public Board')
    expect(
      sharedBoard.repocard
        .map((card: { repo_name: string }) => card.repo_name)
        .sort(),
    ).toEqual(['private-project', 'test-repo'])
    expect(JSON.stringify(sharedBoard)).not.toContain(OTHER_USER.id)
  })

  test("a share link's lookup returns nothing for a slug no board has", async () => {
    // Arrange
    const visitor = createAnonSupabaseClient()

    // Act
    const { data: sharedBoard, error } = await visitor.rpc('get_public_board', {
      p_slug: 'aabbccddeeff',
    })

    // Assert
    expect(error).toBeNull()
    expect(sharedBoard).toBeNull()
  })

  test.describe('a board that has a slug but is not public', () => {
    test.beforeEach(async () => {
      const { error } = await createServiceRoleSupabaseClient()
        .from('board')
        .upsert({
          id: PRIVATE_BOARD_WITH_SLUG.id,
          user_id: TEST_USER_ID,
          name: 'Private Board With Slug',
          is_public: false,
          share_slug: PRIVATE_BOARD_WITH_SLUG.slug,
        })
      expect(error).toBeNull()
    })

    test.afterEach(async () => {
      const { error } = await createServiceRoleSupabaseClient()
        .from('board')
        .delete()
        .eq('id', PRIVATE_BOARD_WITH_SLUG.id)
      expect(error).toBeNull()
    })

    test("its share link's lookup returns nothing", async () => {
      // Arrange
      const visitor = createAnonSupabaseClient()

      // Act
      const { data: sharedBoard, error } = await visitor.rpc(
        'get_public_board',
        { p_slug: PRIVATE_BOARD_WITH_SLUG.slug },
      )

      // Assert
      expect(error).toBeNull()
      expect(sharedBoard).toBeNull()
    })
  })

  test.describe('a shared board whose cards were added out of order', () => {
    /** Removes the board; its column and cards go with it (ON DELETE CASCADE). */
    async function deleteBoardWithCardsAddedOutOfOrder(): Promise<void> {
      const { error } = await createServiceRoleSupabaseClient()
        .from('board')
        .delete()
        .eq('id', BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.id)
      expect(error).toBeNull()
    }

    test.beforeEach(async () => {
      // A run that was cut short may have left the board behind
      await deleteBoardWithCardsAddedOutOfOrder()

      const database = createServiceRoleSupabaseClient()
      const board = await database.from('board').insert({
        id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.id,
        user_id: TEST_USER_ID,
        name: 'Board With Cards Added Out Of Order',
        is_public: true,
        share_slug: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.slug,
      })
      expect(board.error).toBeNull()
      const column = await database.from('statuslist').insert({
        id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.columnId,
        board_id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.id,
        name: 'To Do',
      })
      expect(column.error).toBeNull()
      // Added last-to-first, so the order the rows were written in is the
      // reverse of the order on the board
      const cards = await database.from('repocard').insert([
        {
          board_id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.id,
          status_id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.columnId,
          repo_owner: 'card-order-probe',
          repo_name: 'third-on-the-board',
          order: 2,
        },
        {
          board_id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.id,
          status_id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.columnId,
          repo_owner: 'card-order-probe',
          repo_name: 'second-on-the-board',
          order: 1,
        },
        {
          board_id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.id,
          status_id: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.columnId,
          repo_owner: 'card-order-probe',
          repo_name: 'first-on-the-board',
          order: 0,
        },
      ])
      expect(cards.error).toBeNull()
    })

    test.afterEach(async () => {
      await deleteBoardWithCardsAddedOutOfOrder()
    })

    test("its share link's lookup returns the cards in the order they have on the board", async () => {
      // Arrange
      const visitor = createAnonSupabaseClient()

      // Act
      const { data: sharedBoard, error } = await visitor.rpc(
        'get_public_board',
        { p_slug: BOARD_WITH_CARDS_ADDED_OUT_OF_ORDER.slug },
      )

      // Assert
      expect(error).toBeNull()
      expect(
        sharedBoard.repocard.map(
          (card: { repo_name: string }) => card.repo_name,
        ),
      ).toEqual([
        'first-on-the-board',
        'second-on-the-board',
        'third-on-the-board',
      ])
    })
  })
})
