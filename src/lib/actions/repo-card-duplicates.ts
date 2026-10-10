/**
 * Repo Card Duplicate Rules (Issue #215)
 *
 * One repository may sit on at most one board per user, and never on a board
 * and in Maintenance at once. This module holds everything the server actions
 * need to enforce and explain that rule:
 * - {@link lookupRepoPlacements}: where each of the user's repositories lives
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

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import { POSTGREST_MAX_ROWS } from '@/lib/constants/postgrest'
import { createModuleLogger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
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

/**
 * Everywhere the current user's repositories are placed.
 *
 * @example
 * {
 *   boards: [{ identifier: 'laststance/gitbox', boardId: 'uuid', boardName: 'Work' }],
 *   maintenance: ['laststance/old-project'],
 * }
 */
export interface RepoPlacements {
  /** Repositories on any of the user's boards. */
  boards: BoardPlacement[]
  /** Lowercase `owner/name` of repositories in Maintenance. */
  maintenance: RepoIdentifier[]
}

/** Why a requested repository was not added. */
export type SkippedReason = 'this-board' | 'other-board' | 'maintenance'

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
  /** Where the repository already lives. */
  reason: SkippedReason
  /** Ready-to-show sentence. */
  message: string
  /** Holding board, for `this-board` and `other-board`. */
  boardId?: string
  /** Holding board name, for `this-board` and `other-board`. */
  boardName?: string
}

/** The identity fields {@link splitRequestedRepos} needs from a requested repository. */
interface RequestedRepository {
  name: string
  owner: { login: string }
}

/**
 * Loads every placement of the user's repositories: cards on any of their
 * boards plus Maintenance entries.
 *
 * Called by `addRepositoriesToBoard`, `restoreToBoard` and
 * `getUserRepoPlacements`, so the owner filter exists in exactly one place.
 * RLS alone is not enough here: the policy "Anyone can view public board repo
 * cards" also returns other users' public cards, hence the explicit
 * `board.user_id` filter.
 *
 * @param supabase - Authenticated Supabase client (RLS applies).
 * @param userId - The current user's id (`claims.sub`).
 * @returns The user's {@link RepoPlacements}.
 * @throws When either query fails. Callers that mutate must not continue
 * without this data (fail closed).
 * @example
 * const placements = await lookupRepoPlacements(supabase, claims.sub)
 * // => { boards: [{ identifier: 'a/b', boardId: '…', boardName: 'Work' }], maintenance: [] }
 */
export async function lookupRepoPlacements(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RepoPlacements> {
  const [cardsResult, maintenanceResult] = await Promise.all([
    supabase
      .from('repocard')
      .select('repo_owner, repo_name, board!inner(id, user_id, name)')
      .eq('board.user_id', userId),
    supabase
      .from('maintenance')
      .select('repo_owner, repo_name')
      .eq('user_id', userId),
  ])

  if (cardsResult.error) {
    log.error({ error: cardsResult.error }, 'Repo placement lookup failed')
    throw new Error('Failed to look up repository placements (cards)')
  }
  if (maintenanceResult.error) {
    log.error(
      { error: maintenanceResult.error },
      'Maintenance placement lookup failed',
    )
    throw new Error('Failed to look up repository placements (maintenance)')
  }

  // Surface a possible silent truncation at the PostgREST row cap. The unique
  // index still blocks the duplicate; the user just gets the race message.
  if (cardsResult.data.length >= POSTGREST_MAX_ROWS) {
    Sentry.captureMessage(
      'Repo placement lookup may be truncated at PostgREST row limit',
      {
        level: 'warning',
        extra: { userId, repoCardCount: cardsResult.data.length },
      },
    )
  }

  return {
    boards: cardsResult.data.map((card) => ({
      identifier: toRepoIdentifier(card.repo_owner, card.repo_name),
      boardId: card.board.id,
      boardName: card.board.name,
    })),
    maintenance: maintenanceResult.data.map((item) =>
      toRepoIdentifier(item.repo_owner, item.repo_name),
    ),
  }
}

/**
 * Finds the board that already holds a repository, if any.
 *
 * @param placements - Result of {@link lookupRepoPlacements}.
 * @param owner - Repository owner login, any letter case.
 * @param name - Repository name, any letter case.
 * @returns The first matching {@link BoardPlacement}, or `undefined` when the
 * repository is on none of the user's boards.
 * @example
 * findBoardPlacement(placements, 'Laststance', 'GitBox')
 * // => { identifier: 'laststance/gitbox', boardId: '…', boardName: 'Work' }
 */
export function findBoardPlacement(
  placements: RepoPlacements,
  owner: string,
  name: string,
): BoardPlacement | undefined {
  const identifier = toRepoIdentifier(owner, name)
  return placements.boards.find(
    (placement) => placement.identifier === identifier,
  )
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
 *   { boards: [{ identifier: 'laststance/gitbox', boardId: 'b2', boardName: 'Work' }], maintenance: [] },
 *   'b1',
 * )
 * // => { addable: [], skipped: [{ fullName: 'laststance/gitbox', reason: 'other-board',
 * //      message: 'laststance/gitbox is already on board "Work"', boardId: 'b2', boardName: 'Work' }] }
 */
export function splitRequestedRepos<Repository extends RequestedRepository>(
  requested: Repository[],
  placements: RepoPlacements,
  currentBoardId: string,
): { addable: Repository[]; skipped: SkippedRepository[] } {
  // First card wins if legacy data holds the same repository twice
  const boardPlacementByIdentifier = new Map<RepoIdentifier, BoardPlacement>()
  for (const placement of placements.boards) {
    if (!boardPlacementByIdentifier.has(placement.identifier)) {
      boardPlacementByIdentifier.set(placement.identifier, placement)
    }
  }
  const maintenanceIdentifiers = new Set(placements.maintenance)

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

    if (maintenanceIdentifiers.has(identifier)) {
      skipped.push({
        fullName,
        reason: 'maintenance',
        message: `${fullName} is in Maintenance`,
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
 * Called by the three placing actions (add, restore, move) when the database
 * rejects a write the pre-check allowed, i.e. another tab or request placed
 * the repository in between. {@link ActionUserError} skips Sentry, so this
 * writes one structured warning (no repository names) to keep the frequency
 * of the race observable.
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

/**
 * Sentence shown by the restore and move dialogs when the unique index
 * rejected the write.
 *
 * @param owner - Repository owner login.
 * @param name - Repository name.
 * @returns The race sentence naming the repository.
 * @example
 * toDialogRaceMessage('laststance', 'gitbox')
 * // => 'laststance/gitbox was just placed on a board. Close this dialog and try again.'
 */
export function toDialogRaceMessage(owner: string, name: string): string {
  return `${owner}/${name} was just placed on a board. Close this dialog and try again.`
}
