import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

import {
  COARSE_HIT_TARGET_AFTER_CLASS,
  COARSE_HIT_TARGET_CLASS,
  ICON_TRIGGER_CLASS,
  ICON_TRIGGER_PAINTED_CLASS,
} from '@/lib/constants/touch-target'

const ROOT = resolve(import.meta.dirname, '../../../../../')

describe('touch-target class strings', () => {
  test('keeps the locked 36px painted floor and 44px coarse overlay', () => {
    // Arrange
    const expectedAfter =
      "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:h-11 pointer-coarse:after:w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']"

    // Act / Assert
    expect(ICON_TRIGGER_PAINTED_CLASS).toBe('size-9 p-0')
    expect(COARSE_HIT_TARGET_AFTER_CLASS).toBe(expectedAfter)
    expect(COARSE_HIT_TARGET_CLASS).toBe(`relative ${expectedAfter}`)
    expect(ICON_TRIGGER_CLASS).toBe(`size-9 p-0 relative ${expectedAfter}`)
  })

  test('lists the shared classes on the locked surfaces and drops the old recipes', () => {
    // Arrange
    const iconTriggerFiles = [
      'src/components/Board/OverflowMenu.tsx',
      'src/components/Board/CommentActionsMenu.tsx',
      'src/components/Board/StatusColumn.tsx',
    ]
    const coarseFiles = [
      'src/components/ui/editable-url-item.tsx',
      'src/components/Board/HeldRepositoryList.tsx',
      'src/components/Modals/MoveToAnotherBoardDialog.tsx',
    ]
    const dialogSource = readFileSync(
      resolve(ROOT, 'src/components/ui/dialog.tsx'),
      'utf8',
    )

    // Act
    const iconSources = iconTriggerFiles.map((file) =>
      readFileSync(resolve(ROOT, file), 'utf8'),
    )
    const coarseSources = coarseFiles.map((file) =>
      readFileSync(resolve(ROOT, file), 'utf8'),
    )
    const listedSources = [...iconSources, ...coarseSources, dialogSource]

    // Assert
    for (const source of iconSources) {
      expect(source).toContain("from '@/lib/constants/touch-target'")
      expect(source).toContain('ICON_TRIGGER_CLASS')
    }
    for (const source of coarseSources) {
      expect(source).toContain('COARSE_HIT_TARGET_CLASS')
    }
    expect(dialogSource).toContain('COARSE_HIT_TARGET_AFTER_CLASS')
    expect(
      dialogSource.replaceAll('COARSE_HIT_TARGET_AFTER_CLASS', ''),
    ).not.toContain('COARSE_HIT_TARGET_CLASS')
    expect(dialogSource).toContain('top-2')
    expect(dialogSource).toContain('right-2')
    expect(dialogSource).not.toContain('top-0.5')
    for (const source of listedSources) {
      expect(source).not.toContain('pointer-coarse:min-h-11')
      expect(source).not.toContain('pointer-coarse:size-11')
      expect(source).not.toContain('after:-inset-[9px]')
    }
    const heldSource = coarseSources[1]
    expect(heldSource).toContain('min-h-11')
  })
})
