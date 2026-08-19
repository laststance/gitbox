import type {
  GitHubAccountType,
  Visibility,
} from '@/lib/types/domain-primitives'

/** Subset of the GitHub REST Repository object consumed by GitBox. */
export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  description: string | null
  stargazers_count: number
  language: string | null
  topics: string[]
  visibility: Visibility
  updated_at: string
  /** Legacy fields remain optional for callers that already provide full GitHub payloads. */
  node_id?: string
  html_url?: string
  homepage?: string | null
  watchers_count?: number
  created_at?: string
}

/** Subset of the GitHub REST User object consumed by GitBox. */
export interface GitHubUser {
  id: number
  login: string
  avatar_url: string
  name: string | null
  type: GitHubAccountType
}

/** Subset of the GitHub REST Organization object consumed by GitBox. */
export interface GitHubOrganization {
  id: number
  login: string
  avatar_url: string
  description: string | null
}

/** One cacheable payload used to render every repository-picker filter and row. */
export interface GitHubRepositoryCatalog {
  currentUser: GitHubUser
  organizations: GitHubOrganization[]
  repositories: GitHubRepository[]
}
