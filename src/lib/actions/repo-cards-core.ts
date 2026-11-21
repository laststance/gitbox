/**
 * RepoCard add-to-board core logic
 *
 * The write half of {@link addRepositoriesToBoard} with the client, the user
 * and the GitHub token injected instead of read from the request: the server
 * action calls it with the signed-in user's cookie context, and the MCP
 * endpoint (`src/app/api/mcp/route.ts`) calls it with the service-role client
 * and `GITBOX_MCP_*` credentials. Steps are identical either way — board
 * ownership check, payload validation, placement split, GitHub identity
 * confirmation, rename release, order computation, batch insert.
 *
 * NOT a 'use server' module — it is imported by `repo-cards.ts`, which is.
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

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
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'
import {
  addRepositoriesRequestSchema,
  type AddRepositoriesInput,
} from '@/lib/validations/repo-card'

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
import { ActionUserError } from './types'

const log = createModuleLogger('repo-cards-core')

/**
 * Moves a card off a name that now belongs to a different repository.
 *
 * The card was confirmed under its own GitHub id and still spells the old
 * name. Called by {@link addRepositoriesToBoardCore} before the insert, so the
 * unique owner/name index does not reject the repository that has the name now.
 *
 * @param supabase - Authenticated client.
 * @param userId - The signed-in user.
 * @param repositories - Repositories GitHub just confirmed and the board does not hold.
 * @param placements - Every card the user already has.
 * @param githubToken - Bearer to send GitHub instead of the cookie token, when set.
 * @example
 * await releaseNamesHeldByAnotherRepository(supabase, claims.sub, newRepos, placements)
 */
async function releaseNamesHeldByAnotherRepository(
  supabase: SupabaseClient<Database>,
  userId: string,
  repositories: Array<{
    id?: number
    name: string
    owner: { login: string }
  }>,
  placements: BoardPlacement[],
  githubToken?: string,
): Promise<void> {
  for (const repository of repositories) {
    // Only a GitHub-confirmed id can prove this repository owns the name now
    if (typeof repository.id !== 'number') continue
    const repositoryId = repository.id
    const identifier = toRepoIdentifier(repository.owner.login, repository.name)
    const held = placements.find(
      (placement) =>
        placement.identifier === identifier &&
        typeof placement.githubRepoId === 'number' &&
        placement.githubRepoId !== repositoryId,
    )
    if (!held || typeof held.githubRepoId !== 'number') continue

    // The cookie path keeps the historic one-argument call: an explicit
    // trailing `undefined` does not match `toHaveBeenCalledWith(99)` in
    // the placement tests.
    const current = githubToken
      ? await lookupRepositoryByGitHubId(held.githubRepoId, githubToken)
      : await lookupRepositoryByGitHubId(held.githubRepoId)
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

    // The memory row moves first: a failed memory update leaves the card
    // name old, so a retry still finds the name held and can complete both.
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
  }
}

/**
 * Server-authored card data returned from {@link addRepositoriesToBoardCore}.
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
 *   comment: { comment: 'v2 soon', color: 'blue' },
 * }
 * // `comment` is not a field of the card in Redux. The board page puts it
 * // in the comment map and leaves it off the card:
 * // `({ comment: _comment, ...card })`, then `setRestoredComments`.
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
 * The id of the board's first column, the one the picker drops a card into.
 *
 * `statusLists[0]?.id` of the board page is the column the (grid_row,
 * grid_col) sort puts first — a dragged column moves in the grid and keeps
 * its `order`, so the grid is the order to read
 * (`useAddRepositoryCombobox.ts`: `resumedStatusId ?? statusLists[0]?.id`).
 * Called by {@link addRepositoriesToBoardCore} only when the caller sent no
 * column: the board page always sends one, so this adds no query to the UI.
 *
 * @param supabase - Authenticated client.
 * @param boardId - Board whose first column is wanted.
 * @returns The column id.
 * @throws `Error` when the column read itself fails;
 *   {@link ActionUserError} "This board has no column" — a board without
 *   columns cannot hold a card.
 */
async function readFirstColumnOfBoard(
  supabase: SupabaseClient<Database>,
  boardId: string,
): Promise<string> {
  const { data: column, error } = await supabase
    .from('statuslist')
    .select('id')
    .eq('board_id', boardId)
    .order('grid_row', { ascending: true })
    .order('grid_col', { ascending: true })
    .limit(1)
    .maybeSingle()

  // A failed read is not an empty board — throwing here keeps the
  // "no column" sentence for a successful read that found nothing.
  if (error) {
    throw new Error('Failed to read the board columns')
  }
  if (!column) {
    throw new ActionUserError('This board has no column')
  }
  return column.id
}

/**
 * Confirms a caller-chosen column belongs to the board, then returns it.
 *
 * Called by {@link addRepositoriesToBoardCore} only when `statusId` was
 * sent: the MCP `add_repository_to_board` tool takes any column id, and an
 * id of another board's column would land the card out of sight — the
 * `status_id` foreign key accepts it. Checked right where the default would
 * be read, so the mismatch is refused before the rename release, the column
 * order read or the insert.
 *
 * @param supabase - Authenticated client.
 * @param boardId - Board the column must belong to.
 * @param statusId - The caller-chosen column id.
 * @returns The column id.
 * @throws `Error` when the column read itself fails;
 *   {@link ActionUserError} "That column is not on this board" — a column
 *   of another board, or no column with that id at all.
 * @example
 * const statusId = await readColumnOnBoard(supabase, boardId, params.statusId)
 */
async function readColumnOnBoard(
  supabase: SupabaseClient<Database>,
  boardId: string,
  statusId: string,
): Promise<string> {
  const { data: column, error } = await supabase
    .from('statuslist')
    .select('id')
    .eq('id', statusId)
    .eq('board_id', boardId)
    .maybeSingle()

  // A failed read is not a mismatch — the "not on this board" sentence is
  // for a successful read that found nothing.
  if (error) {
    throw new Error('Failed to read the board columns')
  }
  if (!column) {
    throw new ActionUserError('That column is not on this board')
  }
  return column.id
}

/**
 * Add repositories to a board, with the client, user and GitHub token injected.
 *
 * {@link addRepositoriesToBoard} wraps this in the auth guard + rate limit and
 * passes the cookie-bound context; the MCP route passes the service-role
 * client, `GITBOX_MCP_OWNER_ID` and `GITBOX_MCP_GITHUB_TOKEN`. The work is the
 * same: reject malformed payloads, check the board is the user's, backfill
 * unconfirmed ids, ask GitHub who each repository is, skip the ones already
 * placed, free names held by renamed repositories, then append the cards at
 * the end of the column. `meta` and `github_repo_id` are built from GitHub's
 * own answer, never from what the caller claimed.
 *
 * @param params.supabase - Client already scoped to the caller (session or
 *   service role). Ownership is re-checked here either way.
 * @param params.userId - The user the board must belong to (`claims.sub`, or
 *   `GITBOX_MCP_OWNER_ID` for the MCP route).
 * @param params.githubToken - Bearer for GitHub verification calls. When
 *   absent the cookie token path runs (UI + E2E mock token).
 * @param params.boardId - Target board id.
 * @param params.repos - Repositories to add; Zod-validated again inside.
 * @param params.statusId - Target column. Defaults to the board's first
 *   column by (grid_row, grid_col), mirroring the picker. An explicit
 *   column must belong to the board — a mismatch refuses the add.
 * @param params.maxBackfillMs - Optional budget for the unconfirmed-id
 *   backfill: past it, no new GitHub fetch is dispatched (the skipped cards
 *   sort first next call). Unset means unbounded — the UI path; the MCP
 *   route passes ~20s so the call fits its `maxDuration`.
 * @returns `{ addedCount, cards, skipped }` — repositories already placed are
 *   not an error; each comes back in `skipped` with its sentence.
 * @throws {@link ActionUserError} for refusals the caller may show (GitHub
 *   could not confirm, add race, board without columns); plain `Error`
 *   otherwise.
 * @example
 * const result = await addRepositoriesToBoardCore({
 *   supabase, userId: claims.sub, boardId, statusId, repos,
 * })
 */
export async function addRepositoriesToBoardCore(params: {
  supabase: SupabaseClient<Database>
  userId: string
  githubToken?: string
  boardId: string
  repos: AddRepositoriesInput
  statusId?: string
  maxBackfillMs?: number
}): Promise<{
  addedCount: number
  cards: CreatedRepoCard[]
  skipped: SkippedRepository[]
}> {
  const { supabase, userId, githubToken, boardId, repos } = params

  // Reject a malformed identity or display payload before any query.
  // Owner and name are echoed in messages. Description, stars, topics
  // and the rest of `meta` are rendered as text, so the insert below
  // copies the parsed value, never the object the caller sent.
  const parsedRequest = addRepositoriesRequestSchema.safeParse(repos)
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

  // The board and the cards this user already has do not need each
  // other's answers, so they go out together. The placement read waits
  // for the backfill: a rename confirmed in this request has to be
  // visible to the split below. A backfill failure only leaves those ids
  // null; the insert still refuses an id GitHub did not just confirm.
  // The column's last order is read later, after GitHub confirmation, so
  // two adds do not share a maximum taken before either of them inserts.
  const boardQuery = supabase
    .from('board')
    .select('id, user_id')
    .eq('id', boardId)
    .eq('user_id', userId)
    .single()
  const placementsQuery = (async (): Promise<BoardPlacement[]> => {
    try {
      await backfillVerifiedRepositoryIds(
        supabase,
        userId,
        githubToken,
        params.maxBackfillMs,
      )
    } catch (error) {
      Sentry.captureException(error, {
        tags: { action: 'backfillVerifiedRepositoryIds' },
      })
    }
    // Throws on lookup failure: never insert without it.
    return lookupRepoPlacements(supabase, userId)
  })()

  const [boardResult, placements] = await Promise.all([
    boardQuery,
    placementsQuery,
  ])
  const { data: board, error: boardError } = boardResult
  if (boardError || !board) {
    throw new Error('Board not found')
  }

  // Without a column the card lands in the board's first one, the way the
  // picker drops it. A caller-chosen column must belong to this board —
  // the MCP tool takes any statusId string, and another board's column
  // would put the card out of sight — so it is verified before the
  // release, the order read and the insert.
  const statusId = params.statusId
    ? await readColumnOnBoard(supabase, boardId, params.statusId)
    : await readFirstColumnOfBoard(supabase, boardId)

  // The id on the request is whatever the caller sent, so the first
  // split uses the name only. A card that already has a confirmed id is
  // left out of that split: the name may have been taken by another
  // repository, and only GitHub can tell. Cards with no id yet still
  // match by name, and are not sent to GitHub.
  const { addable: namedAddable, skipped: namedSkipped } = splitRequestedRepos(
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
    githubToken,
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
    // Identity and display fields come from GitHub's own answer — the id,
    // the name it currently has, and the `meta` snapshot the card shows.
    confirmed.push({
      ...repository,
      id: verified.id,
      name: verified.name,
      owner: { login: verified.owner },
      stargazers_count: verified.stargazers_count,
      language: verified.language,
      topics: verified.topics,
      description: verified.description,
      visibility: verified.visibility,
      updated_at: verified.updated_at,
    })
  }

  const { addable: newRepos, skipped: confirmedSkipped } = splitRequestedRepos(
    confirmed,
    placements,
    boardId,
  )
  const skipped = [...namedSkipped, ...confirmedSkipped]

  // Everything is already placed: not an error, the caller explains why
  if (newRepos.length === 0) {
    return { addedCount: 0, cards: [], skipped }
  }

  // A confirmed card may still spell this name. Move it to the name
  // GitHub gives its id, then the insert can take the name.
  await releaseNamesHeldByAnotherRepository(
    supabase,
    userId,
    newRepos,
    placements,
    githubToken,
  )

  // Read after confirmation, not with the board: an earlier maximum would
  // be shared by two adds that both pass GitHub before either inserts.
  // `.maybeSingle()`: an empty column is no error — the first card is
  // order 0. A failed read must not silently restart the orders at 0.
  const { data: maxOrderData, error: maxOrderError } = await supabase
    .from('repocard')
    .select('order')
    .eq('status_id', statusId)
    .order('order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxOrderError) {
    throw new Error('Failed to read the column order')
  }
  let nextOrder = (maxOrderData?.order ?? -1) + 1

  // Add new cards
  const cardsToInsert = newRepos.map((repo) => ({
    board_id: boardId,
    status_id: statusId,
    repo_owner: repo.owner.login,
    repo_name: repo.name,
    // `id` is the one GitHub just confirmed (schema types it optional)
    github_repo_id: repo.id ?? null,
    order: nextOrder++,
    meta: {
      stars: repo.stargazers_count,
      language: repo.language,
      topics: repo.topics ?? [],
      visibility: repo.visibility,
      description: repo.description,
      updatedAt: repo.updated_at,
      // The id GitHub just confirmed for this owner and name, not the
      // number the caller sent
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
        userId,
      })
    }

    log.error({ error: insertError }, 'RepoCard insert error')
    Sentry.captureException(insertError, {
      extra: { context: 'RepoCard insert', boardId },
    })
    throw new Error('Failed to add cards: ' + insertError.message)
  }

  // Transform database response to CreatedRepoCard format
  const createdCards: CreatedRepoCard[] = (insertedCards || []).map((card) => ({
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
  }))

  return {
    addedCount: createdCards.length,
    cards: createdCards,
    skipped,
  }
}
