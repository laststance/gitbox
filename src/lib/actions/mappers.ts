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

import type { CommentData } from './project-info-core'

export {
  BOARD_BUNDLE_SELECT,
  PROJECT_COMMENT_EMBED,
  REPO_CARD_COLUMNS,
} from '@/lib/constants/board-bundle'

type StatusListRow = Tables<'statuslist'>
type RepoCardRow = Omit<Tables<'repocard'>, 'user_id'>

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
 * Mirrors {@link BOARD_BUNDLE_SELECT}.
 * `projectinfo` is an object-or-null (NOT an array): the computed relationship
 * `projectinfo(repocard)` returns the row of the card's repository and is
 * declared `ROWS 1` (issue #216); it is `null` whenever nothing is saved for
 * that repository. `getBoardBundle` returns the owner's boards only.
 */
export type BoardBundleRow = Tables<'board'> & {
  statuslist: Tables<'statuslist'>[]
  repocard: Array<
    RepoCardRow & {
      projectinfo: Pick<
        Tables<'projectinfo'>,
        'comment' | 'comment_color'
      > | null
    }
  >
}

/**
 * Domain-shaped board bundle — everything `BoardPageClient` needs from a single
 * embed. Equivalent to the old multi-query `fetchBoardInitialData` result.
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
 * absent (the card has no info yet).
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
  // `comments[id].color` is never undefined downstream.
  const comments: Record<string, CommentData> = {}
  for (const card of repocard) {
    comments[card.id] = toCommentData(card.projectinfo)
  }

  return { board, statusLists, repoCards, comments }
}

/**
 * Turn the embedded `projectinfo(comment, comment_color)` of a card into the
 * comment the board shows, with defaults when nothing is saved.
 *
 * Shared by {@link remapBoardEmbed} (every card of a board) and
 * {@link addRepositoriesToBoard} (a card added again gets the comment its
 * repository kept, issue #216).
 *
 * @param projectInfo - The embedded row, or `null` when nothing is saved.
 * @returns
 * - The saved text and color (`primary` when the color is empty)
 * - `{ comment: '', color: 'primary' }` when `projectInfo` is `null`
 * @example
 * toCommentData({ comment: 'v2 soon', comment_color: 'blue' }) // => { comment: 'v2 soon', color: 'blue' }
 * toCommentData(null) // => { comment: '', color: 'primary' }
 */
export function toCommentData(
  projectInfo: Pick<Tables<'projectinfo'>, 'comment' | 'comment_color'> | null,
): CommentData {
  if (!projectInfo) {
    return { comment: '', color: DEFAULT_COMMENT_COLOR }
  }
  return {
    comment: projectInfo.comment || '',
    color: (projectInfo.comment_color as CommentColor) || DEFAULT_COMMENT_COLOR,
  }
}
