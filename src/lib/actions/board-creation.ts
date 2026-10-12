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
import type { Database, TablesInsert } from '@/lib/supabase/types'
import { createdBoardRowSchema } from '@/lib/validations/board'

import type { BoardOption } from './types'

/**
 * Preset whose columns a board gets when nobody chose one: the first board of
 * a user, and a board that is found without columns.
 */
const FALLBACK_COLUMNS_PRESET_ID = 'software-release' satisfies PresetId

/**
 * Start of the codes of an error that says the connection to the database
 * broke while the request was running: SQLSTATE class 08 (connection
 * exception) and 57P (the server shut down or ended the session), and
 * PostgREST's PGRST000 to PGRST003 (it lost, or never got, its own connection
 * to the database). The function may have committed before the break, so
 * such an error does not prove that nothing was written.
 */
const BROKEN_CONNECTION_CODE_PREFIXES = ['08', '57P', 'PGRST00']

/**
 * A code PostgreSQL writes (a SQLSTATE: five digits or capitals) or PostgREST
 * does (`PGRST` and three digits). Only such a code shows that the database
 * or its API answered. The client hands over whatever JSON a failed request
 * came back with, so a gateway's own reply can carry any `code`, a number
 * included.
 */
const DATABASE_ERROR_CODE_PATTERN = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/

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
 * columns are written, or nothing is. Called by {@link createBoard} and
 * {@link createFirstBoardIfNeeded}. No failure is reported here, because the
 * two callers answer a failure in different ways. It never throws: a call
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
 * // => { status: 'created', board: { id: 'uuid', name: 'Side Projects', isPublic: false,
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
        p_columns: BOARD_PRESETS[presetId].columns.map(({ name, color }) => ({
          name,
          color,
        })),
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
    // A board is shared from its settings, never at creation
    return {
      status: 'created',
      board: { id, name, isPublic: false, statusLists },
    }
  } catch (error) {
    // The client answers with an error and does not throw. If something
    // throws all the same, the request may be on its way: no proof either way
    return { status: 'unconfirmed', error }
  }
}

/**
 * Tells whether an error of the database function proves that nothing was
 * written. Called by {@link createBoardFromPreset} to choose between
 * `not-created` and `unconfirmed`.
 *
 * PostgreSQL and PostgREST answer with a code of their own instead of
 * committing. An error without such a code did not come from them: the
 * request failed on the way or a gateway replied, and the function may have
 * run all the same. A code that says the connection broke is no proof either.
 *
 * @param error - The error of the `create_board_with_status_lists` call.
 * @returns
 * - `true` for a refusal: a check of the function, a missing right, a
 *   cancelled statement, a function the API does not know
 * - `false` when the board may exist: no code, a code that is neither a
 *   SQLSTATE nor a PostgREST code ({@link DATABASE_ERROR_CODE_PATTERN}), or
 *   one that starts with one of {@link BROKEN_CONNECTION_CODE_PREFIXES}
 * @example
 * didDatabaseRefuse({ code: '23514', ... }) // => true (check violation)
 * didDatabaseRefuse({ code: '', ... })      // => false (fetch failed)
 * didDatabaseRefuse({ code: 502, ... })     // => false (a gateway's own JSON)
 * didDatabaseRefuse({ code: '08006', ... }) // => false (connection failure)
 */
function didDatabaseRefuse(error: PostgrestError): boolean {
  // Typed as a string, but it is whatever the JSON of the answer held
  const code: unknown = error.code
  if (typeof code !== 'string' || !DATABASE_ERROR_CODE_PATTERN.test(code)) {
    return false
  }
  return !BROKEN_CONNECTION_CODE_PREFIXES.some((prefix) =>
    code.startsWith(prefix),
  )
}

/**
 * Gives a user who has no board a "First Board" with the default columns (the
 * Software Release preset), so the first sign-in lands on a board that can
 * hold cards. Does nothing for a user who has a board, so it is safe on every
 * sign-in. Called by the OAuth callback (`src/app/auth/callback/route.ts`)
 * right after the session is established, and by nothing else.
 *
 * A failure is reported and never blocks the sign-in: the user then lands on
 * an empty board list. That holds for anything thrown in here too, because
 * the callback would answer a rejection by sending a user whose session is
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
    // Check if user already has any boards
    const { count, error: countError } = await supabase
      .from('board')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) {
      Sentry.captureException(countError, {
        extra: { context: 'Check existing boards', userId },
      })
      // Don't block login on error - just skip first board creation
      return null
    }

    // User already has boards - no action needed
    if (count && count > 0) {
      return null
    }

    // "First Board" and its default columns in one transaction: the board
    // never exists without them
    const outcome = await createBoardFromPreset(
      supabase,
      'First Board',
      FALLBACK_COLUMNS_PRESET_ID,
    )

    if (outcome.status !== 'created') {
      Sentry.captureException(outcome.error, {
        extra: {
          context: 'Create first board',
          userId,
          status: outcome.status,
        },
      })
      // Don't block login on error
      return null
    }

    return { id: outcome.board.id, name: outcome.board.name }
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
 * @param boardId - Board that has no column.
 * @returns The created columns, in column order.
 * @throws When the columns cannot be written; the failure is reported first.
 * @example
 * await createDefaultStatusLists(boardId)
 * // Creates: Pending, Planning, Focus Development, MVP Release, Production Release
 */
export async function createDefaultStatusLists(
  boardId: string,
): Promise<StatusListDomain[]> {
  const supabase = await createClient()

  const statusLists: TablesInsert<'statuslist'>[] = BOARD_PRESETS[
    FALLBACK_COLUMNS_PRESET_ID
  ].columns.map((column, index) => ({
    board_id: boardId,
    name: column.name,
    color: column.color,
    order: index,
    grid_row: 0,
    grid_col: index,
  }))

  const { data, error } = await supabase
    .from('statuslist')
    .insert(statusLists)
    .select()

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Create default status lists', boardId },
    })
    throw new Error('Failed to create status lists')
  }

  return (data || []).map(toStatusListDomain)
}
