/**
 * Confirms a repository's identity with the GitHub API.
 *
 * `meta.githubId` is whatever the browser sent. The number stored in
 * `github_repo_id`, and the number the unique index uses, has to be the id
 * GitHub itself returned for that owner and name. Called by
 * {@link addRepositoriesToBoard} before an insert and by
 * {@link getUserRepoPlacements} to fill cards that were saved before the
 * column existed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isAxiosError } from 'axios'

import { createGitHubAxios, getGitHubToken } from '@/lib/axios-github'
import type { Database } from '@/lib/supabase/types'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'

/** How many unconfirmed cards one picker opening confirms. The next opening continues. */
const BACKFILL_BATCH_SIZE = 25

/** GitHub requests in flight during one batch. */
const BACKFILL_CONCURRENCY = 5

/** A repository GitHub says is gone is tried again after this long, so it does not block the batch. */
const BACKFILL_RETRY_MS = 24 * 60 * 60 * 1000

/** Statuses that mean this owner/name is not a repository GitHub will confirm. */
const GONE_STATUS = new Set([404, 451])

/** What GitHub says a repository is, ignoring anything the browser claimed. */
export interface VerifiedRepository {
  /** GitHub's numeric repository id. */
  id: number
  /** Owner login GitHub returned, which follows a rename or a transfer. */
  owner: string
  /** Repository name GitHub returned. */
  name: string
}

interface GitHubRepositoryResponse {
  id: number
  name: string
  owner: { login: string }
}

/**
 * How a confirmation ended.
 *
 * `gone` is a 404 or 451: the repository is not there, and the backfill may
 * remember that. `unavailable` is a rate limit, a timeout, a 5xx or a missing
 * token: the row must be tried again on the next opening.
 */
export type RepositoryConfirmation =
  | { outcome: 'confirmed'; repository: VerifiedRepository }
  | { outcome: 'gone' }
  | { outcome: 'unavailable' }

/**
 * Asks GitHub which repository `owner/name` is now.
 *
 * A rename answers with the same id and the current name, because the client
 * follows GitHub's redirect. A missing token, a rate limit or a failed
 * request is `unavailable`: nothing may store an id GitHub did not just
 * confirm, and the backfill must not remember it as gone.
 *
 * @param owner - Owner login to look up.
 * @param name - Repository name to look up.
 * @returns Whether GitHub confirmed the repository, said it is gone, or did not answer.
 * @example
 * const verified = await verifyRepositoryIdentity('laststance', 'gitbox')
 * if (verified.outcome === 'confirmed') verified.repository.id // => 12345
 */
export async function verifyRepositoryIdentity(
  owner: string,
  name: string,
): Promise<RepositoryConfirmation> {
  const token = await getGitHubToken()
  if (!token) return { outcome: 'unavailable' }

  const api = createGitHubAxios({
    token,
    clearTokenCookieOnUnauthorized: false,
  })
  try {
    const { data } = await api.get<GitHubRepositoryResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    )
    if (!Number.isInteger(data.id) || data.id <= 0) {
      return { outcome: 'unavailable' }
    }
    if (!data.owner?.login || !data.name) return { outcome: 'unavailable' }
    return {
      outcome: 'confirmed',
      repository: { id: data.id, owner: data.owner.login, name: data.name },
    }
  } catch (error) {
    // 404 and 451 are the only answers that mean the repository is gone
    const status = isAxiosError(error) ? error.response?.status : undefined
    if (typeof status === 'number' && GONE_STATUS.has(status)) {
      return { outcome: 'gone' }
    }
    return { outcome: 'unavailable' }
  }
}

/**
 * Confirms several repositories at once, in the same order.
 *
 * Called by {@link addRepositoriesToBoard} so a large selection does not wait
 * for one GitHub request after another. Five run at a time, the same limit as
 * the backfill.
 *
 * @param repositories - Owner and name of each repository, in request order.
 * @returns One confirmation per repository, in that same order.
 * @example
 * const [first] = await verifyRepositoryIdentities([
 *   { owner: 'laststance', name: 'gitbox' },
 * ])
 */
export async function verifyRepositoryIdentities(
  repositories: readonly { owner: string; name: string }[],
): Promise<RepositoryConfirmation[]> {
  const results: RepositoryConfirmation[] = repositories.map(() => ({
    outcome: 'unavailable',
  }))
  await mapWithConcurrency(
    repositories.map((repository, index) => ({ repository, index })),
    BACKFILL_CONCURRENCY,
    async ({ repository, index }) => {
      const confirmation = await verifyRepositoryIdentity(
        repository.owner,
        repository.name,
      )
      const slot = results[index]
      if (slot) results[index] = confirmation
    },
  )
  return results
}

/**
 * Fills `github_repo_id` on cards that do not have one yet, from the GitHub API.
 *
 * Also copies that id onto the repository's memory, so the note keeps matching
 * the card after a rename. A card whose id is already taken by another card of
 * the user is left null: the unique index refuses the write, and deleting a
 * card is not this function's decision. A repository GitHub says is gone is
 * remembered for a day, so the next opening confirms other cards. A rate
 * limit or a network failure leaves the row unchanged. One opening confirms
 * at most 25 cards, five GitHub requests at a time.
 *
 * @param supabase - Authenticated client. Row level security applies.
 * @param userId - The signed-in user (`claims.sub`).
 * @returns Nothing. Cards that GitHub did not confirm stay null.
 * @example
 * await backfillVerifiedRepositoryIds(supabase, claims.sub)
 */
export async function backfillVerifiedRepositoryIds(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const retryBefore = new Date(Date.now() - BACKFILL_RETRY_MS).toISOString()
  const { data, error } = await supabase
    .from('repocard')
    .select('id, repo_owner, repo_name, board!inner(user_id)')
    .eq('board.user_id', userId)
    .is('github_repo_id', null)
    .or(
      `github_identity_checked_at.is.null,github_identity_checked_at.lt."${retryBefore}"`,
    )
    .order('github_identity_checked_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(BACKFILL_BATCH_SIZE)

  if (error) {
    throw new Error('Failed to list repositories without a confirmed GitHub id')
  }
  if (!data || data.length === 0) return

  await mapWithConcurrency(data, BACKFILL_CONCURRENCY, async (card) => {
    const confirmation = await verifyRepositoryIdentity(
      card.repo_owner,
      card.repo_name,
    )
    // GitHub did not answer. Leave the row so the next opening tries it again.
    if (confirmation.outcome === 'unavailable') return

    const checkedAt = new Date().toISOString()
    const verified =
      confirmation.outcome === 'confirmed' ? confirmation.repository : null
    const { error: cardError } = await supabase
      .from('repocard')
      .update(
        verified
          ? {
              github_repo_id: verified.id,
              github_identity_checked_at: checkedAt,
            }
          : { github_identity_checked_at: checkedAt },
      )
      .eq('id', card.id)
      .is('github_repo_id', null)

    // 23505: another card of this user already has this id. Remember the
    // attempt so this card does not occupy the next batch, and leave the id null.
    if (cardError?.code === '23505') {
      await supabase
        .from('repocard')
        .update({ github_identity_checked_at: checkedAt })
        .eq('id', card.id)
        .is('github_repo_id', null)
      return
    }
    if (cardError) {
      throw new Error('Failed to store the confirmed GitHub id')
    }
    if (!verified) return

    const { error: memoryError } = await supabase
      .from('projectinfo')
      .update({ github_repo_id: verified.id })
      .eq('user_id', userId)
      .eq('repo_key', toRepoIdentifier(card.repo_owner, card.repo_name))
      .is('github_repo_id', null)

    if (memoryError && memoryError.code !== '23505') {
      throw new Error('Failed to store the confirmed GitHub id on the memory')
    }
  })
}

/**
 * Runs `task` over `items` with at most `concurrency` tasks in flight.
 *
 * Used by {@link backfillVerifiedRepositoryIds} so one opening does not wait
 * for 25 GitHub requests one after another.
 *
 * @param items - Work items, in order.
 * @param concurrency - How many tasks may run at once.
 * @param task - What to do with one item.
 * @example
 * await mapWithConcurrency([1, 2, 3], 2, async (item) => { await item })
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
