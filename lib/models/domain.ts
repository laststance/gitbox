/**
 * Domain Models
 *
 * ビジネスロジック層で使用する型定義
 * Database層(Supabase types)とUI層の中間に位置し、
 * アプリケーション全体で統一された型を提供
 */

// Re-export database types for mapper usage
export type { StatusList as DbStatusList, RepoCard as DbRepoCard } from '@/lib/supabase/types'

// ========================================
// Status List Domain Model
// ========================================

/**
 * カンバンボードのステータス列を表すドメインモデル
 * UI層とRedux層で共通して使用
 */
export interface StatusListDomain {
  id: string
  /** 表示用タイトル (database: name) */
  title: string
  /** WIP制限数 (database: wip_limit) */
  wipLimit: number
  /** 列の色コード */
  color: string
  /** 表示順序 */
  order: number
  /** ボードID (データベース外部キー) */
  boardId: string
  /** 作成日時 */
  createdAt: string
  /** 更新日時 */
  updatedAt: string
}

// ========================================
// Repo Card Domain Model
// ========================================

/**
 * GitHubリポジトリカードのドメインモデル
 * UI層とRedux層で共通して使用
 */
export interface RepoCardDomain {
  id: string
  /** カード表示タイトル (GitHub repo名) */
  title: string
  /** リポジトリ説明文 (メモまたはGitHub description) */
  description?: string
  /** 所属ステータスID */
  statusId: string
  /** ボードID (データベース外部キー) */
  boardId: string
  /** GitHubリポジトリオーナー */
  repoOwner: string
  /** GitHubリポジトリ名 */
  repoName: string
  /** ユーザーメモ */
  note: string | null
  /** カード表示順序 */
  order: number
  /** GitHubメタデータ (stars, language, etc.) */
  meta: RepoCardMeta
  /** 作成日時 */
  createdAt: string
  /** 更新日時 */
  updatedAt: string

  // UI拡張フィールド (オプショナル、将来の拡張用)
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
 * RepoCardのGitHubメタデータ
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
 * Redux state用の簡略化型
 * Immerの型推論問題を回避するため、Json型をunknownに変換
 */
export type StatusListForRedux = StatusListDomain

/**
 * Redux state用の簡略化型
 * Immerの型推論問題を回避するため、meta をunknownに変換
 */
export type RepoCardForRedux = Omit<RepoCardDomain, 'meta'> & { meta: unknown }
