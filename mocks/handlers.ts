/**
 * MSW Handlers for Storybook
 *
 * Mock Service Worker handlers for mocking API requests in Storybook stories.
 * Handles GitHub API and Supabase API calls.
 */

import { http, HttpResponse } from 'msw'

import type { GitHubRepository } from '@/lib/github/api'

const GITHUB_API_BASE_URL = 'https://api.github.com'

// Mock GitHub repositories data
const mockRepositories: GitHubRepository[] = [
  {
    id: 1,
    node_id: 'MDEwOlJlcG9zaXRvcnkx',
    name: 'example-repo',
    full_name: 'octocat/example-repo',
    owner: {
      login: 'octocat',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    description: 'An example repository for testing',
    html_url: 'https://github.com/octocat/example-repo',
    homepage: null,
    stargazers_count: 100,
    watchers_count: 50,
    language: 'TypeScript',
    topics: ['react', 'nextjs', 'typescript'],
    visibility: 'public',
    updated_at: '2024-01-15T10:00:00Z',
    created_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 2,
    node_id: 'MDEwOlJlcG9zaXRvcnky',
    name: 'another-repo',
    full_name: 'octocat/another-repo',
    owner: {
      login: 'octocat',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    description: 'Another example repository',
    html_url: 'https://github.com/octocat/another-repo',
    homepage: 'https://example.com',
    stargazers_count: 200,
    watchers_count: 100,
    language: 'JavaScript',
    topics: ['nodejs', 'express'],
    visibility: 'public',
    updated_at: '2024-01-20T15:30:00Z',
    created_at: '2023-06-15T00:00:00Z',
  },
]

export const handlers = [
  // GitHub API: Search repositories
  http.get(`${GITHUB_API_BASE_URL}/search/repositories`, ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('q') || ''

    // Filter mock repositories based on query
    const filteredRepos = mockRepositories.filter((repo) =>
      repo.name.toLowerCase().includes(query.toLowerCase()),
    )

    return HttpResponse.json({
      total_count: filteredRepos.length,
      incomplete_results: false,
      items: filteredRepos,
    })
  }),

  // GitHub API: Get authenticated user repositories
  http.get(`${GITHUB_API_BASE_URL}/user/repos`, () => {
    return HttpResponse.json(mockRepositories)
  }),

  // GitHub API: Get user repositories
  http.get(`${GITHUB_API_BASE_URL}/users/:username/repos`, () => {
    return HttpResponse.json(mockRepositories)
  }),

  // GitHub API: Get specific repository
  http.get(`${GITHUB_API_BASE_URL}/repos/:owner/:repo`, ({ params }) => {
    const { owner, repo } = params
    const repository = mockRepositories.find(
      (r) => r.owner.login === owner && r.name === repo,
    )

    if (!repository) {
      return HttpResponse.json({ message: 'Not Found' }, { status: 404 })
    }

    return HttpResponse.json(repository)
  }),

  // Supabase Auth: Get session (mock)
  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'test@example.com',
      user_metadata: {
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        full_name: 'Test User',
      },
    })
  }),

  // Supabase Auth: Get session
  http.get('*/auth/v1/session', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'mock-user-id',
        email: 'test@example.com',
        user_metadata: {
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          full_name: 'Test User',
        },
      },
    })
  }),
]
