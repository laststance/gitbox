/**
 * Repository Memory E2E Tests (issue #216)
 *
 * A repository keeps its note, links and comment when its card leaves the
 * board: removed from the board, its column deleted or its board deleted.
 * Added again from the Add Repositories picker, the card shows them at once,
 * and the picker marks what a repository on no board brings back.
 *
 * Fixtures: laststance/nsx (card 4 on Test Board) carries the note "CLI tool
 * documentation" and the comment "v2.0リリース準備中" in seed.sql, and the MSW
 * GitHub catalog offers it, so the picker lists it once its card is gone. Its
 * seeded link is in a form without `type` that the Note dialog does not show,
 * so each test gives it one npm link in the form the app writes.
 * laststance/create-react-app-vite (card 3) has a row whose note, links and
 * comment are all empty.
 */

import type { Locator, Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  PROJECT_INFO_IDS,
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
  querySingle,
  resetProjectInfoComments,
  resetRepoCards,
} from '../helpers/db-query'

const TEST_BOARD_URL = `/board/${BOARD_IDS.testBoard}`

/** Name of the board this spec creates; boards of that name are deleted afterwards. */
const SCRATCH_BOARD_NAME = 'Board of repository memory'

/** Fixed id of the nsx card this spec puts on its own board. */
const SCRATCH_CARD_ID = '00000000-0000-0000-0000-0000000003d1'

/** The link nsx keeps, in the form the Note dialog writes and shows. */
const NSX_LINK = { type: 'npm', url: 'https://www.npmjs.com/package/nsx' }

/** Give nsx's saved memory {@link NSX_LINK} in place of its seeded link. */
async function giveNsxAnNpmLink(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('projectinfo')
    .update({ links: [NSX_LINK] })
    .eq('id', PROJECT_INFO_IDS.projinfo4)
  if (error) {
    throw new Error(`giveNsxAnNpmLink failed: ${error.message}`)
  }
}

/** Delete the boards this spec created, with their columns and cards. */
async function removeBoardsOfThisSpec(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('board')
    .delete()
    .eq('name', SCRATCH_BOARD_NAME)
  if (error) {
    throw new Error(`removeBoardsOfThisSpec failed: ${error.message}`)
  }
}

/**
 * Take a card off the board with the service role, as Remove from Board
 * would, leaving the project info of its repository where it is.
 * @param cardId - Card to delete.
 */
async function deleteCard(cardId: string): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('repocard')
    .delete()
    .eq('id', cardId)
  if (error) {
    throw new Error(`deleteCard failed: ${error.message}`)
  }
}

/**
 * Create a board of the test user with two columns and put laststance/nsx on
 * the first. Card 4 has to be gone first: one card per user and repository.
 * @returns The id of the new board.
 */
async function placeNsxOnScratchBoard(): Promise<string> {
  const created = await createTestUserSupabaseClient().rpc(
    'create_board_with_status_lists',
    {
      p_name: SCRATCH_BOARD_NAME,
      p_columns: [
        { name: 'Doomed column', color: '#111111' },
        { name: 'Kept column', color: '#222222' },
      ],
    },
  )
  if (created.error) {
    throw new Error(`placeNsxOnScratchBoard failed: ${created.error.message}`)
  }
  const boardId: string = created.data.id
  const firstColumnId: string = created.data.status_lists[0].id
  const { error } = await createServiceRoleSupabaseClient()
    .from('repocard')
    .insert({
      id: SCRATCH_CARD_ID,
      board_id: boardId,
      status_id: firstColumnId,
      repo_owner: 'laststance',
      repo_name: 'nsx',
      order: 0,
      meta: {},
    })
  if (error) {
    throw new Error(
      `placeNsxOnScratchBoard failed on the card: ${error.message}`,
    )
  }
  return boardId
}

/** Open a board and wait until its cards or its columns are drawn. */
async function openBoard(page: Page, boardUrl: string): Promise<void> {
  await page.goto(boardUrl)
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByRole('button', { name: /add repositories/i }),
  ).toBeVisible({ timeout: 15000 })
}

/** Open the Add Repositories picker and wait until it finished loading. */
async function openPicker(page: Page): Promise<void> {
  await page.getByRole('button', { name: /add repositories/i }).click()
  await expect(page.getByPlaceholder(/search repositories/i)).toBeVisible({
    timeout: 10000,
  })
  await expect(page.getByText('Loading repositories...')).toBeHidden({
    timeout: 15000,
  })
}

/**
 * The picker's row of a repository.
 * @param fullName - `owner/name` as GitHub spells it.
 */
function pickerOption(page: Page, fullName: string): Locator {
  return page
    .getByRole('listbox', { name: 'Repository options' })
    .getByRole('option', { name: new RegExp(fullName) })
}

/** Add laststance/nsx from the open picker and wait until the picker closed. */
async function addNsxFromPicker(page: Page): Promise<void> {
  await pickerOption(page, 'laststance/nsx').click()
  await page.getByRole('button', { name: 'Add (1)' }).click()
  await expect(page.getByPlaceholder(/search repositories/i)).toBeHidden({
    timeout: 10000,
  })
}

/** The card of laststance/nsx on the page, whatever its id. */
function nsxCard(page: Page): Locator {
  return page.locator('[data-repo-card-id]').filter({ hasText: 'nsx' })
}

test.describe('Repository memory', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(async () => {
    await removeBoardsOfThisSpec()
    await resetRepoCards()
    await giveNsxAnNpmLink()
  })

  test.afterEach(async () => {
    await removeBoardsOfThisSpec()
    await resetRepoCards()
    await resetProjectInfoComments()
  })

  // Value: protects=the core of issue #216, a removed repository comes back with its comment on the card and its note and link in the Note dialog, without a reload; fails_when=projectinfo is deleted with the card, the added card's comment is not merged into the board, or the picker mark is missing; why_new=no spec adds a removed repository again; seam=MSW GitHub catalog; no_claim=production data (checked as ryota-murakami)
  test('a repository removed from the board and added again shows its comment, note and link again', async ({
    page,
  }) => {
    // Arrange: remove card 4 (laststance/nsx) through its menu
    await openBoard(page, TEST_BOARD_URL)
    await page
      .locator(`[data-testid="overflow-menu-trigger-${CARD_IDS.card4}"]`)
      .click()
    await page
      .locator(`[data-testid="remove-from-board-${CARD_IDS.card4}"]`)
      .click()
    await expect(page.getByRole('alertdialog')).toContainText(
      'Its note, links and comment are kept: they come back when you add the repository to a board again.',
    )
    await page
      .locator(`[data-testid="confirm-remove-${CARD_IDS.card4}"]`)
      .click()
    await expect(nsxCard(page)).toHaveCount(0, { timeout: 10000 })
    await expect(async () => {
      expect(await querySingle('repocard', { id: CARD_IDS.card4 })).toBeNull()
    }).toPass({ timeout: 10000 })

    // Act
    await openPicker(page)
    await expect(
      pickerOption(page, 'laststance/nsx').getByTestId('saved-memory-label'),
    ).toHaveText('Saved: note, 1 link, comment')
    await addNsxFromPicker(page)

    // Assert: the comment is on the new card at once ...
    await expect(nsxCard(page).getByTestId('comment-display')).toContainText(
      'v2.0リリース準備中',
      { timeout: 10000 },
    )
    // ... and the note and the link are in its Note dialog
    await nsxCard(page).getByRole('button', { name: 'Open note' }).click()
    const noteDialog = page.getByRole('dialog')
    await expect(noteDialog.getByTestId('note-editor')).toContainText(
      'CLI tool documentation',
      { timeout: 10000 },
    )
    await expect(noteDialog.getByTestId('url-list')).toContainText(
      'https://www.npmjs.com/package/nsx',
    )
  })

  // Value: protects=a repository whose stored letter case differs from GitHub's spelling still gets its memory back after Delete Column; fails_when=the column cascade reaches projectinfo, or the key or the card's lookup compares raw case; why_new=no spec deletes a column with cards and adds one again; seam=MSW GitHub catalog, memory renamed by the service role; no_claim=a GitHub rename or transfer (TODOS.md)
  test('a repository whose column was deleted comes back with its comment, also when it was saved in another letter case', async ({
    page,
  }) => {
    // Arrange: nsx on a board of its own, its memory saved as LastStance/NSX
    await deleteCard(CARD_IDS.card4)
    const boardId = await placeNsxOnScratchBoard()
    const renamed = await createServiceRoleSupabaseClient()
      .from('projectinfo')
      .update({ repo_owner: 'LastStance', repo_name: 'NSX' })
      .eq('id', PROJECT_INFO_IDS.projinfo4)
    expect(renamed.error).toBeNull()
    await openBoard(page, `/board/${boardId}`)
    await expect(nsxCard(page)).toBeVisible()

    // Act: delete the column that holds the card, then add nsx again
    await page
      .getByTestId(/^status-column-/)
      .filter({ hasText: 'Doomed column' })
      .getByRole('button', { name: 'Column options' })
      .click()
    await page.getByRole('menuitem', { name: 'Delete Column' }).click()
    await expect(page.getByRole('alertdialog')).toContainText(
      'The note, links and comment of its repository are kept for when you add it again.',
    )
    await page
      .getByRole('button', { name: 'Delete column Doomed column' })
      .click()
    await expect(nsxCard(page)).toHaveCount(0, { timeout: 10000 })
    await openPicker(page)
    await addNsxFromPicker(page)

    // Assert
    await expect(nsxCard(page).getByTestId('comment-display')).toContainText(
      'v2.0リリース準備中',
      { timeout: 10000 },
    )
  })

  // Value: protects=a repository whose board was deleted comes back with its memory on another board; fails_when=the board cascade reaches projectinfo; why_new=no spec adds a repository of a deleted board again; seam=MSW GitHub catalog; no_claim=the boards list's own Delete Board dialog (same copy, DeleteBoardDialog.test.tsx)
  test('a repository whose board was deleted is marked in the picker and comes back with its comment', async ({
    page,
  }) => {
    // Arrange: nsx on a board of its own, which the user deletes
    await deleteCard(CARD_IDS.card4)
    const boardId = await placeNsxOnScratchBoard()
    await openBoard(page, `/board/${boardId}`)
    await page.getByRole('button', { name: 'Board Settings' }).click()
    const settings = page.getByRole('dialog')
    await settings.getByRole('tab', { name: 'Danger Zone' }).click()
    await settings.getByRole('button', { name: 'Delete Board' }).click()
    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation).toContainText(
      'kept for when you add them again.',
    )
    await confirmation
      .getByRole('button', { name: `Delete board ${SCRATCH_BOARD_NAME}` })
      .click()
    await expect(page).toHaveURL('/boards', { timeout: 15000 })

    // Act
    await openBoard(page, TEST_BOARD_URL)
    await openPicker(page)
    await expect(
      pickerOption(page, 'laststance/nsx').getByTestId('saved-memory-label'),
    ).toHaveText('Saved: note, 1 link, comment')
    await addNsxFromPicker(page)

    // Assert
    await expect(nsxCard(page).getByTestId('comment-display')).toContainText(
      'v2.0リリース準備中',
      { timeout: 10000 },
    )
  })

  // Value: protects=the picker marks only memories that bring something back (eng review R4); fails_when=an empty row or a repository without a row gets a mark; why_new=new mark; seam=MSW GitHub catalog; no_claim=the counting rules for whitespace and legacy links (saved-repository-memories.test.ts)
  test('the picker marks no repository whose saved note, links and comment are empty', async ({
    page,
  }) => {
    // Arrange: card 3 (create-react-app-vite) leaves an empty row behind;
    // testuser/private-project never had one
    await deleteCard(CARD_IDS.card3)
    await openBoard(page, TEST_BOARD_URL)

    // Act
    await openPicker(page)

    // Assert
    await expect(
      pickerOption(page, 'laststance/create-react-app-vite'),
    ).toBeVisible()
    await expect(
      pickerOption(page, 'laststance/create-react-app-vite').getByTestId(
        'saved-memory-label',
      ),
    ).toHaveCount(0)
    await expect(pickerOption(page, 'testuser/private-project')).toBeVisible()
    await expect(
      pickerOption(page, 'testuser/private-project').getByTestId(
        'saved-memory-label',
      ),
    ).toHaveCount(0)
  })

  // Value: protects=Delete in the comment menu clears the comment of the repository's memory and nothing else (pre-landing review of #216); fails_when=the delete misses the row now keyed by user and repository, or clears the note or the links with it; why_new=the delete was tested against a mocked client only (project-info-core.test.ts); seam=none; no_claim=a repository held by two users (the user filter, project-info-core.test.ts)
  test('deleting a comment from its menu clears the comment and keeps the note and the link', async ({
    page,
  }) => {
    // Arrange
    await openBoard(page, TEST_BOARD_URL)
    const card = page.getByTestId(`repo-card-${CARD_IDS.card4}`)
    await card.getByTestId('comment-display').hover()
    await card.getByTestId('comment-actions-trigger').click()

    // Act
    await page.getByTestId('comment-action-delete').click()

    // Assert: the card offers a new comment, and the row lost the comment only
    await expect(card.getByText('Add comment')).toBeVisible()
    await expect(async () => {
      const memory = await querySingle<{
        note: string
        comment: string | null
        comment_color: string
        links: unknown
      }>('projectinfo', { id: PROJECT_INFO_IDS.projinfo4 })
      expect(memory).toMatchObject({
        note: 'CLI tool documentation',
        comment: null,
        comment_color: 'primary',
        links: [NSX_LINK],
      })
    }).toPass({ timeout: 10000 })
  })

  // Value: protects=on a narrow phone the mark moves under the stars and stays inside its row on one line (design review of #216); fails_when=the meta row stops wrapping and the mark is pushed out of the row, or the mark breaks over two lines; why_new=the layout was checked by hand at 375px only; seam=MSW GitHub catalog (the fixture's row fits on one line at 375px, so 320px is where it has to wrap); no_claim=other widths than 320px
  test('on a 320px screen the mark stays inside its row on one line', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 320, height: 640 })
    await deleteCard(CARD_IDS.card4)
    await openBoard(page, TEST_BOARD_URL)

    // Act
    await openPicker(page)

    // Assert: one line of text-xs with its padding and border is 22px high
    const option = pickerOption(page, 'laststance/nsx')
    const label = option.getByTestId('saved-memory-label')
    await expect(label).toHaveText('Saved: note, 1 link, comment')
    const optionBox = await option.boundingBox()
    const labelBox = await label.boundingBox()
    expect(optionBox).not.toBeNull()
    expect(labelBox).not.toBeNull()
    if (!optionBox || !labelBox) return
    expect(labelBox.height).toBe(22)
    expect(labelBox.x).toBeGreaterThanOrEqual(optionBox.x)
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(
      optionBox.x + optionBox.width,
    )
  })
})
