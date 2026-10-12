/**
 * Unit Tests: contrast of the favorite star of a board card
 *
 * The star is an icon without a label: its outline is all that says where
 * the button is. On a touch screen and on a narrow one the star of every
 * board is on screen all the time, so it has to stand out from the card in
 * both states, in every theme:
 * - a board that is no favorite: `text-muted-foreground`, undimmed
 * - a favorite: `text-amber-700`, `dark:text-amber-400`
 *
 * BoardCard.test.tsx checks that the star carries these classes.
 *
 * @see src/components/Boards/BoardCard.tsx
 * @see src/tests/unit/styles/theme-color-math.ts
 */

import { describe, expect, test } from 'vitest'

import {
  AA_ICON_CONTRAST,
  contrastRatio,
  DARK_THEME_SELECTORS,
  readTailwindColor,
  readThemeColor,
  THEME_SELECTORS,
} from './theme-color-math'

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
      const favoriteStar = readTailwindColor(
        DARK_THEME_SELECTORS.includes(themeSelector)
          ? 'amber-400'
          : 'amber-700',
      )

      // Act
      const contrast = contrastRatio(favoriteStar, card)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_ICON_CONTRAST)
    },
  )
})
