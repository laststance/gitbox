/**
 * Unit Tests: contrast of the favorite star of a board card
 *
 * The star is an icon without a label: its outline is all that says where
 * the button is. On a touch screen and on a narrow one the star of every
 * board is on screen all the time, so it has to stand out from the card in
 * both states, in every theme:
 * - a board that is no favorite: `text-muted-foreground`, undimmed
 * - a favorite: `text-favorite`
 *
 * The empty-state icon on /boards/favorites sits on `bg-favorite/15` over
 * `--muted`. The label on a favorite fill is `--favorite-foreground`.
 *
 * BoardCard.test.tsx checks that the star carries these classes.
 *
 * @see src/components/Boards/BoardCard.tsx
 * @see src/app/boards/favorites/page.tsx
 * @see src/tests/unit/styles/theme-color-math.ts
 */

import { describe, expect, test } from 'vitest'

import {
  AA_ICON_CONTRAST,
  AA_TEXT_CONTRAST,
  contrastRatio,
  paintOver,
  readThemeColor,
  THEME_SELECTORS,
} from './theme-color-math'

/** `bg-favorite/15` of the empty-state circle. */
const EMPTY_ICON_TINT = 0.15

describe('the favorite star of a board card', () => {
  test.each(THEME_SELECTORS)(
    'the star of a board that is no favorite stands out from the card: %s',
    (themeSelector) => {
      // Arrange
      const card = readThemeColor(themeSelector, 'card')
      const mutedStar = readThemeColor(themeSelector, 'muted-foreground')

      // Act
      const contrast = contrastRatio(mutedStar, card)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_ICON_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'the star of a favorite stands out from the card: %s',
    (themeSelector) => {
      // Arrange
      const card = readThemeColor(themeSelector, 'card')
      const favoriteStar = readThemeColor(themeSelector, 'favorite')

      // Act
      const contrast = contrastRatio(favoriteStar, card)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_ICON_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'the empty-state star can be read on its favorite tint over muted: %s',
    (themeSelector) => {
      // Arrange: Star is text-favorite on bg-favorite/15 on the muted empty box
      const favorite = readThemeColor(themeSelector, 'favorite')
      const muted = readThemeColor(themeSelector, 'muted')
      const circle = paintOver(favorite, muted, EMPTY_ICON_TINT)

      // Act
      const contrast = contrastRatio(favorite, circle)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_ICON_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'the label on a favorite fill can be read: %s',
    (themeSelector) => {
      // Arrange
      const fill = readThemeColor(themeSelector, 'favorite')
      const label = readThemeColor(themeSelector, 'favorite-foreground')

      // Act
      const contrast = contrastRatio(label, fill)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})
