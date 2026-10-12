/**
 * Unit Tests: board presets
 *
 * The columns of a preset go to the `create_board_with_status_lists` database
 * function as they are. The function refuses the whole board when one column
 * has a name outside 1 to 50 characters or a color that is not #RRGGBB, and
 * when the list holds no column or more than 100. A preset that breaks one of
 * those limits would make every board created from it fail with "The board
 * was not created. Try again.", so each preset is checked against them here.
 *
 * @see src/lib/constants/board-presets.ts
 * @see supabase/migrations/20261012085900_create_board_with_status_lists.sql
 */

import { describe, expect, test } from 'vitest'

import { BOARD_PRESETS, PRESET_IDS } from '@/lib/constants/board-presets'
import {
  statusListColorSchema,
  statusListNameSchema,
} from '@/lib/validations/board'

describe('BOARD_PRESETS', () => {
  test.each(PRESET_IDS)(
    'every column of the %s preset has a name and a color the database function accepts',
    (presetId) => {
      // Arrange
      const { columns } = BOARD_PRESETS[presetId]

      // Act
      const refusedColumns = columns.filter(
        (column) =>
          !statusListNameSchema.safeParse(column.name).success ||
          !statusListColorSchema.safeParse(column.color).success,
      )

      // Assert
      expect(refusedColumns).toEqual([])
    },
  )

  test.each(PRESET_IDS)(
    'the %s preset has at least 1 and at most 100 columns',
    (presetId) => {
      // Arrange
      const { columns } = BOARD_PRESETS[presetId]

      // Act
      const columnCount = columns.length

      // Assert
      expect(columnCount).toBeGreaterThanOrEqual(1)
      expect(columnCount).toBeLessThanOrEqual(100)
    },
  )
})
