/**
 * GitHub API Mock Handlers
 *
 * MSW handlers for GitHub REST API endpoints.
 * Provides mock data for user, repositories, and organizations.
 *
 * @see https://docs.github.com/en/rest
 */
import { http, HttpResponse, type HttpHandler } from 'msw'

import {
  GITHUB_API_URL,
  getSearchParams,
  mockGitHubUser,
  mockGitHubRepos,
  mockGitHubOrgs,
} from './data'

// ============================================================================
// GitHub API Handlers
// ============================================================================

export const githubApiHandlers: HttpHandler[] = [
  /**
   * GET /user - Get authenticated GitHub user
   */
  http.get(`${GITHUB_API_URL}/user`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    return HttpResponse.json(mockGitHubUser)
  }),

  /**
   * GET /user/repos - Get authenticated user's repositories
   */
  http.get(`${GITHUB_API_URL}/user/repos`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    const params = getSearchParams(request)
    const sort = params.get('sort') || 'updated'
    const perPage = parseInt(params.get('per_page') || '30', 10)
    const page = parseInt(params.get('page') || '1', 10)

    let repos = [...mockGitHubRepos]

    // Sort repositories
    if (sort === 'updated') {
      repos.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
    } else if (sort === 'created') {
      repos.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    } else if (sort === 'pushed') {
      repos.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
    } else if (sort === 'full_name') {
      repos.sort((a, b) => a.full_name.localeCompare(b.full_name))
    }

    // Paginate
    const start = (page - 1) * perPage
    repos = repos.slice(start, start + perPage)

    return HttpResponse.json(repos)
  }),

  /**
   * GET /user/orgs - Get authenticated user's organizations
   */
  http.get(`${GITHUB_API_URL}/user/orgs`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    return HttpResponse.json(mockGitHubOrgs)
  }),

  /**
   * GET /repos/:owner/:repo - Get a specific repository
   */
  http.get(`${GITHUB_API_URL}/repos/:owner/:repo`, ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    const { owner, repo } = params
    const fullName = `${owner}/${repo}`

    const foundRepo = mockGitHubRepos.find((r) => r.full_name === fullName)

    if (!foundRepo) {
      return HttpResponse.json({ message: 'Not Found' }, { status: 404 })
    }

    return HttpResponse.json(foundRepo)
  }),

  /**
   * GET /search/repositories - Search repositories
   */
  http.get(`${GITHUB_API_URL}/search/repositories`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    const params = getSearchParams(request)
    const query = params.get('q') || ''

    // Simple search filter
    const items = mockGitHubRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        (repo.description?.toLowerCase().includes(query.toLowerCase()) ??
          false),
    )

    return HttpResponse.json({
      total_count: items.length,
      incomplete_results: false,
      items,
    })
  }),
]
