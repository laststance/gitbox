/**
 * Unit Tests: remapBoardEmbed (PostgREST board embed → domain bundle)
 *
 * remapBoardEmbed is the pure/synchronous core of the /board/[id] read-path
 * optimization: it turns ONE nested PostgREST embed into the exact shape the
 * old multi-query path produced. These specs lock in the behaviors that would
 * silently break the board if they regressed — child ordering, comment-map
 * parity, and the RLS fail-closed shape (projectinfo hidden for non-owners).
 *
 * Out of scope here (and why): the async getBoardBundle DB contract — embed
 * error => throw (never a 404), null data => null => notFound(), zero-column
 * default creation, and the 1000-row truncation warning — depends on Supabase
 * + PostgREST + Postgres RLS. RLS itself is enforced by migration
 * 20260219100000_add_public_board.sql and PostgREST, not by this remap; these
 * tests only prove the remap handles a projectinfo:null (RLS-hidden) embed
 * without leaking. The DB contract is covered by E2E board rendering.
 *
 * @see src/lib/actions/mappers.ts
 */

import { describe, it, expect } from 'vitest'

import { remapBoardEmbed, type BoardBundleRow } from '@/lib/actions/mappers'
import type { Tables } from '@/lib/supabase/types'

const TIMESTAMP = '2026-04-21T12:00:00.000Z'

/** A single embedded repocard row (card columns + its one-to-one projectinfo). */
type RepoCardEmbedRow = BoardBundleRow['repocard'][number]

/** Build a valid `board` row; override only the columns a test cares about. */
function makeBoardRow(
  overrides: Partial<Tables<'board'>> = {},
): Tables<'board'> {
  return {
    id: 'board-1',
    name: 'My Board',
    user_id: 'user-1',
    position: 0,
    is_favorite: false,
    is_public: false,
    settings: null,
    share_slug: null,
    subtitle: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  }
}

/** Build a valid `statuslist` row; override only the columns a test cares about. */
function makeStatusListRow(
  overrides: Partial<Tables<'statuslist'>> = {},
): Tables<'statuslist'> {
  return {
    id: 'status-1',
    board_id: 'board-1',
    name: 'Todo',
    color: '#6B7280',
    grid_row: 0,
    grid_col: 0,
    order: 0,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  }
}

/** Build a valid embedded `repocard` row (projectinfo defaults to null). */
function makeRepoCardRow(
  overrides: Partial<RepoCardEmbedRow> = {},
): RepoCardEmbedRow {
  return {
    id: 'card-1',
    board_id: 'board-1',
    status_id: 'status-1',
    repo_owner: 'laststance',
    repo_name: 'gitbox',
    order: 0,
    meta: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    projectinfo: null,
    ...overrides,
  }
}

/** Assemble a full BoardBundleRow from optional board / column / card parts. */
function makeBundleRow(
  parts: {
    board?: Tables<'board'>
    statuslist?: BoardBundleRow['statuslist']
    repocard?: BoardBundleRow['repocard']
  } = {},
): BoardBundleRow {
  return {
    ...(parts.board ?? makeBoardRow()),
    statuslist: parts.statuslist ?? [],
    repocard: parts.repocard ?? [],
  }
}

describe('remapBoardEmbed', () => {
  it('orders columns by grid row then grid column so the board renders left-to-right regardless of DB row order', () => {
    // Arrange: columns supplied out of order
    const row = makeBundleRow({
      statuslist: [
        makeStatusListRow({ id: 'col-second', grid_row: 0, grid_col: 1 }),
        makeStatusListRow({ id: 'col-fourth', grid_row: 1, grid_col: 1 }),
        makeStatusListRow({ id: 'col-third', grid_row: 1, grid_col: 0 }),
        makeStatusListRow({ id: 'col-first', grid_row: 0, grid_col: 0 }),
      ],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert
    expect(bundle.statusLists.map((column) => column.id)).toEqual([
      'col-first',
      'col-second',
      'col-third',
      'col-fourth',
    ])
  })

  it('orders cards by their order field within the bundle', () => {
    // Arrange: cards supplied out of order
    const row = makeBundleRow({
      repocard: [
        makeRepoCardRow({ id: 'card-c', order: 2 }),
        makeRepoCardRow({ id: 'card-a', order: 0 }),
        makeRepoCardRow({ id: 'card-b', order: 1 }),
      ],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert
    expect(bundle.repoCards.map((card) => card.id)).toEqual([
      'card-a',
      'card-b',
      'card-c',
    ])
  })

  it('uses the stored comment text and color when projectinfo is present', () => {
    // Arrange
    const row = makeBundleRow({
      repocard: [
        makeRepoCardRow({
          id: 'card-1',
          projectinfo: { comment: 'ship it', comment_color: 'blue' },
        }),
      ],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert
    expect(bundle.comments['card-1']).toEqual({
      comment: 'ship it',
      color: 'blue',
    })
  })

  it("fills the default 'primary' comment when a card has no projectinfo (parity with the old batch comment fetch)", () => {
    // Arrange: card with no projectinfo row
    const row = makeBundleRow({
      repocard: [makeRepoCardRow({ id: 'card-1', projectinfo: null })],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert ('primary' is DEFAULT_COMMENT_COLOR)
    expect(bundle.comments['card-1']).toEqual({ comment: '', color: 'primary' })
  })

  it("falls back to the default 'primary' color when comment_color is null", () => {
    // Arrange: projectinfo present but no color stored
    const row = makeBundleRow({
      repocard: [
        makeRepoCardRow({
          id: 'card-1',
          projectinfo: { comment: 'note', comment_color: null },
        }),
      ],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert
    expect(bundle.comments['card-1']).toEqual({
      comment: 'note',
      color: 'primary',
    })
  })

  it('produces exactly one comment entry per card so the map never misses a card', () => {
    // Arrange: one card with projectinfo, one without
    const row = makeBundleRow({
      repocard: [
        makeRepoCardRow({
          id: 'card-with',
          projectinfo: { comment: 'has', comment_color: 'green' },
        }),
        makeRepoCardRow({ id: 'card-without', projectinfo: null }),
      ],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert
    expect(bundle.comments).toEqual({
      'card-with': { comment: 'has', color: 'green' },
      'card-without': { comment: '', color: 'primary' },
    })
  })

  it('never leaks a comment when projectinfo is RLS-hidden for a non-owner — every card gets a safe default', () => {
    // Arrange: non-owner embed where RLS returns projectinfo: null for every card
    const row = makeBundleRow({
      repocard: [
        makeRepoCardRow({ id: 'card-1', projectinfo: null }),
        makeRepoCardRow({ id: 'card-2', projectinfo: null }),
      ],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert: only the safe default shape, no leaked text
    expect(bundle.comments).toEqual({
      'card-1': { comment: '', color: 'primary' },
      'card-2': { comment: '', color: 'primary' },
    })
  })

  it('returns empty status lists when the board has no columns (the caller creates defaults, not the remap)', () => {
    // Arrange: a board with no columns and no cards
    const row = makeBundleRow({ statuslist: [], repocard: [] })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert
    expect(bundle.statusLists).toEqual([])
    expect(bundle.repoCards).toEqual([])
    expect(bundle.comments).toEqual({})
  })

  it('returns the plain board row without the embedded statuslist/repocard children', () => {
    // Arrange: a fully populated bundle
    const row = makeBundleRow({
      board: makeBoardRow({ id: 'board-9', name: 'Roadmap' }),
      statuslist: [makeStatusListRow()],
      repocard: [makeRepoCardRow()],
    })

    // Act
    const bundle = remapBoardEmbed(row)

    // Assert: board columns survive, embedded children are stripped off
    expect(bundle.board.id).toBe('board-9')
    expect(bundle.board.name).toBe('Roadmap')
    expect('statuslist' in bundle.board).toBe(false)
    expect('repocard' in bundle.board).toBe(false)
  })
})
