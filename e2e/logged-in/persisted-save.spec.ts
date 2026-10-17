/**
 * A card drag does not write the saved settings. A theme change does.
 *
 * The fixture user stands in for GitHub. The owner check is a separate step
 * and does not change the theme of a real board.
 */

import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/coverage'
import { cdpCardToColumnDragAndDrop } from '../helpers/cdp-drag'
import {
  createServiceRoleSupabaseClient,
  createTestUserSupabaseClient,
} from '../helpers/db-query'

/** Scratch board deleted before and after the test. */
const BOARD_NAME = 'Persisted save scratch'

/** Menu names for the two themes this test switches. */
const THEME_MENU_NAME: Record<string, string> = {
  system: 'System',
  default: 'Default',
  sunrise: 'Sunrise',
  sandstone: 'Sandstone',
  mint: 'Mint',
  sky: 'Sky',
  lavender: 'Lavender',
  rose: 'Rose',
  dark: 'Dark',
  midnight: 'Midnight',
  graphite: 'Graphite',
  forest: 'Forest',
  ocean: 'Ocean',
  plum: 'Plum',
  rust: 'Rust',
}

test.describe('A persisted save', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })
  test.beforeEach(removeScratchBoard)
  test.afterEach(removeScratchBoard)

  // Value: protects=a card drag does not write gitbox-state, and a theme change does; fails_when=the drag writes, or the stored theme stays the old one; why_new=the package skip is not visible from a unit test of GitBox; seam=localStorage.setItem after hydration; no_claim=the bytes of settings other than theme, and Sign Out
  test('does not write settings when a card is dragged, and does when the theme changes', async ({
    page,
  }) => {
    // Arrange: one card on Alpha, and the writes after hydration
    const { boardId, betaId, cardId } = await createScratchBoard()
    await page.goto(`/board/${boardId}`)
    await page.waitForLoadState('networkidle')
    const themeBefore = await storedTheme(page)
    await countGitboxStateWrites(page)
    const started = await page.evaluate(() => performance.now())

    // Act: drag the card, then wait past the 300 ms save
    await cdpCardToColumnDragAndDrop(page, cardId, betaId)
    await expect(cardIn(page, betaId, cardId)).toBeVisible()
    await expect
      .poll(async () => {
        const now = await page.evaluate(() => performance.now())
        const writes = await gitboxStateWrites(page)
        return now - started >= 400 && writes === 0
      })
      .toBe(true)

    // Act: pick a theme that is not the one already stored
    const nextTheme = themeBefore === 'midnight' ? 'sunrise' : 'midnight'
    await selectTheme(page, THEME_MENU_NAME[nextTheme] ?? 'Midnight')

    // Assert: the stored theme is the one just chosen, and a write happened
    await expect.poll(() => storedTheme(page)).toBe(nextTheme)
    await expect.poll(() => gitboxStateWrites(page)).toBeGreaterThan(0)

    // Restore the theme the fixture had, so the next spec does not inherit it
    await selectTheme(page, THEME_MENU_NAME[themeBefore] ?? 'System')
    await expect.poll(() => storedTheme(page)).toBe(themeBefore)
  })
})

/**
 * Counts later writes of `gitbox-state`.
 *
 * Called after the page has hydrated, so the count starts at the drag.
 * A write of another key is left alone.
 *
 * @param page - The fixture browser page.
 */
async function countGitboxStateWrites(page: Page): Promise<void> {
  await page.evaluate(() => {
    const storage = window.localStorage
    const original = storage.setItem.bind(storage)
    let writes = 0
    storage.setItem = (key: string, value: string) => {
      if (key === 'gitbox-state') writes += 1
      original(key, value)
    }
    ;(
      window as Window & { __gitboxStateWrites?: () => number }
    ).__gitboxStateWrites = () => writes
  })
}

/**
 * How many times `gitbox-state` was written since {@link countGitboxStateWrites}.
 *
 * @param page - The fixture browser page.
 * @returns The count, or 0 when the counter was not installed.
 */
async function gitboxStateWrites(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        window as Window & { __gitboxStateWrites?: () => number }
      ).__gitboxStateWrites?.() ?? 0,
  )
}

/**
 * The theme stored for this browser.
 *
 * @param page - The fixture browser page.
 * @returns The theme id, or `system` when nothing is stored yet.
 */
async function storedTheme(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('gitbox-state')
    if (raw === null) return 'system'
    const theme = (
      JSON.parse(raw) as { state?: { settings?: { theme?: string } } }
    ).state?.settings?.theme
    return theme ?? 'system'
  })
}

/**
 * Chooses a theme from the sidebar menu.
 *
 * @param page - The fixture browser page.
 * @param menuName - The name shown on the menu item, such as Midnight.
 */
async function selectTheme(page: Page, menuName: string): Promise<void> {
  await page.locator('aside button:has-text("Theme")').click()
  await page.locator('[role="menuitem"]').filter({ hasText: menuName }).click()
}

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
 * Called by the test. The card's repository is not one of the seed
 * repositories, so removing the board removes the only row for it.
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
      repo_owner: 'persisted-save',
      repo_name: 'skip-write',
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
