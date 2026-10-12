/**
 * Unit Tests: contrast of the labels in the sidebar
 *
 * The sidebar keeps the neutral colors of the system default it stands on,
 * `:root` or `.dark`: no named theme sets a `--sidebar` token. The theme does
 * change `--primary` and `--muted-foreground`, and both are used on the
 * sidebar:
 * - the page the user is on: `bg-primary/10` under `text-sidebar-foreground`.
 *   The label was `text-primary`, which on that tint was between 2.7:1 and
 *   4.45:1 in 11 of the 14 themes.
 * - the other pages, "Theme" and the name of the current theme:
 *   `text-muted-foreground`. The name was dimmed to 70%, which was between
 *   2.6:1 and 4.0:1 in every theme.
 *
 * Sidebar.test.tsx checks that the elements carry these classes.
 *
 * @see src/components/Sidebar/Sidebar.tsx
 * @see src/components/ThemeToggle/ThemeToggle.tsx
 * @see src/tests/unit/styles/theme-color-math.ts
 */

import { describe, expect, test } from 'vitest'

import {
  AA_TEXT_CONTRAST,
  contrastRatio,
  DARK_THEME_SELECTORS,
  paintOver,
  readThemeColor,
  type Srgb,
  THEME_SELECTORS,
} from './theme-color-math'

/** The two blocks without a `data-theme`: the system defaults. */
const SYSTEM_DEFAULT_SELECTORS = [':root', '.dark']

/** The blocks of the 14 named themes. */
const NAMED_THEME_SELECTORS = THEME_SELECTORS.filter(
  (themeSelector) => !SYSTEM_DEFAULT_SELECTORS.includes(themeSelector),
)

/** How much of the primary `bg-primary/10` paints over the sidebar. */
const CURRENT_PAGE_TINT_ALPHA = 0.1

/**
 * Reads a token of the sidebar as a page in the given theme shows it: from
 * the system default the theme stands on, because the named themes set none.
 * @param themeSelector - Selector of the theme's block.
 * @param tokenName - `sidebar` or `sidebar-foreground`.
 * @returns The color.
 * @example
 * readSidebarColor("html[data-theme='rust']", 'sidebar') // the --sidebar of .dark
 */
function readSidebarColor(themeSelector: string, tokenName: string): Srgb {
  return readThemeColor(
    DARK_THEME_SELECTORS.includes(themeSelector) ? '.dark' : ':root',
    tokenName,
  )
}

describe('the labels of the sidebar', () => {
  test.each(NAMED_THEME_SELECTORS)(
    'the sidebar has the colors of the system default, not colors of its own: %s',
    (themeSelector) => {
      // Arrange & Act & Assert: readSidebarColor above relies on this. A
      // theme that gets a sidebar of its own has to be read from its block.
      expect(() => readThemeColor(themeSelector, 'sidebar')).toThrow(
        `${themeSelector} has no --sidebar written as oklch(L C H)`,
      )
    },
  )

  test.each(THEME_SELECTORS)(
    'the label of the page the user is on is readable on its tint: %s',
    (themeSelector) => {
      // Arrange: bg-primary/10 over the sidebar, text-sidebar-foreground on it
      const currentPageTint = paintOver(
        readThemeColor(themeSelector, 'primary'),
        readSidebarColor(themeSelector, 'sidebar'),
        CURRENT_PAGE_TINT_ALPHA,
      )
      const label = readSidebarColor(themeSelector, 'sidebar-foreground')

      // Act
      const contrast = contrastRatio(label, currentPageTint)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )

  test.each(THEME_SELECTORS)(
    'the muted labels (the other pages, "Theme", the name of the theme) are readable on the sidebar: %s',
    (themeSelector) => {
      // Arrange: text-muted-foreground, undimmed
      const sidebar = readSidebarColor(themeSelector, 'sidebar')
      const mutedLabel = readThemeColor(themeSelector, 'muted-foreground')

      // Act
      const contrast = contrastRatio(mutedLabel, sidebar)

      // Assert
      expect(contrast).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST)
    },
  )
})
