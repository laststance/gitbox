/**
 * Color math and theme token reading shared by the contrast tests.
 *
 * A browser paints a translucent fill over a surface and a person reads the
 * text on it; a unit test cannot look at pixels, so these functions compute
 * what is on the screen from the colors written in the CSS. The first tests
 * of destructive-color-contrast.test.ts pin the math with colors whose
 * values are known.
 *
 * @see src/tests/unit/styles/destructive-color-contrast.test.ts
 * @see src/tests/unit/styles/comment-counter-contrast.test.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  DARK_THEME_IDS,
  LIGHT_THEME_IDS,
  type ThemeId,
} from '@/lib/constants/themes'

/** An OKLCH color as CSS writes it: lightness 0 to 1, chroma, hue in degrees. */
export type Oklch = readonly [
  lightness: number,
  chroma: number,
  hueDegrees: number,
]

/**
 * A color as gamma-encoded sRGB channels from 0 to 1, the space a browser
 * composites a translucent fill in.
 */
export type Srgb = readonly [red: number, green: number, blue: number]

/** What WCAG 2.1 AA asks of text below 18.66px bold or 24px. */
export const AA_TEXT_CONTRAST = 4.5

/** What WCAG 2.1 AA asks of an icon that is the only sign of a control. */
export const AA_ICON_CONTRAST = 3

/**
 * Selector of the block that holds the tokens of a named theme.
 * @param themeId - Id of the theme.
 * @returns The selector as themes.css writes it.
 * @example
 * toThemeSelector('rust') // => "html[data-theme='rust']"
 */
const toThemeSelector = (themeId: ThemeId): string =>
  `html[data-theme='${themeId}']`

/**
 * Blocks of theme tokens that set the `.dark` class on the page: the system
 * default for a dark screen and the dark themes. A `dark:` class applies in
 * these and in no other. Built from the app's list of themes, so a theme
 * that is added there is checked by every contrast test.
 */
export const DARK_THEME_SELECTORS = [
  '.dark',
  ...DARK_THEME_IDS.map(toThemeSelector),
]

/**
 * Every block of theme tokens: the two system defaults of globals.css (no
 * `data-theme`) and the named themes of themes.css, from the app's list.
 */
export const THEME_SELECTORS = [
  ':root',
  ...LIGHT_THEME_IDS.map(toThemeSelector),
  ...DARK_THEME_SELECTORS,
]

/** Text of the two CSS files that hold the theme tokens. */
const THEME_STYLES = ['src/styles/globals.css', 'src/styles/themes.css']
  .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
  .join('\n')

/** Text of the file in which the installed Tailwind defines its palette. */
const TAILWIND_PALETTE = readFileSync(
  join(process.cwd(), 'node_modules/tailwindcss/theme.css'),
  'utf8',
)

/**
 * Reads one color token from one block of theme tokens.
 *
 * @param themeSelector - Selector of the block, as written in the CSS (one
 * of {@link THEME_SELECTORS}).
 * @param tokenName - Name of the custom property without the two dashes,
 * for example `card`.
 * @returns The color of that token in that theme.
 * @throws When the block or the token is missing, or the token is not an
 * opaque `oklch(L C H)`: the math below does not cover another notation.
 * @example
 * readThemeColor(':root', 'background') // => [1, 1, 1] (white)
 */
export function readThemeColor(themeSelector: string, tokenName: string): Srgb {
  // At the start of a line: the block that defines the tokens. The media
  // query for more contrast names the same selectors, indented.
  const blockStart = THEME_STYLES.indexOf(`\n${themeSelector} {`)
  if (blockStart === -1) {
    throw new Error(`No block of theme tokens for ${themeSelector}`)
  }
  const block = THEME_STYLES.slice(
    blockStart,
    THEME_STYLES.indexOf('}', blockStart),
  )

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

/**
 * Reads one color of the Tailwind palette from the installed package, so a
 * test follows the palette the build uses.
 *
 * @param colorName - Family and step as a class names them, for example
 * `orange-800` for `text-orange-800`.
 * @returns The color.
 * @throws When the palette has no such color written as `oklch(L% C H)`.
 * @example
 * toHexColor(readTailwindColor('red-600')) // => '#e7000b'
 */
export function readTailwindColor(colorName: string): Srgb {
  const channels = new RegExp(
    `--color-${colorName}:\\s*oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\);`,
  ).exec(TAILWIND_PALETTE)
  if (!channels) {
    throw new Error(
      `The Tailwind palette has no --color-${colorName} written as oklch(L% C H)`,
    )
  }
  return oklchToSrgb([
    Number(channels[1]) / 100,
    Number(channels[2]),
    Number(channels[3]),
  ])
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
export function oklchToSrgb([lightness, chroma, hueDegrees]: Oklch): Srgb {
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
 * Contrast ratio of two colors as WCAG 2.1 defines it.
 *
 * @param first - One color.
 * @param second - The other; the order does not matter.
 * @returns 1 for two equal colors up to 21 for black and white.
 * @example
 * contrastRatio([0, 0, 0], [1, 1, 1]) // => 21
 */
export function contrastRatio(first: Srgb, second: Srgb): number {
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
export function paintOver(
  fill: Srgb,
  surface: Srgb,
  fillOpacity: number,
): Srgb {
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
export function toHexColor(color: Srgb): string {
  const hexChannels = color.map((channel) =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, '0'),
  )
  return `#${hexChannels.join('')}`
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
