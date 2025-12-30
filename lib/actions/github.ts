/**
 * GitHub API Server Actions
 *
 * Actions to call GitHub REST API on server side
 * Authenticate using provider_token stored in Cookie
 */

'use server'

import { cookies } from 'next/headers'

import { getGitHubTokenCookieName } from '@/lib/constants/cookies'
import { isTestMode } from '@/tests/isTestMode'

const GITHUB_API_BASE_URL = 'https://api.github.com'

/**
 * Mock data for E2E testing
 * Matches the mock data in mocks/handlers.ts
 */
const MOCK_GITHUB_USER = {
  id: 12345,
  login: 'testuser',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
  name: 'Test User',
  type: 'User' as const,
}

const MOCK_GITHUB_REPOS = [
  {
    id: 1,
    node_id: 'R_kgDOGq0qMQ',
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    owner: {
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    description: 'A test repository for GitBox',
    html_url: 'https://github.com/testuser/test-repo',
    homepage: 'https://test-repo.dev',
    stargazers_count: 42,
    watchers_count: 42,
    language: 'TypeScript',
    topics: ['react', 'nextjs'],
    visibility: 'public' as const,
    updated_at: '2024-01-15T00:00:00.000Z',
    created_at: '2023-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    node_id: 'R_kgDOGq0qMg',
    name: 'another-repo',
    full_name: 'testuser/another-repo',
    owner: {
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    description: 'Another test repository',
    html_url: 'https://github.com/testuser/another-repo',
    homepage: null,
    stargazers_count: 128,
    watchers_count: 128,
    language: 'JavaScript',
    topics: ['nodejs', 'api'],
    visibility: 'public' as const,
    updated_at: '2024-01-10T00:00:00.000Z',
    created_at: '2023-06-01T00:00:00.000Z',
  },
  {
    id: 3,
    node_id: 'R_kgDOGq0qMz',
    name: 'private-project',
    full_name: 'testuser/private-project',
    owner: {
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    description: 'A private project',
    html_url: 'https://github.com/testuser/private-project',
    homepage: null,
    stargazers_count: 0,
    watchers_count: 1,
    language: 'Python',
    topics: ['private', 'internal'],
    visibility: 'private' as const,
    updated_at: '2024-01-20T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
  },
]

const MOCK_GITHUB_ORGS = [
  {
    id: 100,
    login: 'laststance',
    avatar_url: 'https://avatars.githubusercontent.com/u/100?v=4',
    description: 'Laststance.io organization',
  },
  {
    id: 101,
    login: 'test-org',
    avatar_url: 'https://avatars.githubusercontent.com/u/101?v=4',
    description: 'Test organization for development',
  },
]

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
  // E2E test mode: return mock data
  if (isTestMode()) {
    return { data: MOCK_GITHUB_REPOS, error: null }
  }

  const token = await getGitHubToken()

  if (!token) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

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

        const data: GitHubRepository[] = await response.json()
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
  // E2E test mode: return filtered mock data
  if (isTestMode()) {
    const query = params.q.toLowerCase()
    const filtered = MOCK_GITHUB_REPOS.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        (repo.description?.toLowerCase().includes(query) ?? false),
    )
    return {
      data: { total_count: filtered.length, items: filtered },
      error: null,
    }
  }

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
  // E2E test mode: return mock data
  if (isTestMode()) {
    const fullName = `${owner}/${repo}`
    const found = MOCK_GITHUB_REPOS.find((r) => r.full_name === fullName)
    return found
      ? { data: found, error: null }
      : { data: null, error: 'Repository not found.' }
  }

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
  // E2E test mode: always valid
  if (isTestMode()) {
    return { valid: true, error: null }
  }

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
  // E2E test mode: return mock user
  if (isTestMode()) {
    return { data: MOCK_GITHUB_USER, error: null }
  }

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
  // E2E test mode: return mock data filtered by org
  if (isTestMode()) {
    const filtered = MOCK_GITHUB_REPOS.filter(
      (repo) => repo.owner.login.toLowerCase() === org.toLowerCase(),
    )
    return { data: filtered, error: null }
  }

  const token = await getGitHubToken()

  if (!token) {
    return {
      data: null,
      error: 'GitHub token not found. Please sign in again.',
    }
  }

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

        const url = `${GITHUB_API_BASE_URL}/orgs/${org}/repos?${searchParams.toString()}`

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
              error: `Organization '${org}' not found.`,
            }
          }
          const errorData = await response.json().catch(() => ({}))
          return {
            data: null,
            error: errorData.message || `GitHub API error: ${response.status}`,
          }
        }

        const data: GitHubRepository[] = await response.json()
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

    const url = `${GITHUB_API_BASE_URL}/orgs/${org}/repos?${searchParams.toString()}`

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
          error: `Organization '${org}' not found.`,
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
    console.error('Failed to fetch organization repositories:', error)
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch organization repositories',
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
  // E2E test mode: return mock organizations
  if (isTestMode()) {
    return { data: MOCK_GITHUB_ORGS, error: null }
  }

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
