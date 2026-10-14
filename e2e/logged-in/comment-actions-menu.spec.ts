/**
 * Comment Actions Menu E2E Tests
 *
 * The comment of a card is a button that opens its editor, and the menu with
 * Edit, Color and Delete is rendered inside it. A click or a key in that menu
 * reaches the comment as well, so the comment has to tell them from a click
 * or a key on itself. While it did not, a click on Color and Enter or Space
 * on the menu button opened the editor: a touch screen, which cannot hover,
 * had no way to the colors, and the keyboard had none to the menu.
 *
 * The stories of the comment check the same with the components alone. These
 * tests use the card of the board, with a real pointer and a real keyboard.
 *
 * @see src/components/Board/CommentEditingWorkflow.stories.tsx
 */

import { expect, test } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  resetProjectInfoComments,
} from '../helpers/db-query'

test.describe('Comment actions menu on a card', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    // card1 has a comment in the color "primary"
    await resetProjectInfoComments()
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
  })

  test.afterEach(async () => {
    await resetProjectInfoComments()
  })

  // Value: protects=a click or a tap on Color opens the colors of a card's comment; fails_when=the comment takes a click in its menu for a click on itself and opens the editor; why_new=the one test that changes a color hovers Color, which a touch screen cannot; seam=the board page in a browser with a real pointer; no_claim=that the chosen color is saved
  test('opens the colors, not the editor, on a click on Color', async ({
    page,
  }) => {
    // Arrange
    const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
    const comment = card.getByTestId('comment-display')
    await comment.hover()
    await card.getByTestId('comment-actions-trigger').click()

    // Act
    await page.getByTestId('comment-action-color').click()

    // Assert
    await expect(page.getByTestId('comment-color-blue')).toBeVisible()
    await expect(comment).toBeVisible()
    await expect(card.getByTestId('comment-textarea')).toBeHidden()
  })

  // Value: protects=the keyboard alone opens the comment menu and chooses a color; fails_when=the comment takes Enter on its menu button or on a menu item for Enter on itself and opens the editor; why_new=no test used the keyboard on the comment menu; seam=the board page in a browser with a real keyboard; no_claim=the arrow keys themselves, which are Radix's
  test('chooses a color with the keyboard alone and leaves the editor closed', async ({
    page,
  }) => {
    // Arrange
    const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
    const comment = card.getByTestId('comment-display')
    await expect(comment).toHaveClass(/bg-primary\/20/)
    await card.getByTestId('comment-actions-trigger').focus()

    // Act: Enter opens the menu, the arrows lead to Blue, Enter chooses it
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('comment-action-edit')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('comment-action-color')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('comment-color-neutral')).toBeFocused()
    // One arrow at a time: the menu moves its focus a moment after the key
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('comment-color-primary')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('comment-color-blue')).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert
    await expect(comment).toHaveClass(/bg-blue-500\/20/)
    await expect(comment).toBeVisible()
    await expect(card.getByTestId('comment-textarea')).toBeHidden()
    await expect(page.getByRole('menu')).toHaveCount(0)
  })

  // Value: protects=Space on the menu button opens the comment menu; fails_when=the comment takes Space on its menu button for Space on itself and opens the editor; why_new=no test used the keyboard on the comment menu; seam=the board page in a browser with a real keyboard; no_claim=what the menu items do
  test('opens the menu, not the editor, on Space on the menu button', async ({
    page,
  }) => {
    // Arrange
    const card = page.getByTestId(`repo-card-${CARD_IDS.card1}`)
    const comment = card.getByTestId('comment-display')
    await card.getByTestId('comment-actions-trigger').focus()

    // Act
    await page.keyboard.press('Space')

    // Assert
    await expect(page.getByTestId('comment-action-edit')).toBeVisible()
    await expect(comment).toBeVisible()
    await expect(card.getByTestId('comment-textarea')).toBeHidden()
  })
})
