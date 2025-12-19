/**
 * GitHub REST API Client (RTK Query)
 *
 * Manages communication with GitHub REST API using RTK Query
 * Used for repository search and metadata retrieval
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// GitHub API base URL
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
      // Add GitHub OAuth token (retrieved from Supabase session)
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
  endpoints: (builder) => ({
    // Repository search
    searchRepositories: builder.query<
      SearchRepositoriesResponse,
      SearchRepositoriesParams
    >({
      query: (params) => ({
        url: '/search/repositories',
        params,
      }),
      providesTags: ['Repository'],
    }),

    // Get user's repository list
    getUserRepositories: builder.query<GitHubRepository[], string>({
      query: (username) => `/users/${username}/repos`,
      providesTags: ['Repository'],
    }),

    // Get authenticated user's repository list
    getAuthenticatedUserRepositories: builder.query<
      GitHubRepository[],
      {
        sort?: 'created' | 'updated' | 'pushed' | 'full_name'
        per_page?: number
      }
    >({
      query: (params) => ({
        url: '/user/repos',
        params: {
          sort: params.sort || 'updated',
          per_page: params.per_page || 100,
        },
      }),
      providesTags: ['Repository'],
    }),

    // Get specific repository details
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
