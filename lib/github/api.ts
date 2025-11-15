/**
 * GitHub REST API Client (RTK Query)
 *
 * GitHub REST API との通信を RTK Query で管理
 * Repository 検索、メタデータ取得に使用
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// GitHub API のベース URL
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

export interface SearchRepositoriesParams {
  q: string
  sort?: 'stars' | 'forks' | 'updated'
  order?: 'asc' | 'desc'
  per_page?: number
  page?: number
}

export interface SearchRepositoriesResponse {
  total_count: number
  incomplete_results: boolean
  items: GitHubRepository[]
}

export const githubApi = createApi({
  reducerPath: 'githubApi',
  baseQuery: fetchBaseQuery({
    baseUrl: GITHUB_API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      // GitHub OAuth トークンを追加（Supabase セッションから取得）
      const state = getState() as any
      const session = state.auth?.session

      if (session?.provider_token) {
        headers.set('Authorization', `Bearer ${session.provider_token}`)
      }

      headers.set('Accept', 'application/vnd.github.v3+json')
      return headers
    },
  }),
  tagTypes: ['Repository'],
  endpoints: builder => ({
    // リポジトリ検索
    searchRepositories: builder.query<
      SearchRepositoriesResponse,
      SearchRepositoriesParams
    >({
      query: params => ({
        url: '/search/repositories',
        params,
      }),
      providesTags: ['Repository'],
    }),

    // ユーザーのリポジトリ一覧取得
    getUserRepositories: builder.query<GitHubRepository[], string>({
      query: username => `/users/${username}/repos`,
      providesTags: ['Repository'],
    }),

    // 認証ユーザーのリポジトリ一覧取得
    getAuthenticatedUserRepositories: builder.query<
      GitHubRepository[],
      { sort?: 'created' | 'updated' | 'pushed' | 'full_name'; per_page?: number }
    >({
      query: params => ({
        url: '/user/repos',
        params: {
          sort: params.sort || 'updated',
          per_page: params.per_page || 100,
        },
      }),
      providesTags: ['Repository'],
    }),

    // 特定リポジトリの詳細取得
    getRepository: builder.query<
      GitHubRepository,
      { owner: string; repo: string }
    >({
      query: ({ owner, repo }) => `/repos/${owner}/${repo}`,
      providesTags: ['Repository'],
    }),
  }),
})

export const {
  useSearchRepositoriesQuery,
  useGetUserRepositoriesQuery,
  useGetAuthenticatedUserRepositoriesQuery,
  useGetRepositoryQuery,
} = githubApi
