/**
 * Unit Tests: contrast of the warning color in every theme
 *
 * Reads `--warning` and the colors it is painted on from
 * src/styles/globals.css and src/styles/themes.css, and computes the WCAG
 * contrast of every way the app paints with it:
 * - the label on a warning fill, at rest and on hover (the fill at 90%
 *   over the surface behind the button)
 * - the color as text on a surface: a near-limit counter, an unknown-outcome
 *   alert
 * - that text on its own tint (5% or 10% of the color over a surface): the
 *   unknown-outcome box
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

/** The colors of one theme that the warning color meets. */
interface WarningColors {
  /** `--warning`: the fill of a warning badge, and warning text. */
  warning: Srgb
  /** `--warning-foreground`: the label on that fill. */
  label: Srgb
  /** `--background`, `--card` and `--popover`: what the color is painted on. */
  surfaces: Srgb[]
}

/** `hover:bg-warning/90` of a warning fill. */
const HOVER_FILL_OPACITY = 0.9

/** `bg-warning/5` and `bg-warning/10` behind warning text. */
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
})

describe('the warning color', () => {
  test.each(THEME_SELECTORS)(
    'the label of a warning fill can be read at rest and on hover: %s',
    (themeSelector) => {
      // Arrange
      const { warning, label, surfaces } = readWarningColors(themeSelector)

      // Act
      const contrastAtRest = contrastRatio(label, warning)
      const lowestContrastOnHover = Math.min(
        ...surfaces.map((surface) =>
          contrastRatio(label, paintOver(warning, surface, HOVER_FILL_OPACITY)),
        ),
      )

      // Assert
      expect(contrastAtRest).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
      expect(lowestContrastOnHover).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'warning text can be read on the page, on a card and in a menu: %s',
    (themeSelector) => {
      // Arrange
      const { warning, surfaces } = readWarningColors(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...surfaces.map((surface) => contrastRatio(warning, surface)),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'warning text can be read on its own tint, as in an unknown-outcome box: %s',
    (themeSelector) => {
      // Arrange
      const { warning, surfaces } = readWarningColors(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...surfaces.flatMap((surface) =>
          TINT_OPACITIES.map((tintOpacity) =>
            contrastRatio(warning, paintOver(warning, surface, tintOpacity)),
          ),
        ),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})

/**
 * Reads the colors the warning color meets from one block of theme tokens.
 *
 * @param themeSelector - Selector of the block, as written in the CSS.
 * @returns The {@link WarningColors} of that theme.
 */
function readWarningColors(themeSelector: string): WarningColors {
  return {
    warning: readThemeColor(themeSelector, 'warning'),
    label: readThemeColor(themeSelector, 'warning-foreground'),
    surfaces: [
      readThemeColor(themeSelector, 'background'),
      readThemeColor(themeSelector, 'card'),
      readThemeColor(themeSelector, 'popover'),
    ],
  }
}
