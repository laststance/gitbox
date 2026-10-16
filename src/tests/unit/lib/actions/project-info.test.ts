/**
 * Unit Tests: project-info server actions
 *
 * The read is authenticated and unlimited. Each write shares the `projectInfo`
 * rate limit, so a signed-in browser cannot flood rows that outlive their
 * cards. A sentence the core meant for the user still reaches the Note dialog;
 * a database error string does not.
 *
 * @see src/lib/actions/project-info.ts
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  deleteComment,
  getProjectInfo,
  updateComment,
  updateCommentColor,
  upsertProjectInfo,
} from '@/lib/actions/project-info'
import {
  deleteCommentCore,
  getProjectInfoCore,
  updateCommentColorCore,
  updateCommentCore,
  upsertProjectInfoCore,
} from '@/lib/actions/project-info-core'
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

vi.mock('@/lib/actions/project-info-core', () => ({
  getProjectInfoCore: vi.fn(),
  upsertProjectInfoCore: vi.fn(),
  updateCommentCore: vi.fn(),
  updateCommentColorCore: vi.fn(),
  deleteCommentCore: vi.fn(),
}))

describe('project info actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
  })

  // Value: protects=opening a note still shows why it could not be read; fails_when=the guard replaces "Card not found" with the generic message and the dialog no longer says the card is gone; why_new=the read moved onto withAuthResult; seam=none; no_claim=the toast (useNoteModal.test.ts)
  test('a missing card is still explained when the note is opened', async () => {
    // Arrange
    vi.mocked(getProjectInfoCore).mockRejectedValue(
      new ActionUserError('Card not found'),
    )

    // Act
    const result = await getProjectInfo('card-1')

    // Assert
    expect(result).toEqual({ success: false, error: 'Card not found' })
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  // Value: protects=a database error string from reading a note never reaches the browser; fails_when=the action returns error.message again; why_new=the read's own catch used to forward every message; seam=none; no_claim=the toast title (useNoteModal.ts)
  test('a failed note read hides the database error', async () => {
    // Arrange
    const databaseError = new Error('relation "projectinfo" does not exist')
    vi.mocked(getProjectInfoCore).mockRejectedValue(databaseError)

    // Act
    const result = await getProjectInfo('card-1')

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: { context: 'withAuthResult' },
    })
  })

  // Value: protects=a caller over the project-info limit is refused before a note, comment, color or deletion is written; fails_when=a write runs with no limit, or shares a limit with board edits; why_new=these writes had no rate limit; seam=none; no_claim=the sliding window itself (check.ts)
  test.each([
    {
      write: 'saving a note',
      run: async () =>
        upsertProjectInfo('card-1', { note: 'a note', links: [] }),
      core: upsertProjectInfoCore,
    },
    {
      write: 'saving a comment',
      run: async () => updateComment('card-1', 'a comment'),
      core: updateCommentCore,
    },
    {
      write: 'changing a comment color',
      run: async () => updateCommentColor('card-1', 'blue'),
      core: updateCommentColorCore,
    },
    {
      write: 'deleting a comment',
      run: async () => deleteComment('card-1'),
      core: deleteCommentCore,
    },
  ])(
    '$write does not run once the project info limit is reached',
    async ({ run, core }) => {
      // Arrange
      vi.mocked(checkRateLimit).mockReturnValue({
        allowed: false,
        error: 'Too many project info requests. Please try again later.',
      })

      // Act
      const result = await run()

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Too many project info requests. Please try again later.',
      })
      expect(core).not.toHaveBeenCalled()
      expect(checkRateLimit).toHaveBeenCalledWith(
        'projectInfo',
        '00000000-0000-0000-0000-000000000001',
      )
    },
  )

  // Value: protects=a signed-out caller cannot save a note; fails_when=the write skips the auth guard; why_new=the writes moved onto withAuthResultRateLimit; seam=none; no_claim=the session check itself (auth-guard.test.ts)
  test('a signed-out caller cannot save a note', async () => {
    // Arrange
    vi.mocked(getCachedClaims).mockResolvedValueOnce(null)

    // Act
    const result = await upsertProjectInfo('card-1', {
      note: 'a note',
      links: [],
    })

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
    })
    expect(upsertProjectInfoCore).not.toHaveBeenCalled()
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  // Value: protects=the Note dialog still shows a validation sentence, and a database error string from a save stays off the page; fails_when=every failure becomes generic, or error.message is forwarded again; why_new=the save's own catch used to return every thrown message; seam=none; no_claim=the toast keeping the draft (useNoteModalDraft.test.tsx)
  test('a refused note save explains a validation failure and hides a database error', async () => {
    // Arrange
    vi.mocked(upsertProjectInfoCore).mockRejectedValueOnce(
      new ActionUserError('Note must be 20000 characters or less'),
    )

    // Act
    const explained = await upsertProjectInfo('card-1', {
      note: 'x',
      links: [],
    })

    // Assert
    expect(explained).toEqual({
      success: false,
      error: 'Note must be 20000 characters or less',
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()

    const databaseError = new Error(
      'duplicate key value violates unique constraint',
    )
    vi.mocked(upsertProjectInfoCore).mockRejectedValueOnce(databaseError)
    const hidden = await upsertProjectInfo('card-1', { note: 'x', links: [] })
    expect(hidden).toEqual({
      success: false,
      error: 'An unexpected error occurred',
    })
    expect(Sentry.captureException).toHaveBeenCalledWith(databaseError, {
      extra: { context: 'withAuthResultRateLimit:projectInfo' },
    })
  })
})
