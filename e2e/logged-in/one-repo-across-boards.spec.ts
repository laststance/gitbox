/**
 * One Repository, One Card Per User E2E Tests (Issue #215)
 *
 * A user may place a given GitHub repository on at most one of their boards,
 * and never on a board and in Maintenance at once.
 *
 * UI flows:
 * - The Add Repositories picker lists repositories held by another board under
 *   "Already placed elsewhere" with a link to that board, instead of offering them
 * - The server skips a repository that was placed after the picker opened
 * - Restoring from Maintenance is rejected when a board already holds the repository
 * - Another user's cards never restrict this user
 *
 * Database rules (asserted directly against PostgREST):
 * - Unique index per (user, lower(owner), lower(name))
 * - `repocard.user_id` always equals the board owner and cannot be forged
 *
 * Fixtures: the MSW GitHub catalog offers `testuser/private-project`, which is
 * on none of the test user's boards in `seed.sql`. The seeded second account
 * owns a PUBLIC board holding `testuser/test-repo` and `testuser/private-project`.
 */

import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  MAINTENANCE_IDS,
  OTHER_USER,
  TEST_USER_ID,
  WORK_PROJECTS_STATUS_IDS,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
  querySingle,
  querySupabase,
  resetMaintenanceItems,
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

/** Open the Test Board and wait until its cards are in the Redux store. */
async function openTestBoard(page: Page): Promise<void> {
  await page.goto(TEST_BOARD_URL)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
}

/** Open the Add Repositories picker and wait until it finished loading. */
async function openPicker(page: Page): Promise<void> {
  const searchInput = page.getByPlaceholder(/search repositories/i)
  // After Back navigation the picker may or may not still be open
  if (!(await searchInput.isVisible())) {
    await page.getByRole('button', { name: /add repositories/i }).click()
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
    await resetMaintenanceItems()
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
      name: 'Open board Work Projects, which holds testuser/private-project',
    })
    await expect(boardLink).toHaveText('On Work Projects')
    await boardLink.click()

    // Assert: lands on the holding board, where the card is
    await expect(page).toHaveURL(WORK_PROJECTS_URL)
    await expect(
      page.locator(`[data-testid="repo-card-${FIXTURE_CARD_ID}"]`),
    ).toBeVisible({ timeout: 15000 })
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
    await expect(notice).toHaveText(
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
          name: 'Open board Work Projects, which holds testuser/private-project',
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
        name: 'Open board Work Projects, which holds testuser/private-project',
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
        name: 'Open board Work Projects, which holds testuser/test-repo',
      }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page
        .getByRole('listbox', { name: 'Repository options' })
        .getByRole('option', { name: /testuser\/test-repo/ }),
    ).toHaveCount(0)
  })

  test("still offers and adds a repository that sits on another user's public board", async ({
    page,
  }) => {
    // Arrange: the fixture this test relies on must really exist, otherwise
    // it would pass for the wrong reason
    const otherUserBoard = await querySingle<{
      user_id: string
      is_public: boolean
    }>('board', { id: OTHER_USER.boardId })
    expect(otherUserBoard).toMatchObject({
      user_id: OTHER_USER.id,
      is_public: true,
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

  test('refuses to restore from Maintenance a repository that a board already holds and names that board', async ({
    page,
  }) => {
    // Arrange: maintenance-1 is laststance/claude-plugin-dashboard
    await placeOnWorkProjects('laststance', 'claude-plugin-dashboard')
    await page.goto('/maintenance')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Act
    await page
      .locator(
        `[data-testid="overflow-menu-trigger-${MAINTENANCE_IDS.maintenance1}"]`,
      )
      .click()
    await page
      .locator(
        `[data-testid="restore-to-board-${MAINTENANCE_IDS.maintenance1}"]`,
      )
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    const restoreButton = dialog.getByRole('button', { name: /^restore$/i })
    await expect(restoreButton).toBeEnabled({ timeout: 10000 })
    await restoreButton.click()

    // Assert: readable error, dialog stays, maintenance item untouched
    await expect(dialog.getByRole('alert')).toHaveText(
      'laststance/claude-plugin-dashboard is already on board "Work Projects"',
      { timeout: 10000 },
    )
    const maintenanceItem = await querySingle('maintenance', {
      id: MAINTENANCE_IDS.maintenance1,
    })
    expect(maintenanceItem).not.toBeNull()
  })
})

test.describe('One repository per user - database rules', () => {
  test.beforeEach(async () => {
    await resetRepoCards()
  })

  test.afterEach(async () => {
    await resetRepoCards()
    await resetMaintenanceItems()
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

  test('rolls back a restore from Maintenance that would create a second card', async () => {
    // Arrange: ask the RPC to restore maintenance-1 as testuser/test-repo,
    // which card-1 already holds on Test Board
    const supabase = createServiceRoleSupabaseClient()

    // Act
    const { error } = await supabase.rpc('restore_to_board', {
      p_maintenance_id: MAINTENANCE_IDS.maintenance1,
      p_board_id: BOARD_IDS.workProjects,
      p_status_id: WORK_PROJECTS_STATUS_IDS.backlog,
      p_repo_owner: 'testuser',
      p_repo_name: 'test-repo',
      p_next_order: 0,
    })

    // Assert: unique violation, and the maintenance item is still there
    expect(error?.code).toBe('23505')
    const maintenanceItem = await querySingle('maintenance', {
      id: MAINTENANCE_IDS.maintenance1,
    })
    expect(maintenanceItem).not.toBeNull()
  })

  test('re-checks uniqueness for the new owner when a card changes boards', async () => {
    // Arrange: moving card-1 (testuser/test-repo) onto the other user's board
    // makes that user its owner, and that user already holds testuser/test-repo
    const supabase = createServiceRoleSupabaseClient()

    // Act
    const { error } = await supabase.rpc('move_card_to_board', {
      p_card_id: CARD_IDS.card1,
      p_target_board_id: OTHER_USER.boardId,
      p_target_status_id: OTHER_USER.statusId,
    })

    // Assert: rejected, card-1 stays where it was
    expect(error?.code).toBe('23505')
    const card = await querySingle<{ board_id: string; user_id: string }>(
      'repocard',
      { id: CARD_IDS.card1 },
    )
    expect(card).toMatchObject({
      board_id: BOARD_IDS.testBoard,
      user_id: TEST_USER_ID,
    })
  })

  test("refuses a signed-in user's insert into another user's public board", async () => {
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

    // Assert: row-level security violation, nothing written
    expect(error?.code).toBe('42501')
    const probeCards = await querySupabase('repocard', {
      repo_name: 'rls-probe',
    })
    expect(probeCards).toHaveLength(0)
  })
})
