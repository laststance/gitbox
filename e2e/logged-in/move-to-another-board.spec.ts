/**
 * Move to Another Board E2E Tests
 *
 * Tests for moving repository cards between boards while preserving projectinfo.
 * Requires authentication (uses storageState from auth.setup.ts).
 *
 * Feature (Issue #133):
 * - OverflowMenu displays "Move to Another Board" option
 * - Dialog opens with board/column selects (current board excluded)
 * - Card moves atomically via RPC, preserving projectinfo FK
 * - Card disappears from source board after move
 *
 * Setting a repository aside (Issue #213): a card is parked on another board
 * and brought back with its note, and the destination board can be created
 * inside the dialog.
 */

import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import {
  querySingle,
  querySupabase,
  CARD_IDS,
  BOARD_IDS,
  STATUS_IDS,
  WORK_PROJECTS_STATUS_IDS,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
  resetBoardPublicState,
  resetRepoCards,
} from '../helpers/db-query'

/** Name of the board one test creates inside the dialog. No other spec uses it. */
const BOARD_CREATED_IN_DIALOG = 'Move spec: parked repositories'

/** Name of the board one test creates as the user's newest. No other spec uses it. */
const BOARD_CREATED_LAST = 'Move spec: newest board'

/** Fixed id of the card one test puts on Work Projects; `resetRepoCards` removes it. */
const CARD_ON_WORK_PROJECTS_ID = '00000000-0000-0000-0000-0000000003d1'

/**
 * Put the three columns of Work Projects at the given places of its one row,
 * the way a drag does it: only `grid_col` changes, `order` stays as it was
 * when the column was made (Backlog 0, Active 1, Complete 2).
 * @param gridColumns - Place of each column in the row, counted from 0.
 */
async function placeWorkProjectsColumns(gridColumns: {
  backlog: number
  active: number
  complete: number
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const placements = [
    { id: WORK_PROJECTS_STATUS_IDS.backlog, grid_col: gridColumns.backlog },
    { id: WORK_PROJECTS_STATUS_IDS.active, grid_col: gridColumns.active },
    { id: WORK_PROJECTS_STATUS_IDS.complete, grid_col: gridColumns.complete },
  ]
  for (const { id, grid_col } of placements) {
    const { error } = await supabase
      .from('statuslist')
      .update({ grid_col })
      .eq('id', id)
    if (error) {
      throw new Error(`placeWorkProjectsColumns failed: ${error.message}`)
    }
  }
}

/**
 * Open the Move to Another Board dialog of a card on the board on screen.
 * @param page - Page showing the board that holds the card.
 * @param cardId - Id of the card to move.
 * @returns The open dialog.
 */
async function openMoveDialog(page: Page, cardId: string) {
  const overflowMenuTrigger = page.locator(
    `[data-testid="overflow-menu-trigger-${cardId}"]`,
  )
  await expect(overflowMenuTrigger).toBeVisible({ timeout: 15000 })
  await overflowMenuTrigger.click()
  await page.locator(`[data-testid="move-to-another-board-${cardId}"]`).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5000 })
  return dialog
}

test.describe('Move to Another Board Feature', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  test.afterEach(async () => {
    // Restore all cards to original board for test isolation
    await resetRepoCards()
    // One test drags a column of Work Projects; seed.sql has them in this order
    await placeWorkProjectsColumns({ backlog: 0, active: 1, complete: 2 })

    // Later specs count the seed boards; take away the ones a test created
    const { error } = await createServiceRoleSupabaseClient()
      .from('board')
      .delete()
      .in('name', [BOARD_CREATED_IN_DIALOG, BOARD_CREATED_LAST])
    if (error) {
      throw new Error(`cleanup of the created boards failed: ${error.message}`)
    }
  })

  test('should display Move to Another Board option in overflow menu', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu on first card
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    // Wait for dropdown menu
    const dropdownMenu = page.getByTestId('overflow-menu')
    await expect(dropdownMenu).toBeVisible({ timeout: 5000 })

    // Verify "Move to Another Board" menu item visible
    const moveMenuItem = page
      .locator('[data-testid^="move-to-another-board-"]')
      .first()
    await expect(moveMenuItem).toBeVisible()
  })

  test('should open dialog with board list (current board excluded)', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu and click Move to Another Board
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    const moveMenuItem = page
      .locator('[data-testid^="move-to-another-board-"]')
      .first()
    await moveMenuItem.click()

    // Dialog should appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify title: the one heading of the dialog
    await expect(
      dialog.getByRole('heading', { name: 'Move to Another Board' }),
    ).toBeVisible()

    // Open board select
    await dialog.locator('#board-select').click()

    // "Work Projects" should be visible (another board)
    await expect(
      page.getByRole('option', { name: 'Work Projects' }),
    ).toBeVisible()
  })

  test('should close dialog on Cancel', async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open dialog
    const overflowMenuTrigger = page
      .locator('[data-testid^="overflow-menu-trigger-"]')
      .first()
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    const moveMenuItem = page
      .locator('[data-testid^="move-to-another-board-"]')
      .first()
    await moveMenuItem.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Click Cancel
    await dialog.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('should move card to another board and remove from source', async ({
    page,
  }) => {
    await resetRepoCards()
    const cardId = CARD_IDS.card5 // laststance/use-app-state

    // Verify card exists on testBoard before move
    const cardBefore = await querySingle('repocard', { id: cardId })
    expect(cardBefore).not.toBeNull()
    expect((cardBefore as { board_id: string }).board_id).toBe(
      BOARD_IDS.testBoard,
    )

    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu on card5
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${cardId}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    // Click "Move to Another Board"
    const moveMenuItem = page.locator(
      `[data-testid="move-to-another-board-${cardId}"]`,
    )
    await moveMenuItem.click()

    // Dialog appears
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Select "Work Projects" board
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()

    // Click Move
    await dialog.getByRole('button', { name: /^move$/i }).click()

    // Dialog closes, card disappears from source board
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).not.toBeVisible({ timeout: 5000 })

    // DB verification: card now on workProjects board
    await expect(async () => {
      const cardAfter = await querySingle('repocard', { id: cardId })
      expect(cardAfter).not.toBeNull()
      expect((cardAfter as { board_id: string }).board_id).toBe(
        BOARD_IDS.workProjects,
      )
    }).toPass({ timeout: 10000 })
  })

  test('should preserve projectinfo after move', async ({ page }) => {
    await resetRepoCards()
    const cardId = CARD_IDS.card1 // testuser/test-repo (has projectinfo with notes+links)

    // Get projectinfo before move
    const projInfoBefore = await querySingle('projectinfo', {
      repo_card_id: cardId,
    })
    expect(projInfoBefore).not.toBeNull()
    expect((projInfoBefore as { note: string }).note).toBe(
      'Important project notes here',
    )

    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Open overflow menu on card1
    const overflowMenuTrigger = page.locator(
      `[data-testid="overflow-menu-trigger-${cardId}"]`,
    )
    await expect(overflowMenuTrigger).toBeVisible({ timeout: 10000 })
    await overflowMenuTrigger.click()

    // Click "Move to Another Board"
    const moveMenuItem = page.locator(
      `[data-testid="move-to-another-board-${cardId}"]`,
    )
    await moveMenuItem.click()

    // Select "Work Projects" board
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()

    // Click Move
    await dialog.getByRole('button', { name: /^move$/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Verify projectinfo FK unchanged, data intact
    await expect(async () => {
      const projInfoAfter = await querySingle('projectinfo', {
        repo_card_id: cardId,
      })
      expect(projInfoAfter).not.toBeNull()
      expect((projInfoAfter as { note: string }).note).toBe(
        'Important project notes here',
      )
      expect((projInfoAfter as { id: string }).id).toBe(
        (projInfoBefore as { id: string }).id,
      )
    }).toPass({ timeout: 10000 })
  })

  test('says which board the card went to, and the toast opens that board with the card on it', async ({
    page,
  }) => {
    // Arrange
    await resetRepoCards()
    const cardId = CARD_IDS.card5 // laststance/use-app-state
    await page.goto(BOARD_URL)
    const dialog = await openMoveDialog(page, cardId)
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()

    // Act
    await dialog.getByRole('button', { name: 'Move', exact: true }).click()

    // Assert: the toast names the destination and the repository
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Moved to Work Projects' })
    await expect(toast).toBeVisible({ timeout: 10000 })
    await expect(toast).toContainText('laststance/use-app-state')

    // Act: follow the toast
    await toast.getByRole('button', { name: 'Open board' }).click()

    // Assert: the destination board shows the card
    await expect(page).toHaveURL(`/board/${BOARD_IDS.workProjects}`)
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).toBeVisible({ timeout: 15000 })
  })

  test('a repository set aside on another board comes back with its note', async ({
    page,
  }) => {
    // Arrange: card-1 carries a note
    await resetRepoCards()
    const cardId = CARD_IDS.card1 // testuser/test-repo
    const noteBefore = await querySingle<{ id: string; note: string }>(
      'projectinfo',
      { repo_card_id: cardId },
    )
    expect(noteBefore?.note).toBe('Important project notes here')
    await page.goto(BOARD_URL)

    // Act: set it aside on Work Projects ...
    const parkDialog = await openMoveDialog(page, cardId)
    await parkDialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()
    await parkDialog.getByRole('button', { name: 'Move', exact: true }).click()
    await expect(parkDialog).toBeHidden({ timeout: 10000 })
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).toHaveCount(0, { timeout: 10000 })

    // ... and bring it back from there
    await page.goto(`/board/${BOARD_IDS.workProjects}`)
    const returnDialog = await openMoveDialog(page, cardId)
    await expect(returnDialog.locator('#board-select')).toHaveText('Test Board')
    await returnDialog
      .getByRole('button', { name: 'Move', exact: true })
      .click()
    await expect(returnDialog).toBeHidden({ timeout: 10000 })

    // Assert: the card is on Test Board again, in the first column the dialog
    // offered, and the note is the same row with the same text
    await page.goto(BOARD_URL)
    await expect(
      page
        .locator(`[data-testid="status-column-${STATUS_IDS.pending}"]`)
        .locator(`[data-testid="repo-card-${cardId}"]`),
    ).toBeVisible({ timeout: 15000 })
    const noteAfter = await querySingle<{ id: string; note: string }>(
      'projectinfo',
      { repo_card_id: cardId },
    )
    expect(noteAfter).toMatchObject({
      id: '00000000-0000-0000-0000-000000000401',
      note: 'Important project notes here',
    })
  })

  test('moves a card to a board created inside the dialog, which has the one column "Repositories"', async ({
    page,
  }) => {
    // Arrange
    await resetRepoCards()
    const cardId = CARD_IDS.card5 // laststance/use-app-state
    await page.goto(BOARD_URL)
    const dialog = await openMoveDialog(page, cardId)

    // Act: create the destination without leaving the dialog ...
    await dialog.getByRole('button', { name: 'New Board...' }).click()
    await dialog.getByLabel('Board Name').fill(BOARD_CREATED_IN_DIALOG)
    await dialog.getByRole('button', { name: 'Create Board' }).click()

    // ... which selects the new board and its column, with Move under the keyboard
    await expect(dialog.locator('#board-select')).toHaveText(
      BOARD_CREATED_IN_DIALOG,
      { timeout: 10000 },
    )
    await expect(dialog.locator('#status-select')).toHaveText('Repositories')
    const moveButton = dialog.getByRole('button', { name: 'Move', exact: true })
    await expect(moveButton).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert: the toast leads to the new board
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: `Moved to ${BOARD_CREATED_IN_DIALOG}` })
    await expect(toast).toBeVisible({ timeout: 10000 })
    await toast.getByRole('button', { name: 'Open board' }).click()
    await expect(page.getByTestId('board-title')).toHaveText(
      BOARD_CREATED_IN_DIALOG,
      { timeout: 15000 },
    )

    // Assert: that board has exactly one column, and the card is in it
    const columns = page.locator('[data-testid^="status-column-"]')
    await expect(columns).toHaveCount(1)
    await expect(columns.locator('h2')).toHaveText('Repositories')
    await expect(
      columns.locator(`[data-testid="repo-card-${cardId}"]`),
    ).toBeVisible()

    // Assert: one board of that name exists, with one column
    const createdBoards = await querySupabase<{ id: string }>('board', {
      name: BOARD_CREATED_IN_DIALOG,
    })
    expect(createdBoards).toHaveLength(1)
    const createdColumns = await querySupabase<{
      name: string
      order: number
      grid_row: number
      grid_col: number
    }>('statuslist', { board_id: createdBoards[0]?.id ?? '' })
    expect(
      createdColumns.map(({ name, order, grid_row, grid_col }) => ({
        name,
        order,
        grid_row,
        grid_col,
      })),
    ).toEqual([{ name: 'Repositories', order: 0, grid_row: 0, grid_col: 0 }])
  })

  // Value: protects=the dialog opens on the board the user made last, which is where a card that is set aside most likely goes; fails_when=the server lists the boards in another order than newest first, or the dialog stops taking the first board of that list; why_new=the test account has one other board, so no other test gives the dialog a choice, and the unit tests stub the database's sort away; seam=none; no_claim=which board the dialog opens on once a move from this board is remembered (unit tests of the dialog)
  test('opens on the board the user made last when there are several to choose from', async ({
    page,
  }) => {
    // Arrange: Work Projects is from the seed; this board is made now, so it
    // is the newest. No move from this board is remembered.
    const created = await createTestUserSupabaseClient().rpc(
      'create_board_with_status_lists',
      {
        p_name: BOARD_CREATED_LAST,
        p_columns: [{ name: 'Parked', color: '#111111' }],
      },
    )
    expect(created.error).toBeNull()
    await page.addInitScript(() => {
      if (sessionStorage.getItem('gitbox-e2e-storage-cleared')) return

      localStorage.removeItem('gitbox-state')
      sessionStorage.setItem('gitbox-e2e-storage-cleared', 'true')
    })
    await page.goto(BOARD_URL)

    // Act
    const dialog = await openMoveDialog(page, CARD_IDS.card1)

    // Assert: the newest board and its one column are selected, and the list
    // has the newest board first
    await expect(dialog.locator('#board-select')).toHaveText(BOARD_CREATED_LAST)
    await expect(dialog.locator('#status-select')).toHaveText('Parked')
    await dialog.locator('#board-select').click()
    await expect(page.getByRole('option').first()).toHaveText(
      BOARD_CREATED_LAST,
    )
    await expect(page.getByRole('option').nth(1)).toHaveText('Work Projects')
  })

  test('lists the columns of the destination in the order its board shows them and starts on the left-most one', async ({
    page,
  }) => {
    // Arrange: on Work Projects "Active" was dragged in front of "Backlog"
    await placeWorkProjectsColumns({ backlog: 1, active: 0, complete: 2 })
    await page.goto(BOARD_URL)
    const dialog = await openMoveDialog(page, CARD_IDS.card1)

    // Act
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()

    // Assert: the column a move goes to without another choice is the one
    // the board shows first ...
    await expect(dialog.locator('#status-select')).toHaveText('Active')

    // ... and the list has the board's order, not the order of creation
    await dialog.locator('#status-select').click()
    await expect(page.getByRole('option')).toHaveText([
      'Active',
      'Backlog',
      'Complete',
    ])
  })

  test('says that the destination is shared, and what that shows of the repository, when the board has a public link', async ({
    page,
  }) => {
    // Arrange: Test Board has a public link, and a card sits on Work Projects,
    // whose only possible destination Test Board is
    await resetBoardPublicState()
    const placed = await createServiceRoleSupabaseClient()
      .from('repocard')
      .insert({
        id: CARD_ON_WORK_PROJECTS_ID,
        board_id: BOARD_IDS.workProjects,
        status_id: WORK_PROJECTS_STATUS_IDS.backlog,
        repo_owner: 'laststance',
        repo_name: 'move-spec-private-notes',
        order: 0,
        meta: { visibility: 'private' },
      })
    expect(placed.error).toBeNull()
    await page.goto(`/board/${BOARD_IDS.workProjects}`)
    await page.waitForLoadState('networkidle')

    // Act
    const dialog = await openMoveDialog(page, CARD_ON_WORK_PROJECTS_ID)

    // Assert: the board carries the mark of a shared board, and the sentence
    // is read with the button that would make the card readable
    const boardSelect = dialog.locator('#board-select')
    await expect(boardSelect).toContainText('Test Board')
    await expect(
      boardSelect.getByRole('img', { name: 'Public board' }),
    ).toBeVisible()
    await expect(
      dialog.getByText(
        'Test Board is shared by a public link. Anyone who has the link will see this repository there, with its description. Notes, links, and comments stay private.',
      ),
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Move' }),
    ).toHaveAccessibleDescription(
      'Test Board is shared by a public link. Anyone who has the link will see this repository there, with its description. Notes, links, and comments stay private.',
    )
  })

  test('puts the keyboard focus on the next card of the column after a move', async ({
    page,
  }) => {
    // Arrange: Planning holds card-1, card-4 and card-5, top to bottom
    await resetRepoCards()
    const cardId = CARD_IDS.card1
    await page.goto(BOARD_URL)
    const dialog = await openMoveDialog(page, cardId)
    await dialog.locator('#board-select').click()
    await page.getByRole('option', { name: 'Work Projects' }).click()

    // Act
    await dialog.getByRole('button', { name: 'Move', exact: true }).click()

    // Assert: card-4 has the focus, also once card-1 has left the page
    const nextCard = page.locator(`[data-repo-card-id="${CARD_IDS.card4}"]`)
    await expect(nextCard).toBeFocused({ timeout: 10000 })
    await expect(
      page.locator(`[data-testid="repo-card-${cardId}"]`),
    ).toHaveCount(0, { timeout: 10000 })
    await expect(nextCard).toBeFocused()
  })

  test('puts the keyboard focus back on the card when the dialog is cancelled', async ({
    page,
  }) => {
    // Arrange
    const cardId = CARD_IDS.card1
    await page.goto(BOARD_URL)
    const dialog = await openMoveDialog(page, cardId)

    // Act
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // Assert
    await expect(dialog).toBeHidden({ timeout: 5000 })
    await expect(page.locator(`[data-repo-card-id="${cardId}"]`)).toBeFocused({
      timeout: 10000,
    })
  })
})
