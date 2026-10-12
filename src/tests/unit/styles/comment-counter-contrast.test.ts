/**
 * Unit Tests: contrast of the comment editor on its tinted box
 *
 * The editor of a card's comment (CommentInlineEdit) stands on the comment's
 * box: one of the colors of COMMENT_CARD_COLORS at 20% over the card, and at
 * 25% while the pointer is on the box. These tests read those tints from the
 * component and the colors from the theme files, and compute the WCAG
 * contrast of what the editor writes there, in every theme:
 * - the character counter in its plain state, 70% of the foreground
 * - the text being typed, which keeps its color over the limit
 * - the counter near the limit, orange on a chip of the page background
 * - the counter over the limit, on a destructive fill
 *
 * CommentInlineEdit.test.tsx checks that the counter carries these classes.
 *
 * @see src/components/Board/CommentInlineEdit.tsx
 * @see src/tests/unit/styles/theme-color-math.ts
 */

import { describe, expect, test } from 'vitest'

import { COMMENT_CARD_COLORS } from '@/components/Board/CommentDisplay'

import {
  AA_TEXT_CONTRAST,
  contrastRatio,
  DARK_THEME_SELECTORS,
  paintOver,
  readTailwindColor,
  readThemeColor,
  type Srgb,
  THEME_SELECTORS,
} from './theme-color-math'

/** One background of a comment box: a color and how much of it is painted. */
interface CommentTint {
  /** Name of the color as the class writes it, e.g. `blue-500` or `primary`. */
  colorName: string
  /** Opacity of the fill, 0 to 1. */
  opacity: number
}

/** `text-foreground/70` of the counter in its plain state. */
const PLAIN_COUNTER_OPACITY = 0.7

/** `bg-<color>/<percent>` at rest and under `hover:`, in one class string. */
const TINT_PATTERN = /(?<![\w-])(?:hover:)?bg-([a-z]+(?:-\d+)?)\/(\d+)/g

/**
 * The tints of every comment color, at rest and under the pointer, as
 * COMMENT_CARD_COLORS writes them.
 */
const COMMENT_TINTS: CommentTint[] = Object.values(COMMENT_CARD_COLORS).flatMap(
  (classNames) =>
    [...classNames.matchAll(TINT_PATTERN)].map((tint) => ({
      colorName: tint[1] ?? '',
      opacity: Number(tint[2]) / 100,
    })),
)

describe('the tints these tests read from the comment colors', () => {
  test('finds the resting and the hovered tint of all eight comment colors', () => {
    // Act
    const tintNames = COMMENT_TINTS.map(
      ({ colorName, opacity }) => `${colorName} at ${opacity}`,
    ).sort()

    // Assert: a pattern that finds nothing would pass every test below
    expect(tintNames).toEqual([
      'amber-500 at 0.2',
      'amber-500 at 0.25',
      'blue-500 at 0.2',
      'blue-500 at 0.25',
      'cyan-500 at 0.2',
      'cyan-500 at 0.25',
      'green-500 at 0.2',
      'green-500 at 0.25',
      'muted at 0.2',
      'muted at 0.25',
      'primary at 0.2',
      'primary at 0.25',
      'purple-500 at 0.2',
      'purple-500 at 0.25',
      'rose-500 at 0.2',
      'rose-500 at 0.25',
    ])
  })
})

describe('the comment editor on its tinted box', () => {
  test.each(THEME_SELECTORS)(
    'the character counter can be read on every comment color, at rest and under the pointer: %s',
    (themeSelector) => {
      // Arrange
      const foreground = readThemeColor(themeSelector, 'foreground')
      const boxes = paintCommentBoxes(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...boxes.map((box) =>
          contrastRatio(paintOver(foreground, box, PLAIN_COUNTER_OPACITY), box),
        ),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'the comment being typed can be read on every comment color, also over the limit: %s',
    (themeSelector) => {
      // Arrange: the field inherits the text color of the card
      const cardText = readThemeColor(themeSelector, 'card-foreground')
      const boxes = paintCommentBoxes(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...boxes.map((box) => contrastRatio(cardText, box)),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'the counter near the limit can be read on its chip: %s',
    (themeSelector) => {
      // Arrange: `bg-background text-orange-800 dark:text-orange-300`
      const chip = readThemeColor(themeSelector, 'background')
      const warningText = readTailwindColor(
        DARK_THEME_SELECTORS.includes(themeSelector)
          ? 'orange-300'
          : 'orange-800',
      )

      // Act
      const contrast = contrastRatio(warningText, chip)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'the counter over the limit can be read on its red fill: %s',
    (themeSelector) => {
      // Arrange: `bg-destructive text-destructive-foreground`
      const fill = readThemeColor(themeSelector, 'destructive')
      const label = readThemeColor(themeSelector, 'destructive-foreground')

      // Act
      const contrast = contrastRatio(label, fill)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})

/**
 * Paints every comment tint over the card of one theme: the backgrounds the
 * editor can stand on.
 *
 * @param themeSelector - Selector of the theme's block of tokens.
 * @returns The opaque color of each box, one per entry of
 * {@link COMMENT_TINTS}.
 * @example
 * paintCommentBoxes(':root').length // => 16
 */
function paintCommentBoxes(themeSelector: string): Srgb[] {
  const card = readThemeColor(themeSelector, 'card')
  return COMMENT_TINTS.map(({ colorName, opacity }) => {
    // A name that ends in a step (blue-500) is a palette color, any other
    // (primary, muted) is a token of the theme
    const isPaletteColor = /-\d+$/.test(colorName)
    const tintColor = isPaletteColor
      ? readTailwindColor(colorName)
      : readThemeColor(themeSelector, colorName)
    return paintOver(tintColor, card, opacity)
  })
}
