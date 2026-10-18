/**
 * Source lock: the warning and favorite call sites no longer name Tailwind
 * orange or amber utilities. Comment colors and the landing mock keep those
 * families on purpose and are not in this list.
 *
 * @see src/lib/constants/character-counter.ts
 * @see src/components/Boards/BoardCard.tsx
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

const PRODUCT_FILES = [
  'src/lib/constants/character-counter.ts',
  'src/components/Boards/BoardCard.tsx',
  'src/app/boards/favorites/page.tsx',
  'src/app/boards/new/CreateBoardForm.tsx',
  'src/components/Modals/CreateDestinationBoardForm.tsx',
  'src/components/Modals/MoveToAnotherBoardDialog.tsx',
  'src/components/Board/MoveHereDialog.tsx',
] as const

/** A Tailwind color utility: `text-orange-800`, `bg-amber-100/30`. */
const ORANGE_OR_AMBER_UTILITY =
  /(?<![\w-])(?:text|bg|fill|border|hover:text|hover:bg|dark:text|dark:bg|dark:fill|dark:hover:text)-?(?:orange|amber)-/

describe('warning and favorite call sites', () => {
  test.each(PRODUCT_FILES)(
    'does not name an orange or amber utility: %s',
    (relativePath) => {
      // Arrange
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8')

      // Act
      const utilities = source.match(
        /(?:text|bg|fill|border)(?:-\[[^\]]+\]|-[a-z0-9./:%]+)+/g,
      )
      const orangeOrAmber = (utilities ?? []).filter((name) =>
        ORANGE_OR_AMBER_UTILITY.test(name),
      )

      // Assert
      expect(orangeOrAmber).toEqual([])
    },
  )
})
