/**
 * Unit Tests: busy and option labels use the ellipsis character
 *
 * FINDING-017 asked for `…` (U+2026) instead of three ASCII dots on every
 * in-progress label and on the two option labels that open a form. A missed
 * string looks like the old copy. This file fails when one of those labels
 * returns to ASCII dots, or when a listed label disappears from product
 * source.
 *
 * @see src/app/account/AccountClient.tsx
 * @see src/components/Board/AddRepositoryCombobox.tsx
 * @see src/components/Modals/MoveToAnotherBoardDialog.tsx
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, test } from 'vitest'

/** Three ASCII dots. Built in parts so this file never contains a locked label. */
const ASCII_DOTS = `.${'.'.repeat(2)}`

/** U+2026, the character the labels must end with. */
const ELLIPSIS = '\u2026'

/**
 * Busy labels and the two option labels that open a form.
 *
 * The source lock looks for these stems plus {@link ASCII_DOTS} or
 * {@link ELLIPSIS}. Placeholders (`Search repositories...`) are not here.
 */
const LABEL_STEMS = [
  'Signing out',
  'Creating',
  'Saving',
  'Moving',
  'Deleting',
  'Renaming',
  'Loading boards',
  'Loading repositories',
  'Adding repositories',
  'Checking where repositories are placed',
  'New Board',
  'Add custom type',
] as const

/** Directories whose `.ts` / `.tsx` files render or announce these labels. */
const PRODUCT_DIRECTORIES = ['src/app', 'src/components', 'src/hooks']

/**
 * Lists product source files under a directory, tests left out.
 *
 * @param directory - Directory to walk, absolute.
 * @returns Absolute paths of the files.
 */
function listProductFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return listProductFiles(entryPath)
    const isProductFile =
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.')
    return isProductFile ? [entryPath] : []
  })
}

/**
 * Reads every product file that can show a busy or option label.
 *
 * @returns Path-from-root and file text.
 */
function readProductSources(): { location: string; source: string }[] {
  const repositoryRoot = process.cwd()
  return PRODUCT_DIRECTORIES.flatMap((directory) =>
    listProductFiles(join(repositoryRoot, directory)),
  ).map((filePath) => ({
    location: relative(repositoryRoot, filePath),
    source: readFileSync(filePath, 'utf8'),
  }))
}

const PRODUCT_SOURCES = readProductSources()

describe('busy and option labels use the ellipsis character', () => {
  test('keeps every locked busy and option label on … and drops the ASCII dots', () => {
    // Arrange
    const asciiHits: string[] = []
    const missingEllipsis: string[] = []

    // Act
    for (const stem of LABEL_STEMS) {
      const asciiLabel = `${stem}${ASCII_DOTS}`
      const ellipsisLabel = `${stem}${ELLIPSIS}`
      const asciiLocations = PRODUCT_SOURCES.filter(({ source }) =>
        source.includes(asciiLabel),
      ).map(({ location }) => location)
      const hasEllipsis = PRODUCT_SOURCES.some(({ source }) =>
        source.includes(ellipsisLabel),
      )
      if (asciiLocations.length > 0) {
        asciiHits.push(`${asciiLabel} in ${asciiLocations.join(', ')}`)
      }
      if (!hasEllipsis) {
        missingEllipsis.push(ellipsisLabel)
      }
    }

    // Assert
    expect(asciiHits).toEqual([])
    expect(missingEllipsis).toEqual([])
  })
})
