/**
 * Domain Models
 *
 * Type definitions used in the business logic layer
 * Positioned between Database layer (Supabase types) and UI layer,
 * providing unified types throughout the application
 */

// Re-export database types for mapper usage
export type {
  StatusList as DbStatusList,
  RepoCard as DbRepoCard,
} from '@/lib/supabase/types'

// ========================================
// Status List Domain Model
// ========================================

/**
 * Domain model representing a Kanban board status column
 * Shared across UI layer and Redux layer
 */
export interface StatusListDomain {
  id: string
  /** Display title (database: name) */
  title: string
  /** WIP limit count (database: wip_limit) */
  wipLimit: number
  /** Column color code */
  color: string
  /** Grid row position (0-indexed) */
  gridRow: number
  /** Grid column position (0-indexed) */
  gridCol: number
  /** Board ID (database foreign key) */
  boardId: string
  /** Creation timestamp */
  createdAt: string
  /** Update timestamp */
  updatedAt: string
}

// ========================================
// Repo Card Domain Model
// ========================================

/**
 * Domain model for GitHub repository cards
 * Shared across UI layer and Redux layer
 */
export interface RepoCardDomain {
  id: string
  /** Card display title (GitHub repo name) */
  title: string
  /** Repository description (note or GitHub description) */
  description?: string
  /** Status ID this card belongs to */
  statusId: string
  /** Board ID (database foreign key) */
  boardId: string
  /** GitHub repository owner */
  repoOwner: string
  /** GitHub repository name */
  repoName: string
  /** User note */
  note: string | null
  /** Card display order */
  order: number
  /** GitHub metadata (stars, language, etc.) */
  meta: RepoCardMeta
  /** Creation timestamp */
  createdAt: string
  /** Update timestamp */
  updatedAt: string

  // UI extension fields (optional, for future enhancements)
  priority?: 'low' | 'medium' | 'high'
  assignee?: {
    name: string
    avatar: string
  }
  tags?: string[]
  dueDate?: string
  attachments?: number
  comments?: number
}

/**
 * GitHub metadata for RepoCard
 */
export interface RepoCardMeta {
  stars?: number
  updatedAt?: string
  visibility?: 'public' | 'private'
  language?: string
  topics?: string[]
  description?: string
}

// ========================================
// Simplified Types for Redux (Immer compatibility)
// ========================================

/**
 * Simplified type for Redux state
 * Converts Json type to unknown to avoid Immer type inference issues
 */
export type StatusListForRedux = StatusListDomain

/**
 * Simplified type for Redux state
 * Converts meta to unknown to avoid Immer type inference issues
 */
export type RepoCardForRedux = Omit<RepoCardDomain, 'meta'> & { meta: unknown }
