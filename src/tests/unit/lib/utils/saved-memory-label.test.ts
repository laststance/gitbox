/**
 * Unit Tests: formatSavedMemoryLabel
 *
 * The Add Repositories picker names what a repository on no board brings back
 * when it is added again (issue #216): "Saved: note, 3 links, comment".
 *
 * @see src/lib/utils/saved-memory-label.ts
 */

import { describe, expect, test } from 'vitest'

import { formatSavedMemoryLabel } from '@/lib/utils/saved-memory-label'

describe('formatSavedMemoryLabel', () => {
  // Value: protects=the picker names exactly the saved parts, in the order of the Note dialog, with "link" in the singular for one; fails_when=an empty part is named ("0 links"), the order changes, or "1 links" is shown; why_new=new label; seam=none; no_claim=which rows count as saved (saved-repository-memories.test.ts)
  test.each([
    {
      saved: 'a note, three links and a comment',
      memory: { hasNote: true, linkCount: 3, hasComment: true },
      expected: 'Saved: note, 3 links, comment',
    },
    {
      saved: 'one link only',
      memory: { hasNote: false, linkCount: 1, hasComment: false },
      expected: 'Saved: 1 link',
    },
    {
      saved: 'a note only',
      memory: { hasNote: true, linkCount: 0, hasComment: false },
      expected: 'Saved: note',
    },
    {
      saved: 'a comment and two links',
      memory: { hasNote: false, linkCount: 2, hasComment: true },
      expected: 'Saved: 2 links, comment',
    },
  ])('names $saved as "$expected"', ({ memory, expected }) => {
    // Arrange
    const savedMemory = { identifier: 'laststance/nsx', ...memory }

    // Act
    const label = formatSavedMemoryLabel(savedMemory)

    // Assert
    expect(label).toBe(expected)
  })
})
