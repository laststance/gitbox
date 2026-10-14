/**
 * Unit Tests: describeColumnDeletion
 *
 * The Delete Column confirmation says what cannot be undone, then that the
 * memory of the removed cards' repositories is kept (issue #216).
 *
 * @see src/lib/utils/describe-column-deletion.ts
 */

import { describe, expect, test } from 'vitest'

import { describeColumnDeletion } from '@/lib/utils/describe-column-deletion'

describe('describeColumnDeletion', () => {
  // Value: protects=the Delete Column dialog promises the kept memory in words that fit the number of cards, after saying the deletion cannot be undone (design review of #216); fails_when=an empty column mentions cards, one card is spoken of in the plural, or the order changes; why_new=the copy was built inline in the board page, untested for 0 and 1 card; seam=none; no_claim=that the memory is really kept (repository-memory.spec.ts)
  test.each([
    {
      cards: 'no card',
      cardCount: 0,
      expected:
        'Are you sure you want to delete "Done"? This action cannot be undone.',
    },
    {
      cards: 'one card',
      cardCount: 1,
      expected:
        'Are you sure you want to delete "Done"? This action cannot be undone. This will also remove 1 card in this column. The note, links and comment of its repository are kept for when you add it again.',
    },
    {
      cards: 'two cards',
      cardCount: 2,
      expected:
        'Are you sure you want to delete "Done"? This action cannot be undone. This will also remove 2 cards in this column. The notes, links and comments of their repositories are kept for when you add them again.',
    },
  ])(
    'asks to delete a column with $cards in words that fit',
    ({ cardCount, expected }) => {
      // Arrange
      const columnTitle = 'Done'

      // Act
      const description = describeColumnDeletion(columnTitle, cardCount)

      // Assert
      expect(description).toBe(expected)
    },
  )
})
