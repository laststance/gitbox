/**
 * Unit tests: the refresh actions are signed-in, rate-limited writes.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  refreshBoardMetadata,
  refreshCardMetadata,
} from '@/lib/actions/refresh-metadata'
import {
  refreshBoardMetadataCore,
  refreshCardMetadataCore,
} from '@/lib/actions/refresh-metadata-core'
import { ActionUserError } from '@/lib/actions/types'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { checkRateLimit } from '@/lib/rate-limit/check'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/auth/get-cached-claims', () => ({
  getCachedClaims: vi.fn(async () => ({
    supabase: {},
    claims: { sub: '00000000-0000-0000-0000-000000000001' },
  })),
}))

vi.mock('@/lib/rate-limit/check', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}))

vi.mock('@/lib/actions/refresh-metadata-core', () => ({
  refreshCardMetadataCore: vi.fn(),
  refreshBoardMetadataCore: vi.fn(),
}))

const CARD_ID = '00000000-0000-0000-0000-0000000000c1'
const BOARD_ID = '00000000-0000-0000-0000-0000000000b1'

describe('refresh metadata actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    vi.mocked(getCachedClaims).mockResolvedValue({
      supabase: {},
      claims: { sub: '00000000-0000-0000-0000-000000000001' },
    } as never)
  })

  // Value: protects=a signed-out refresh does not ask GitHub; fails_when=the core runs without a user and writes a card; why_new=the actions are new endpoints; seam=none; no_claim=the session cookie itself
  test('asks a signed-out caller to sign in before refreshing a card', async () => {
    // Arrange
    vi.mocked(getCachedClaims).mockResolvedValue(null)

    // Act
    const result = await refreshCardMetadata(CARD_ID)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
    })
    expect(refreshCardMetadataCore).not.toHaveBeenCalled()
  })

  // Value: protects=the refresh shares its own limit, so a script cannot walk every card as fast as the note limit allows; fails_when=the action uses another key or no key; why_new=the key; seam=none; no_claim=the window size
  test('counts a card refresh against the repository refresh limit', async () => {
    // Arrange
    vi.mocked(refreshCardMetadataCore).mockResolvedValue({
      id: CARD_ID,
      description: 'Boards for repositories',
      meta: { githubId: 42, stars: 7 },
    })

    // Act
    const result = await refreshCardMetadata(CARD_ID)

    // Assert
    expect(checkRateLimit).toHaveBeenCalledWith(
      'refreshRepoMetadata',
      '00000000-0000-0000-0000-000000000001',
    )
    expect(result).toEqual({
      success: true,
      data: {
        id: CARD_ID,
        description: 'Boards for repositories',
        meta: { githubId: 42, stars: 7 },
      },
    })
  })

  // Value: protects=a name that belongs to another repository is explained, not replaced with the generic error; fails_when=the guard hides the sentence and the user retries a write that will keep refusing; why_new=the core throws that sentence; seam=none; no_claim=the menu
  test('keeps the sentence when a card name belongs to a different repository', async () => {
    // Arrange
    vi.mocked(refreshCardMetadataCore).mockRejectedValue(
      new ActionUserError(
        'This name now belongs to a different repository, so the card was left as it is.',
      ),
    )

    // Act
    const result = await refreshCardMetadata(CARD_ID)

    // Assert
    expect(result).toEqual({
      success: false,
      error:
        'This name now belongs to a different repository, so the card was left as it is.',
    })
  })

  // Value: protects=a board id that is not a uuid never reaches the database; fails_when=the core is called with the raw string; why_new=the browser chooses the argument; seam=none; no_claim=the database error
  test('does not refresh a board whose id is not a uuid', async () => {
    // Arrange
    const boardId = 'not-a-board'

    // Act
    const result = await refreshBoardMetadata(boardId)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(refreshBoardMetadataCore).not.toHaveBeenCalled()
  })

  // Value: protects=a burst of board refreshes is refused with the repository refresh sentence; fails_when=the tenth refresh in a minute still asks GitHub; why_new=the limit; seam=none; no_claim=the limiter's clock
  test('refuses a board refresh once the repository refresh limit is spent', async () => {
    // Arrange
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      error: 'Too many repository refresh requests. Please try again later.',
    })

    // Act
    const result = await refreshBoardMetadata(BOARD_ID)

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Too many repository refresh requests. Please try again later.',
    })
    expect(refreshBoardMetadataCore).not.toHaveBeenCalled()
  })
})
