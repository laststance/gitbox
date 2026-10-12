/**
 * Unit Tests: how components paint with the destructive color
 *
 * destructive-color-contrast.test.ts proves that the color tokens can be read
 * in every theme, for the ways the app paints with them: a solid fill under
 * `text-destructive-foreground`, that fill at 90% on hover, and red text on a
 * 5% or 10% tint of itself. That proof holds only while the components paint
 * in those ways. These tests read the class names of every component and
 * page and fail for one that paints differently: a white label on a
 * destructive fill, another hover opacity, or a red menu item on the default
 * highlight (`focus:bg-accent`, about 2:1 in the dark themes).
 *
 * @see src/tests/unit/styles/destructive-color-contrast.test.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, test } from 'vitest'

/** One quoted string of a source file that names the destructive color. */
interface DestructiveClassString {
  /** Path from the repository root and line, e.g. `src/components/ui/button.tsx:15`. */
  location: string
  /** The class names inside the quotes. */
  classNames: string
}

/** Directories whose `.tsx` files render the app. */
const RENDERING_DIRECTORIES = ['src/app', 'src/components']

/** A quoted string on one line; class names never span lines here. */
const QUOTED_STRING_PATTERN = /(["'`])((?:(?!\1).)*)\1/g

/** `bg-destructive` as a solid fill, at rest: no variant before it, no opacity after it. */
const SOLID_FILL_PATTERN = /(?<![\w:/-])bg-destructive(?![\w/-])/

/** `bg-destructive/NN` with whatever variant stands before it. */
const TRANSLUCENT_FILL_PATTERN =
  /(?<![\w/-])((?:[\w-]+:)*)bg-destructive\/(\d+)/g

/**
 * Lists the `.tsx` files below a directory, tests left out.
 * @param directory - Directory to walk, absolute.
 * @returns Absolute paths of the files.
 */
function listComponentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return listComponentFiles(entryPath)
    const isComponentFile =
      entry.name.endsWith('.tsx') && !entry.name.includes('.test.')
    return isComponentFile ? [entryPath] : []
  })
}

/**
 * Reads every quoted string that names the destructive color out of the
 * components and pages.
 * @returns The strings with where they stand.
 */
function readDestructiveClassStrings(): DestructiveClassString[] {
  const repositoryRoot = process.cwd()
  return RENDERING_DIRECTORIES.flatMap((directory) =>
    listComponentFiles(join(repositoryRoot, directory)),
  ).flatMap((filePath) =>
    readFileSync(filePath, 'utf8')
      .split('\n')
      .flatMap((line, lineIndex) =>
        [...line.matchAll(QUOTED_STRING_PATTERN)]
          .map((quoted) => quoted[2] ?? '')
          .filter((classNames) => classNames.includes('destructive'))
          .map((classNames) => ({
            location: `${relative(repositoryRoot, filePath)}:${lineIndex + 1}`,
            classNames,
          })),
      ),
  )
}

const DESTRUCTIVE_CLASS_STRINGS = readDestructiveClassStrings()

describe('how components paint with the destructive color', () => {
  test('reads the class names of the button, the badge and the card menu', () => {
    // Arrange: three places known to paint with the color
    const knownFiles = [
      'src/components/ui/button.tsx',
      'src/components/ui/badge.tsx',
      'src/components/Board/OverflowMenu.tsx',
    ]

    // Act
    const filesFound = knownFiles.filter((knownFile) =>
      DESTRUCTIVE_CLASS_STRINGS.some(({ location }) =>
        location.startsWith(`${knownFile}:`),
      ),
    )

    // Assert: a scan that finds nothing would pass every test below
    expect(filesFound).toEqual([
      'src/components/ui/button.tsx',
      'src/components/ui/badge.tsx',
      'src/components/Board/OverflowMenu.tsx',
    ])
  })

  test('every destructive fill carries the label color made for it, never white', () => {
    // Arrange
    const fills = DESTRUCTIVE_CLASS_STRINGS.filter(({ classNames }) =>
      SOLID_FILL_PATTERN.test(classNames),
    )

    // Act
    const fillsWithAnotherLabel = fills
      .filter(
        ({ classNames }) =>
          !classNames.includes('text-destructive-foreground') ||
          classNames.includes('text-white'),
      )
      .map(({ location }) => location)

    // Assert
    expect(fillsWithAnotherLabel).toEqual([])
  })

  test('a destructive fill is hovered at 90%, the opacity the contrast test computes', () => {
    // Arrange
    const hoverFills = DESTRUCTIVE_CLASS_STRINGS.flatMap(
      ({ location, classNames }) =>
        [...classNames.matchAll(TRANSLUCENT_FILL_PATTERN)]
          .filter((fill) => (fill[1] ?? '').includes('hover:'))
          .map((fill) => ({ location, opacity: fill[2] })),
    )

    // Act
    const hoverFillsAtAnotherOpacity = hoverFills
      .filter(({ opacity }) => opacity !== '90')
      .map(({ location, opacity }) => `${location} (/${opacity})`)

    // Assert
    expect(hoverFillsAtAnotherOpacity).toEqual([])
  })

  test('red text sits on a 5% or 10% tint of its own color, the tints the contrast test computes', () => {
    // Arrange: every translucent destructive background that is not the
    // hover of a fill
    const tints = DESTRUCTIVE_CLASS_STRINGS.flatMap(
      ({ location, classNames }) =>
        [...classNames.matchAll(TRANSLUCENT_FILL_PATTERN)]
          .filter((fill) => !(fill[1] ?? '').includes('hover:'))
          .map((fill) => ({ location, opacity: fill[2] })),
    )

    // Act
    const tintsAtAnotherOpacity = tints
      .filter(({ opacity }) => opacity !== '5' && opacity !== '10')
      .map(({ location, opacity }) => `${location} (/${opacity})`)

    // Assert
    expect(tintsAtAnotherOpacity).toEqual([])
  })

  test('a red menu item is highlighted with its own tint, not with the accent color', () => {
    // Arrange: menu items keep their red while the keyboard or the pointer is on them
    const redMenuItems = DESTRUCTIVE_CLASS_STRINGS.filter(({ classNames }) =>
      classNames.includes('focus:text-destructive'),
    )

    // Act
    const itemsOnTheDefaultHighlight = redMenuItems
      .filter(
        ({ classNames }) => !classNames.includes('focus:bg-destructive/10'),
      )
      .map(({ location }) => location)

    // Assert: red on `focus:bg-accent` reads about 2:1 in the dark themes
    expect(itemsOnTheDefaultHighlight).toEqual([])
    // "Remove from Board" is one of them, so the list above was not empty
    expect(
      redMenuItems.some(({ location }) =>
        location.startsWith('src/components/Board/OverflowMenu.tsx:'),
      ),
    ).toBe(true)
  })
})
