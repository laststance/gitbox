/**
 * Rewrites a card's GitHub snapshot from a repository GitHub just returned.
 *
 * The browser sends a card id or a board id, never the metadata. Called by
 * {@link refreshCardMetadata} and {@link refreshBoardMetadata}. A card whose
 * stored GitHub id no longer matches the repository at its owner and name is
 * left alone: that name belongs to a different repository now.
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import { BOARD_OF_CARD_RELATION } from '@/lib/constants/board-bundle'
import type { RepositorySnapshotRead } from '@/lib/github/repository-snapshot'
import { readRepositorySnapshot } from '@/lib/github/repository-snapshot'
import type { RepoCardMeta } from '@/lib/models/domain'
import type { Json, Database } from '@/lib/supabase/types'
import type { GitHubRepository } from '@/lib/types/github'
import { readEveryRow } from '@/lib/utils/read-every-row'

import { ActionUserError } from './types'

/** How many cards one board refresh reads from GitHub. The next refresh continues. */
export const CARDS_PER_METADATA_REFRESH = 100

/** GitHub requests in flight during one board refresh. */
const REFRESH_CONCURRENCY = 5

/** A card the refresh can ask GitHub about. */
interface RefreshCardRow {
  id: string
  repo_owner: string
  repo_name: string
  github_repo_id: number | null
}

/** What one card's refresh did. */
type CardRefreshOutcome =
  | { kind: 'updated'; card: RefreshedCard }
  | { kind: 'failed'; reason: RefreshFailureReason }
  | { kind: 'skipped' }

/** Why a card was not given a new snapshot. A skip is tried again next time. */
export type RefreshFailureReason = 'gone' | 'unavailable' | 'name-taken'

/**
 * The snapshot written onto one card, in the shape the board stores.
 *
 * `description` is the card's own line, copied from `meta.description`, so
 * the board can show it without reading `meta` again.
 */
export interface RefreshedCard {
  id: string
  description: string
  meta: RepoCardMeta
}

/** How a board refresh ended. `remaining` cards were not asked this time. */
export interface RefreshBoardData {
  updated: RefreshedCard[]
  failed: Array<{ id: string; reason: RefreshFailureReason }>
  remaining: number
}

/** Reads one repository. Tests pass a fake; the action uses {@link readRepositorySnapshot}. */
export type ReadRepositorySnapshot = (
  owner: string,
  name: string,
) => Promise<RepositorySnapshotRead>

/**
 * Chooses the oldest cards, up to {@link CARDS_PER_METADATA_REFRESH}.
 *
 * The caller has already ordered the rows oldest first. A later refresh
 * sees the rows this one wrote at the end, because an update sets
 * `updated_at`. Called by {@link refreshBoardMetadataCore}.
 *
 * @param cards - Every card of the board, oldest first.
 * @returns The cards to read now, and how many are left.
 * @example
 * cardsForThisRefresh([card]) // => { batch: [card], remaining: 0 }
 */
export function cardsForThisRefresh<Card>(cards: readonly Card[]): {
  batch: Card[]
  remaining: number
} {
  if (cards.length <= CARDS_PER_METADATA_REFRESH) {
    return { batch: [...cards], remaining: 0 }
  }
  return {
    batch: cards.slice(0, CARDS_PER_METADATA_REFRESH),
    remaining: cards.length - CARDS_PER_METADATA_REFRESH,
  }
}

/**
 * Reads one card's repository from GitHub and writes the snapshot.
 *
 * @param supabase - Server client of the signed-in user.
 * @param userId - The signed-in user (`claims.sub`).
 * @param cardId - The card the browser asked to refresh.
 * @param read - How a repository is read. The default asks GitHub.
 * @returns The snapshot now stored on the card.
 * @throws {@link ActionUserError} when the card is missing, GitHub has no
 *   such repository, the name now belongs to a different repository, or
 *   GitHub did not answer.
 * @example
 * await refreshCardMetadataCore(supabase, claims.sub, cardId)
 */
export async function refreshCardMetadataCore(
  supabase: SupabaseClient<Database>,
  userId: string,
  cardId: string,
  read: ReadRepositorySnapshot = readRepositorySnapshot,
): Promise<RefreshedCard> {
  const card = await readOwnedCard(supabase, userId, cardId)
  const outcome = await refreshOneCard(supabase, card, read)
  if (outcome.kind === 'updated') return outcome.card
  if (outcome.kind === 'skipped') {
    throw new ActionUserError(
      'Could not read this repository from GitHub. Try again.',
    )
  }
  throw new ActionUserError(failureSentence(outcome.reason))
}

/**
 * Reads the cards of one board from GitHub and writes each snapshot.
 *
 * One request reads at most {@link CARDS_PER_METADATA_REFRESH} cards, oldest
 * first, five GitHub requests at a time. A card GitHub no longer has, or
 * whose name now belongs to a different repository, is marked checked and
 * left otherwise, so the next refresh moves on. A card GitHub did not answer
 * is left untouched, counted as unread, and comes first next time.
 *
 * @param supabase - Server client of the signed-in user.
 * @param userId - The signed-in user (`claims.sub`).
 * @param boardId - The board the browser asked to refresh.
 * @param read - How a repository is read. The default asks GitHub.
 * @returns The cards that were written, the ones that were not, and how many
 *   were left for a later refresh.
 * @throws {@link ActionUserError} when the board is not this user's.
 * @example
 * await refreshBoardMetadataCore(supabase, claims.sub, boardId)
 */
export async function refreshBoardMetadataCore(
  supabase: SupabaseClient<Database>,
  userId: string,
  boardId: string,
  read: ReadRepositorySnapshot = readRepositorySnapshot,
): Promise<RefreshBoardData> {
  const { data: board, error: boardError } = await supabase
    .from('board')
    .select('id')
    .eq('id', boardId)
    .eq('user_id', userId)
    .maybeSingle()
  if (boardError) {
    Sentry.captureException(boardError, {
      extra: { context: 'refresh board', boardId },
    })
    throw new ActionUserError('Could not read this board. Try again.')
  }
  if (!board) throw new ActionUserError('Board not found')

  const cards = await readEveryBoardCard(supabase, userId, boardId)
  const { batch, remaining } = cardsForThisRefresh(cards)
  const updated: RefreshedCard[] = []
  const failed: RefreshBoardData['failed'] = []

  await mapWithConcurrency(batch, REFRESH_CONCURRENCY, async (card) => {
    const outcome = await refreshOneCard(supabase, card, read)
    if (outcome.kind === 'updated') {
      updated.push(outcome.card)
      return
    }
    // A skip is GitHub not answering, or the write failing. Count it, or a
    // board of such cards looks empty and the toast says the refresh worked.
    failed.push({
      id: card.id,
      reason: outcome.kind === 'failed' ? outcome.reason : 'unavailable',
    })
  })

  return { updated, failed, remaining }
}

/**
 * Asks GitHub about one card and writes what came back.
 *
 * @param supabase - Server client of the signed-in user.
 * @param card - The card's stored owner, name and GitHub id.
 * @param read - How a repository is read.
 * @returns Whether the snapshot was written, the card was left for a retry,
 *   or GitHub gave a final answer that is not this card's repository.
 */
async function refreshOneCard(
  supabase: SupabaseClient<Database>,
  card: RefreshCardRow,
  read: ReadRepositorySnapshot,
): Promise<CardRefreshOutcome> {
  const readResult = await read(card.repo_owner, card.repo_name)
  if (readResult.outcome === 'unavailable') return { kind: 'skipped' }
  if (readResult.outcome === 'gone') {
    await rememberRefreshAttempt(supabase, card.id)
    return { kind: 'failed', reason: 'gone' }
  }

  // The stored id was confirmed earlier. The repository at this name is a
  // different one, so its stars and description must not replace this card's.
  if (
    typeof card.github_repo_id === 'number' &&
    card.github_repo_id !== readResult.repository.id
  ) {
    await rememberRefreshAttempt(supabase, card.id)
    return { kind: 'failed', reason: 'name-taken' }
  }

  const meta = metaFromRepository(readResult.repository)
  const { error } = await supabase
    .from('repocard')
    .update({
      meta: meta as Json,
      github_repo_id: readResult.repository.id,
    })
    .eq('id', card.id)
  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'refresh card metadata', cardId: card.id },
    })
    return { kind: 'skipped' }
  }

  return {
    kind: 'updated',
    card: {
      id: card.id,
      description: readResult.repository.description ?? '',
      meta,
    },
  }
}

/**
 * Loads one card the user owns.
 *
 * @param supabase - Server client of the signed-in user.
 * @param userId - The signed-in user (`claims.sub`).
 * @param cardId - The card the browser named.
 * @returns The card's owner, name and stored GitHub id.
 * @throws {@link ActionUserError} when the card is missing or not theirs,
 *   or when the read failed.
 */
async function readOwnedCard(
  supabase: SupabaseClient<Database>,
  userId: string,
  cardId: string,
): Promise<RefreshCardRow> {
  const { data, error } = await supabase
    .from('repocard')
    .select(
      `id, repo_owner, repo_name, github_repo_id, ${BOARD_OF_CARD_RELATION}!inner(user_id)`,
    )
    .eq('id', cardId)
    .eq('board.user_id', userId)
    .maybeSingle()
  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'refresh card', cardId },
    })
    throw new ActionUserError('Could not read this card. Try again.')
  }
  if (!data) throw new ActionUserError('Card not found')
  return data
}

/**
 * Loads every card of a board the user owns, oldest update first.
 *
 * @param supabase - Server client of the signed-in user.
 * @param userId - The signed-in user (`claims.sub`).
 * @param boardId - The board being refreshed.
 * @returns The cards, oldest first.
 * @throws {@link ActionUserError} when the read failed.
 */
async function readEveryBoardCard(
  supabase: SupabaseClient<Database>,
  userId: string,
  boardId: string,
): Promise<RefreshCardRow[]> {
  try {
    return await readEveryRow((from, to) =>
      supabase
        .from('repocard')
        .select(
          `id, repo_owner, repo_name, github_repo_id, updated_at, ${BOARD_OF_CARD_RELATION}!inner(user_id)`,
        )
        .eq('board_id', boardId)
        .eq('board.user_id', userId)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'refresh board cards', boardId },
    })
    throw new ActionUserError('Could not read this board. Try again.')
  }
}

/**
 * Marks a card as checked without changing its snapshot.
 *
 * An update sets `updated_at`, so a board refresh that could not use this
 * card does not pick it first again. The snapshot and the stored GitHub id
 * stay. A failed write is reported and the card is still counted as failed:
 * the next refresh will try it once more.
 *
 * @param supabase - Server client of the signed-in user.
 * @param cardId - The card GitHub gave a final answer for.
 */
async function rememberRefreshAttempt(
  supabase: SupabaseClient<Database>,
  cardId: string,
): Promise<void> {
  const { error } = await supabase
    .from('repocard')
    .update({ github_identity_checked_at: new Date().toISOString() })
    .eq('id', cardId)
  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'remember repository refresh', cardId },
    })
  }
}

/**
 * Copies the fields a card stores from the repository GitHub returned.
 *
 * The owner and the name are not copied. They are the key of the repository's
 * note, and a rename keeps that note on the name the card already has. The
 * id is what a later add uses to tell the renamed repository from a new one.
 *
 * @param repository - The repository GitHub just returned.
 * @returns The `meta` object to store, including `githubId`.
 */
function metaFromRepository(repository: GitHubRepository): RepoCardMeta {
  return {
    stars: repository.stargazers_count,
    topics: repository.topics,
    visibility: repository.visibility,
    updatedAt: repository.updated_at,
    githubId: repository.id,
    // A missing language or description is left off, so the stored object
    // replaces the previous one instead of keeping the old text
    ...(typeof repository.language === 'string'
      ? { language: repository.language }
      : {}),
    ...(typeof repository.description === 'string'
      ? { description: repository.description }
      : {}),
  }
}

/**
 * The sentence for a refresh that will not succeed on a retry.
 *
 * @param reason - Why the card was left as it is.
 * @returns The sentence {@link ActionUserError} carries to the toast.
 */
function failureSentence(reason: RefreshFailureReason): string {
  if (reason === 'gone') return 'GitHub no longer has this repository.'
  if (reason === 'name-taken') {
    return 'This name now belongs to a different repository, so the card was left as it is.'
  }
  return 'Could not read this repository from GitHub. Try again.'
}

/**
 * Runs `task` over `items` with at most `concurrency` tasks in flight.
 *
 * @param items - Work items, in order.
 * @param concurrency - How many tasks may run at once.
 * @param task - What to do with one item.
 */
async function mapWithConcurrency<Item>(
  items: readonly Item[],
  concurrency: number,
  task: (item: Item) => Promise<void>,
): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index]
      if (item === undefined) return
      await task(item)
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => worker(),
  )
  await Promise.all(workers)
}
