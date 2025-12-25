/**
 * GitHub API Server Actions
 *
 * Actions to call GitHub REST API on server side
 * Authenticate using provider_token stored in Cookie
 */

'use server'

import { cookies } from 'next/headers'

import { getGitHubTokenCookieName } from '@/lib/constants/cookies'

const GITHUB_API_BASE_URL = 'https://api.github.com'

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
 * Get provider_token from Cookie
 */
async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookieName = getGitHubTokenCookieName()
  return cookieStore.get(cookieName)?.value ?? null
}

/**
 * Get authenticated user's repository list
 */
export async function getAuthenticatedUserRepositories(params?: {
  sort?: 'created' | 'updated' | 'pushed' | 'full_name'
  per_page?: number
  page?: number
}): Promise<{ data: GitHubRepository[] | null; error: string | null }> {
  const token = await getGitHubToken()

  if (!token) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  try {
    const searchParams = new URLSearchParams()
    if (params?.sort) searchParams.set('sort', params.sort)
    if (params?.per_page)
      searchParams.set('per_page', params.per_page.toString())
    if (params?.page) searchParams.set('page', params.page.toString())

    const url = `${GITHUB_API_BASE_URL}/user/repos?${searchParams.toString()}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitBox-App',
      },
      next: {
        revalidate: 60, // Cache for 1 minute
      },
    } as RequestInit)

    if (!response.ok) {
      if (response.status === 401) {
        return {
          data: null,
          error: 'GitHub token expired. Please sign in again.',
        }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        data: null,
        error: errorData.message || `GitHub API error: ${response.status}`,
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    console.error('Failed to fetch repositories:', error)
    return {
      data: null,
      error:
        error instanceof Error ? error.message : 'Failed to fetch repositories',
    }
  }
}

/**
 * Search repositories
 */
export async function searchRepositories(params: {
  q: string
  sort?: 'stars' | 'forks' | 'updated'
  order?: 'asc' | 'desc'
  per_page?: number
  page?: number
}): Promise<{
  data: { total_count: number; items: GitHubRepository[] } | null
  error: string | null
}> {
  const token = await getGitHubToken()

  if (!token) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  try {
    const searchParams = new URLSearchParams()
    searchParams.set('q', params.q)
    if (params.sort) searchParams.set('sort', params.sort)
    if (params.order) searchParams.set('order', params.order)
    if (params.per_page)
      searchParams.set('per_page', params.per_page.toString())
    if (params.page) searchParams.set('page', params.page.toString())

    const url = `${GITHUB_API_BASE_URL}/search/repositories?${searchParams.toString()}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitBox-App',
      },
      next: {
        revalidate: 60,
      },
    } as RequestInit)

    if (!response.ok) {
      if (response.status === 401) {
        return {
          data: null,
          error: 'GitHub token expired. Please sign in again.',
        }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        data: null,
        error: errorData.message || `GitHub API error: ${response.status}`,
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    console.error('Failed to search repositories:', error)
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to search repositories',
    }
  }
}

/**
 * Get specific repository
 */
export async function getRepository(
  owner: string,
  repo: string,
): Promise<{ data: GitHubRepository | null; error: string | null }> {
  const token = await getGitHubToken()

  if (!token) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  try {
    const url = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitBox-App',
      },
      next: {
        revalidate: 60,
      },
    } as RequestInit)

    if (!response.ok) {
      if (response.status === 401) {
        return {
          data: null,
          error: 'GitHub token expired. Please sign in again.',
        }
      }
      if (response.status === 404) {
        return {
          data: null,
          error: 'Repository not found.',
        }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        data: null,
        error: errorData.message || `GitHub API error: ${response.status}`,
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    console.error('Failed to fetch repository:', error)
    return {
      data: null,
      error:
        error instanceof Error ? error.message : 'Failed to fetch repository',
    }
  }
}

/**
 * Check if GitHub token is valid
 */
export async function checkGitHubTokenValidity(): Promise<{
  valid: boolean
  error: string | null
}> {
  const token = await getGitHubToken()

  if (!token) {
    return { valid: false, error: 'No token found' }
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitBox-App',
      },
    })

    if (response.ok) {
      return { valid: true, error: null }
    } else {
      return { valid: false, error: 'Token is invalid or expired' }
    }
  } catch (_error) {
    return { valid: false, error: 'Failed to verify token' }
  }
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
 * Get authenticated user's profile
 *
 * Fetches the current user's GitHub profile information.
 *
 * @returns The user's profile data or an error message
 * @example
 * const { data, error } = await getAuthenticatedUser()
 * if (data) console.log(data.login) // => "ryota-murakami"
 */
export async function getAuthenticatedUser(): Promise<{
  data: GitHubUser | null
  error: string | null
}> {
  const token = await getGitHubToken()

  if (!token) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitBox-App',
      },
      next: {
        revalidate: 300, // Cache for 5 minutes
      },
    } as RequestInit)

    if (!response.ok) {
      if (response.status === 401) {
        return {
          data: null,
          error: 'GitHub token expired. Please sign in again.',
        }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        data: null,
        error: errorData.message || `GitHub API error: ${response.status}`,
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch user',
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
 * @example
 * const { data, error } = await getAuthenticatedUserOrganizations()
 * if (data) data.forEach(org => console.log(org.login))
 */
export async function getAuthenticatedUserOrganizations(): Promise<{
  data: GitHubOrganization[] | null
  error: string | null
}> {
  const token = await getGitHubToken()

  if (!token) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/user/orgs`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitBox-App',
      },
      next: {
        revalidate: 300, // Cache for 5 minutes
      },
    } as RequestInit)

    if (!response.ok) {
      if (response.status === 401) {
        return {
          data: null,
          error: 'GitHub token expired. Please sign in again.',
        }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        data: null,
        error: errorData.message || `GitHub API error: ${response.status}`,
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    console.error('Failed to fetch organizations:', error)
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch organizations',
    }
  }
}
