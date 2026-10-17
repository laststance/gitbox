/**
 * Back after a saved drag still shows the card in the new column.
 *
 * The journey stays in one document. A full reload would read the database
 * and hide the bug this test is for. The fixture user stands in for GitHub.
 */

import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import { cdpCardToColumnDragAndDrop } from '../helpers/cdp-drag'
import {
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Scratch board deleted before and after the test. */
const BOARD_NAME = 'Back after drag scratch'

test.describe('Back after a drag', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })
  test.beforeEach(removeScratchBoard)
  test.afterEach(removeScratchBoard)

  // Value: protects=Back after a saved drag shows the new column and the refetch does not restore the old one; fails_when=the card is in the first column after Back or after the refetch, or the document was reloaded; no_claim=Back from a different board, and the owner's GitHub account
  test('keeps the card in the column it was dragged to', async ({ page }) => {
    // Arrange
    const { boardId, betaId, cardId } = await createScratchBoard()
    await page.goto(`/board/${boardId}`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => {
      ;(window as Window & { __sameDocument?: number }).__sameDocument = 1
    })

    // Act: the save has to land before Back, or a pending save already hides the bug
    await cdpCardToColumnDragAndDrop(page, cardId, betaId)
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await expect.poll(() => cardColumnId(cardId)).toBe(betaId)
    await page.getByRole('link', { name: 'All Boards' }).click()
    await expect(page).toHaveURL(/\/boards$/)
    const settled = page.waitForLoadState('networkidle')
    await page.goBack()

    // Assert: the restored page has not put the card back, and this is the same document
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    expect(
      await page.evaluate(
        () => (window as Window & { __sameDocument?: number }).__sameDocument,
      ),
    ).toBe(1)

    await settled
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await expect.poll(() => cardColumnId(cardId)).toBe(betaId)
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
 * Column id stored for the scratch card.
 *
 * @param cardId - Card created for this scratch board.
 * @returns The column id, or an empty string when the row is gone.
 */
async function cardColumnId(cardId: string): Promise<string> {
  const { data, error } = await createTestUserSupabaseClient()
    .from('repocard')
    .select('status_id')
    .eq('id', cardId)
    .single()
  if (error || data === null) return ''
  return data.status_id
}

/**
 * A board with Alpha, Beta and one card on Alpha.
 *
 * @returns Ids the test drags and asserts.
 */
async function createScratchBoard(): Promise<{
  boardId: string
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
      repo_owner: 'back-after-drag',
      repo_name: 'stay-put',
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
  return { boardId, betaId: beta.id, cardId: inserted.data.id }
}

/**
 * Delete the scratch board this file creates.
 *
 * Called before and after the test. Cards on the board go with it.
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
