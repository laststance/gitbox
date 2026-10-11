/**
 * Unit Tests: toPublicBoardUrl
 *
 * @see src/lib/utils/to-public-board-url.ts
 */

import { describe, expect, test } from 'vitest'

import { toPublicBoardUrl } from '@/lib/utils/to-public-board-url'

describe('toPublicBoardUrl()', () => {
  test('builds the address of the read-only page anyone can open', () => {
    // Arrange
    const origin = 'https://gitbox-laststance.vercel.app'
    const shareSlug = 'a1b2c3d4e5f6'

    // Act
    const publicBoardUrl = toPublicBoardUrl(origin, shareSlug)

    // Assert
    expect(publicBoardUrl).toBe(
      'https://gitbox-laststance.vercel.app/public/a1b2c3d4e5f6',
    )
  })
})
