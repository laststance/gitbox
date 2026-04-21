/**
 * Domain Models
 *
 * Application-facing types that sit between the raw Supabase row types
 * (`src/lib/supabase/types.ts`) and the React/Redux layer. A Supabase row
 * uses snake_case columns, ISO strings, and nullable fields; a domain model
 * uses camelCase, branded IDs, and safe defaults. Conversion happens in
 * `src/lib/actions/mappers.ts`.
 *
 * Downstream consumers (components, Redux slices, hooks) should import
 * these types rather than `Tables<'...'>` — they get:
 * - camelCase naming,
 * - {@link BoardId}/{@link StatusListId}/{@link RepoCardId} branding that
 *   prevents swapping IDs across entities,
 * - named unions ({@link Visibility}, {@link Priority}) instead of
 *   scattered string literals.
 */

import type { BoardId, RepoCardId, StatusListId } from '@/lib/types/brands'
import type {
  ISOTimestamp,
  Priority,
  Visibility,
} from '@/lib/types/domain-primitives'

// ========================================
// Status List Domain Model
// ========================================

/**
 * A Kanban column within a board. Corresponds 1:1 to a `statuslist` row,
 * but camelCased and with non-null defaults applied.
 *
 * @example
 * {
 *   id: 'status-123' as StatusListId,
 *   title: 'In Progress',
 *   color: '#6B7280',
 *   gridRow: 0,
 *   gridCol: 1,
 *   boardId: 'board-456' as BoardId,
 *   createdAt: '2026-04-21T12:00:00Z',
 *   updatedAt: '2026-04-21T12:00:00Z',
 * }
 */
export interface StatusListDomain {
  /** Primary key (`statuslist.id`). */
  id: StatusListId
  /** Display title (maps to `statuslist.name`). */
  title: string
  /** Column accent color (hex). Defaults to `#6B7280` when DB value is null. */
  color: string
  /** Grid row position (0-indexed). */
  gridRow: number
  /** Grid column position (0-indexed). */
  gridCol: number
  /** Parent board (`statuslist.board_id`). */
  boardId: BoardId
  /** Creation timestamp (ISO-8601 UTC). */
  createdAt: ISOTimestamp
  /** Last update timestamp (ISO-8601 UTC). */
  updatedAt: ISOTimestamp
}

// ========================================
// Repo Card Domain Model
// ========================================

/**
 * A GitHub repository card on the board. Rich text notes, inline comments,
 * and external links live in the `projectinfo` table (joined via
 * `repo_card_id`), not on the card itself.
 *
 * @example
 * {
 *   id: 'card-123' as RepoCardId,
 *   title: 'laststance/gitbox',
 *   statusId: 'status-456' as StatusListId,
 *   boardId: 'board-789' as BoardId,
 *   repoOwner: 'laststance',
 *   repoName: 'gitbox',
 *   order: 0,
 *   meta: { stars: 42, language: 'TypeScript', visibility: 'public' },
 *   createdAt: '2026-04-21T12:00:00Z',
 *   updatedAt: '2026-04-21T12:00:00Z',
 * }
 */
export interface RepoCardDomain {
  /** Primary key (`repocard.id`). */
  id: RepoCardId
  /** Display title — `${repoOwner}/${repoName}`. */
  title: string
  /** Repository description (from GitHub metadata, cached in `meta`). */
  description?: string
  /** Parent status list (`repocard.status_id`). */
  statusId: StatusListId
  /** Parent board (`repocard.board_id`). */
  boardId: BoardId
  /** GitHub repository owner login. */
  repoOwner: string
  /** GitHub repository name. */
  repoName: string
  /** Display order within the status column (0-indexed). */
  order: number
  /** GitHub metadata snapshot (stars, language, visibility, …). */
  meta: RepoCardMeta
  /** Creation timestamp (ISO-8601 UTC). */
  createdAt: ISOTimestamp
  /** Last update timestamp (ISO-8601 UTC). */
  updatedAt: ISOTimestamp

  // UI extension fields (optional, not yet persisted)
  /** Visual priority hint. UI-only; not stored in the DB. */
  priority?: Priority
  /** Assignee avatar/name for UI — not yet persisted. */
  assignee?: {
    name: string
    avatar: string
  }
  /** Freeform tags for UI — not yet persisted. */
  tags?: string[]
  /** Due-date hint (ISO string) — not yet persisted. */
  dueDate?: ISOTimestamp
  /** Attachment count for UI — not yet persisted. */
  attachments?: number
  /** Cached count of inline comments on this card (from `projectinfo`). */
  commentsCount?: number
}

/**
 * Snapshot of a repository's GitHub metadata, cached in `repocard.meta`.
 * Refreshed by the background GitHub sync. Every field is optional because
 * older cards may predate a given field's introduction.
 *
 * @example
 * { stars: 120, language: 'TypeScript', visibility: 'public', topics: ['react'] }
 */
export interface RepoCardMeta {
  /** Star count at the last sync. */
  stars?: number
  /** Repository `updated_at` reported by GitHub (ISO-8601). */
  updatedAt?: ISOTimestamp
  /** GitHub repo visibility. */
  visibility?: Visibility
  /** Primary language reported by GitHub (e.g. `TypeScript`). */
  language?: string
  /** Topic tags from GitHub. */
  topics?: string[]
  /** Repository description from GitHub. */
  description?: string
}

// ========================================
// Simplified Types for Redux (Immer compatibility)
// ========================================

/**
 * {@link RepoCardDomain} with `meta` widened to `unknown`.
 *
 * Why: Immer's recursive draft-type inference chokes on `RepoCardMeta`'s
 * deep optional fields. Treating `meta` as opaque inside Redux avoids the
 * type-system blow-up without changing the runtime value. Components should
 * narrow via `as RepoCardMeta` only if they need to read it.
 */
export type RepoCardForRedux = Omit<RepoCardDomain, 'meta'> & {
  meta: unknown
}
