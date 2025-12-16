/**
 * GitHub API Server Actions
 *
 * GitHub REST API をサーバーサイドで呼び出すアクション
 * Cookieに保存されたprovider_tokenを使用して認証
 */

'use server'

import { cookies } from 'next/headers'

const GITHUB_API_BASE_URL = 'https://api.github.com'
const GITHUB_TOKEN_COOKIE = 'github_provider_token'

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
 * Cookieからprovider_tokenを取得
 */
async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(GITHUB_TOKEN_COOKIE)?.value ?? null
}

/**
 * 認証ユーザーのリポジトリ一覧を取得
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
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString())
    if (params?.page) searchParams.set('page', params.page.toString())

    const url = `${GITHUB_API_BASE_URL}/user/repos?${searchParams.toString()}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitBox-App',
      },
      next: {
        revalidate: 60, // 1分間キャッシュ
      },
    })

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
      error: error instanceof Error ? error.message : 'Failed to fetch repositories',
    }
  }
}

/**
 * リポジトリを検索
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
    if (params.per_page) searchParams.set('per_page', params.per_page.toString())
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
    })

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
      error: error instanceof Error ? error.message : 'Failed to search repositories',
    }
  }
}

/**
 * 特定のリポジトリを取得
 */
export async function getRepository(
  owner: string,
  repo: string
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
    })

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
      error: error instanceof Error ? error.message : 'Failed to fetch repository',
    }
  }
}

/**
 * GitHub tokenが有効かチェック
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

