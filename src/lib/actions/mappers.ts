/**
 * Domain Model Mappers
 *
 * The trust boundary between Supabase rows and the application's domain
 * layer. Every mapper:
 * 1. camelCases snake_case columns,
 * 2. brands the ID fields via `src/lib/types/brands.ts` factories,
 * 3. coerces nullable timestamps/colors into safe defaults.
 *
 * Keeping the `as BoardId` / `as RepoCardId` casts confined to this file
 * means the rest of the codebase can enjoy nominal IDs without scattered
 * escape hatches.
 */

import type {
  RepoCardDomain,
  RepoCardMeta,
  StatusListDomain,
} from '@/lib/models/domain'
import type { Board, CommentColor, Tables } from '@/lib/supabase/types'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'
import { DEFAULT_COMMENT_COLOR } from '@/lib/validations/project-info'

import type { CommentData } from './shared-project-info'

type StatusListRow = Tables<'statuslist'>
type RepoCardRow = Tables<'repocard'>

/**
 * Convert a raw Supabase `statuslist` row into a {@link StatusListDomain}.
 * Applies safe defaults for nullable columns (color, timestamps).
 *
 * @param row - Raw row from `supabase.from('statuslist').select(...)`
 * @returns Fully-populated domain object with branded IDs
 *
 * @example
 * const domain = toStatusListDomain(row)
 * // { id: 'uuid' as StatusListId, title: 'Todo', color: '#6B7280', gridRow: 0, ... }
 */
export function toStatusListDomain(row: StatusListRow): StatusListDomain {
  return {
    id: toStatusListId(row.id),
    title: row.name,
    color: row.color ?? '#6B7280',
    gridRow: row.grid_row ?? 0,
    gridCol: row.grid_col ?? 0,
    boardId: toBoardId(row.board_id),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Convert a raw Supabase `repocard` row into a {@link RepoCardDomain}.
 * Parses the JSON `meta` blob (cast-based; older rows may omit fields) and
 * derives the display title from `${repo_owner}/${repo_name}`.
 *
 * @param row - Raw row from `supabase.from('repocard').select(...)`
 * @returns Fully-populated domain object with branded IDs
 *
 * @example
 * const domain = toRepoCardDomain(row)
 * // { id: 'uuid' as RepoCardId, title: 'owner/repo', meta: { stars: 42 }, ... }
 */
export function toRepoCardDomain(row: RepoCardRow): RepoCardDomain {
  const meta = (row.meta as RepoCardMeta) || {}
  return {
    id: toRepoCardId(row.id),
    title: `${row.repo_owner}/${row.repo_name}`,
    description: meta.description || '',
    statusId: toStatusListId(row.status_id),
    boardId: toBoardId(row.board_id),
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    order: row.order,
    meta: {
      stars: meta.stars,
      updatedAt: meta.updatedAt,
      visibility: meta.visibility,
      language: meta.language,
      topics: meta.topics,
      description: meta.description,
    },
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Raw shape of one board fetched with its children embedded via PostgREST.
 * Mirrors the embed select string in `getBoardBundle`
 * (`*, statuslist(*), repocard(*, projectinfo(comment, comment_color))`).
 * `projectinfo` is an object-or-null (NOT an array) because
 * `projectinfo_repo_card_id_fkey` is one-to-one; it is `null` whenever the
 * card has no project info, or when RLS hides it from a non-owner.
 */
export type BoardBundleRow = Tables<'board'> & {
  statuslist: Tables<'statuslist'>[]
  repocard: Array<
    Tables<'repocard'> & {
      projectinfo: Pick<
        Tables<'projectinfo'>,
        'comment' | 'comment_color'
      > | null
    }
  >
}

/**
 * Domain-shaped board bundle — everything `BoardPageClient` needs from a single
 * embed. Equivalent to the old multi-query `fetchBoardInitialData` result minus
 * `maintenanceRepoIdentifiers` (user-scoped, still fetched separately).
 */
export interface BoardBundle {
  /** Raw board row (the shape `BoardPageClient` expects via its `board` prop). */
  board: Board
  /** Columns sorted by grid position (gridRow asc, then gridCol asc). */
  statusLists: StatusListDomain[]
  /** Repository cards sorted by display order (asc). */
  repoCards: RepoCardDomain[]
  /** Map of cardId → comment data, with one entry per card (defaults filled). */
  comments: Record<string, CommentData>
}

/**
 * Remap one PostgREST board embed into the domain-shaped {@link BoardBundle}.
 * Pure/synchronous; exists so the embed read path produces the exact shape the
 * legacy per-table queries did. Called by `getBoardBundle` right after the
 * embed resolves. Sorts columns by gridRow then gridCol and cards by order
 * ascending, and builds a comments map with one entry per card — filling
 * `{ comment: '', color: DEFAULT_COMMENT_COLOR }` whenever `projectinfo` is
 * absent (no info yet, or RLS-hidden for non-owners), mirroring `getCommentsCore`.
 *
 * @param row - Raw board row with embedded `statuslist` + `repocard(+projectinfo)`.
 * @returns A {@link BoardBundle}: raw board, sorted columns/cards, parity comments map.
 * @example
 * remapBoardEmbed({ id: 'b1', name: 'My Board', statuslist: [], repocard: [
 *   { id: 'c1', order: 0, projectinfo: { comment: 'hi', comment_color: 'blue' } },
 * ] })
 * // => { board, statusLists: [], repoCards: [card], comments: { c1: { comment: 'hi', color: 'blue' } } }
 */
export function remapBoardEmbed(row: BoardBundleRow): BoardBundle {
  // Separate the embedded children from the plain board columns.
  const { statuslist, repocard, ...board } = row

  // Order columns by grid position: row first, then column.
  const statusLists = statuslist
    .map(toStatusListDomain)
    .sort((a, b) => a.gridRow - b.gridRow || a.gridCol - b.gridCol)

  // Order cards by their display order (asc).
  const repoCards = repocard
    .map(toRepoCardDomain)
    .sort((a, b) => a.order - b.order)

  // One comment entry per card — fill defaults when projectinfo is absent so
  // the map has full parity with the old getCommentsCore batch fetch.
  const comments: Record<string, CommentData> = {}
  for (const card of repocard) {
    const projectInfo = card.projectinfo
    comments[card.id] = projectInfo
      ? {
          comment: projectInfo.comment || '',
          color:
            (projectInfo.comment_color as CommentColor) ||
            DEFAULT_COMMENT_COLOR,
        }
      : { comment: '', color: DEFAULT_COMMENT_COLOR }
  }

  return { board, statusLists, repoCards, comments }
}
