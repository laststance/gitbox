import * as Sentry from '@sentry/nextjs'

import { createBoard } from '@/lib/actions/board'
import type { BoardOption } from '@/lib/actions/types'
import { BOARD_CREATION_UNCONFIRMED_MESSAGE } from '@/lib/constants/board-creation'
import type { PresetId } from '@/lib/constants/board-presets'
import { SERVER_ANSWER_TIME_LIMIT_MS } from '@/lib/constants/requests'

import { settleWithin } from './settle-within'

/**
 * How a board creation sent from the browser ended.
 * - `created`: the board exists; `board` is it, with its columns
 * - `not-created`: the server answered and nothing was written, so the same
 *   name can be sent again
 * - `unconfirmed`: a board may exist. The request failed on the way, got no
 *   answer in time, or the server itself could not tell. Sending the name
 *   again could make a second board.
 */
export type BoardCreationAttempt =
  | { status: 'created'; board: BoardOption }
  | { status: 'not-created'; message: string }
  | { status: 'unconfirmed'; message: string }

/**
 * Asks the server for a new board and waits a limited time for the answer.
 * Exists so both places that create a board tell "not created" from "may
 * exist" the same way and never wait without end: {@link CreateBoardForm} on
 * `/boards/new` and {@link MoveToAnotherBoardDialog}. Never rejects: a call
 * that rejects (offline, a connection that broke after the board was
 * written) would otherwise reach the error page of the route, which loses
 * the typed name and offers a second try.
 *
 * A request that failed on the way or got no answer in time is reported to
 * Sentry here. One the server answered is not: the server has reported it.
 *
 * @param boardName - Validated board name.
 * @param presetId - Preset whose columns the board gets.
 * @returns The {@link BoardCreationAttempt}.
 * @example
 * const attempt = await requestBoardCreation('Side Projects', 'single-column')
 * // => { status: 'created', board: { id: 'uuid', name: 'Side Projects', isPublic: false, statusLists: [...] } }
 * // => { status: 'not-created', message: 'The board was not created. Try again.' }
 * // => { status: 'unconfirmed', message: BOARD_CREATION_UNCONFIRMED_MESSAGE }
 */
export async function requestBoardCreation(
  boardName: string,
  presetId: PresetId,
): Promise<BoardCreationAttempt> {
  const outcome = await settleWithin(
    createBoard(boardName, presetId),
    SERVER_ANSWER_TIME_LIMIT_MS,
  )

  // The request failed on the way: the board may have been written before
  if (outcome.status === 'failed') {
    Sentry.captureException(outcome.error, { tags: { action: 'createBoard' } })
    return {
      status: 'unconfirmed',
      message: BOARD_CREATION_UNCONFIRMED_MESSAGE,
    }
  }

  // Still running: nothing can take back a Server Action that was sent
  if (outcome.status === 'overdue') {
    Sentry.captureMessage('createBoard got no answer in time', {
      level: 'warning',
      tags: { action: 'createBoard' },
    })
    return {
      status: 'unconfirmed',
      message: BOARD_CREATION_UNCONFIRMED_MESSAGE,
    }
  }

  const { answer } = outcome
  if (answer.success) return { status: 'created', board: answer.data }

  return {
    // The code, not the text, says that the board may exist: the server sets
    // it when the database gave no answer, or one it could not read
    status:
      answer.errorCode === 'BOARD_CREATION_UNCONFIRMED'
        ? 'unconfirmed'
        : 'not-created',
    message: answer.error,
  }
}
