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
 * here. The first tests pin it with colors whose values are known.
 *
 * @see src/styles/themes.css
 * @see src/styles/globals.css
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

/** An OKLCH color as CSS writes it: lightness 0 to 1, chroma, hue in degrees. */
type Oklch = readonly [lightness: number, chroma: number, hueDegrees: number]

/**
 * A color as gamma-encoded sRGB channels from 0 to 1, the space a browser
 * composites a translucent fill in.
 */
type Srgb = readonly [red: number, green: number, blue: number]

/** The colors of one theme that the destructive color meets. */
interface DestructiveColors {
  /** `--destructive`: the fill of a destructive button, and red text. */
  destructive: Srgb
  /** `--destructive-foreground`: the label on that fill. */
  label: Srgb
  /** `--background`, `--card` and `--popover`: what the color is painted on. */
  surfaces: Srgb[]
}

/** What WCAG 2.1 AA asks of text below 18.66px bold or 24px. */
const AA_TEXT_CONTRAST = 4.5

/** `hover:bg-destructive/90` of a destructive button. */
const HOVER_FILL_OPACITY = 0.9

/** `bg-destructive/5` and `bg-destructive/10` behind destructive text. */
const TINT_OPACITIES = [0.05, 0.1]

/**
 * Every block of theme tokens: the two system defaults of globals.css (no
 * `data-theme`) and the 14 named themes of themes.css.
 */
const THEME_SELECTORS = [
  ':root',
  '.dark',
  "html[data-theme='default']",
  "html[data-theme='sunrise']",
  "html[data-theme='sandstone']",
  "html[data-theme='mint']",
  "html[data-theme='sky']",
  "html[data-theme='lavender']",
  "html[data-theme='rose']",
  "html[data-theme='dark']",
  "html[data-theme='midnight']",
  "html[data-theme='graphite']",
  "html[data-theme='forest']",
  "html[data-theme='ocean']",
  "html[data-theme='plum']",
  "html[data-theme='rust']",
]

const THEME_STYLES = ['src/styles/globals.css', 'src/styles/themes.css']
  .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
  .join('\n')

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
      const { destructive, label, surfaces } = readDestructiveColors(
        THEME_STYLES,
        themeSelector,
      )

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
      const { destructive, surfaces } = readDestructiveColors(
        THEME_STYLES,
        themeSelector,
      )

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
      const { destructive, surfaces } = readDestructiveColors(
        THEME_STYLES,
        themeSelector,
      )

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
 * @param styles - Text of the CSS files that hold the theme tokens.
 * @param themeSelector - Selector of the block, as written in the CSS.
 * @returns The {@link DestructiveColors} of that theme.
 * @throws When the block or one of its tokens is missing, or a token is not
 * an opaque `oklch(L C H)`: the math below does not cover another notation.
 * @example
 * readDestructiveColors(css, "html[data-theme='rose']").label
 * // => [0.98, 0.98, 0.98] (near-white)
 */
function readDestructiveColors(
  styles: string,
  themeSelector: string,
): DestructiveColors {
  // At the start of a line: the block that defines the tokens. The media
  // query for more contrast names the same selectors, indented.
  const blockStart = styles.indexOf(`\n${themeSelector} {`)
  if (blockStart === -1) {
    throw new Error(`No block of theme tokens for ${themeSelector}`)
  }
  const block = styles.slice(blockStart, styles.indexOf('}', blockStart))

  const readToken = (tokenName: string): Srgb => {
    const channels = new RegExp(
      `--${tokenName}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\);`,
    ).exec(block)
    if (!channels) {
      throw new Error(
        `${themeSelector} has no --${tokenName} written as oklch(L C H)`,
      )
    }
    return oklchToSrgb([
      Number(channels[1]),
      Number(channels[2]),
      Number(channels[3]),
    ])
  }

  return {
    destructive: readToken('destructive'),
    label: readToken('destructive-foreground'),
    surfaces: [
      readToken('background'),
      readToken('card'),
      readToken('popover'),
    ],
  }
}

/**
 * Converts an OKLCH color to sRGB (Björn Ottosson's OKLab matrices). A color
 * outside the sRGB gamut is clipped per channel, as a browser shows it on an
 * sRGB screen.
 *
 * @param color - The OKLCH color.
 * @returns The same color as gamma-encoded sRGB.
 * @example
 * oklchToSrgb([1, 0, 0]) // => [1, 1, 1] (white)
 */
function oklchToSrgb([lightness, chroma, hueDegrees]: Oklch): Srgb {
  const hueRadians = (hueDegrees * Math.PI) / 180
  const greenRed = chroma * Math.cos(hueRadians)
  const blueYellow = chroma * Math.sin(hueRadians)

  const long =
    (lightness + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3
  const medium =
    (lightness - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3
  const short =
    (lightness - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3

  const toEncodedChannel = (linearChannel: number): number => {
    const clipped = Math.min(1, Math.max(0, linearChannel))
    return clipped <= 0.0031308
      ? 12.92 * clipped
      : 1.055 * clipped ** (1 / 2.4) - 0.055
  }

  return [
    toEncodedChannel(
      4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    ),
    toEncodedChannel(
      -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    ),
    toEncodedChannel(
      -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
    ),
  ]
}

/**
 * Relative luminance of a color as WCAG 2.1 defines it.
 *
 * @param color - The color as gamma-encoded sRGB.
 * @returns 0 for black up to 1 for white.
 * @example
 * relativeLuminance([1, 1, 1]) // => 1
 */
function relativeLuminance([red, green, blue]: Srgb): number {
  const toLinearChannel = (encodedChannel: number): number =>
    encodedChannel <= 0.04045
      ? encodedChannel / 12.92
      : ((encodedChannel + 0.055) / 1.055) ** 2.4

  return (
    0.2126 * toLinearChannel(red) +
    0.7152 * toLinearChannel(green) +
    0.0722 * toLinearChannel(blue)
  )
}

/**
 * Contrast ratio of two colors as WCAG 2.1 defines it.
 *
 * @param first - One color.
 * @param second - The other; the order does not matter.
 * @returns 1 for two equal colors up to 21 for black and white.
 * @example
 * contrastRatio([0, 0, 0], [1, 1, 1]) // => 21
 */
function contrastRatio(first: Srgb, second: Srgb): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * The color seen where a translucent fill lies over an opaque surface, mixed
 * per channel in gamma-encoded sRGB as browsers do for `bg-destructive/90`.
 *
 * @param fill - Color of the fill.
 * @param surface - Opaque color behind it.
 * @param fillOpacity - Opacity of the fill, 0 to 1.
 * @returns The mixed color.
 * @example
 * paintOver([0, 0, 0], [1, 1, 1], 0.9) // => [0.1, 0.1, 0.1]
 */
function paintOver(fill: Srgb, surface: Srgb, fillOpacity: number): Srgb {
  return [
    fillOpacity * fill[0] + (1 - fillOpacity) * surface[0],
    fillOpacity * fill[1] + (1 - fillOpacity) * surface[1],
    fillOpacity * fill[2] + (1 - fillOpacity) * surface[2],
  ]
}

/**
 * Writes a color as `#rrggbb`.
 *
 * @param color - The color as gamma-encoded sRGB.
 * @returns The hex notation, lower case.
 * @example
 * toHexColor([1, 1, 1]) // => '#ffffff'
 */
function toHexColor(color: Srgb): string {
  const hexChannels = color.map((channel) =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, '0'),
  )
  return `#${hexChannels.join('')}`
}
