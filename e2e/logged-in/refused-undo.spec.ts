/**
 * A refused undo stays available for one more Z, then gets out of the way.
 *
 * The fixture user stands in for GitHub. Taking the browser offline is the
 * blip: the database never hears the undo. A signed-in check as the owner is
 * a separate step and does not force an undo on a real board.
 */

import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import { cdpCardToColumnDragAndDrop } from '../helpers/cdp-drag'
import {
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Scratch board deleted before and after each test. */
const BOARD_NAME = 'Refused undo scratch'

test.describe('A refused undo', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })
  test.beforeEach(removeScratchBoard)
  test.afterEach(removeScratchBoard)

  // Value: protects=Z after a refused card undo tries that same undo again and the card stays in the column it was dragged from; fails_when=the card stays in the column it was dragged to, or the retry is rolled back; why_new=the history stack is not visible in the unit tests' browser; seam=the browser is offline for one undo, then online; no_claim=a refusal the database will keep returning
  test('tries the same card undo again after the save is refused', async ({
    page,
  }) => {
    // Arrange: the card sits on Beta, and the next undo save is dropped
    const { boardId, alphaId, betaId, cardId } = await createScratchBoard()
    await page.goto(`/board/${boardId}`)
    await page.waitForLoadState('networkidle')
    await cdpCardToColumnDragAndDrop(page, cardId, betaId)
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await page.waitForLoadState('networkidle')

    // Act: the undo cannot reach the database, then Z tries it once the
    // connection is back. Offline, the failure toast is the offline notice.
    await page.context().setOffline(true)
    await page.keyboard.press('z')
    await expect(
      page.getByText('The board reloads when the connection is back.'),
    ).toBeVisible()
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await page.context().setOffline(false)
    await expect(
      page.getByText('The board reloads when the connection is back.'),
    ).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await page.keyboard.press('z')

    // Assert: the card is back on Alpha and the saved undo stays there
    await expect(cardIn(page, alphaId, cardId)).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(cardIn(page, alphaId, cardId)).toBeVisible()
    await expect(cardIn(page, betaId, cardId)).toHaveCount(0)
  })

  // Value: protects=a second refusal of the same undo leaves Z with nothing to undo and the card where the drag put it; fails_when=a third Z sends the undo again; why_new=one retry is not the same as a step that never leaves the stack; seam=two undos while the browser is offline; no_claim=an older undo under the refused one, which the unit test drives
  test('stops retrying a card undo after it is refused twice', async ({
    page,
  }) => {
    // Arrange
    const { boardId, alphaId, betaId, cardId } = await createScratchBoard()
    await page.goto(`/board/${boardId}`)
    await page.waitForLoadState('networkidle')
    await cdpCardToColumnDragAndDrop(page, cardId, betaId)
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await page.waitForLoadState('networkidle')
    let failedPosts = 0
    page.on('requestfailed', (request) => {
      if (request.method() === 'POST') failedPosts += 1
    })

    // Act: two refused undos, then Z with the connection back
    await page.context().setOffline(true)
    await page.keyboard.press('z')
    await expect.poll(() => failedPosts).toBeGreaterThan(0)
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    const failedAfterFirstUndo = failedPosts
    await page.keyboard.press('z')
    await expect.poll(() => failedPosts).toBeGreaterThan(failedAfterFirstUndo)
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await page.context().setOffline(false)
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('z')
    await page.waitForLoadState('networkidle')

    // Assert: the stack is empty, so Z is silent and the card stays on Beta
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await expect(cardIn(page, alphaId, cardId)).toHaveCount(0)
  })
})

/**
 * The card inside one column.
 *
 * @param page - The fixture browser page.
 * @param columnId - Column the card should be standing in.
 * @param cardId - Card created for this scratch board.
 * @returns Locator for that card inside that column.
 */
function cardIn(page: Page, columnId: string, cardId: string) {
  return page
    .getByTestId(`status-column-${columnId}`)
    .getByTestId(`repo-card-${cardId}`)
}

/**
 * A board with Alpha, Beta and one card on Alpha.
 *
 * Called by each test. The card's repository is not one of the seed
 * repositories, so removing the board removes the only row for it.
 *
 * @returns Ids the test drags and asserts.
 */
async function createScratchBoard(): Promise<{
  boardId: string
  alphaId: string
  betaId: string
  cardId: string
}> {
  const created = await createTestUserSupabaseClient().rpc(
    'create_board_with_status_lists',
    {
      p_name: BOARD_NAME,
      p_columns: [
        { name: 'Alpha', color: '#111111' },
        { name: 'Beta', color: '#222222' },
      ],
    },
  )
  if (created.error || created.data === null) {
    throw new Error(
      `createScratchBoard failed: ${created.error?.message ?? 'no board'}`,
    )
  }
  const boardId: string = created.data.id
  const lists = created.data.status_lists as { id: string; name: string }[]
  const alpha = lists.find((column) => column.name === 'Alpha')
  const beta = lists.find((column) => column.name === 'Beta')
  if (alpha === undefined || beta === undefined) {
    throw new Error('the scratch board did not return Alpha and Beta')
  }
  const inserted = await createTestUserSupabaseClient()
    .from('repocard')
    .insert({
      board_id: boardId,
      status_id: alpha.id,
      repo_owner: 'undo-retry',
      repo_name: 'retry-once',
      order: 0,
      meta: {},
    })
    .select('id')
    .single()
  if (inserted.error || inserted.data === null) {
    throw new Error(
      `createScratchBoard card failed: ${inserted.error?.message ?? 'no card'}`,
    )
  }
  return {
    boardId,
    alphaId: alpha.id,
    betaId: beta.id,
    cardId: inserted.data.id,
  }
}

/**
 * Delete the scratch board this file creates.
 *
 * Called before and after each test. Cards on the board go with it.
 */
async function removeScratchBoard(): Promise<void> {
  const { error } = await createServiceRoleSupabaseClient()
    .from('board')
    .delete()
    .eq('name', BOARD_NAME)
  if (error) {
    throw new Error(`removeScratchBoard failed: ${error.message}`)
  }
}
