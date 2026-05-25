/**
 * Unit Tests: getBoardBundle() malformed-id guard
 *
 * Locks in the 404-not-500 contract for /board/[id]: a board id that is not a
 * valid UUID must be treated like a board that cannot exist (return null →
 * caller calls notFound()), and must NEVER reach Postgres — passing a non-UUID
 * to `.eq('id', ...)` would raise "invalid input syntax for type uuid" and
 * surface as a 500. This regresses if the `boardIdSchema.safeParse` short-circuit
 * is removed, so the createClient mock throws to prove Supabase is never touched.
 *
 * Out of scope here (and why): the embed query, RLS, and truncation branches all
 * run AFTER createClient() and depend on a live Supabase + PostgREST — they are
 * covered by E2E board rendering. This file only exercises the pre-DB guard.
 *
 * @see src/lib/actions/board-data.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { getBoardBundle } from '@/lib/actions/board-data'
import { createClient } from '@/lib/supabase/server'

// If the malformed-id guard regresses, getBoardBundle would call createClient
// and hit Postgres. Make the mock throw so that path fails the test loudly.
// (vitest hoists vi.mock above these imports, so createClient is mocked before
// board-data.ts loads.)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => {
    throw new Error('createClient must not be called for a malformed board id')
  }),
}))

describe('getBoardBundle() malformed-id guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('treats a non-UUID board id as not-found (null) without querying Postgres', async () => {
    // Arrange
    const malformedBoardId = 'not-a-uuid'

    // Act
    const result = await getBoardBundle(malformedBoardId)

    // Assert
    expect(result).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('treats an empty board id as not-found (null) without querying Postgres', async () => {
    // Arrange
    const emptyBoardId = ''

    // Act
    const result = await getBoardBundle(emptyBoardId)

    // Assert
    expect(result).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })
})
