/**
 * Source lock: the remapped call sites no longer paint body text with
 * `text-primary`. Fills (`bg-primary`), labels on a fill
 * (`text-primary-foreground`), and assertions that a class is not
 * `text-primary` stay as they are. Comment Save is `text-foreground` and
 * is in this list so a later `text-primary` there fails.
 *
 * Line comments and block comments are skipped so a sentence that names
 * the old class does not trip the lock.
 *
 * @see src/lib/constants/link-text.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

const PRODUCT_FILES = [
  'src/app/login/page.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/link-node.tsx',
  'src/components/ui/editable-url-item.tsx',
  'src/components/Board/CommentInlineEdit.tsx',
  'src/components/Board/NewRowDropZone.tsx',
  'src/components/Board/ColumnInsertZone.tsx',
  'src/components/Boards/BoardCard.tsx',
  'src/components/ui/radio-group.tsx',
  'src/components/Modals/MoveToAnotherBoardDialog.tsx',
] as const

/** `text-primary` as a utility, including hover and group-hover. */
const THEME_COLORED_TEXT =
  /(?:^|[\s"'`])(?:hover:|group-hover:|dark:|dark:hover:)*text-primary(?!-foreground)\b/

describe('theme-colored text call sites', () => {
  test.each(PRODUCT_FILES)(
    'does not color body text with text-primary: %s',
    (relativePath) => {
      // Arrange
      const source = stripComments(
        readFileSync(join(process.cwd(), relativePath), 'utf8'),
      )

      // Act
      const matches = source.match(new RegExp(THEME_COLORED_TEXT, 'g')) ?? []

      // Assert
      expect(matches).toEqual([])
    },
  )

  test('the note editor underline uses decoration-link, not decoration-primary', () => {
    // Arrange
    const source = stripComments(
      readFileSync(
        join(process.cwd(), 'src/components/ui/link-node.tsx'),
        'utf8',
      ),
    )

    // Act
    const hasLinkUnderline = source.includes('decoration-link')
    const hasPrimaryUnderline = source.includes('decoration-primary')

    // Assert
    expect(hasLinkUnderline).toBe(true)
    expect(hasPrimaryUnderline).toBe(false)
  })
})

/**
 * Drops block comments and `//` lines so a note that names `text-primary`
 * does not fail the lock.
 *
 * @param source - File text.
 * @returns The same text without those comments.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')
}
