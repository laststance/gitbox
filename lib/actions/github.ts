/**
 * GitHub API Server Actions
 *
 * Actions to call GitHub REST API on server side.
 * Uses axios for HTTP requests with automatic auth token injection.
 *
 * @see https://docs.github.com/en/rest
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import { isAxiosError } from 'axios'

import { createGitHubAxios, hasGitHubToken } from '@/lib/axios-github'
import { createModuleLogger } from '@/lib/logger'

const log = createModuleLogger('github')

export interface GitHubRepository {
  id: number
  node_id: string
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  description: string | null
  html_url: string
  homepage: string | null
  stargazers_count: number
  watchers_count: number
  language: string | null
  topics: string[]
  visibility: 'public' | 'private'
  updated_at: string
  created_at: string
}

/**
 * GitHub User type
 */
export interface GitHubUser {
  id: number
  login: string
  avatar_url: string
  name: string | null
  type: 'User' | 'Organization'
}

/**
 * GitHub Organization type
 */
export interface GitHubOrganization {
  id: number
  login: string
  avatar_url: string
  description: string | null
}

/**
 * Handle axios errors and return standardized error response.
 *
 * @param error - The caught error
 * @param context - Context for error logging (e.g., 'fetch repositories')
 * @returns Standardized error message
 *
 * @example
 * catch (error) {
 *   return { data: null, error: handleGitHubError(error, 'fetch repositories') }
 * }
 */
function handleGitHubError(error: unknown, context: string): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) {
      return 'GitHub token expired. Please sign in again.'
    }
    if (error.response?.status === 404) {
      return 'Resource not found.'
    }
    const message = error.response?.data?.message
    if (message) {
      return message
    }
    return `GitHub API error: ${error.response?.status ?? 'unknown'}`
  }

  log.error({ error }, `Failed to ${context}`)
  Sentry.captureException(error, {
    extra: { context: `GitHub API: ${context}` },
  })
  return error instanceof Error ? error.message : `Failed to ${context}`
}

/**
 * Get authenticated user's repository list
 *
 * Fetches repositories from GitHub API with optional pagination support.
 * When `fetchAll: true`, iterates through all pages to get complete list.
 *
 * @param params.sort - Sort order for repositories
 * @param params.per_page - Number of repos per page (max 100)
 * @param params.page - Specific page to fetch (ignored when fetchAll is true)
 * @param params.fetchAll - Fetch all pages instead of just one (default: false)
 * @returns Array of repositories or error message
 *
 * @example
 * // Fetch all repos (paginated)
 * const { data } = await getAuthenticatedUserRepositories({ fetchAll: true })
 *
 * // Fetch single page
 * const { data } = await getAuthenticatedUserRepositories({ per_page: 100, page: 1 })
 */
export async function getAuthenticatedUserRepositories(params?: {
  sort?: 'created' | 'updated' | 'pushed' | 'full_name'
  per_page?: number
  page?: number
  fetchAll?: boolean
}): Promise<{ data: GitHubRepository[] | null; error: string | null }> {
  if (!(await hasGitHubToken())) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  const api = createGitHubAxios()

  try {
    const perPage = params?.per_page ?? 100
    const fetchAll = params?.fetchAll ?? false

    // If fetchAll is true, paginate through all pages
    if (fetchAll) {
      const allRepos: GitHubRepository[] = []
      let page = 1
      const maxPages = 10 // Safety limit to prevent infinite loops (1000 repos max)

      while (page <= maxPages) {
        const searchParams = new URLSearchParams()
        if (params?.sort) searchParams.set('sort', params.sort)
        searchParams.set('per_page', perPage.toString())
        searchParams.set('page', page.toString())

        const { data } = await api.get<GitHubRepository[]>(
          `/user/repos?${searchParams.toString()}`,
        )

        allRepos.push(...data)

        // If we got fewer repos than requested, we've reached the last page
        if (data.length < perPage) {
          break
        }

        page++
      }

      return { data: allRepos, error: null }
    }

    // Single page fetch (original behavior)
    const searchParams = new URLSearchParams()
    if (params?.sort) searchParams.set('sort', params.sort)
    searchParams.set('per_page', perPage.toString())
    if (params?.page) searchParams.set('page', params.page.toString())

    const { data } = await api.get<GitHubRepository[]>(
      `/user/repos?${searchParams.toString()}`,
    )

    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: handleGitHubError(error, 'fetch repositories'),
    }
  }
}

/**
 * Get authenticated user's profile
 *
 * Fetches the current user's GitHub profile information.
 *
 * @returns The user's profile data or an error message
 *
 * @example
 * const { data, error } = await getAuthenticatedUser()
 * if (data) console.log(data.login) // => "ryota-murakami"
 */
export async function getAuthenticatedUser(): Promise<{
  data: GitHubUser | null
  error: string | null
}> {
  if (!(await hasGitHubToken())) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  const api = createGitHubAxios()

  try {
    const { data } = await api.get<GitHubUser>('/user')
    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: handleGitHubError(error, 'fetch user'),
    }
  }
}

/**
 * Get organization's repositories
 *
 * Fetches repositories from a specific GitHub organization.
 * Used when organization filter is selected to ensure all org repos are visible.
 *
 * @param org - Organization login name
 * @param params.per_page - Number of repos per page (max 100)
 * @param params.fetchAll - Fetch all pages instead of just one
 * @returns Array of repositories or error message
 *
 * @example
 * const { data } = await getOrganizationRepositories('laststance', { fetchAll: true })
 */
export async function getOrganizationRepositories(
  org: string,
  params?: {
    per_page?: number
    fetchAll?: boolean
  },
): Promise<{ data: GitHubRepository[] | null; error: string | null }> {
  if (!(await hasGitHubToken())) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  const api = createGitHubAxios()

  try {
    const perPage = params?.per_page ?? 100
    const fetchAll = params?.fetchAll ?? false

    // If fetchAll is true, paginate through all pages
    if (fetchAll) {
      const allRepos: GitHubRepository[] = []
      let page = 1
      const maxPages = 10 // Safety limit (1000 repos max)

      while (page <= maxPages) {
        const searchParams = new URLSearchParams()
        searchParams.set('per_page', perPage.toString())
        searchParams.set('page', page.toString())
        searchParams.set('type', 'all') // Get all repos (public, private, forks)

        const { data } = await api.get<GitHubRepository[]>(
          `/orgs/${org}/repos?${searchParams.toString()}`,
        )

        allRepos.push(...data)

        if (data.length < perPage) {
          break
        }

        page++
      }

      return { data: allRepos, error: null }
    }

    // Single page fetch
    const searchParams = new URLSearchParams()
    searchParams.set('per_page', perPage.toString())
    searchParams.set('type', 'all')

    const { data } = await api.get<GitHubRepository[]>(
      `/orgs/${org}/repos?${searchParams.toString()}`,
    )

    return { data, error: null }
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return { data: null, error: `Organization '${org}' not found.` }
    }
    return {
      data: null,
      error: handleGitHubError(error, 'fetch organization repositories'),
    }
  }
}

/**
 * Get authenticated user's organizations
 *
 * Fetches the list of organizations the current user belongs to.
 * Used for the Organization Filter in AddRepositoryCombobox.
 *
 * @returns Array of organizations or an error message
 *
 * @example
 * const { data, error } = await getAuthenticatedUserOrganizations()
 * if (data) data.forEach(org => console.log(org.login))
 */
export async function getAuthenticatedUserOrganizations(): Promise<{
  data: GitHubOrganization[] | null
  error: string | null
}> {
  if (!(await hasGitHubToken())) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  const api = createGitHubAxios()

  try {
    const { data } = await api.get<GitHubOrganization[]>('/user/orgs')
    return { data, error: null }
  } catch (error) {
    return {
      data: null,
      error: handleGitHubError(error, 'fetch organizations'),
    }
  }
}
