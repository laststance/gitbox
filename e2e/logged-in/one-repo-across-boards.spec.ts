/**
 * One Repository, One Card Per User E2E Tests (Issue #215)
 *
 * A user may place a given GitHub repository on at most one of their boards.
 *
 * UI flows:
 * - The Add Repositories picker lists repositories held by another board under
 *   "Already placed elsewhere" with a link to that board, instead of offering them
 * - The server skips a repository that was placed after the picker opened
 * - Another user's cards never restrict this user
 *
 * Database rules (asserted directly against PostgREST):
 * - Unique index per (user, lower(owner), lower(name))
 * - `repocard.user_id` always equals the board owner and cannot be forged
 * - An insert into another user's board is refused (23503: that board
 *   is not visible, so the owner trigger cannot copy its user)
 * - A card's column must be a column of the card's board, and a column that
 *   holds cards cannot change boards (`repocard_status_board_fkey`, 23503)
 *
 * Fixtures: the MSW GitHub catalog offers `testuser/private-project`, which is
 * on none of the test user's boards in `seed.sql`. The seeded second account
 * owns a board holding `testuser/test-repo` and `testuser/private-project`.
 */

import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  OTHER_USER,
  STATUS_IDS,
  TEST_USER_ID,
  WORK_PROJECTS_STATUS_IDS,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
  querySingle,
  querySupabase,
  resetRepoCards,
} from '../helpers/db-query'

const TEST_BOARD_URL = `/board/${BOARD_IDS.testBoard}`
const WORK_PROJECTS_URL = `/board/${BOARD_IDS.workProjects}`

/** Fixed id for the card these tests place on Work Projects. */
const FIXTURE_CARD_ID = '00000000-0000-0000-0000-0000000003b1'

/**
 * Place a repository on the Work Projects board, bypassing the app.
 * Stands in for "the user placed it in another tab".
 */
async function placeOnWorkProjects(
  repoOwner: string,
  repoName: string,
): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('repocard')
    .insert({
      id: FIXTURE_CARD_ID,
      board_id: BOARD_IDS.workProjects,
      status_id: WORK_PROJECTS_STATUS_IDS.backlog,
      repo_owner: repoOwner,
      repo_name: repoName,
      order: 0,
      meta: {},
    })
  if (error) {
    throw new Error(`placeOnWorkProjects failed: ${error.message}`)
  }
}

/**
 * Put the other user's `testuser/private-project` card back as seeded.
 * `resetRepoCards` only rebuilds the test user's boards; if a regression let
 * that card move onto one of them, it would be deleted there and every later
 * test relying on the second account would fail for an unrelated reason.
 */
async function restoreOtherUserPrivateProjectCard(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('repocard')
    .upsert(
      {
        id: OTHER_USER.privateProjectCardId,
        board_id: OTHER_USER.boardId,
        status_id: OTHER_USER.statusId,
        repo_owner: 'testuser',
        repo_name: 'private-project',
        order: 1,
        meta: { visibility: 'private' },
      },
      { onConflict: 'id' },
    )
  if (error) {
    throw new Error(
      `restoreOtherUserPrivateProjectCard failed: ${error.message}`,
    )
  }
}

/** Open the Test Board and wait until its cards are in the Redux store. */
async function openTestBoard(page: Page): Promise<void> {
  await page.goto(TEST_BOARD_URL)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
}

/** Open the Add Repositories picker and wait until it finished loading. */
async function openPicker(page: Page): Promise<void> {
  const searchInput = page.getByPlaceholder(/search repositories/i)
  const trigger = page.getByRole('button', { name: /add repositories/i })
  await expect(trigger).toBeVisible({ timeout: 10000 })
  // After Back navigation the picker can still be open. The trigger carries
  // the open state itself, so read it there instead of probing for the panel,
  // which renders later and could turn this click into a close.
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click()
  }
  await expect(searchInput).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Loading repositories...')).toBeHidden({
    timeout: 15000,
  })
}

test.describe('One repository per user - picker and dialogs', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(async () => {
    await resetRepoCards()
  })

  test.afterEach(async () => {
    await resetRepoCards()
  })

  test('lists a repository held by another board and links to that board instead of offering it', async ({
    page,
  }) => {
    // Arrange
    await placeOnWorkProjects('testuser', 'private-project')
    await openTestBoard(page)

    // Act
    await openPicker(page)

    // Assert: not offered, listed with where it lives
    const heldList = page.getByRole('list', {
      name: 'Already placed elsewhere',
    })
    await expect(heldList).toBeVisible()
    await expect(page.getByText('Already placed elsewhere (1)')).toBeVisible()
    await expect(heldList.getByText('testuser/private-project')).toBeVisible()
    await expect(
      page.getByText(
        'No repositories to add. The ones below are already placed.',
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('listbox', { name: 'Repository options' }),
    ).toHaveCount(0)

    // Act: follow the link
    const boardLink = heldList.getByRole('link', {
      name: 'On Work Projects, which holds testuser/private-project',
    })
    await expect(boardLink).toHaveText('On Work Projects')
    await expect(boardLink).toHaveAttribute(
      'href',
      `${WORK_PROJECTS_URL}?card=${FIXTURE_CARD_ID}`,
    )
    await boardLink.click()
    await page.waitForLoadState('networkidle')

    // Assert: lands on the holding board, scrolled to that card and focused
    await expect(page).toHaveURL(WORK_PROJECTS_URL)
    const card = page.locator(`[data-repo-card-id="${FIXTURE_CARD_ID}"]`)
    await expect(card).toBeVisible({ timeout: 15000 })
    await expect(card).toBeFocused()
  })

  test('adds nothing and says where the repository lives when it was placed after the picker opened', async ({
    page,
  }) => {
    // Arrange: the picker opens while the repository is still free
    await openTestBoard(page)
    await openPicker(page)
    const option = page
      .getByRole('listbox', { name: 'Repository options' })
      .getByRole('option', { name: /testuser\/private-project/ })
    await expect(option).toBeVisible()
    // ...then "another tab" places it on Work Projects
    await placeOnWorkProjects('testuser', 'private-project')

    // Act
    await option.click()
    await page.getByRole('button', { name: 'Add (1)' }).click()

    // Assert: neutral notice, picker still open, repository now listed as held
    const notice = page.getByRole('note', {
      name: 'Repositories that were not added',
    })
    await expect(notice).toBeVisible({ timeout: 10000 })
    await expect(
      notice.getByRole('heading', { name: 'Repositories that were not added' }),
    ).toBeVisible()
    // The heading names the note. The repository sentence is the list item,
    // so the note's own text is the heading plus that sentence.
    await expect(notice.getByRole('listitem')).toHaveText(
      'testuser/private-project is already on board "Work Projects"',
    )
    // Scoped to the picker panel: Next.js renders its own page-level
    // route announcer with role="alert"
    await expect(
      page.locator('[aria-controls="repository-listbox"]').getByRole('alert'),
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('list', { name: 'Already placed elsewhere' })
        .getByRole('link', {
          name: 'On Work Projects, which holds testuser/private-project',
        }),
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Add (0)' })).toBeDisabled()

    // Assert: no card was created on the Test Board
    const cardsOnTestBoard = await querySupabase<{ repo_name: string }>(
      'repocard',
      { board_id: BOARD_IDS.testBoard, repo_name: 'private-project' },
    )
    expect(cardsOnTestBoard).toHaveLength(0)
  })

  test('offers a repository again after its card was removed from the holding board and the user navigated back', async ({
    page,
  }) => {
    // Arrange: held by Work Projects, picker on Test Board shows it as held
    await placeOnWorkProjects('testuser', 'private-project')
    await openTestBoard(page)
    await openPicker(page)
    await page
      .getByRole('link', {
        name: 'On Work Projects, which holds testuser/private-project',
      })
      .click()
    await expect(page).toHaveURL(WORK_PROJECTS_URL)

    // Act: remove the card on Work Projects, then go Back
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${FIXTURE_CARD_ID}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 15000 })
    await overflowMenuTrigger.click()
    await page
      .locator(`[data-testid="remove-from-board-${FIXTURE_CARD_ID}"]`)
      .click()
    await page
      .locator(`[data-testid="confirm-remove-${FIXTURE_CARD_ID}"]`)
      .click()
    await expect(
      page.locator(`[data-testid="repo-card-${FIXTURE_CARD_ID}"]`),
    ).toHaveCount(0, { timeout: 10000 })
    await expect(async () => {
      expect(await querySingle('repocard', { id: FIXTURE_CARD_ID })).toBeNull()
    }).toPass({ timeout: 10000 })
    await page.goBack()
    await expect(page).toHaveURL(TEST_BOARD_URL)
    await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
    await openPicker(page)

    // Assert: addable again, no stale "held" row
    await expect(
      page
        .getByRole('listbox', { name: 'Repository options' })
        .getByRole('option', { name: /testuser\/private-project/ }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('list', { name: 'Already placed elsewhere' }),
    ).toHaveCount(0)
  })

  test('shows a moved repository as held by its new board without reloading the page', async ({
    page,
  }) => {
    // Arrange
    const cardId = CARD_IDS.card1 // testuser/test-repo
    await openTestBoard(page)

    // Act: move the card to Work Projects through the dialog
    await page
      .locator(`[data-testid="overflow-menu-trigger-${cardId}"]`)
      .click()
    await page
      .locator(`[data-testid="move-to-another-board-${cardId}"]`)
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()
    await dialog.getByRole('button', { name: /^move$/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).toHaveCount(0, { timeout: 5000 })
    await openPicker(page)

    // Assert
    const heldList = page.getByRole('list', {
      name: 'Already placed elsewhere',
    })
    await expect(
      heldList.getByRole('link', {
        name: 'On Work Projects, which holds testuser/test-repo',
      }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page
        .getByRole('listbox', { name: 'Repository options' })
        .getByRole('option', { name: /testuser\/test-repo/ }),
    ).toHaveCount(0)
  })

  test("still offers and adds a repository that sits on another user's board", async ({
    page,
  }) => {
    // Arrange: another account holds private-project on its own board.
    // Row level security hides that card from this session either way, so
    // the rows below do not prove that lookupRepoPlacements filters by
    // owner. That filter is the unit test "reads only the cards on boards
    // owned by the given user". Here the picker must still offer the
    // repository: one repository per user is not one repository for everyone.
    const otherUserBoard = await querySingle<{
      user_id: string
    }>('board', { id: OTHER_USER.boardId })
    expect(otherUserBoard).toMatchObject({
      user_id: OTHER_USER.id,
    })
    const otherUserCards = await querySupabase<{ repo_name: string }>(
      'repocard',
      { board_id: OTHER_USER.boardId },
    )
    expect(otherUserCards.map((card) => card.repo_name).sort()).toEqual([
      'private-project',
      'test-repo',
    ])
    await openTestBoard(page)
    await openPicker(page)

    // Act
    const option = page
      .getByRole('listbox', { name: 'Repository options' })
      .getByRole('option', { name: /testuser\/private-project/ })
    await expect(option).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Already placed elsewhere' }),
    ).toHaveCount(0)
    await option.click()
    await page.getByRole('button', { name: 'Add (1)' }).click()

    // Assert: picker closes and the card exists on the test user's board
    await expect(page.getByPlaceholder(/search repositories/i)).toBeHidden({
      timeout: 10000,
    })
    await expect(async () => {
      const cardsOnTestBoard = await querySupabase<{
        repo_owner: string
        repo_name: string
      }>('repocard', {
        board_id: BOARD_IDS.testBoard,
        repo_name: 'private-project',
      })
      expect(cardsOnTestBoard).toHaveLength(1)
      expect(cardsOnTestBoard[0]?.repo_owner).toBe('testuser')
    }).toPass({ timeout: 10000 })
  })
})

test.describe('One repository per user - database rules', () => {
  test.beforeEach(async () => {
    await resetRepoCards()
  })

  test.afterEach(async () => {
    await resetRepoCards()
    await restoreOtherUserPrivateProjectCard()
  })

  test('rejects a second card for the same repository on another board of the same user', async () => {
    // Arrange: testuser/test-repo is card-1 on Test Board
    const supabase = createServiceRoleSupabaseClient()

    // Act
    const { error } = await supabase.from('repocard').insert({
      board_id: BOARD_IDS.workProjects,
      status_id: WORK_PROJECTS_STATUS_IDS.backlog,
      repo_owner: 'testuser',
      repo_name: 'test-repo',
      order: 0,
      meta: {},
    })

    // Assert
    expect(error?.code).toBe('23505')
    expect(error?.message).toContain('repocard_unique_repo_per_user')
  })

  test('rejects a second card that differs only in letter case', async () => {
    // Arrange
    const supabase = createServiceRoleSupabaseClient()

    // Act
    const { error } = await supabase.from('repocard').insert({
      board_id: BOARD_IDS.workProjects,
      status_id: WORK_PROJECTS_STATUS_IDS.backlog,
      repo_owner: 'TestUser',
      repo_name: 'TEST-REPO',
      order: 0,
      meta: {},
    })

    // Assert
    expect(error?.code).toBe('23505')
    expect(error?.message).toContain('repocard_unique_repo_per_user')
  })

  test('lets two different users each hold the same repository', async () => {
    // Arrange & Act: both rows come from seed.sql
    const testUserCard = await querySingle<{
      user_id: string
      repo_owner: string
      repo_name: string
    }>('repocard', { id: CARD_IDS.card1 })
    const otherUserCard = await querySingle<{
      user_id: string
      repo_owner: string
      repo_name: string
    }>('repocard', { id: OTHER_USER.testRepoCardId })

    // Assert
    expect(testUserCard).toMatchObject({
      user_id: TEST_USER_ID,
      repo_owner: 'testuser',
      repo_name: 'test-repo',
    })
    expect(otherUserCard).toMatchObject({
      user_id: OTHER_USER.id,
      repo_owner: 'testuser',
      repo_name: 'test-repo',
    })
  })

  test('stores the board owner as the card owner even when the insert names someone else', async () => {
    // Arrange
    const supabase = createServiceRoleSupabaseClient()

    // Act
    const { data, error } = await supabase
      .from('repocard')
      .insert({
        id: FIXTURE_CARD_ID,
        board_id: BOARD_IDS.workProjects,
        status_id: WORK_PROJECTS_STATUS_IDS.backlog,
        repo_owner: 'laststance',
        repo_name: 'forged-owner-probe',
        order: 0,
        meta: {},
        user_id: OTHER_USER.id,
      })
      .select('user_id')
      .single()

    // Assert
    expect(error).toBeNull()
    expect(data?.user_id).toBe(TEST_USER_ID)
  })

  test('keeps the board owner as the card owner when an update tries to reassign it', async () => {
    // Arrange
    const supabase = createServiceRoleSupabaseClient()

    // Act
    const { error } = await supabase
      .from('repocard')
      .update({ user_id: OTHER_USER.id })
      .eq('id', CARD_IDS.card1)

    // Assert
    expect(error).toBeNull()
    const card = await querySingle<{ user_id: string }>('repocard', {
      id: CARD_IDS.card1,
    })
    expect(card?.user_id).toBe(TEST_USER_ID)
  })

  test('still allows an ordinary card update such as reordering', async () => {
    // Arrange
    const supabase = createServiceRoleSupabaseClient()

    // Act
    const { error } = await supabase
      .from('repocard')
      .update({ order: 7 })
      .eq('id', CARD_IDS.card1)

    // Assert
    expect(error).toBeNull()
    const card = await querySingle<{ order: number; user_id: string }>(
      'repocard',
      { id: CARD_IDS.card1 },
    )
    expect(card).toMatchObject({ order: 7, user_id: TEST_USER_ID })
  })

  test('re-checks uniqueness for the new owner when a card changes boards', async () => {
    // Arrange: the test user holds testuser/private-project on Work Projects.
    // Test Board holds no private-project, so the older per-board constraint
    // cannot be what rejects the move below: only the per-user index can.
    await placeOnWorkProjects('testuser', 'private-project')
    const supabase = createServiceRoleSupabaseClient()

    // Act: the other user's private-project card is moved onto Test Board,
    // which would make the test user its owner
    const { error } = await supabase.rpc('move_card_to_board', {
      p_card_id: OTHER_USER.privateProjectCardId,
      p_target_board_id: BOARD_IDS.testBoard,
      p_target_status_id: STATUS_IDS.planning,
    })

    // Assert: rejected by the per-user index, the card stays with its owner
    expect(error?.code).toBe('23505')
    expect(error?.message).toContain('repocard_unique_repo_per_user')
    const card = await querySingle<{ board_id: string; user_id: string }>(
      'repocard',
      { id: OTHER_USER.privateProjectCardId },
    )
    expect(card).toMatchObject({
      board_id: '00000000-0000-0000-0000-000000000110',
      user_id: '00000000-0000-0000-0000-000000000002',
    })
  })

  test('a move to another board that is sent a second time keeps one card, at the end of the chosen column', async () => {
    // Arrange: Backlog of Work Projects holds one card, and the test user has
    // moved card-1 of Test Board behind it
    await placeOnWorkProjects('testuser', 'private-project')
    const testUser = createTestUserSupabaseClient()
    const move = {
      p_card_id: CARD_IDS.card1,
      p_target_board_id: BOARD_IDS.workProjects,
      p_target_status_id: WORK_PROJECTS_STATUS_IDS.backlog,
    }
    const firstMove = await testUser.rpc('move_card_to_board', move)
    expect(firstMove.error).toBeNull()

    // Act: no answer reached the browser, so the dialog sends the move again
    const secondMove = await testUser.rpc('move_card_to_board', move)

    // Assert: accepted, and there is still one testuser/test-repo card of the
    // test user, behind the card that was in the column before
    expect(secondMove.error).toBeNull()
    const movedCards = await querySupabase<{
      id: string
      board_id: string
      status_id: string
      order: number
    }>('repocard', {
      user_id: TEST_USER_ID,
      repo_owner: 'testuser',
      repo_name: 'test-repo',
    })
    expect(
      movedCards.map(({ id, board_id, status_id, order }) => ({
        id,
        board_id,
        status_id,
        order,
      })),
    ).toEqual([
      {
        id: '00000000-0000-0000-0000-000000000301',
        board_id: '00000000-0000-0000-0000-000000000101',
        status_id: '00000000-0000-0000-0000-000000000211',
        order: 2,
      },
    ])
    const cardBeforeIt = await querySingle<{ order: number }>('repocard', {
      id: FIXTURE_CARD_ID,
    })
    expect(cardBeforeIt?.order).toBe(0)
  })

  test("refuses a signed-in user's insert into another user's board", async () => {
    // Arrange: acts as the test user with RLS applied (not the service role)
    const supabase = createTestUserSupabaseClient()

    // Act
    const { error } = await supabase.from('repocard').insert({
      board_id: OTHER_USER.boardId,
      status_id: OTHER_USER.statusId,
      repo_owner: 'laststance',
      repo_name: 'rls-probe',
      order: 5,
      meta: {},
    })

    // Assert: refused, nothing written. Another user's board is invisible,
    // so set_repocard_user_id cannot copy an owner and raises 23503 before
    // row-level security gets to 42501.
    expect(error?.code).toBe('23503')
    const probeCards = await querySupabase('repocard', {
      repo_name: 'rls-probe',
    })
    expect(probeCards).toHaveLength(0)
  })
})

test.describe("A card's column belongs to the card's board - database rules", () => {
  test.beforeEach(async () => {
    await resetRepoCards()
  })

  test.afterEach(async () => {
    await resetRepoCards()
  })

  test('refuses to put a card into a column of another board', async () => {
    // Arrange: card-1 sits on Test Board, in its Planning column
    const supabase = createServiceRoleSupabaseClient()

    // Act: a stale tab writes a Work Projects column onto it
    const { error } = await supabase
      .from('repocard')
      .update({ status_id: WORK_PROJECTS_STATUS_IDS.backlog })
      .eq('id', CARD_IDS.card1)

    // Assert: foreign key violation, and the card is still where it was
    expect(error?.code).toBe('23503')
    const card = await querySingle<{ board_id: string; status_id: string }>(
      'repocard',
      { id: CARD_IDS.card1 },
    )
    expect(card).toMatchObject({
      board_id: BOARD_IDS.testBoard,
      status_id: STATUS_IDS.planning,
    })
  })

  test('undoing a drag cannot strand a card that was moved to another board', async () => {
    // Arrange: card-1 was moved to Work Projects after the undo snapshot was taken
    const serviceRole = createServiceRoleSupabaseClient()
    const { error: moveError } = await serviceRole
      .from('repocard')
      .update({
        board_id: BOARD_IDS.workProjects,
        status_id: WORK_PROJECTS_STATUS_IDS.backlog,
      })
      .eq('id', CARD_IDS.card1)
    expect(moveError).toBeNull()
    const testUser = createTestUserSupabaseClient()

    // Act: the undo replays the old Test Board column for every snapshot card
    const { error } = await testUser.rpc('batch_update_repocard_orders', {
      p_updates: [
        {
          id: CARD_IDS.card1,
          status_id: STATUS_IDS.planning,
          order: 0,
        },
      ],
    })

    // Assert: refused, and the card stays visible on Work Projects
    expect(error?.code).toBe('23503')
    const card = await querySingle<{ board_id: string; status_id: string }>(
      'repocard',
      { id: CARD_IDS.card1 },
    )
    expect(card).toMatchObject({
      board_id: BOARD_IDS.workProjects,
      status_id: WORK_PROJECTS_STATUS_IDS.backlog,
    })
  })

  test('refuses moving a column to another board', async () => {
    // Arrange: Planning is a column of Test Board and holds cards
    const supabase = createServiceRoleSupabaseClient()

    // Act: a direct API call re-homes the column, cards and all
    const { error } = await supabase
      .from('statuslist')
      .update({ board_id: BOARD_IDS.workProjects })
      .eq('id', STATUS_IDS.planning)

    // Assert: foreign key violation, and the column is still on Test Board
    expect(error?.code).toBe('23503')
    const column = await querySingle<{ board_id: string }>('statuslist', {
      id: STATUS_IDS.planning,
    })
    expect(column).toMatchObject({
      board_id: '00000000-0000-0000-0000-000000000100',
    })
  })

  test('refuses a new card whose column belongs to another board', async () => {
    // Arrange
    const supabase = createServiceRoleSupabaseClient()

    // Act: board is Test Board, column is from Work Projects
    const { error } = await supabase.from('repocard').insert({
      board_id: BOARD_IDS.testBoard,
      status_id: WORK_PROJECTS_STATUS_IDS.backlog,
      repo_owner: 'laststance',
      repo_name: 'column-probe',
      order: 9,
      meta: {},
    })

    // Assert: foreign key violation, nothing written
    expect(error?.code).toBe('23503')
    const probeCards = await querySupabase('repocard', {
      repo_name: 'column-probe',
    })
    expect(probeCards).toHaveLength(0)
  })
})
