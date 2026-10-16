/**
 * Board Creation
 *
 * Writes that create a board or its columns and that only server code calls:
 * the OAuth callback and the Server Actions in the files next to this one.
 *
 * This file has no `'use server'` on purpose. Every export of such a file is
 * an endpoint a signed-in browser can call with arguments of its choice, and
 * the functions here check neither who is calling nor how often.
 */

import * as Sentry from '@sentry/nextjs'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { ZodError } from 'zod'

import { toStatusListDomain } from '@/lib/actions/mappers'
import { BOARD_PRESETS, type PresetId } from '@/lib/constants/board-presets'
import type { StatusListDomain } from '@/lib/models/domain'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { didDatabaseRefuse } from '@/lib/utils/did-database-refuse'
import {
  createdBoardRowSchema,
  ensuredStatusListRowsSchema,
} from '@/lib/validations/board'

import type { BoardOption } from './types'

/**
 * Preset whose columns a board gets when nobody chose one: the first board of
 * a user, and a board that is found without columns.
 */
const FALLBACK_COLUMNS_PRESET_ID = 'software-release' satisfies PresetId

/**
 * Columns of a preset in preset order, the `p_columns` JSON the board
 * functions expect. The array order is the column order on the board.
 * Called by {@link createBoardFromPreset}, {@link createFirstBoardIfNeeded}
 * and {@link createDefaultStatusLists}.
 *
 * @param presetId - Preset whose columns are sent.
 * @returns `{ name, color }` of each column, in preset order.
 * @example
 * columnsOfPreset('single-column')
 * // => [{ name: 'Repositories', color: '#6B7280' }]
 */
function columnsOfPreset(
  presetId: PresetId,
): { name: string; color: string }[] {
  return BOARD_PRESETS[presetId].columns.map(({ name, color }) => ({
    name,
    color,
  }))
}

/**
 * Result of {@link createBoardFromPreset}.
 * - `created`: the board and its columns exist
 * - `not-created`: the database refused the call, so nothing was written
 * - `unconfirmed`: no answer came from the database (the request or its
 *   answer was lost on the way, the connection broke, or the call itself
 *   threw), so the board may or may not exist
 * - `unreadable`: the call succeeded, so the board exists, but its answer is
 *   not the JSON {@link createdBoardRowSchema} describes
 */
export type BoardCreationOutcome =
  | { status: 'created'; board: BoardOption }
  | { status: 'not-created'; error: PostgrestError }
  | { status: 'unconfirmed'; error: unknown }
  | { status: 'unreadable'; error: ZodError }

/**
 * Creates a board and the columns of a preset in one database transaction,
 * through the `create_board_with_status_lists` function. Exists so no caller
 * can end up with a board that has no columns: the board and all of its
 * columns are written, or nothing is. Called by {@link createBoard}. The
 * first board of a new account goes through {@link createFirstBoardIfNeeded},
 * which has its own function so the "no board yet" check and the insert
 * share one lock. No failure is reported here, because the caller answers a
 * failure in its own way. It never throws: a call
 * that throws all the same counts as `unconfirmed`, since the request may
 * have been sent by then.
 *
 * The function takes the owner from the session, so `supabase` has to carry
 * the user's token.
 *
 * @param supabase - Client of the signed-in user (RLS applies).
 * @param boardName - Validated, trimmed board name.
 * @param presetId - Preset whose columns the board gets, in preset order.
 * @returns The {@link BoardCreationOutcome}.
 * @example
 * await createBoardFromPreset(supabase, 'Side Projects', 'single-column')
 * // => { status: 'created', board: { id: 'uuid', name: 'Side Projects',
 * //      statusLists: [{ id: 'uuid', name: 'Repositories', color: '#6B7280' }] } }
 */
export async function createBoardFromPreset(
  supabase: SupabaseClient<Database>,
  boardName: string,
  presetId: PresetId,
): Promise<BoardCreationOutcome> {
  try {
    const { data: createdBoardJson, error } = await supabase.rpc(
      'create_board_with_status_lists',
      {
        p_name: boardName,
        // The array order is the column order on the board
        p_columns: columnsOfPreset(presetId),
      },
    )

    if (error) {
      return didDatabaseRefuse(error)
        ? { status: 'not-created', error }
        : { status: 'unconfirmed', error }
    }

    // The function builds its JSON by hand in SQL; check it before use
    const parsedBoard = createdBoardRowSchema.safeParse(createdBoardJson)
    if (!parsedBoard.success) {
      return { status: 'unreadable', error: parsedBoard.error }
    }

    const { id, name, status_lists: statusLists } = parsedBoard.data
    return {
      status: 'created',
      board: { id, name, statusLists },
    }
  } catch (error) {
    // The client answers with an error and does not throw. If something
    // throws all the same, the request may be on its way: no proof either way
    return { status: 'unconfirmed', error }
  }
}

/**
 * Gives a user who has no board a "First Board" with the default columns (the
 * Software Release preset), so the first sign-in lands on a board that can
 * hold cards. Does nothing for a user who has a board, so it is safe on every
 * sign-in. Called by the OAuth callback (`src/app/auth/callback/route.ts`)
 * right after the session is established, and by nothing else.
 *
 * The "does this user have a board" check runs inside
 * `create_first_board_if_needed`, under a lock for that user. Two sign-ins
 * that end at the same moment cannot both see zero boards. A failure is
 * reported and never blocks the sign-in: the user then lands on an empty
 * board list. That holds for anything thrown in here too, because the
 * callback would answer a rejection by sending a user whose session is
 * already set back to the login page.
 *
 * @param supabase - Client that carries the session just established. The
 *   database takes the owner of the new board from that session.
 * @param userId - Id of that session's user; the boards counted are theirs.
 * @returns
 * - `{ id, name }` of the created board
 * - `null` when the user already has a board, or no board could be created
 * @example
 * const { data } = await supabase.auth.exchangeCodeForSession(code)
 * await createFirstBoardIfNeeded(supabase, data.session.user.id)
 * // => { id: 'uuid', name: 'First Board' } on the first sign-in, null afterwards
 */
export async function createFirstBoardIfNeeded(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ id: string; name: string } | null> {
  try {
    // The database counts the boards under its lock and inserts only when
    // there are none. Null, with no error, means the user already has one.
    const { data: createdBoardJson, error } = await supabase.rpc(
      'create_first_board_if_needed',
      {
        p_name: 'First Board',
        p_columns: columnsOfPreset(FALLBACK_COLUMNS_PRESET_ID),
      },
    )

    if (error) {
      const status = didDatabaseRefuse(error) ? 'not-created' : 'unconfirmed'
      Sentry.captureException(error, {
        extra: { context: 'Create first board', userId, status },
      })
      return null
    }

    if (createdBoardJson === null) {
      return null
    }

    const parsedBoard = createdBoardRowSchema.safeParse(createdBoardJson)
    if (!parsedBoard.success) {
      Sentry.captureException(parsedBoard.error, {
        extra: {
          context: 'Create first board',
          userId,
          status: 'unreadable',
        },
      })
      return null
    }

    return { id: parsedBoard.data.id, name: parsedBoard.data.name }
  } catch (error) {
    // The sign-in has succeeded by now; nothing in here may take it back
    Sentry.captureException(error, {
      extra: { context: 'Create first board: unexpected failure', userId },
    })
    return null
  }
}

/**
 * Gives a board that has no column the default ones (the Software Release
 * preset), side by side in one row. Called by {@link getBoardBundle} when it
 * reads a board without columns: one whose last column was deleted, or one
 * made before boards were created together with their columns. New boards do
 * not come this way ({@link createBoardFromPreset}).
 *
 * The write is `ensure_default_status_lists`. It locks the board row and
 * inserts only while the board still has no column, then returns the columns
 * that are there. Two views at once therefore leave five columns, and the
 * later view renders the ones the earlier view wrote.
 *
 * @param boardId - Board that was read with no column.
 * @returns The columns the board has after the call, in grid order.
 * @throws When the columns cannot be written or the answer cannot be read;
 *   the failure is reported first.
 * @example
 * await createDefaultStatusLists(boardId)
 * // Creates: Pending, Planning, Focus Development, MVP Release, Production Release
 */
export async function createDefaultStatusLists(
  boardId: string,
): Promise<StatusListDomain[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('ensure_default_status_lists', {
    p_board_id: boardId,
    p_columns: columnsOfPreset(FALLBACK_COLUMNS_PRESET_ID),
  })

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Create default status lists', boardId },
    })
    throw new Error('Failed to create status lists')
  }

  const parsedColumns = ensuredStatusListRowsSchema.safeParse(data)
  if (!parsedColumns.success) {
    Sentry.captureException(parsedColumns.error, {
      extra: { context: 'Create default status lists', boardId },
    })
    throw new Error('Failed to create status lists')
  }

  return parsedColumns.data.map(toStatusListDomain)
}
