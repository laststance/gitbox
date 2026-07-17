import { isAxiosError, type AxiosInstance } from 'axios'
import { unstable_cache } from 'next/cache'

import { createGitHubAxios } from '@/lib/axios-github'
import {
  GITHUB_CATALOG_MAX_PAGES,
  GITHUB_REPOSITORY_AFFILIATIONS,
  GITHUB_REPOSITORY_CATALOG_CACHE_VERSION,
  GITHUB_REPOSITORY_CATALOG_REVALIDATE_SECONDS,
  GITHUB_REPOSITORY_CATALOG_WINDOW_MS,
  GITHUB_REPOSITORY_PAGE_SIZE,
} from '@/lib/constants/github'
import type {
  GitHubOrganization,
  GitHubRepository,
  GitHubRepositoryCatalog,
  GitHubUser,
} from '@/lib/types/github'

/** Base used when converting each SHA-256 byte into hexadecimal cache-key text. */
const HEX_RADIX = 16

/** Width of one byte after hexadecimal conversion. */
const HEX_BYTE_WIDTH = 2

interface GitHubRepositoryResponse {
  id: number
  name: string
  full_name: string
  owner?: {
    login?: string
    avatar_url?: string
  } | null
  description: string | null
  stargazers_count: number
  language: string | null
  topics: string[]
  visibility: GitHubRepository['visibility']
  updated_at: string
}

interface CatalogPage<T> {
  items: T[]
  upstreamItemCount: number
}

interface CatalogCacheContext {
  api: AxiosInstance
  cacheWindow: string
  tokenFingerprint: string
}

interface OrganizationRepositoryCatalog {
  organizations: GitHubOrganization[]
  repositoryResults: PromiseSettledResult<GitHubRepository[]>[]
}

interface CachedPageOptions<T> {
  cacheContext: CatalogCacheContext
  cacheKeyParts: string[]
  loadPage: () => Promise<CatalogPage<T>>
}

/**
 * Carries only a GitHub status code across Next's cache boundary so OAuth headers never reach logs.
 * @param status - Upstream HTTP status, or null when unavailable.
 * @returns A token-free error safe for Next.js cache diagnostics.
 * @example
 * new GitHubCatalogRequestError(401)
 */
class GitHubCatalogRequestError extends Error {
  readonly status: number | null

  constructor(status: number | null) {
    super(`GitHub catalog request failed with status ${status ?? 'unknown'}`)
    this.name = 'GitHubCatalogRequestError'
    this.status = status
  }
}

/**
 * Copies only picker and card-creation fields, skipping malformed rows that cannot be added safely.
 * @param repository - Raw repository returned by GitHub REST.
 * @returns A compact repository, or null when owner identity is missing.
 * @example
 * selectRepository(rawRepository) // => { id: 1, full_name: 'owner/repo', ... }
 */
function selectRepository(
  repository: GitHubRepositoryResponse,
): GitHubRepository | null {
  if (!repository.owner?.login) return null

  return {
    id: repository.id,
    name: repository.name,
    full_name: repository.full_name,
    owner: {
      login: repository.owner.login,
      avatar_url: repository.owner.avatar_url ?? '',
    },
    description: repository.description,
    stargazers_count: repository.stargazers_count,
    language: repository.language,
    topics: repository.topics,
    visibility: repository.visibility,
    updated_at: repository.updated_at,
  }
}

/**
 * Copies only identity fields needed by the repository picker filters.
 * @param user - Raw authenticated user returned by GitHub REST.
 * @returns The compact GitHub user shape consumed by GitBox.
 * @example
 * selectUser(rawUser) // => { id: 1, login: 'octocat', ... }
 */
function selectUser(user: GitHubUser): GitHubUser {
  return {
    id: user.id,
    login: user.login,
    avatar_url: user.avatar_url,
    name: user.name,
    type: user.type,
  }
}

/**
 * Copies only organization fields rendered by the repository picker.
 * @param organization - Raw organization returned by GitHub REST.
 * @returns The compact organization shape consumed by GitBox.
 * @example
 * selectOrganization(rawOrganization) // => { id: 1, login: 'laststance', ... }
 */
function selectOrganization(
  organization: GitHubOrganization,
): GitHubOrganization {
  return {
    id: organization.id,
    login: organization.login,
    avatar_url: organization.avatar_url,
    description: organization.description,
  }
}

/**
 * Converts an Axios failure into a credential-free error before Next.js can log cache refresh failures.
 * @param error - Failure raised while loading one GitHub page.
 * @returns A safe error containing only the upstream status.
 * @example
 * toSafeCatalogError(axiosError) // => GitHubCatalogRequestError
 */
function toSafeCatalogError(error: unknown): GitHubCatalogRequestError {
  return new GitHubCatalogRequestError(
    isAxiosError(error) ? (error.response?.status ?? null) : null,
  )
}

/**
 * Reads a token-free status from errors produced inside the catalog page cache.
 * @param error - Unknown error caught by the Server Action.
 * @returns The upstream GitHub status, or null for unrelated failures.
 * @example
 * getGitHubCatalogErrorStatus(error) // => 401
 */
export function getGitHubCatalogErrorStatus(error: unknown): number | null {
  return error instanceof GitHubCatalogRequestError ? error.status : null
}

/**
 * Caches one compact API page so no Data Cache entry approaches Next.js's 2 MiB limit.
 * @param options - Cache identity and the authenticated page loader.
 * @returns The cached compact items plus the raw item count used for pagination.
 * @example
 * await getCachedCatalogPage({ cacheContext, cacheKeyParts: ['repositories', 'user', '1'], loadPage })
 */
async function getCachedCatalogPage<T>({
  cacheContext,
  cacheKeyParts,
  loadPage,
}: CachedPageOptions<T>): Promise<CatalogPage<T>> {
  const getCachedPage = unstable_cache(
    async () => {
      try {
        return await loadPage()
      } catch (error) {
        // Never let Axios config.Authorization escape into Next.js cache logs.
        throw toSafeCatalogError(error)
      }
    },
    [
      GITHUB_REPOSITORY_CATALOG_CACHE_VERSION,
      cacheContext.tokenFingerprint,
      cacheContext.cacheWindow,
      ...cacheKeyParts,
    ],
    { revalidate: GITHUB_REPOSITORY_CATALOG_REVALIDATE_SECONDS },
  )

  return getCachedPage()
}

/**
 * Loads every organization in page-sized cache entries for large GitHub accounts.
 * @param cacheContext - Authenticated client and user-isolated cache identity.
 * @returns Up to 1,000 compact organizations.
 * @example
 * await fetchAllOrganizations(cacheContext) // => [{ id: 1, login: 'laststance', ... }]
 */
async function fetchAllOrganizations(
  cacheContext: CatalogCacheContext,
): Promise<GitHubOrganization[]> {
  const organizations: GitHubOrganization[] = []

  // Raw counts, rather than sanitized counts, decide whether another page exists.
  for (let page = 1; page <= GITHUB_CATALOG_MAX_PAGES; page += 1) {
    const searchParams = new URLSearchParams({
      per_page: GITHUB_REPOSITORY_PAGE_SIZE.toString(),
      page: page.toString(),
    })
    const cachedPage = await getCachedCatalogPage({
      cacheContext,
      cacheKeyParts: ['organizations', page.toString()],
      loadPage: async () => {
        const { data } = await cacheContext.api.get<GitHubOrganization[]>(
          `/user/orgs?${searchParams.toString()}`,
        )
        return {
          items: data.map(selectOrganization),
          upstreamItemCount: data.length,
        }
      },
    })

    organizations.push(...cachedPage.items)
    if (cachedPage.upstreamItemCount < GITHUB_REPOSITORY_PAGE_SIZE) break
  }

  return organizations
}

/**
 * Loads user or organization repositories into page-sized cache entries while dropping malformed rows.
 * @param cacheContext - Authenticated client and user-isolated cache identity.
 * @param organizationLogin - Organization to supplement, or undefined for `/user/repos`.
 * @returns Up to 1,000 compact repositories for this source.
 * @example
 * await fetchAllRepositories(cacheContext, 'laststance') // => [{ id: 1, ... }]
 */
async function fetchAllRepositories(
  cacheContext: CatalogCacheContext,
  organizationLogin?: string,
): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = []
  const sourceKey = organizationLogin ?? 'authenticated-user'

  // Each source retains the previous 1,000-item safety cap without creating one giant cache entry.
  for (let page = 1; page <= GITHUB_CATALOG_MAX_PAGES; page += 1) {
    const searchParams = new URLSearchParams({
      per_page: GITHUB_REPOSITORY_PAGE_SIZE.toString(),
      page: page.toString(),
    })

    if (organizationLogin) {
      searchParams.set('type', 'all')
    } else {
      searchParams.set('affiliation', GITHUB_REPOSITORY_AFFILIATIONS)
      searchParams.set('visibility', 'all')
      searchParams.set('sort', 'updated')
      searchParams.set('direction', 'desc')
    }

    const endpoint = organizationLogin
      ? `/orgs/${encodeURIComponent(organizationLogin)}/repos`
      : '/user/repos'
    const cachedPage = await getCachedCatalogPage({
      cacheContext,
      cacheKeyParts: ['repositories', sourceKey, page.toString()],
      loadPage: async () => {
        const { data } = await cacheContext.api.get<GitHubRepositoryResponse[]>(
          `${endpoint}?${searchParams.toString()}`,
        )
        const compactRepositories = data.reduce<GitHubRepository[]>(
          (selectedRepositories, repository) => {
            const selectedRepository = selectRepository(repository)
            if (selectedRepository)
              selectedRepositories.push(selectedRepository)
            return selectedRepositories
          },
          [],
        )

        return {
          items: compactRepositories,
          upstreamItemCount: data.length,
        }
      },
    })

    repositories.push(...cachedPage.items)
    if (cachedPage.upstreamItemCount < GITHUB_REPOSITORY_PAGE_SIZE) break
  }

  return repositories
}

/**
 * Starts every organization repository supplement immediately after membership pages resolve.
 * @param cacheContext - Authenticated client and user-isolated cache identity.
 * @returns Organizations plus settled repository groups so one unavailable org can be skipped.
 * @example
 * await fetchOrganizationRepositoryCatalog(cacheContext) // => { organizations, repositoryResults }
 */
async function fetchOrganizationRepositoryCatalog(
  cacheContext: CatalogCacheContext,
): Promise<OrganizationRepositoryCatalog> {
  const organizations = await fetchAllOrganizations(cacheContext)
  const repositoryResults = await Promise.allSettled(
    organizations.map(
      async (organization) =>
        await fetchAllRepositories(cacheContext, organization.login),
    ),
  )

  return { organizations, repositoryResults }
}

/**
 * Merges user and organization results by GitHub ID while preserving the user-updated order first.
 * @param repositoryGroups - User repositories followed by each organization result.
 * @returns One duplicate-free repository list.
 * @example
 * mergeRepositories([[repoA], [repoA, repoB]]) // => [repoA, repoB]
 */
function mergeRepositories(
  repositoryGroups: readonly GitHubRepository[][],
): GitHubRepository[] {
  const repositoriesById = new Map<number, GitHubRepository>()

  for (const repositoryGroup of repositoryGroups) {
    for (const repository of repositoryGroup) {
      // The first occurrence keeps `/user/repos` ordering and metadata precedence.
      if (!repositoriesById.has(repository.id)) {
        repositoriesById.set(repository.id, repository)
      }
    }
  }

  return [...repositoriesById.values()]
}

/**
 * Hashes the OAuth token so cache keys partition users without storing raw credentials.
 * @param token - GitHub OAuth token read from the httpOnly cookie.
 * @returns A lowercase SHA-256 fingerprint safe for cache-key material.
 * @example
 * await createTokenFingerprint('token') // => '3c469e9d6c5875d3...'
 */
async function createTokenFingerprint(token: string): Promise<string> {
  const tokenBytes = new TextEncoder().encode(token)
  const fingerprintBytes = await globalThis.crypto.subtle.digest(
    'SHA-256',
    tokenBytes,
  )

  return Array.from(new Uint8Array(fingerprintBytes), (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0'),
  ).join('')
}

/**
 * Produces a rotating key so a 24-hour boundary performs a blocking miss instead of serving stale data.
 * @returns The current UTC-aligned 24-hour cache window.
 * @example
 * getCacheWindow() // => '20650'
 */
function getCacheWindow(): string {
  return Math.floor(Date.now() / GITHUB_REPOSITORY_CATALOG_WINDOW_MS).toString()
}

/**
 * Validates the token live, then reuses page-cached user and organization repositories for 24 hours.
 * @param token - GitHub OAuth token captured before entering any cache scope.
 * @returns Current user, organizations, and the duplicate-free repository catalog.
 * @example
 * await getCachedGitHubRepositoryCatalog('gho_secret') // => { currentUser, organizations, repositories }
 */
export async function getCachedGitHubRepositoryCatalog(
  token: string,
): Promise<GitHubRepositoryCatalog> {
  const tokenFingerprint = await createTokenFingerprint(token)
  const cacheWindow = getCacheWindow()
  const api = createGitHubAxios({
    token,
    clearTokenCookieOnUnauthorized: false,
  })
  const cacheContext = { api, cacheWindow, tokenFingerprint }

  // `/user` is intentionally live: revoked credentials must never unlock stale private metadata.
  const [userResponse, userRepositories, organizationCatalog] =
    await Promise.all([
      api.get<GitHubUser>('/user'),
      fetchAllRepositories(cacheContext),
      fetchOrganizationRepositoryCatalog(cacheContext),
    ])
  const { organizations, repositoryResults: organizationRepositoryResults } =
    organizationCatalog
  const repositoryGroups = [userRepositories]

  for (const organizationResult of organizationRepositoryResults) {
    if (organizationResult.status === 'fulfilled') {
      repositoryGroups.push(organizationResult.value)
      continue
    }

    // A revoked token invalidates the whole response; other org failures preserve available user repos.
    if (getGitHubCatalogErrorStatus(organizationResult.reason) === 401) {
      throw organizationResult.reason
    }
  }

  return {
    currentUser: selectUser(userResponse.data),
    organizations,
    repositories: mergeRepositories(repositoryGroups),
  }
}
