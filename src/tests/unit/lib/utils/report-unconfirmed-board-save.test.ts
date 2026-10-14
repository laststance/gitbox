/**
 * Unit Tests: the notice of a board save that got no answer in time
 *
 * A save that never answers keeps the fetch of the board waiting too:
 * Next.js sends Server Actions and `router.refresh()` one after another. So
 * the notice has to offer a way that waits for nothing. The call sites are
 * covered in useBoardRollback.test.tsx; this file presses the button.
 *
 * @see src/lib/utils/report-unconfirmed-board-save.ts
 */

import * as Sentry from '@sentry/nextjs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { reloadPage } from '@/lib/utils/reload-page'
import { reportUnconfirmedBoardSave } from '@/lib/utils/report-unconfirmed-board-save'

/** Stands in for `toast.warning`, typed with what the notice sends. */
const { showWarningToast } = vi.hoisted(() => ({
  showWarningToast: vi.fn<
    (
      message: string,
      options: {
        id: string
        description: string
        duration: number
        action: { label: string; onClick: () => void }
      },
    ) => void
  >(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { warning: showWarningToast },
}))

// A reload would end the test page; the test checks that it was asked for
vi.mock('@/lib/utils/reload-page', () => ({
  reloadPage: vi.fn(),
}))

describe('reportUnconfirmedBoardSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('"Reload page" on the notice reloads the page, the way to the saved board that waits for no request', () => {
    // Arrange
    reportUnconfirmedBoardSave('syncCardPosition')
    const [, shownOptions] = showWarningToast.mock.calls[0] ?? []

    // Act
    shownOptions?.action.onClick()

    // Assert
    expect(shownOptions?.action.label).toBe('Reload page')
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  test('leaves a trace that names the save, so a server that stopped answering shows up', () => {
    // Arrange
    // Act
    reportUnconfirmedBoardSave('undoCardPositions')

    // Assert
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'A board save got no answer in time',
      { level: 'warning', tags: { action: 'undoCardPositions' } },
    )
  })

  test('shows one notice for a burst of saves without an answer', () => {
    // Arrange
    // Act
    reportUnconfirmedBoardSave('syncCardOrder')
    reportUnconfirmedBoardSave('syncCardPosition')

    // Assert: both carry the same id, which Sonner shows as one toast
    expect(
      showWarningToast.mock.calls.map(([, options]) => options.id),
    ).toEqual(['board-save-unconfirmed', 'board-save-unconfirmed'])
  })
})
