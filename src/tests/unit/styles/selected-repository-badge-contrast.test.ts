/**
 * Unit Tests: contrast of the badges of the selected repositories
 *
 * The Add Repositories picker lists what is selected as badges above its
 * list: `bg-primary/10` on the panel (`bg-background`) with a 12px label in
 * `text-foreground`. The label was `text-primary`, which on that tint was
 * between 2.9:1 and 4.49:1 in 12 of the 14 themes.
 *
 * AddRepositoryCombobox.placements.test.tsx checks that a badge carries these
 * classes.
 *
 * @see src/components/Board/AddRepositoryCombobox.tsx
 * @see src/tests/unit/styles/theme-color-math.ts
 */

import { describe, expect, test } from 'vitest'

import {
  AA_TEXT_CONTRAST,
  contrastRatio,
  paintOver,
  readThemeColor,
  THEME_SELECTORS,
} from './theme-color-math'

/** How much of the primary `bg-primary/10` paints over the panel. */
const BADGE_TINT_ALPHA = 0.1

describe('the badge of a selected repository in the picker', () => {
  test.each(THEME_SELECTORS)(
    'its label is readable on its tint: %s',
    (themeSelector) => {
      // Arrange: bg-primary/10 over bg-background, text-foreground on it
      const badgeTint = paintOver(
        readThemeColor(themeSelector, 'primary'),
        readThemeColor(themeSelector, 'background'),
        BADGE_TINT_ALPHA,
      )
      const label = readThemeColor(themeSelector, 'foreground')

      // Act
      const contrast = contrastRatio(label, badgeTint)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})
