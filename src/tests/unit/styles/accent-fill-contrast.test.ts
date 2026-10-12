/**
 * Unit Tests: contrast of what stands on the accent fill
 *
 * A row under the pointer and a chosen row are filled with `bg-accent`, and a
 * menu item under the pointer or the keyboard is too. Text and marks on that
 * fill have `text-accent-foreground`:
 * - an option row of the Add Repositories picker: the description, the stars
 *   and the language, and the check mark of a selected row. They were muted
 *   (between 1.9:1 and 2.4:1 on the fill in six dark themes) and the check
 *   mark had the theme color (between 1.3:1 and 1.8:1 there).
 * - the check mark of the chosen item in the theme list and in the list of
 *   comment colors, which had the theme color as well.
 *
 * Whether the elements have that color is checked in a browser:
 * e2e/logged-in/add-repository-combobox.spec.ts for the rows, the stories of
 * ThemeToggle and CommentActionsMenu for the check marks.
 *
 * @see src/components/Board/AddRepositoryCombobox.tsx
 * @see src/components/ThemeToggle/ThemeToggle.tsx
 * @see src/components/Board/CommentActionsMenu.tsx
 * @see src/tests/unit/styles/theme-color-math.ts
 */

import { describe, expect, test } from 'vitest'

import {
  AA_TEXT_CONTRAST,
  contrastRatio,
  readThemeColor,
  THEME_SELECTORS,
} from './theme-color-math'

describe('what stands on the accent fill', () => {
  // Value: protects=the description, the stars and the check mark of a hovered or selected repository in the picker, and the check mark of a highlighted menu item, can be read in every theme; fails_when=a theme gets an accent fill its accent-foreground is too close to; why_new=the tests of the sidebar compute the foreground color on this fill, not the color made for it; seam=none; no_claim=that the elements carry the color, which the browser tests named above check
  test.each(THEME_SELECTORS)(
    'text and marks in the color made for the fill are readable on it: %s',
    (themeSelector) => {
      // Arrange: bg-accent under text-accent-foreground
      const fill = readThemeColor(themeSelector, 'accent')
      const textOnFill = readThemeColor(themeSelector, 'accent-foreground')

      // Act
      const contrast = contrastRatio(textOnFill, fill)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  // Value: protects=the language of a hovered or selected repository can be read on its chip; fails_when=a theme gets a muted fill its accent-foreground is too close to; why_new=the chip inherits the color of its row since the row sets it, a pair no test computed; seam=none; no_claim=the chip of a row at rest, which is muted text on the muted fill as before
  test.each(THEME_SELECTORS)(
    'the language chip of such a row is readable: %s',
    (themeSelector) => {
      // Arrange: bg-muted, with the text color the row gives on to it
      const chip = readThemeColor(themeSelector, 'muted')
      const textOnChip = readThemeColor(themeSelector, 'accent-foreground')

      // Act
      const contrast = contrastRatio(textOnChip, chip)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  // Value: protects=the check mark of the chosen item is readable while its item is not highlighted, where it has the color of the menu's text; fails_when=a theme gets a popover its popover-foreground is too close to; why_new=the check mark had the theme color and no test computed the color it has now; seam=none; no_claim=none
  test.each(THEME_SELECTORS)(
    'the check mark of a menu item at rest is readable on the menu: %s',
    (themeSelector) => {
      // Arrange: bg-popover under text-popover-foreground
      const menu = readThemeColor(themeSelector, 'popover')
      const checkMark = readThemeColor(themeSelector, 'popover-foreground')

      // Act
      const contrast = contrastRatio(checkMark, menu)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})
