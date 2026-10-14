import type { PostgrestError } from '@supabase/supabase-js'

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
 * Tells whether the error of a call to a database function proves that
 * nothing was written. Called by {@link createBoardFromPreset} and
 * {@link moveCardToBoard}, whose functions write in one transaction, to tell
 * a refusal from a call whose outcome nobody knows.
 *
 * PostgreSQL and PostgREST answer with a code of their own instead of
 * committing. An error without such a code did not come from them: the
 * request failed on the way or a gateway replied, and the function may have
 * run all the same. A code that says the connection broke is no proof either.
 *
 * @param error - The error the Supabase client returned for the call.
 * @returns
 * - `true` for a refusal: a check of the function, a missing right, a
 *   cancelled statement, a function the API does not know
 * - `false` when the write may have happened: no code, a code that is neither
 *   a SQLSTATE nor a PostgREST code ({@link DATABASE_ERROR_CODE_PATTERN}), or
 *   one that starts with one of {@link BROKEN_CONNECTION_CODE_PREFIXES}
 * @example
 * didDatabaseRefuse({ code: '23514', ... }) // => true (check violation)
 * didDatabaseRefuse({ code: '', ... })      // => false (fetch failed)
 * didDatabaseRefuse({ code: 502, ... })     // => false (a gateway's own JSON)
 * didDatabaseRefuse({ code: '08006', ... }) // => false (connection failure)
 */
export function didDatabaseRefuse(error: PostgrestError): boolean {
  // Typed as a string, but it is whatever the JSON of the answer held
  const code: unknown = error.code
  if (typeof code !== 'string' || !DATABASE_ERROR_CODE_PATTERN.test(code)) {
    return false
  }
  return !BROKEN_CONNECTION_CODE_PREFIXES.some((prefix) =>
    code.startsWith(prefix),
  )
}
