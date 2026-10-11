/**
 * E2E: fetching a page's server data again keeps what the user has open
 *
 * `router.refresh()` asks the server for the page's data again. The board
 * calls it after a save failed and the board changed in the meantime, and the
 * Maintenance page calls it after a restore or a delete. The new data has to
 * arrive without the page being built again: an open dialog stays open and
 * text that is typed but not saved stays in its field.
 *
 * A Client Component that is exported as `memo(fn)` and rendered by a Server
 * Component is created anew on every server render (vercel/next.js#44901).
 * The root layout renders such components right under `<body>`, so a refetch
 * rebuilt every page. These tests fail when one of the components between the
 * root layout and the checked element is rebuilt again.
 *
 * Requires authentication (uses storageState from auth.setup.ts)
 */

import { test, expect } from '../fixtures/coverage'
import {
  BOARD_IDS,
  STATUS_IDS,
  createServiceRoleSupabaseClient,
  resetStatusListNames,
} from '../helpers/db-query'

/** The part of Next.js's `window.next` these tests call. */
interface WindowWithAppRouter {
  next: { router: { refresh: () => void } }
}

test.describe('Fetching the page data again (router.refresh)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.afterEach(async () => {
    await resetStatusListNames()
  })

  test('shows the newly fetched column name and keeps the open Board Settings dialog with its unsaved text', async ({
    page,
  }) => {
    // Arrange: the settings dialog is open and holds a board name that is not saved
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
    await page.getByRole('button', { name: /board settings/i }).click()
    const dialog = page.getByRole('dialog')
    const nameInput = dialog.getByRole('textbox', { name: 'Board name' })
    await nameInput.fill('Typed before the refetch')
    // ...and a column of this board was renamed somewhere else
    const supabase = createServiceRoleSupabaseClient()
    const { error } = await supabase
      .from('statuslist')
      .update({ name: 'Renamed elsewhere' })
      .eq('id', STATUS_IDS.pending)
    expect(error).toBeNull()

    // Act: the call the board makes after a failed save
    await page.evaluate(() => {
      // Next.js exposes the App Router on window; it has no type there
      const { next } = window as unknown as WindowWithAppRouter
      next.router.refresh()
    })

    // Assert: the fetched data is on the board...
    await expect(
      page.getByText('Renamed elsewhere', { exact: true }).first(),
    ).toBeVisible()
    // ...and the dialog is still open with the text that was typed
    await expect(dialog).toBeVisible()
    await expect(nameInput).toHaveValue('Typed before the refetch')
  })

  test('keeps the keyboard shortcuts help open when the boards page is fetched again', async ({
    page,
  }) => {
    // Arrange: the shortcuts help, which the root layout renders, is open
    await page.goto('/boards')
    await expect(
      page.getByRole('link', { name: /create board/i }),
    ).toBeVisible()
    await page.keyboard.press('?')
    const shortcutsHelp = page.getByRole('dialog')
    await expect(shortcutsHelp).toBeVisible()
    // Mark the element itself: one that is built again does not carry the mark
    await shortcutsHelp.evaluate((element) => {
      element.setAttribute('data-open-before-refetch', 'true')
    })
    // Next.js replaces the <title> element with every response it puts on
    // screen, so a marked <title> that is gone means the refetch was applied
    await page.evaluate(() => {
      document
        .querySelector('title')
        ?.setAttribute('data-before-refetch', 'true')
    })
    await expect(page.locator('title[data-before-refetch]')).toHaveCount(1)

    // Act
    await page.evaluate(() => {
      // Next.js exposes the App Router on window; it has no type there
      const { next } = window as unknown as WindowWithAppRouter
      next.router.refresh()
    })
    await expect(page.locator('title[data-before-refetch]')).toHaveCount(0)

    // Assert: the very same help dialog is still open
    await expect(
      page.locator('[role="dialog"][data-open-before-refetch="true"]'),
    ).toBeVisible()
  })
})
