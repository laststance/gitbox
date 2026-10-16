/**
 * Unit Tests: mergeRestoredComments
 *
 * A comment restored when a card is added must not hide the comment the
 * server sends the next time the board is loaded.
 *
 * @see src/lib/utils/merge-restored-comments.ts
 */

import { describe, expect, test } from 'vitest'

import { mergeRestoredComments } from '@/lib/utils/merge-restored-comments'

describe('mergeRestoredComments', () => {
  // Value: protects=the comment loaded with the board wins over the one remembered when the card was added; fails_when=a restored comment stays on screen after the server has a newer one, or a card added on this page loses the comment the server has not sent yet; why_new=the page spread the restored map last; seam=none; no_claim=when the board page loads again
  test('lets the server comment win and keeps a comment the server has not sent', () => {
    // Arrange
    const serverComments = {
      'card-1': { comment: 'from the server', color: 'blue' as const },
    }
    const restoredComments = {
      'card-1': { comment: 'from the add', color: 'primary' as const },
      'card-2': {
        comment: 'kept until the next load',
        color: 'green' as const,
      },
    }

    // Act
    const comments = mergeRestoredComments(serverComments, restoredComments)

    // Assert
    expect(comments).toEqual({
      'card-1': { comment: 'from the server', color: 'blue' },
      'card-2': { comment: 'kept until the next load', color: 'green' },
    })
  })
})
