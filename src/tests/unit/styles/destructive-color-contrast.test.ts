/**
 * Unit Tests: contrast of the destructive color in every theme
 *
 * Reads `--destructive` and the colors it is painted on from
 * src/styles/globals.css and src/styles/themes.css, and computes the WCAG
 * contrast of every way the app paints with it:
 * - the label on a destructive fill, at rest and on hover (the fill at 90%
 *   over the surface behind the button)
 * - the color as text on a surface: an error text, the menu item "Remove
 *   from Board"
 * - that text on its own tint (5% or 10% of the color over a surface): the
 *   focused menu item and the error box of the board form
 *
 * A browser does this painting, not a unit test, so the color math is done
 * in theme-color-math.ts. The first tests pin it with colors whose values
 * are known.
 *
 * @see src/styles/themes.css
 * @see src/styles/globals.css
 */

import { describe, expect, test } from 'vitest'

import {
  AA_TEXT_CONTRAST,
  contrastRatio,
  type Oklch,
  oklchToSrgb,
  paintOver,
  readThemeColor,
  type Srgb,
  THEME_SELECTORS,
  toHexColor,
} from './theme-color-math'

/** The colors of one theme that the destructive color meets. */
interface DestructiveColors {
  /** `--destructive`: the fill of a destructive button, and red text. */
  destructive: Srgb
  /** `--destructive-foreground`: the label on that fill. */
  label: Srgb
  /** `--background`, `--card` and `--popover`: what the color is painted on. */
  surfaces: Srgb[]
}

/** `hover:bg-destructive/90` of a destructive button. */
const HOVER_FILL_OPACITY = 0.9

/** `bg-destructive/5` and `bg-destructive/10` behind destructive text. */
const TINT_OPACITIES = [0.05, 0.1]

describe('the color math of these tests', () => {
  test('turns the OKLCH of Tailwind red-600 into its sRGB value', () => {
    // Arrange
    const tailwindRed600: Oklch = [0.577, 0.245, 27.325]

    // Act
    const hexColor = toHexColor(oklchToSrgb(tailwindRed600))

    // Assert
    expect(hexColor).toBe('#e7000b')
  })

  test('reads black on white as 21:1, the highest contrast there is', () => {
    // Arrange
    const black = oklchToSrgb([0, 0, 0])
    const white = oklchToSrgb([1, 0, 0])

    // Act
    const contrast = contrastRatio(black, white)

    // Assert
    expect(contrast).toBeCloseTo(21, 5)
  })

  test('paints a translucent fill over a surface the way a browser mixes the two', () => {
    // Arrange
    const black = oklchToSrgb([0, 0, 0])
    const white = oklchToSrgb([1, 0, 0])

    // Act
    const blackAt80PercentOverWhite = paintOver(black, white, 0.8)

    // Assert
    expect(toHexColor(blackAt80PercentOverWhite)).toBe('#333333')
  })
})

describe('the destructive color', () => {
  test.each(THEME_SELECTORS)(
    'the label of a destructive button can be read at rest and on hover: %s',
    (themeSelector) => {
      // Arrange
      const { destructive, label, surfaces } =
        readDestructiveColors(themeSelector)

      // Act
      const contrastAtRest = contrastRatio(label, destructive)
      const lowestContrastOnHover = Math.min(
        ...surfaces.map((surface) =>
          contrastRatio(
            label,
            paintOver(destructive, surface, HOVER_FILL_OPACITY),
          ),
        ),
      )

      // Assert
      expect(contrastAtRest).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
      expect(lowestContrastOnHover).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'destructive text can be read on the page, on a card and in a menu: %s',
    (themeSelector) => {
      // Arrange
      const { destructive, surfaces } = readDestructiveColors(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...surfaces.map((surface) => contrastRatio(destructive, surface)),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'destructive text can be read on its own tint, as in a focused "Remove from Board" and an error box: %s',
    (themeSelector) => {
      // Arrange
      const { destructive, surfaces } = readDestructiveColors(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...surfaces.flatMap((surface) =>
          TINT_OPACITIES.map((tintOpacity) =>
            contrastRatio(
              destructive,
              paintOver(destructive, surface, tintOpacity),
            ),
          ),
        ),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})

/**
 * Reads the colors the destructive color meets from one block of theme
 * tokens.
 *
 * @param themeSelector - Selector of the block, as written in the CSS.
 * @returns The {@link DestructiveColors} of that theme.
 * @throws When the block or one of its tokens is missing, or a token is not
 * an opaque `oklch(L C H)` (see {@link readThemeColor}).
 * @example
 * readDestructiveColors("html[data-theme='rose']").label
 * // => [0.98, 0.98, 0.98] (near-white)
 */
function readDestructiveColors(themeSelector: string): DestructiveColors {
  return {
    destructive: readThemeColor(themeSelector, 'destructive'),
    label: readThemeColor(themeSelector, 'destructive-foreground'),
    surfaces: [
      readThemeColor(themeSelector, 'background'),
      readThemeColor(themeSelector, 'card'),
      readThemeColor(themeSelector, 'popover'),
    ],
  }
}
