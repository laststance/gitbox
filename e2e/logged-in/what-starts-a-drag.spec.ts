/**
 * What Starts a Drag on the Board E2E Tests
 *
 * A card and a column header are picked up by a press on themselves: a mouse
 * that moves more than 8px while it is down, a finger that rests 200ms, or
 * Space or Enter. Both hold other things that take presses and keys of their
 * own: menus, which are drawn elsewhere on the page while React hands their
 * events up to the card that rendered them, buttons inside the card and the
 * header, and the comment editor. While the drag sensors took those events for
 * their own, a mouse that slipped on a menu item or on a button, a finger that
 * rested on it and Enter on the button picked the card up, and the item or the
 * button did nothing.
 *
 * The mouse, the finger and the keyboard of these tests are real ones.
 * Playwright's own tap lifts the finger at once, so a finger that rests is
 * sent through the DevTools protocol.
 *
 * @see src/lib/utils/may-start-drag.ts
 * @see src/lib/utils/own-element-sensors.ts
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  STATUS_IDS,
  resetProjectInfoComments,
  resetStatusListPositions,
} from '../helpers/db-query'

/** More than the 8px of mouse travel that start a drag on the board. */
const SLIP_PX = 12

/** More than the 200ms a finger rests before the board picks a card up. */
const REST_MS = 300

/** The box of an element on the page, as Playwright measures it. */
type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>

/**
 * Waits until an element stands still and tells where it is. A card slides
 * 20px into its place when the board appears, and a place that is measured
 * during those 200ms is one the card has left when the press arrives.
 * @param target - The element to measure.
 * @returns The box of the element on the page.
 */
async function boxAtRest(target: Locator): Promise<Box> {
  // A trial hover runs Playwright's checks, one of which is that the element no longer moves
  await target.hover({ trial: true })
  const box = await target.boundingBox()
  if (!box) throw new Error('boxAtRest: the target is not on the page')
  return box
}

/**
 * Presses the mouse on an element, lets it slip sideways while it is down and
 * releases it there, as a hand does that moves during a click.
 * @param page - The page of the test.
 * @param target - The element to click. It has to be wider than 16px plus the slip.
 * @param whileDown - Runs after the slip and before the mouse is released.
 */
async function clickWithSlip(
  page: Page,
  target: Locator,
  whileDown?: () => Promise<void>,
): Promise<void> {
  const box = await boxAtRest(target)
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + 16, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 16 + SLIP_PX, y, { steps: 6 })
  await whileDown?.()
  await page.mouse.up()
}

/**
 * Puts a finger on the middle of an element, lets it rest there and lifts it.
 * @param page - The page of the test. Its context needs `hasTouch`.
 * @param target - The element to touch.
 * @param whileResting - Runs after the rest and before the finger lifts.
 */
async function restFingerOn(
  page: Page,
  target: Locator,
  whileResting?: () => Promise<void>,
): Promise<void> {
  const box = await boxAtRest(target)
  const point = {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  }
  const devTools = await page.context().newCDPSession(page)
  await devTools.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  })
  await page.waitForTimeout(REST_MS)
  await whileResting?.()
  await devTools.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await devTools.detach()
}

test.describe('What starts a drag on the board', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    // card1 has a comment in the color "primary", and every column is in its first place
    await resetProjectInfoComments()
    await resetStatusListPositions()
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
  })

  test.afterEach(async () => {
    await resetProjectInfoComments()
  })

  test.describe('in a menu, with a mouse that slips while it is down', () => {
    // Value: protects=a click on a comment color chooses it although the hand moved; fails_when=the card's drag sensor takes the press in the menu for a press on the card, picks the card up and swallows the click; why_new=every test clicked without moving; seam=the board page in a browser with a real mouse; no_claim=that the color is saved
    test('chooses the comment color the mouse was pressed on', async ({
      page,
    }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      const comment = card.getByTestId('comment-display')
      await comment.hover()
      await card.getByTestId('comment-actions-trigger').click()
      await page.getByTestId('comment-action-color').click()
      const blue = page.getByTestId('comment-color-blue')
      await expect(blue).toBeVisible()

      // Act
      await clickWithSlip(page, blue)

      // Assert
      await expect(comment).toHaveClass(/bg-blue-500\/20/)
      await expect(card).toHaveCSS('opacity', '1')
    })

    // Value: protects=a click on Edit Column opens the column dialog although the hand moved; fails_when=the header's drag sensor takes the press in the column menu for a press on the header, picks the column up and swallows the click; why_new=every test clicked without moving; seam=the board page in a browser with a real mouse; no_claim=what the dialog saves
    test('opens the column dialog from Edit Column', async ({ page }) => {
      // Arrange
      await page.getByRole('button', { name: 'Column options' }).first().click()
      const editColumn = page.getByRole('menuitem', { name: 'Edit Column' })
      await expect(editColumn).toBeVisible()

      // Act
      await clickWithSlip(page, editColumn)

      // Assert
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  test.describe('in a menu, with a finger that rests before it lifts', () => {
    test.use({ hasTouch: true })

    // Value: protects=a slow tap on Move to Another Board opens the dialog; fails_when=the card's touch sensor takes the finger on the menu item for a finger on the card and picks the card up after 200ms; why_new=no test used a finger, and the menu's own guard stops the mouse only; seam=the board page in a browser with touch events; no_claim=the move itself, see move-to-another-board.spec.ts
    test('opens the Move dialog from Move to Another Board', async ({
      page,
    }) => {
      // Arrange
      await page.getByTestId(`overflow-menu-trigger-${CARD_IDS.card1}`).tap()
      const moveItem = page.getByRole('menuitem', {
        name: 'Move to Another Board',
      })
      await expect(moveItem).toBeVisible()

      // Act
      await restFingerOn(page, moveItem)

      // Assert
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    // Value: protects=a slow tap on a comment color chooses it; fails_when=the card's touch sensor takes the finger on the color for a finger on the card; why_new=no test used a finger on the comment menu, whose button this branch shows where the main pointer is a finger; seam=the board page in a browser with touch events; no_claim=that the color is saved
    test('chooses the comment color the finger rested on', async ({ page }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      const comment = card.getByTestId('comment-display')
      await card.getByTestId('comment-actions-trigger').tap()
      await page.getByTestId('comment-action-color').tap()
      const blue = page.getByTestId('comment-color-blue')
      await expect(blue).toBeVisible()

      // Act
      await restFingerOn(page, blue)

      // Assert
      await expect(comment).toHaveClass(/bg-blue-500\/20/)
    })

    // Value: protects=a slow tap on Edit Column opens the column dialog; fails_when=the header's touch sensor takes the finger on the menu item for a finger on the header; why_new=no test used a finger on the column menu; seam=the board page in a browser with touch events; no_claim=what the dialog saves
    test('opens the column dialog from Edit Column', async ({ page }) => {
      // Arrange
      await page.getByRole('button', { name: 'Column options' }).first().tap()
      const editColumn = page.getByRole('menuitem', { name: 'Edit Column' })
      await expect(editColumn).toBeVisible()

      // Act
      await restFingerOn(page, editColumn)

      // Assert
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  test.describe('on a button of the card', () => {
    test.use({ hasTouch: true })

    // Value: protects=a click on Open note opens the note although the hand moved; fails_when=the card's mouse sensor takes a press on a button inside the card for a press on the card, picks the card up and swallows the click; why_new=every test clicked without moving; seam=the board page in a browser with a real mouse; no_claim=what the note dialog saves
    test('opens the note when the mouse slips on Open note', async ({
      page,
    }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      const openNote = card.getByRole('button', { name: 'Open note' })
      await expect(openNote).toBeVisible()

      // Act
      await clickWithSlip(page, openNote)

      // Assert
      await expect(page.getByTestId('note-modal')).toBeVisible()
      await expect(card).toHaveCSS('opacity', '1')
    })

    // Value: protects=a slow tap on Open note opens the note; fails_when=the card's touch sensor takes a finger on a button inside the card for a finger on the card and picks the card up after 200ms; why_new=no test used a finger on a button of a card; seam=the board page in a browser with touch events; no_claim=what the note dialog saves
    test('opens the note when a finger rests on Open note', async ({
      page,
    }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      const openNote = card.getByRole('button', { name: 'Open note' })
      await expect(openNote).toBeVisible()

      // Act
      await restFingerOn(page, openNote)

      // Assert
      await expect(page.getByTestId('note-modal')).toBeVisible()
    })

    // Value: protects=the keyboard presses the Open note button; fails_when=the card's keyboard sensor takes Enter on a button inside the card for Enter on the card, picks the card up and cancels the click; why_new=no test pressed a button of a card with the keyboard; seam=the board page in a browser with a real keyboard; no_claim=Enter on the card itself, see keyboard-shortcuts.spec.ts
    test('opens the note on Enter on Open note', async ({ page }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      await card.getByRole('button', { name: 'Open note' }).focus()

      // Act
      await page.keyboard.press('Enter')

      // Assert
      await expect(page.getByTestId('note-modal')).toBeVisible()
      await expect(card).toHaveCSS('opacity', '1')
    })

    // Value: protects=Space presses the Open note button as Enter does; fails_when=the card's keyboard sensor takes Space on a button inside the card for Space on the card and picks the card up; why_new=no test pressed a button of a card with the keyboard; seam=the board page in a browser with a real keyboard; no_claim=Space on the card itself, which picks it up (the last test of this file)
    test('opens the note on Space on Open note', async ({ page }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      await card.getByRole('button', { name: 'Open note' }).focus()

      // Act
      await page.keyboard.press('Space')

      // Assert
      await expect(page.getByTestId('note-modal')).toBeVisible()
      await expect(card).toHaveCSS('opacity', '1')
    })
  })

  test.describe('in the open comment editor', () => {
    test.use({ hasTouch: true })

    // Value: protects=a press on the counter of the comment editor does not pick the card up; fails_when=mayStartDrag forgets the data-no-drag mark of the editor, whose counter is neither a field nor a button; why_new=the editor stopped pointerdown, which no sensor of the board listens for; seam=the board page in a browser with a real mouse; no_claim=what the press does to the editor, which stays open: its field loses the focus and saves nothing, the text being the same
    test('leaves the card in place when the mouse slips on the counter', async ({
      page,
    }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      await card.getByTestId('comment-text').click()
      const counter = card.getByTestId('character-counter')
      await expect(counter).toBeVisible()

      // Act and assert: the card is not lifted while the mouse is down
      await clickWithSlip(page, counter, async () => {
        await page.evaluate(() => new Promise(requestAnimationFrame))
        await expect(card).toHaveCSS('opacity', '1')
      })
    })

    // Value: protects=a finger that rests on the counter of the comment editor does not pick the card up; fails_when=mayStartDrag forgets the data-no-drag mark of the editor; why_new=no test used a finger on the editor; seam=the board page in a browser with touch events; no_claim=what the tap does to the editor
    test('leaves the card in place when a finger rests on the counter', async ({
      page,
    }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      await card.getByTestId('comment-text').click()
      const counter = card.getByTestId('character-counter')
      await expect(counter).toBeVisible()

      // Act and assert: the card is not lifted while the finger rests
      await restFingerOn(page, counter, async () => {
        await expect(card).toHaveCSS('opacity', '1')
      })
    })
  })

  test.describe('on the card itself', () => {
    test.use({ hasTouch: true })

    // Value: protects=a finger that rests on a card still picks it up; fails_when=the sensors refuse the presses of the card itself along with those of its menus; why_new=no test dragged with a finger; seam=the board page in a browser with touch events; no_claim=where the card can be dropped, see the kanban-dnd specs
    test('still picks up the card the finger rests on', async ({ page }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      await expect(card).toHaveCSS('opacity', '1')

      // Act and assert: the card is lifted while the finger rests, and put back when it lifts
      await restFingerOn(page, card.getByTestId('repo-name'), async () => {
        await expect(card).toHaveCSS('opacity', '0.5')
      })
      await expect(card).toHaveCSS('opacity', '1')
    })

    // Value: protects=Space on a card still picks it up; fails_when=the keyboard sensor refuses the keys of the card itself along with those of its buttons and menus; why_new=no test dragged with the keyboard; seam=the board page in a browser with a real keyboard; no_claim=where the arrow keys move the card
    test('still picks up the card on Space, and Escape puts it back', async ({
      page,
    }) => {
      // Arrange
      const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
      await page.locator(`[data-repo-card-id="${CARD_IDS.card1}"]`).focus()

      // Act
      await page.keyboard.press('Space')

      // Assert
      await expect(card).toHaveCSS('opacity', '0.5')
      // dnd-kit starts to listen for the keys of a drag in a timeout of its
      // own, so an Escape in the same instant as the lift is not heard (6 of
      // 6 runs). A timeout of the page that is set later runs after that one
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))
      await page.keyboard.press('Escape')
      await expect(card).toHaveCSS('opacity', '1')
    })
  })

  test.describe('on the column header', () => {
    test.use({ hasTouch: true })

    // Value: protects=a slow tap on Column options opens the column menu; fails_when=the header's touch sensor takes a finger on the button inside the header for a finger on the header and picks the column up after 200ms; why_new=no test used a finger on the header; seam=the board page in a browser with touch events; no_claim=the items of the menu, see the tests of Edit Column above
    test('opens the column menu when a finger rests on Column options', async ({
      page,
    }) => {
      // Arrange
      const column = page.getByTestId(`sortable-column-${STATUS_IDS.pending}`)
      const columnOptions = column.getByRole('button', {
        name: 'Column options',
      })
      await expect(columnOptions).toBeVisible()

      // Act and assert: the column is not lifted while the finger rests
      await restFingerOn(page, columnOptions, async () => {
        await expect(column).toHaveCSS('opacity', '1')
      })

      // Assert
      await expect(
        page.getByRole('menuitem', { name: 'Edit Column' }),
      ).toBeVisible()
    })

    // Value: protects=a finger that rests on the title of a column still picks the column up; fails_when=the sensors refuse the presses of the header itself along with those of its button; why_new=no test dragged a column with a finger; seam=the board page in a browser with touch events; no_claim=where the column can be dropped, see kanban-dnd/column-dnd.spec.ts
    test('still picks up the column the finger rests on', async ({ page }) => {
      // Arrange
      const column = page.getByTestId(`sortable-column-${STATUS_IDS.pending}`)
      await expect(column).toHaveCSS('opacity', '1')

      // Act and assert: the column is lifted while the finger rests, and put back when it lifts
      await restFingerOn(
        page,
        column.getByRole('heading', { name: 'Pending' }),
        async () => {
          await expect(column).toHaveCSS('opacity', '0.5')
        },
      )
      await expect(column).toHaveCSS('opacity', '1')
    })

    // Value: protects=Space on the header of a column picks the column up, and Escape puts it back and takes the drop zones away; fails_when=the keyboard sensor refuses the keys of the header itself, or a cancelled drag leaves the board in the state of a column drag; why_new=no test dragged a column with the keyboard or cancelled a drag, and the board had no handler for a cancelled drag; seam=the board page in a browser with a real keyboard; no_claim=where the arrow keys move the column
    test('still picks up the column on Space, and Escape puts it back', async ({
      page,
    }) => {
      // Arrange
      const column = page.getByTestId(`sortable-column-${STATUS_IDS.pending}`)
      const newRowZone = page.getByText('Drop column here to create new row')
      await column
        .getByRole('button', { name: /^Drag to reorder Pending column/ })
        .focus()

      // Act
      await page.keyboard.press('Space')

      // Assert
      await expect(column).toHaveCSS('opacity', '0.5')
      await expect(newRowZone).toBeVisible()
      // dnd-kit hears the keys of a drag one timeout later, as in the test of the card
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))
      await page.keyboard.press('Escape')
      await expect(column).toHaveCSS('opacity', '1')
      await expect(newRowZone).toBeHidden()
    })
  })
})
