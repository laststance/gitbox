/**
 * Painted size of the icon triggers locked by issue #322.
 *
 * Desktop Chrome cannot flip `pointer: coarse`, so these tests claim the
 * 36px painted box only. The 44px overlay is locked by the unit strings.
 */

import { expect, test, type Locator } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  resetProjectInfoComments,
} from '../helpers/db-query'

async function paintedSize(locator: Locator): Promise<{
  width: number
  height: number
}> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return {
    width: Math.round(box!.width),
    height: Math.round(box!.height),
  }
}

test.describe('Control heights', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test.beforeEach(async ({ page }) => {
    await resetProjectInfoComments()
    await page.goto(`/board/${BOARD_IDS.testBoard}`)
  })

  test.afterEach(async () => {
    await resetProjectInfoComments()
  })

  // Value: protects=card menu, comment menu, and Column options paint at 36 after hydration; fails_when=any of those three is 24; no_claim=the 44px coarse overlay, which Desktop Chrome does not apply
  test('paints the card menu, comment menu, and Column options at 36px after hydration', async ({
    page,
  }) => {
    // Arrange
    const overflow = page.getByTestId(`overflow-menu-trigger-${CARD_IDS.card1}`)
    const comment = page.getByTestId('comment-actions-trigger')
    const column = page.getByTestId('column-options-trigger').first()

    // Act
    await comment.focus()

    // Assert
    await expect.poll(async () => (await paintedSize(overflow)).width).toBe(36)
    await expect.poll(async () => (await paintedSize(overflow)).height).toBe(36)
    await expect.poll(async () => (await paintedSize(comment)).width).toBe(36)
    await expect.poll(async () => (await paintedSize(comment)).height).toBe(36)
    await expect.poll(async () => (await paintedSize(column)).width).toBe(36)
    await expect.poll(async () => (await paintedSize(column)).height).toBe(36)
  })

  // Value: protects=Move dialog Close paints at 36 and stays at top-2 right-2; fails_when=pointer-coarse:size-11 remains or the painted box is 32; no_claim=a completed move
  test('paints Move dialog Close at 36px in the top-right corner', async ({
    page,
  }) => {
    // Arrange
    await page.getByTestId(`overflow-menu-trigger-${CARD_IDS.card1}`).click()
    await page.getByRole('menuitem', { name: 'Move to Another Board' }).click()

    // Act
    const close = page.getByRole('button', { name: 'Close' })
    const className = await close.getAttribute('class')

    // Assert
    expect(className).toContain('top-2')
    expect(className).toContain('right-2')
    expect(className).not.toContain('top-0.5')
    await expect.poll(async () => (await paintedSize(close)).width).toBe(36)
    await expect.poll(async () => (await paintedSize(close)).height).toBe(36)

    await page.keyboard.press('Escape')
  })
})
