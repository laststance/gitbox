/**
 * Unit Tests: CreateBoardForm
 *
 * The form of `/boards/new`. `createBoard` has two failures that ask for
 * opposite things: "not created" (try again) and "could not confirm" (look at
 * your boards first, because a second try could make a second board). These
 * tests pin that the form words each one as what it is, that it sends nothing
 * more after the second one, and what a keyboard and a screen reader get in
 * each case.
 *
 * @see src/app/boards/new/CreateBoardForm.tsx
 */

import * as Sentry from '@sentry/nextjs'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { CreateBoardForm } from '@/app/boards/new/CreateBoardForm'
import { createBoard } from '@/lib/actions/board'

/**
 * `pushRoute`: where the form navigates to after a creation.
 * `showErrorToast` and `showSuccessToast`: stand in for the toasts.
 */
const { pushRoute, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  pushRoute: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushRoute, back: vi.fn() }),
  // The real check is `instanceof`. Tests build the error by its name.
  unstable_isUnrecognizedActionError: (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'UnrecognizedActionError',
}))

vi.mock('@/lib/actions/board', () => ({
  createBoard: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: showErrorToast, success: showSuccessToast },
}))

describe('CreateBoardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // One test switches to fake timers to let 15 seconds pass
    vi.useRealTimers()
  })

  test('opens the new board when the server created it', async () => {
    // Arrange
    const user = userEvent.setup()
    vi.mocked(createBoard).mockResolvedValue({
      success: true,
      data: {
        id: 'board-7',
        name: 'Side Projects',
        statusLists: [],
      },
    })
    render(<CreateBoardForm />)

    // Act
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects')
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Assert
    expect(createBoard).toHaveBeenCalledWith('Side Projects', 'web-app')
    expect(showSuccessToast).toHaveBeenCalledWith('Board created', {
      description: '"Side Projects" has been created.',
    })
    expect(pushRoute).toHaveBeenCalledWith('/board/board-7')
  })

  test('says the creation is not confirmed, and leads to the boards, when the server could not confirm the board', async () => {
    // Arrange: the board may exist
    const user = userEvent.setup()
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })
    render(<CreateBoardForm />)

    // Act
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects')
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not confirm that the board was created. Check your boards before trying again.',
    )
    expect(screen.getByRole('alert')).toHaveClass('text-warning')
    // Said once, in the form: no toast lands on the way to the boards
    expect(showErrorToast).not.toHaveBeenCalled()
    expect(
      screen.getByRole('link', { name: 'Open your boards' }),
    ).toHaveAttribute('href', '/boards')
    expect(pushRoute).not.toHaveBeenCalled()
  })

  test('keeps the form and the typed name, and says the board may exist, when the request fails on the way', async () => {
    // Arrange: the connection broke; the board may have been written before
    const user = userEvent.setup()
    const networkError = new TypeError('Failed to fetch')
    vi.mocked(createBoard).mockRejectedValue(networkError)
    render(<CreateBoardForm />)

    // Act
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects')
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Assert: the form is still there, with the name, and leads to the boards
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not confirm that the board was created. Check your boards before trying again.',
    )
    expect(screen.getByLabelText('Board Name')).toHaveValue('Side Projects')
    expect(
      screen.getByRole('link', { name: 'Open your boards' }),
    ).toHaveAttribute('href', '/boards')
    expect(screen.queryByRole('button', { name: 'Create Board' })).toBeNull()
    // Said once, in the form: no toast lands on the way to the boards
    expect(showErrorToast).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledWith(networkError, {
      tags: { action: 'createBoard' },
    })
    expect(pushRoute).not.toHaveBeenCalled()
  })

  test('stops waiting after 15 seconds without an answer and leads to the boards', async () => {
    // Arrange: a creation the server never answers
    vi.mocked(createBoard).mockReturnValue(new Promise(() => {}))
    render(<CreateBoardForm />)
    fireEvent.change(screen.getByLabelText('Board Name'), {
      target: { value: 'Side Projects' },
    })
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Create Board' }))
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()

    // Act
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not confirm that the board was created. Check your boards before trying again.',
    )
    expect(
      screen.getByRole('link', { name: 'Open your boards' }),
    ).toHaveAttribute('href', '/boards')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'createBoard got no answer in time',
      { level: 'warning', tags: { action: 'createBoard' } },
    )
  })

  test('says the board was not created, with nothing to look up, when the server refused', async () => {
    // Arrange: nothing was written
    const user = userEvent.setup()
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error: 'The board was not created. Try again.',
    })
    render(<CreateBoardForm />)

    // Act
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects')
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The board was not created. Try again.',
    )
    expect(screen.getByRole('alert')).toHaveClass('text-destructive')
    // Said once, in the form: no toast lands on the Create Board button
    expect(showErrorToast).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Open your boards' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Create Board' })).toBeEnabled()
  })

  test('sends no second creation after one the server could not confirm, so pressing again cannot make a second board', async () => {
    // Arrange: the board may exist
    const user = userEvent.setup()
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })
    render(<CreateBoardForm />)
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects')
    await user.click(screen.getByRole('button', { name: 'Create Board' }))
    const boardsLink = await screen.findByRole('link', {
      name: 'Open your boards',
    })

    // Act: the form is sent once more, the way Enter or a second press would
    const form = boardsLink.closest('form')
    if (form) fireEvent.submit(form)

    // Assert
    expect(createBoard).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Create Board' })).toBeNull()
    expect(screen.getByLabelText('Board Name')).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Web App/ })).toBeDisabled()
  })

  test('offers Reload page when this page is out of date, and sends no second creation', async () => {
    // Arrange: the server rejected the call without running it
    const user = userEvent.setup()
    const stalePage = new Error(
      'Server Action "abc" was not found on the server.',
    )
    stalePage.name = 'UnrecognizedActionError'
    vi.mocked(createBoard).mockRejectedValue(stalePage)
    render(<CreateBoardForm />)
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects')
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Act: the form is sent once more, the way Enter or a second press would
    const reloadButton = await screen.findByRole('button', {
      name: 'Reload page',
    })
    const form = reloadButton.closest('form')
    if (form) fireEvent.submit(form)

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This page is out of date. Reload the page and try again.',
    )
    expect(createBoard).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Create Board' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open your boards' })).toBeNull()
    expect(screen.getByLabelText('Board Name')).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Web App/ })).toBeDisabled()
    expect(reloadButton).toHaveFocus()
    expect(reloadButton).toHaveAccessibleDescription(
      'This page is out of date. Reload the page and try again.',
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  test('puts the keyboard on "Open your boards" after a creation the server could not confirm', async () => {
    // Arrange: the board may exist
    const user = userEvent.setup()
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })
    render(<CreateBoardForm />)

    // Act
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects{Enter}')

    // Assert: the field the user typed in is disabled now and cannot hold it
    expect(
      await screen.findByRole('link', { name: 'Open your boards' }),
    ).toHaveFocus()
  })

  // Value: protects=a screen reader that follows the focus to "Open your boards" reads why the link stands where "Create Board" stood; fails_when=the link is not described by the message, so it is read as a bare link and the reason stays in a paragraph the focus never visits; why_new=the tests of an unconfirmed creation read the message and the focus, not what the link is described by; seam=none; no_claim=what a screen reader says aloud, and whether it reads the alert when the message appears
  test('reads the message of a creation nobody could confirm with "Open your boards"', async () => {
    // Arrange: the board may exist
    const user = userEvent.setup()
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error:
        'Could not confirm that the board was created. Check your boards before trying again.',
      errorCode: 'BOARD_CREATION_UNCONFIRMED',
    })
    render(<CreateBoardForm />)

    // Act
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects{Enter}')

    // Assert
    expect(
      await screen.findByRole('link', { name: 'Open your boards' }),
    ).toHaveAccessibleDescription(
      'Could not confirm that the board was created. Check your boards before trying again.',
    )
  })

  // Value: protects=after a refused creation a keyboard user is back in the name field and can change the name or send it again; fails_when=the form leaves the focus on the page, where it fell when the field and the buttons were disabled for the request; why_new=the test of the refusal reads the text and the buttons, not the focus; seam=none; no_claim=a creation sent with Enter: happy-dom leaves the focus on a field that is disabled, a browser does not, so the story "Focus Returns To Name After Refusal" checks that one in a browser
  test('puts the keyboard back on the name after a creation the server refused', async () => {
    // Arrange: nothing was written
    const user = userEvent.setup()
    vi.mocked(createBoard).mockResolvedValue({
      success: false,
      error: 'The board was not created. Try again.',
    })
    render(<CreateBoardForm />)
    const nameField = screen.getByLabelText('Board Name')
    await user.type(nameField, 'Side Projects')

    // Act: sent with the button, which is disabled while the request runs
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The board was not created. Try again.',
    )
    expect(nameField).toHaveFocus()
    expect(nameField).toHaveValue('Side Projects')
  })

  // Value: protects=a user who went on to another part of the page while the creation ran is not pulled back into the form; fails_when=the refusal takes the focus whatever holds it; why_new=the test above has the focus fall out of the form's own button; seam=none; no_claim=none
  test('leaves the keyboard where the user moved it while the request ran when the refusal arrives', async () => {
    // Arrange: the answer comes when the test says so, and the page has a
    // link beside the form, as the sidebar has
    const user = userEvent.setup()
    let answerCreation: (
      answer: Awaited<ReturnType<typeof createBoard>>,
    ) => void = () => {}
    vi.mocked(createBoard).mockReturnValue(
      new Promise((resolve) => {
        answerCreation = resolve
      }),
    )
    render(
      <>
        <a href="/settings">Settings</a>
        <CreateBoardForm />
      </>,
    )
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects{Enter}')
    const settingsLink = screen.getByRole('link', { name: 'Settings' })
    settingsLink.focus()

    // Act
    await act(async () => {
      answerCreation({
        success: false,
        error: 'The board was not created. Try again.',
      })
    })

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The board was not created. Try again.',
    )
    expect(settingsLink).toHaveFocus()
  })

  // Value: protects=a user who went on to another part of the page while the creation ran is not pulled back into the form when nobody could confirm the board; fails_when="Open your boards" takes the focus whatever holds it, as its ref callback did; why_new=the test of this path has the focus fall out of the form's own field, and the test above covers the refusal only; seam=none; no_claim=none
  test('leaves the keyboard where the user moved it while the request ran when the creation could not be confirmed', async () => {
    // Arrange: the answer comes when the test says so, and the page has a
    // link beside the form, as the sidebar has
    const user = userEvent.setup()
    let answerCreation: (
      answer: Awaited<ReturnType<typeof createBoard>>,
    ) => void = () => {}
    vi.mocked(createBoard).mockReturnValue(
      new Promise((resolve) => {
        answerCreation = resolve
      }),
    )
    render(
      <>
        <a href="/settings">Settings</a>
        <CreateBoardForm />
      </>,
    )
    await user.type(screen.getByLabelText('Board Name'), 'Side Projects{Enter}')
    const settingsLink = screen.getByRole('link', { name: 'Settings' })
    settingsLink.focus()

    // Act
    await act(async () => {
      answerCreation({
        success: false,
        error:
          'Could not confirm that the board was created. Check your boards before trying again.',
        errorCode: 'BOARD_CREATION_UNCONFIRMED',
      })
    })

    // Assert: the way to the boards is there, and the keyboard stayed
    expect(
      await screen.findByRole('link', { name: 'Open your boards' }),
    ).toBeVisible()
    expect(settingsLink).toHaveFocus()
  })

  test('announces a refused empty name, ties it to the name field and keeps the keyboard there', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CreateBoardForm />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Assert
    const nameField = screen.getByLabelText('Board Name')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Board name is required',
    )
    expect(nameField).toHaveAttribute('aria-invalid', 'true')
    expect(nameField).toHaveAccessibleDescription(
      '0/50 characters Board name is required',
    )
    expect(nameField).toHaveFocus()
    expect(createBoard).not.toHaveBeenCalled()
  })

  test('takes the refusal of a name away once the name is edited', async () => {
    // Arrange: an empty name was refused
    const user = userEvent.setup()
    render(<CreateBoardForm />)
    await user.click(screen.getByRole('button', { name: 'Create Board' }))

    // Act
    await user.type(screen.getByLabelText('Board Name'), 'S')

    // Assert
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Board Name')).toHaveAttribute(
      'aria-invalid',
      'false',
    )
  })

  test('names the preset cards as one group, so a screen reader says what they choose', () => {
    // Arrange / Act
    render(<CreateBoardForm />)

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'Column Preset' }),
    ).toHaveAccessibleDescription('Choose how to organize your repos')
  })
})
