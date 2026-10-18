/**
 * Unit Tests: contrast of the theme-colored text token in every theme
 *
 * `--link` is the color of `text-link` (`LINK_TEXT_CLASS`): the login
 * Terms and Privacy links, a note's URL, a board name under the pointer,
 * the labels of the two drop zones while a card is over them, and the
 * Move icon. It is not a fill. Comment Save sits on a comment tint, so
 * it is `text-foreground` and is not checked here.
 *
 * These tests read `--link` and the surfaces it is painted on from
 * src/styles/globals.css and src/styles/themes.css, and compute the WCAG
 * contrast of:
 * - the color as text on `--background`, `--card`, `--popover`, `--muted`
 * - the color on the 10% and 20% primary tint over the page background
 *
 * They also pin System light `--muted-foreground` on `--muted` and
 * `--accent` at 4.5:1. Named themes and `.dark` keep the values they had.
 *
 * @see src/lib/constants/link-text.ts
 * @see src/styles/themes.css
 * @see src/styles/globals.css
 */

import { describe, expect, test } from 'vitest'

import { LINK_TEXT_CLASS } from '@/lib/constants/link-text'

import {
  AA_TEXT_CONTRAST,
  contrastRatio,
  paintOver,
  readThemeColor,
  type Srgb,
  THEME_SELECTORS,
} from './theme-color-math'

/** `bg-primary/10` and `bg-primary/20` under drop-zone labels. */
const PRIMARY_TINT_OPACITIES = [0.1, 0.2] as const

/** Colors of one theme that `--link` meets. */
interface LinkColors {
  /** `--link`: theme-colored text on a surface. */
  link: Srgb
  /** `--primary`: the fill mixed into the 10% / 20% tint. */
  primary: Srgb
  /** `--background`: the page, and the surface under a primary tint. */
  background: Srgb
  /** `--background`, `--card`, `--popover`, `--muted`. */
  surfaces: Srgb[]
}

describe('the link text class', () => {
  test('is the Tailwind utility for --link', () => {
    // Assert
    expect(LINK_TEXT_CLASS).toBe('text-link')
  })
})

describe('the link color', () => {
  test.each(THEME_SELECTORS)(
    'theme-colored text can be read on the page, a card, a menu and muted: %s',
    (themeSelector) => {
      // Arrange
      const { link, surfaces } = readLinkColors(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...surfaces.map((surface) => contrastRatio(link, surface)),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'theme-colored text can be read on the 10% and 20% primary tint: %s',
    (themeSelector) => {
      // Arrange
      const { link, primary, background } = readLinkColors(themeSelector)

      // Act
      const lowestContrast = Math.min(
        ...PRIMARY_TINT_OPACITIES.map((tintOpacity) =>
          contrastRatio(link, paintOver(primary, background, tintOpacity)),
        ),
      )

      // Assert
      expect(lowestContrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})

describe('System light muted text', () => {
  test('can be read on muted and on accent', () => {
    // Arrange
    const mutedForeground = readThemeColor(':root', 'muted-foreground')
    const muted = readThemeColor(':root', 'muted')
    const accent = readThemeColor(':root', 'accent')

    // Act
    const contrastOnMuted = contrastRatio(mutedForeground, muted)
    const contrastOnAccent = contrastRatio(mutedForeground, accent)

    // Assert
    expect(contrastOnMuted).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    expect(contrastOnAccent).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
  })
})

/**
 * Reads the colors `--link` meets from one block of theme tokens.
 *
 * @param themeSelector - Selector of the block, as written in the CSS.
 * @returns The {@link LinkColors} of that theme.
 */
function readLinkColors(themeSelector: string): LinkColors {
  return {
    link: readThemeColor(themeSelector, 'link'),
    primary: readThemeColor(themeSelector, 'primary'),
    background: readThemeColor(themeSelector, 'background'),
    surfaces: [
      readThemeColor(themeSelector, 'background'),
      readThemeColor(themeSelector, 'card'),
      readThemeColor(themeSelector, 'popover'),
      readThemeColor(themeSelector, 'muted'),
    ],
  }
}
