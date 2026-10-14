/**
 * Unit Tests: didDatabaseRefuse()
 *
 * A database function that writes in one transaction either answers with a
 * code of PostgreSQL or PostgREST, which proves that nothing was written, or
 * gives no such answer, and then the write may have happened. Creating a
 * board and moving a card both word their failure by this, so the classes of
 * codes are pinned here once; `board.create.test.ts` and
 * `repo-cards.placement.test.ts` check that each action asks.
 *
 * @see src/lib/utils/did-database-refuse.ts
 */

import type { PostgrestError } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'

import { didDatabaseRefuse } from '@/lib/utils/did-database-refuse'

/**
 * An error as the Supabase client hands it over: whatever JSON the failed
 * request came back with, typed as a {@link PostgrestError}.
 * @param code - The `code` of that JSON, which a gateway can set to anything.
 * @returns The error.
 */
function makeError(code: unknown): PostgrestError {
  return {
    name: 'PostgrestError',
    message: 'failed',
    details: '',
    hint: '',
    code,
  } as PostgrestError
}

describe('didDatabaseRefuse()', () => {
  test.each([
    { code: '23514', meaning: 'a check of the function failed' },
    { code: '42501', meaning: 'the caller may not run the function' },
    { code: '40P01', meaning: 'a deadlock was detected and rolled back' },
    { code: '57014', meaning: 'the statement was cancelled and rolled back' },
    { code: 'PGRST202', meaning: 'the API does not know the function' },
  ])(
    'takes it as proof that nothing was written when $meaning ($code)',
    ({ code }) => {
      // Arrange
      const error = makeError(code)

      // Act
      const didRefuse = didDatabaseRefuse(error)

      // Assert
      expect(didRefuse).toBe(true)
    },
  )

  test.each([
    { code: '08006', meaning: 'the connection to the database failed' },
    { code: '08007', meaning: 'the outcome of the transaction is unknown' },
    { code: '57P01', meaning: 'the database was shut down' },
    { code: 'PGRST001', meaning: 'the API lost its database connection' },
  ])(
    'does not take it as proof when $meaning ($code): the function may have committed before the break',
    ({ code }) => {
      // Arrange
      const error = makeError(code)

      // Act
      const didRefuse = didDatabaseRefuse(error)

      // Assert
      expect(didRefuse).toBe(false)
    },
  )

  test.each([
    { code: '', meaning: 'the request failed on the way and has no code' },
    { code: 502, meaning: 'a gateway answered with a number as its code' },
    {
      code: 'BAD_GATEWAY',
      meaning: 'a gateway answered with a code the database never writes',
    },
    { code: null, meaning: 'the answer carried no code at all' },
    { code: undefined, meaning: 'the answer had no code field' },
  ])(
    'does not take it as proof when $meaning: the database did not write that answer',
    ({ code }) => {
      // Arrange
      const error = makeError(code)

      // Act
      const didRefuse = didDatabaseRefuse(error)

      // Assert
      expect(didRefuse).toBe(false)
    },
  )
})
