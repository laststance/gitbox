/**
 * Source lock: product files no longer use `transition-all`.
 *
 * That class tweens every property, including width and layout. The leftover
 * from the 2026-10-12 review named the properties that actually change.
 *
 * @see src/components/Sidebar/Sidebar.tsx
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, test } from 'vitest'

const ROOT = process.cwd()
const DIRECTORIES = ['src/app', 'src/components']

/** `transition-all` as a Tailwind utility, including variants. */
const TRANSITION_ALL = /(?:^|[\s"'`])(?:[\w-]+:)*transition-all\b/

/**
 * Every product `.ts` / `.tsx` file under a directory.
 *
 * @param directory - Absolute directory to walk.
 * @returns File paths.
 */
function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry)
    if (statSync(entryPath).isDirectory()) {
      return listSourceFiles(entryPath)
    }
    const isSource = /\.tsx?$/.test(entry) && !/\.(test|stories)\./.test(entry)
    return isSource ? [entryPath] : []
  })
}

const PRODUCT_FILES = DIRECTORIES.flatMap((directory) =>
  listSourceFiles(join(ROOT, directory)),
)

describe('transition-all call sites', () => {
  test.each(PRODUCT_FILES.map((file) => relative(ROOT, file)))(
    'does not use transition-all: %s',
    (relativePath) => {
      // Arrange
      const source = readFileSync(join(ROOT, relativePath), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n')

      // Act
      const matches = source.match(new RegExp(TRANSITION_ALL, 'g')) ?? []

      // Assert
      expect(matches).toEqual([])
    },
  )

  test('the sidebar keeps width tweening only below 768px', () => {
    // Arrange
    const source = readFileSync(
      join(ROOT, 'src/components/Sidebar/Sidebar.tsx'),
      'utf8',
    )

    // Act
    const hasWidth = source.includes('transition-[width]')
    const stopsFromMd = source.includes('md:transition-none')

    // Assert
    expect(hasWidth).toBe(true)
    expect(stopsFromMd).toBe(true)
  })
})
