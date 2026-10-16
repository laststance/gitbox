/**
 * RepoCard Actions
 *
 * Execute RepoCard (GitHub Repository Card) CRUD operations with server actions
 * - Add repository to board
 * - Check duplicates
 * - Update quick note
 * - Delete card
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  withAuthResult,
  withAuthResultRateLimit,
} from '@/lib/actions/auth-guard'
import type { GitHubRepository } from '@/lib/actions/github'
import { MOVE_UNCONFIRMED_MESSAGE } from '@/lib/constants/card-move'
import {
  backfillVerifiedRepositoryIds,
  lookupRepositoryByGitHubId,
  verifyRepositoryIdentities,
} from '@/lib/github/verify-repository-identity'
import { createModuleLogger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'
import {
  toBoardId,
  toRepoCardId,
  toStatusListId,
  type BoardId,
  type RepoCardId,
  type StatusListId,
} from '@/lib/types/brands'
import type { ISOTimestamp, Visibility } from '@/lib/types/domain-primitives'
import { didDatabaseRefuse } from '@/lib/utils/did-database-refuse'
import { readEveryRow } from '@/lib/utils/read-every-row'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'
import { addRepositoriesRequestSchema } from '@/lib/validations/repo-card'

import {
  PROJECT_COMMENT_EMBED,
  REPO_CARD_COLUMNS,
  toCommentData,
} from './mappers'
import type { CommentData } from './project-info-core'
import {
  ADD_RACE_MESSAGE,
  isUniqueViolation,
  lookupRepoPlacements,
  splitRequestedRepos,
  toUniqueViolationError,
  type BoardPlacement,
  type SkippedRepository,
} from './repo-card-duplicates'
import { ActionUserError, type ActionResult, type BoardOption } from './types'

const log = createModuleLogger('repo-cards')

/**
 * Moves a card off a name that now belongs to a different repository.
 *
 * The card was confirmed under its own GitHub id and still spells the old
 * name. Called by {@link addRepositoriesToBoard} before the insert, so the
 * unique owner/name index does not reject the repository that has the name now.
 *
 * @param supabase - Authenticated client.
 * @param userId - The signed-in user.
 * @param repositories - Repositories GitHub just confirmed and the board does not hold.
 * @param placements - Every card the user already has.
 * @example
 * await releaseNamesHeldByAnotherRepository(supabase, claims.sub, newRepos, placements)
 */
async function releaseNamesHeldByAnotherRepository(
  supabase: SupabaseClient<Database>,
  userId: string,
  repositories: Array<{
    id: number
    name: string
    owner: { login: string }
  }>,
  placements: BoardPlacement[],
): Promise<void> {
  for (const repository of repositories) {
    const identifier = toRepoIdentifier(repository.owner.login, repository.name)
    const held = placements.find(
      (placement) =>
        placement.identifier === identifier &&
        typeof placement.githubRepoId === 'number' &&
        placement.githubRepoId !== repository.id,
    )
    if (!held || typeof held.githubRepoId !== 'number') continue

    const current = await lookupRepositoryByGitHubId(held.githubRepoId)
    if (current.outcome !== 'confirmed') {
      throw new ActionUserError(
        'Could not confirm the repository with GitHub. Try again.',
      )
    }
    const currentIdentifier = toRepoIdentifier(
      current.repository.owner,
      current.repository.name,
    )
    // GitHub still gives this name to the card's id, so it is not free
    if (currentIdentifier === identifier) {
      throw new ActionUserError(
        'Could not confirm the repository with GitHub. Try again.',
      )
    }

    const { error: cardError } = await supabase
      .from('repocard')
      .update({
        repo_owner: current.repository.owner,
        repo_name: current.repository.name,
      })
      .eq('id', held.cardId)
    if (cardError) {
      throw new Error('Failed to update the repository name')
    }

    const { error: memoryError } = await supabase
      .from('projectinfo')
      .update({
        repo_owner: current.repository.owner,
        repo_name: current.repository.name,
      })
      .eq('user_id', userId)
      .eq('github_repo_id', held.githubRepoId)
    if (memoryError && memoryError.code !== '23505') {
      throw new Error('Failed to update the repository name')
    }
  }
}

/**
 * Server-authored card data returned from {@link addRepositoriesToBoard}.
 * Shaped for direct consumption by Redux optimistic updates (see
 * `BoardPageClient`'s `onRepositoriesAdded`), which maps these into
 * `RepoCardForRedux` items.
 *
 * @example
 * {
 *   id: 'uuid' as RepoCardId,
 *   boardId: 'uuid' as BoardId,
 *   statusId: 'uuid' as StatusListId,
 *   repoOwner: 'laststance',
 *   repoName: 'gitbox',
 *   order: 0,
 *   meta: { stars: 42, language: 'TypeScript', visibility: 'public' },
 *   createdAt: '2026-04-21T12:00:00Z',
 *   updatedAt: '2026-04-21T12:00:00Z',
 * }
 */
export interface CreatedRepoCard {
  /** Newly-inserted {@link RepoCardId}. */
  id: RepoCardId
  /** Parent {@link BoardId}. */
  boardId: BoardId
  /** Initial column (`statuslist.id`) the card lives in. */
  statusId: StatusListId
  /** GitHub repository owner login. */
  repoOwner: string
  /** GitHub repository name. */
  repoName: string
  /** Display order within the column (0-indexed). */
  order: number
  /** Snapshot of GitHub metadata (subset of `RepoCardMeta`). */
  meta: {
    stars?: number
    language?: string | null
    topics?: string[]
    visibility?: Visibility
    description?: string | null
    updatedAt?: ISOTimestamp
    githubId?: number
  }
  /** Creation timestamp (ISO-8601 UTC). */
  createdAt: ISOTimestamp
  /** Last update timestamp (ISO-8601 UTC). */
  updatedAt: ISOTimestamp
  /**
   * Comment the repository kept from an earlier card (issue #216): the board
   * shows it on the new card right away. Empty text and the default color
   * when nothing is saved.
   */
  comment: CommentData
}

/**
 * Add multiple repositories to board
 *
 * A repository can sit on at most one of the user's boards (Issue #215).
 * Repositories that are already placed are not an error: they come back in
 * `skipped`, each with the sentence to show. Called by the Add Repositories
 * picker.
 *
 * @param boardId - Target board ID
 * @param statusId - Initial status (column) ID
 * @param repositories - List of GitHub repositories to add
 * @returns
 * - Some or all added: `{ success: true, data: { addedCount, cards, skipped } }`
 * - Every repository already placed: `{ success: true, data: { addedCount: 0, cards: [], skipped } }`
 * - Lost a race with another tab: `{ success: false, error: ADD_RACE_MESSAGE }` (nothing added)
 * - More than `MAX_REPOSITORIES_PER_ADD` repositories: `{ success: false, error: TOO_MANY_REPOSITORIES_MESSAGE }`
 * - Anything else: `{ success: false, error: 'An unexpected error occurred' }`
 * @example
 * const result = await addRepositoriesToBoard(boardId, statusId, repos)
 * if (result.success) {
 *   dispatch(addRepoCards(result.data.cards)) // Optimistic update
 *   result.data.skipped // => [{ fullName: 'a/b', reason: 'other-board', message: 'a/b is already on board "Work"', ... }]
 * }
 */
export async function addRepositoriesToBoard(
  boardId: string,
  statusId: string,
  repositories: GitHubRepository[],
): Promise<
  ActionResult<{
    addedCount: number
    cards: CreatedRepoCard[]
    skipped: SkippedRepository[]
  }>
> {
  return withAuthResultRateLimit(
    'addReposToBoard',
    async (supabase, claims) => {
      // Reject a malformed identity or display payload before any query.
      // Owner and name are echoed in messages. Description, stars, topics
      // and the rest of `meta` are rendered as text, so the insert below
      // copies the parsed value, never the object the browser sent.
      const parsedRequest = addRepositoriesRequestSchema.safeParse(repositories)
      if (!parsedRequest.success) {
        // The picker has no selection cap, so an oversized batch is a user
        // mistake worth explaining (the schema carries the sentence);
        // anything else is a malformed request
        const tooManyRepositoriesIssue = parsedRequest.error.issues.find(
          (issue) => issue.code === 'too_big' && issue.path.length === 0,
        )
        throw tooManyRepositoriesIssue
          ? new ActionUserError(tooManyRepositoriesIssue.message)
          : new Error('Invalid repositories payload')
      }
      const requested = parsedRequest.data

      // Check if board exists and user owns it
      const { data: board, error: boardError } = await supabase
        .from('board')
        .select('id, user_id')
        .eq('id', boardId)
        .eq('user_id', claims.sub)
        .single()

      if (boardError || !board) {
        throw new Error('Board not found')
      }

      // Confirm ids that were saved before the column existed, so a renamed
      // repository matches the card it already has. A failure here only
      // leaves those ids null; the insert below still refuses an id GitHub
      // did not just confirm.
      try {
        await backfillVerifiedRepositoryIds(supabase, claims.sub)
      } catch (error) {
        Sentry.captureException(error, {
          tags: { action: 'backfillVerifiedRepositoryIds' },
        })
      }

      // Where every repository of this user already lives (all boards).
      // Throws on lookup failure: never insert without it.
      const placements = await lookupRepoPlacements(supabase, claims.sub)

      // The id on the request is whatever the browser sent, so the first
      // split uses the name only. A card that already has a confirmed id is
      // left out of that split: the name may have been taken by another
      // repository, and only GitHub can tell. Cards with no id yet still
      // match by name, and are not sent to GitHub.
      const { addable: namedAddable, skipped: namedSkipped } =
        splitRequestedRepos(
          requested.map((repository) => ({ ...repository, id: undefined })),
          placements.filter(
            (placement) => typeof placement.githubRepoId !== 'number',
          ),
          boardId,
        )

      if (namedAddable.length === 0) {
        return { addedCount: 0, cards: [], skipped: namedSkipped }
      }

      // Ask GitHub, five at a time, and compare and store only that answer.
      const confirmations = await verifyRepositoryIdentities(
        namedAddable.map((repository) => ({
          owner: repository.owner.login,
          name: repository.name,
        })),
      )
      const confirmed: typeof requested = []
      for (const [index, repository] of namedAddable.entries()) {
        const confirmation = confirmations[index]
        if (!confirmation || confirmation.outcome !== 'confirmed') {
          throw new ActionUserError(
            'Could not confirm the repository with GitHub. Try again.',
          )
        }
        const verified = confirmation.repository
        // Identity comes from GitHub. Display fields stay the parsed ones.
        confirmed.push({
          ...repository,
          id: verified.id,
          name: verified.name,
          owner: { login: verified.owner },
        })
      }

      const { addable: newRepos, skipped: confirmedSkipped } =
        splitRequestedRepos(confirmed, placements, boardId)
      const skipped = [...namedSkipped, ...confirmedSkipped]

      // Everything is already placed: not an error, the picker explains why
      if (newRepos.length === 0) {
        return { addedCount: 0, cards: [], skipped }
      }

      // A confirmed card may still spell this name. Move it to the name
      // GitHub gives its id, then the insert can take the name.
      await releaseNamesHeldByAnotherRepository(
        supabase,
        claims.sub,
        newRepos,
        placements,
      )

      // Get current maximum order value
      const { data: maxOrderData } = await supabase
        .from('repocard')
        .select('order')
        .eq('status_id', statusId)
        .order('order', { ascending: false })
        .limit(1)
        .single()

      let nextOrder = (maxOrderData?.order ?? -1) + 1

      // Add new cards
      const cardsToInsert = newRepos.map((repo) => ({
        board_id: boardId,
        status_id: statusId,
        repo_owner: repo.owner.login,
        repo_name: repo.name,
        github_repo_id: repo.id,
        order: nextOrder++,
        meta: {
          stars: repo.stargazers_count,
          language: repo.language,
          topics: repo.topics ?? [],
          visibility: repo.visibility,
          description: repo.description,
          updatedAt: repo.updated_at,
          // The id GitHub just confirmed for this owner and name, not the
          // number the browser sent
          githubId: repo.id,
        },
      }))

      // The note, links and comment of a repository outlive its cards
      // (issue #216): the insert's own response carries the comment the
      // repository kept, read through the computed relationship
      const { data: insertedCards, error: insertError } = await supabase
        .from('repocard')
        .insert(cardsToInsert)
        .select(`${REPO_CARD_COLUMNS}, ${PROJECT_COMMENT_EMBED}`)

      if (insertError) {
        // Another tab placed one of these repositories after the lookup. The
        // batch insert is atomic, so nothing was added.
        if (isUniqueViolation(insertError)) {
          throw toUniqueViolationError({
            error: insertError,
            raceMessage: ADD_RACE_MESSAGE,
            action: 'addRepositoriesToBoard',
            userId: claims.sub,
          })
        }

        log.error({ error: insertError }, 'RepoCard insert error')
        Sentry.captureException(insertError, {
          extra: { context: 'RepoCard insert', boardId },
        })
        throw new Error('Failed to add cards: ' + insertError.message)
      }

      // Transform database response to CreatedRepoCard format
      const createdCards: CreatedRepoCard[] = (insertedCards || []).map(
        (card) => ({
          id: toRepoCardId(card.id),
          boardId: toBoardId(card.board_id),
          statusId: toStatusListId(card.status_id),
          repoOwner: card.repo_owner,
          repoName: card.repo_name,
          order: card.order,
          meta: card.meta as CreatedRepoCard['meta'],
          createdAt: card.created_at ?? new Date().toISOString(),
          updatedAt: card.updated_at ?? new Date().toISOString(),
          comment: toCommentData(card.projectinfo),
        }),
      )

      return {
        addedCount: createdCards.length,
        cards: createdCards,
        skipped,
      }
    },
  )
}

/**
 * Delete RepoCard
 *
 * @param cardId - Card ID
 * @returns Deletion success flag
 */
export async function deleteRepoCard(
  cardId: string,
): Promise<ActionResult<void>> {
  return withAuthResultRateLimit('boardCrud', async (supabase) => {
    // Delete card (ownership check is done automatically by RLS policy)
    const { error: deleteError } = await supabase
      .from('repocard')
      .delete()
      .eq('id', cardId)

    if (deleteError) {
      log.error({ error: deleteError }, 'Delete card error')
      Sentry.captureException(deleteError, {
        extra: { context: 'Delete card', cardId },
      })
      throw new Error('Failed to delete card')
    }
  })
}

/**
 * Get all boards for the current user with their status lists
 *
 * Used by {@link MoveToAnotherBoardDialog}, through {@link useMoveDestinations},
 * to show the boards a card can be moved to and their columns.
 *
 * @returns
 * - On success: `{ success: true, data: BoardOption[] }`, every board of the
 *   user, newest first, with its columns in the order the board page shows
 *   them (grid row, then grid column). Newest first on purpose: the dialog
 *   opens on the first board that is not shared when no move was made from
 *   this board yet, and the board made last is the likeliest destination.
 *   `isPublic` says whether the board is shared through a public link, so
 *   the dialog can say that a card moved there becomes readable through it.
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 *
 * @example
 * const result = await getUserBoardsWithStatusLists()
 * if (result.success) {
 *   result.data.forEach(board => {
 *     console.log(board.name, board.statusLists.length, 'columns')
 *   })
 * }
 */
export async function getUserBoardsWithStatusLists(): Promise<
  ActionResult<BoardOption[]>
> {
  return withAuthResult(async (supabase, claims) => {
    const boards = await readEveryRow((from, to) =>
      supabase
        .from('board')
        .select('id, name, is_public')
        .eq('user_id', claims.sub)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    )

    if (boards.length === 0) {
      return []
    }

    // Columns of every board, in the order the board page shows them.
    // Dragging a column changes grid_row and grid_col and leaves "order"
    // as it was at creation, so "order" would list them differently.
    // `id` is the tiebreak so a later page does not repeat a column.
    const boardIds = boards.map((b) => b.id)
    const statusLists = await readEveryRow((from, to) =>
      supabase
        .from('statuslist')
        .select('id, name, color, board_id')
        .in('board_id', boardIds)
        .order('grid_row', { ascending: true })
        .order('grid_col', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )

    // Group status lists by board
    const statusListsByBoard = new Map<string, BoardOption['statusLists']>()
    for (const sl of statusLists) {
      const existing = statusListsByBoard.get(sl.board_id) || []
      existing.push({ id: sl.id, name: sl.name, color: sl.color ?? '#6B7280' })
      statusListsByBoard.set(sl.board_id, existing)
    }

    // Build result
    return boards.map((board) => ({
      id: board.id,
      name: board.name,
      isPublic: board.is_public,
      statusLists: statusListsByBoard.get(board.id) || [],
    }))
  })
}

/**
 * Move a RepoCard to another board
 *
 * Transfers a repository card from the current board to a different board.
 * The note, links and comment stay with the repository (issue #216), so they
 * are on the card at its new place as they were.
 *
 * Sending the same move again is harmless: a card that is already on the
 * target board is put at the end of the chosen column once more. A move whose
 * answer was lost on the way can therefore simply be repeated.
 *
 * @param cardId - RepoCard ID to move
 * @param targetBoardId - Destination board ID
 * @param targetStatusId - Destination status column ID
 * @returns
 * - On success: `{ success: true }`
 * - On a malformed id: `{ success: false, error: 'Invalid ID format' }`
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - When the database gave no answer to the move itself, so the card may
 *   have moved: `{ success: false, error: MOVE_UNCONFIRMED_MESSAGE,
 *   errorCode: 'MOVE_UNCONFIRMED' }`
 * - On anything else (card or board not found, not the owner, column of
 *   another board, a move the database refused):
 *   `{ success: false, error: 'An unexpected error occurred' }`
 *
 * @example
 * const result = await moveCardToBoard('card-uuid', 'board-uuid', 'status-uuid')
 * if (result.success) {
 *   // Leaves the store only while it still holds the board the card came from
 *   dispatch(removeMovedRepoCard(sourceBoardId, 'card-uuid'))
 * }
 */
export async function moveCardToBoard(
  cardId: string,
  targetBoardId: string,
  targetStatusId: string,
): Promise<ActionResult<void>> {
  // Step 0: Validate UUID format
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (
    !UUID_RE.test(cardId) ||
    !UUID_RE.test(targetBoardId) ||
    !UUID_RE.test(targetStatusId)
  ) {
    return { success: false, error: 'Invalid ID format' }
  }

  return withAuthResultRateLimit('boardCrud', async (supabase, claims) => {
    // Fetch card with board ownership check
    const { data: card, error: cardError } = await supabase
      .from('repocard')
      .select('*, board:board_id(user_id)')
      .eq('id', cardId)
      .single()

    if (cardError || !card) {
      throw new Error('Card not found')
    }

    // Verify ownership via board's user_id
    const boardData = card.board as { user_id: string } | null
    if (!boardData || boardData.user_id !== claims.sub) {
      throw new Error('Unauthorized')
    }

    // Verify target board exists and user owns it
    const { data: targetBoard, error: targetBoardError } = await supabase
      .from('board')
      .select('id')
      .eq('id', targetBoardId)
      .eq('user_id', claims.sub)
      .single()

    if (targetBoardError || !targetBoard) {
      throw new Error('Target board not found')
    }

    // Verify target status belongs to target board
    const { data: targetStatus, error: targetStatusError } = await supabase
      .from('statuslist')
      .select('id')
      .eq('id', targetStatusId)
      .eq('board_id', targetBoardId)
      .single()

    if (targetStatusError || !targetStatus) {
      throw new Error('Status column does not belong to target board')
    }

    // No look into the target board for the same repository, and no answer
    // of its own for a unique violation: a user has one card per repository
    // (repocard_unique_repo_per_user) and the card stays with its owner, so
    // the only card of this repository the target board can hold is this one,
    // already moved by a request whose answer was lost. The function below
    // moves it again without harm.

    // Atomic move via RPC (calculates next order position)
    const failure = await supabase
      .rpc('move_card_to_board', {
        p_card_id: cardId,
        p_target_board_id: targetBoardId,
        p_target_status_id: targetStatusId,
      })
      .then(
        ({ error }) =>
          error && { cause: error, isRefusal: didDatabaseRefuse(error) },
        // The client answers with an error and does not throw. If something
        // throws all the same, the request may be on its way.
        (thrown: unknown) => ({ cause: thrown, isRefusal: false }),
      )

    if (failure) {
      log.error({ error: failure.cause }, 'move_card_to_board RPC error')
      Sentry.captureException(failure.cause, {
        extra: { context: 'move_card_to_board RPC', cardId, targetBoardId },
      })
      // The function moves the card in one transaction. Only a code of the
      // database proves that it did not: without one the card may have moved.
      if (!failure.isRefusal) {
        throw new ActionUserError(MOVE_UNCONFIRMED_MESSAGE, 'MOVE_UNCONFIRMED')
      }
      throw new Error('Failed to move card')
    }
  })
}
