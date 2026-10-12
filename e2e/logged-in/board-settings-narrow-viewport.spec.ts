/**
 * Board Settings Dialog on a Phone E2E Tests
 *
 * Below 512px the dialog is as wide as the screen. On a phone its four tabs
 * in one row are wider than that, and a row that is wider than the dialog
 * made the whole dialog scroll sideways. The tabs take a second row there.
 *
 * Only a browser lays the dialog out, so these tests measure it. What the
 * tabs and their panels are named is in the unit tests.
 *
 * @see src/tests/unit/components/Boards/BoardSettingsDialog.test.tsx
 */

import { expect, test } from '../fixtures/coverage'
import { BOARD_IDS } from '../helpers/db-query'

/** A small phone held upright: the dialog is as wide as this screen. */
const PHONE_VIEWPORT = { width: 375, height: 667 }

test.describe('Board Settings dialog on a 375px phone', () => {
  test.use({ storageState: 'e2e/.auth/user.json', viewport: PHONE_VIEWPORT })

  for (const tabName of ['General', 'Cards', 'Sharing', 'Danger Zone']) {
    // Value: protects=every tab of the board settings can be read and reached on a phone without moving the dialog sideways; fails_when=something in the dialog is wider than the dialog again, as the row of the four tabs was, so it scrolls sideways and a tab lies outside it, or the dialog itself is wider than the screen; why_new=no test opened this dialog on a narrow screen, and happy-dom lays nothing out; seam=none; no_claim=other dialogs, and widths between 375px and 640px
    test(`shows the ${tabName} tab without a sideways scroll, with all four tabs inside the dialog`, async ({
      page,
    }) => {
      // Arrange: the columns are drawn once the page answers to clicks
      await page.goto(`/board/${BOARD_IDS.testBoard}`)
      await expect(page.getByText('Pending')).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /board settings/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Act
      await dialog.getByRole('tab', { name: tabName, exact: true }).click()

      // Assert
      await expect(
        dialog.getByRole('tabpanel', { name: tabName, exact: true }),
      ).toBeVisible()
      const layout = await dialog.evaluate((element) => {
        const dialogBox = element.getBoundingClientRect()
        const screenWidthPx = document.documentElement.clientWidth
        return {
          // The dialog against the screen: a dialog that is wider than the
          // screen can hold all of its own content and still cut it off
          beyondScreenPx: Math.max(
            0,
            Math.round(-dialogBox.left),
            Math.round(dialogBox.right - screenWidthPx),
          ),
          hiddenWidthPx: element.scrollWidth - element.clientWidth,
          tabsOutsideTheDialog: [...element.querySelectorAll('[role="tab"]')]
            .filter((tab) => {
              const tabBox = tab.getBoundingClientRect()
              return (
                tabBox.left < dialogBox.left || tabBox.right > dialogBox.right
              )
            })
            .map((tab) => tab.textContent),
        }
      })
      expect(layout).toEqual({
        beyondScreenPx: 0,
        hiddenWidthPx: 0,
        tabsOutsideTheDialog: [],
      })
    })
  }
})
