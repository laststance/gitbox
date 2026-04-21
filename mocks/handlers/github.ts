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

/**
 * Returns a 401 response matching GitHub's shape when no Bearer token is present.
 * Returns null when the request is authenticated.
 */
function requireBearerAuth(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      { message: 'Requires authentication' },
      { status: 401 },
    )
  }
  return null
}

export const githubApiHandlers: HttpHandler[] = [
  http.get(`${GITHUB_API_URL}/user`, ({ request }) => {
    const unauthorized = requireBearerAuth(request)
    if (unauthorized) return unauthorized
    return HttpResponse.json(mockGitHubUser)
  }),

  http.get(`${GITHUB_API_URL}/user/repos`, ({ request }) => {
    const unauthorized = requireBearerAuth(request)
    if (unauthorized) return unauthorized

    const params = getSearchParams(request)
    const sort = params.get('sort') || 'updated'
    const perPage = parseInt(params.get('per_page') || '30', 10)
    const page = parseInt(params.get('page') || '1', 10)

    const repos = [...mockGitHubRepos]

    switch (sort) {
      case 'updated':
      case 'pushed':
        repos.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        break
      case 'created':
        repos.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        break
      case 'full_name':
        repos.sort((a, b) => a.full_name.localeCompare(b.full_name))
        break
    }

    const start = (page - 1) * perPage
    return HttpResponse.json(repos.slice(start, start + perPage))
  }),

  http.get(`${GITHUB_API_URL}/user/orgs`, ({ request }) => {
    const unauthorized = requireBearerAuth(request)
    if (unauthorized) return unauthorized
    return HttpResponse.json(mockGitHubOrgs)
  }),

  http.get(`${GITHUB_API_URL}/orgs/:org/repos`, ({ params, request }) => {
    const unauthorized = requireBearerAuth(request)
    if (unauthorized) return unauthorized

    const { org } = params
    const searchParams = getSearchParams(request)
    const perPage = parseInt(searchParams.get('per_page') || '30', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)

    const orgRepos = mockGitHubRepos.filter((repo) => repo.owner.login === org)
    const start = (page - 1) * perPage
    return HttpResponse.json(orgRepos.slice(start, start + perPage))
  }),

  http.get(`${GITHUB_API_URL}/repos/:owner/:repo`, ({ params, request }) => {
    const unauthorized = requireBearerAuth(request)
    if (unauthorized) return unauthorized

    const { owner, repo } = params
    const foundRepo = mockGitHubRepos.find(
      (r) => r.full_name === `${owner}/${repo}`,
    )

    if (!foundRepo) {
      return HttpResponse.json({ message: 'Not Found' }, { status: 404 })
    }

    return HttpResponse.json(foundRepo)
  }),

  http.get(`${GITHUB_API_URL}/search/repositories`, ({ request }) => {
    const unauthorized = requireBearerAuth(request)
    if (unauthorized) return unauthorized

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
