/**
 * Repo Card Duplicate Rules (Issue #215)
 *
 * One repository may sit on at most one board per user. This module holds
 * everything the server actions need to enforce and explain that rule:
 * - {@link lookupRepoPlacements}: which board holds each of the user's repositories
 * - {@link splitRequestedRepos}: which requested repositories can still be added
 * - {@link toUniqueViolationError}: the friendly error for a lost race
 *
 * NOT a 'use server' module — imported by `repo-cards.ts` and `board-data.ts`,
 * so the lookup never becomes a client-callable action on its own.
 *
 * Schema-order note: nothing here reads or writes `repocard.user_id`. Ownership
 * comes from the `board` join, so the same build works before and after the
 * migration that adds the column and the unique index.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createModuleLogger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
import { readEveryRow } from '@/lib/utils/read-every-row'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'

import { ActionUserError } from './types'

const log = createModuleLogger('repo-card-duplicates')

/** Postgres SQLSTATE for a unique constraint / unique index violation. */
const POSTGRES_UNIQUE_VIOLATION = '23505'

/**
 * Shown by the picker when the unique index rejected the insert: another tab
 * placed one of the selected repositories between the check and the insert.
 */
export const ADD_RACE_MESSAGE =
  'Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.'

/** One repository of the user that currently sits on a board. */
export interface BoardPlacement {
  /** Lowercase `owner/name`. */
  identifier: RepoIdentifier
  /** Board that holds the card. */
  boardId: string
  /** Display name of that board. */
  boardName: string
}

/** Why a requested repository was not added. */
export type SkippedReason = 'this-board' | 'other-board'

/**
 * A requested repository that was not added, with the sentence shown to the user.
 *
 * @example
 * {
 *   fullName: 'laststance/gitbox',
 *   reason: 'other-board',
 *   message: 'laststance/gitbox is already on board "Work"',
 *   boardId: 'uuid',
 *   boardName: 'Work',
 * }
 */
export interface SkippedRepository {
  /** `owner/name` as requested (original letter case). */
  fullName: string
  /** Whether the repository sits on the target board or on another one. */
  reason: SkippedReason
  /** Ready-to-show sentence. */
  message: string
  /** Board that already holds the repository. */
  boardId: string
  /** Display name of the board that already holds the repository. */
  boardName: string
}

/** The identity fields {@link splitRequestedRepos} needs from a requested repository. */
interface RequestedRepository {
  name: string
  owner: { login: string }
}

/**
 * Loads every placement of the user's repositories: the cards on any of their
 * boards, each with the board that holds it.
 *
 * Called by `addRepositoriesToBoard` and `getUserRepoPlacements`, so the owner
 * filter exists in exactly one place. The read is ordered by card id and
 * continues past the row cap, so a repository past the first 1000 is still
 * named instead of looking unplaced. Row level security already limits this
 * read to the user's own boards; the explicit `board.user_id` filter keeps the
 * lookup correct by itself, so a future read policy cannot make another user's
 * cards block this user.
 *
 * @param supabase - Authenticated Supabase client (RLS applies).
 * @param userId - The current user's id (`claims.sub`).
 * @returns One {@link BoardPlacement} per card of the user.
 * @throws When the query fails. Callers that mutate must not continue without
 * this data (fail closed).
 * @example
 * const placements = await lookupRepoPlacements(supabase, claims.sub)
 * // => [{ identifier: 'a/b', boardId: '…', boardName: 'Work' }]
 */
export async function lookupRepoPlacements(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<BoardPlacement[]> {
  // One read stops at the row cap. A card past it would be offered again,
  // and the add would end in the race sentence instead of naming the board.
  let cards
  try {
    cards = await readEveryRow((from, to) =>
      supabase
        .from('repocard')
        .select('repo_owner, repo_name, board!inner(id, user_id, name)')
        .eq('board.user_id', userId)
        .order('id', { ascending: true })
        .range(from, to),
    )
  } catch (error) {
    log.error({ error }, 'Repo placement lookup failed')
    throw new Error('Failed to look up repository placements')
  }

  return cards.map((card) => ({
    identifier: toRepoIdentifier(card.repo_owner, card.repo_name),
    boardId: card.board.id,
    boardName: card.board.name,
  }))
}

/**
 * Splits the repositories of an "Add Repositories" request into those that can
 * be inserted and those that are already placed somewhere.
 *
 * Pure function called by `addRepositoriesToBoard`. Comparison is
 * case-insensitive, and the request is de-duplicated against itself (first
 * entry wins) so one batch cannot violate the unique index on its own.
 *
 * @param requested - Repositories the user selected, in request order.
 * @param placements - Result of {@link lookupRepoPlacements}.
 * @param currentBoardId - Board the repositories are being added to.
 * @returns
 * - `addable`: repositories to insert, in request order
 * - `skipped`: one {@link SkippedRepository} per repository already placed
 * @example
 * splitRequestedRepos(
 *   [{ name: 'gitbox', owner: { login: 'laststance' } }],
 *   [{ identifier: 'laststance/gitbox', boardId: 'b2', boardName: 'Work' }],
 *   'b1',
 * )
 * // => { addable: [], skipped: [{ fullName: 'laststance/gitbox', reason: 'other-board',
 * //      message: 'laststance/gitbox is already on board "Work"', boardId: 'b2', boardName: 'Work' }] }
 */
export function splitRequestedRepos<Repository extends RequestedRepository>(
  requested: Repository[],
  placements: BoardPlacement[],
  currentBoardId: string,
): { addable: Repository[]; skipped: SkippedRepository[] } {
  // First card wins if legacy data holds the same repository twice
  const boardPlacementByIdentifier = new Map<RepoIdentifier, BoardPlacement>()
  for (const placement of placements) {
    if (!boardPlacementByIdentifier.has(placement.identifier)) {
      boardPlacementByIdentifier.set(placement.identifier, placement)
    }
  }

  const addable: Repository[] = []
  const skipped: SkippedRepository[] = []
  const seenIdentifiers = new Set<RepoIdentifier>()

  for (const repository of requested) {
    const identifier = toRepoIdentifier(repository.owner.login, repository.name)

    // Same repository twice in one request: keep the first, drop the rest silently
    if (seenIdentifiers.has(identifier)) continue
    seenIdentifiers.add(identifier)

    const fullName = `${repository.owner.login}/${repository.name}`
    const boardPlacement = boardPlacementByIdentifier.get(identifier)

    if (boardPlacement) {
      const isOnCurrentBoard = boardPlacement.boardId === currentBoardId
      skipped.push({
        fullName,
        reason: isOnCurrentBoard ? 'this-board' : 'other-board',
        message: isOnCurrentBoard
          ? `${fullName} is already on this board`
          : `${fullName} is already on board "${boardPlacement.boardName}"`,
        boardId: boardPlacement.boardId,
        boardName: boardPlacement.boardName,
      })
      continue
    }

    addable.push(repository)
  }

  return { addable, skipped }
}

/**
 * Tells whether a Supabase / PostgREST error is a Postgres unique violation.
 *
 * Deliberately does not match on the constraint name, so it covers both
 * `unique_repo_per_board` (old schema) and `repocard_unique_repo_per_user`.
 *
 * @param error - The `error` returned by a Supabase insert or RPC call.
 * @returns `true` when the SQLSTATE is `23505`.
 * @example
 * isUniqueViolation({ code: '23505', message: 'duplicate key value …' }) // => true
 * isUniqueViolation({ code: '42501', message: 'permission denied' })     // => false
 * isUniqueViolation(null)                                                // => false
 */
export function isUniqueViolation(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === POSTGRES_UNIQUE_VIOLATION
}

/**
 * Builds the user-facing error for a unique violation and records that the
 * race happened.
 *
 * Called by {@link addRepositoriesToBoard} when the database rejects an
 * insert the pre-check allowed, i.e. another tab or request placed the
 * repository in between. {@link ActionUserError} skips Sentry, so this writes
 * one structured warning (no repository names) to keep the frequency of the
 * race observable.
 *
 * @param params.error - The Supabase error whose code is `23505`.
 * @param params.raceMessage - Sentence shown to the user by the calling surface.
 * @param params.action - Name of the calling server action, for the log.
 * @param params.userId - Current user id, for the log.
 * @returns An {@link ActionUserError} carrying `raceMessage`; the caller throws it.
 * @example
 * if (isUniqueViolation(insertError)) {
 *   throw toUniqueViolationError({
 *     error: insertError,
 *     raceMessage: ADD_RACE_MESSAGE,
 *     action: 'addRepositoriesToBoard',
 *     userId: claims.sub,
 *   })
 * }
 */
export function toUniqueViolationError(params: {
  error: { message?: string }
  raceMessage: string
  action: string
  userId: string
}): ActionUserError {
  // e.g. duplicate key value violates unique constraint "repocard_unique_repo_per_user"
  const constraint =
    params.error.message?.match(/unique constraint "([^"]+)"/)?.[1] ?? 'unknown'

  log.warn(
    { action: params.action, userId: params.userId, constraint },
    'Repo placement rejected by unique constraint (concurrent placement)',
  )

  return new ActionUserError(params.raceMessage)
}
