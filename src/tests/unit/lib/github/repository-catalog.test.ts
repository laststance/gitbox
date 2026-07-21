import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cacheHarness = vi.hoisted(() => {
  const cachedResults = new Map<string, Promise<unknown>>()
  const unstableCache = vi.fn(
    (
      loader: () => Promise<unknown>,
      keyParts: string[],
      _options?: { revalidate?: number },
    ) => {
      return async (): Promise<unknown> => {
        const cacheKey = JSON.stringify(keyParts)
        const cachedResult = cachedResults.get(cacheKey)

        // A matching page key returns the original pending or resolved load.
        if (cachedResult) return cachedResult

        // Rejections are removed because Next.js only persists successful loads.
        const pendingResult = loader().catch((error: unknown) => {
          cachedResults.delete(cacheKey)
          throw error
        })
        cachedResults.set(cacheKey, pendingResult)
        return pendingResult
      }
    },
  )

  return { cachedResults, unstableCache }
})

const githubAxiosHarness = vi.hoisted(() => ({
  createGitHubAxios: vi.fn(),
}))

const loggerHarness = vi.hoisted(() => ({
  warn: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: cacheHarness.unstableCache,
}))

vi.mock('@/lib/axios-github', () => ({
  createGitHubAxios: githubAxiosHarness.createGitHubAxios,
}))

vi.mock('@/lib/logger', () => ({
  createModuleLogger: vi.fn(() => ({ warn: loggerHarness.warn })),
}))

import {
  getCachedGitHubRepositoryCatalog,
  getGitHubCatalogErrorStatus,
} from '@/lib/github/repository-catalog'

const AUTHENTICATED_USER = {
  id: 1,
  login: 'octocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  name: 'The Octocat',
  type: 'User',
  email: 'private@example.com',
}

const LASTSTANCE_ORGANIZATION = {
  id: 10,
  login: 'laststance',
  avatar_url: 'https://avatars.githubusercontent.com/laststance',
  description: 'Laststance organization',
  node_id: 'ORG_10',
}

const USER_REPOSITORY_PAGE_ONE_URL =
  '/user/repos?per_page=100&page=1&affiliation=owner%2Ccollaborator%2Corganization_member&visibility=all&sort=updated&direction=desc'
const USER_REPOSITORY_PAGE_TWO_URL =
  '/user/repos?per_page=100&page=2&affiliation=owner%2Ccollaborator%2Corganization_member&visibility=all&sort=updated&direction=desc'
const ORGANIZATION_PAGE_ONE_URL = '/user/orgs?per_page=100&page=1'
const LASTSTANCE_REPOSITORY_PAGE_ONE_URL =
  '/orgs/laststance/repos?per_page=100&page=1&type=all'

const CACHE_WINDOW_DURATION_MS = 86_400_000
const BASE_CACHE_WINDOW = 20_000
const BASE_CACHE_WINDOW_MS = BASE_CACHE_WINDOW * CACHE_WINDOW_DURATION_MS
const NEXT_DATA_CACHE_ENTRY_LIMIT_BYTES = 2 * 1_024 * 1_024
const GITHUB_REPOSITORY_NAME_MAX_LENGTH = 100
const GITHUB_REPOSITORY_DESCRIPTION_MAX_LENGTH = 350
const GITHUB_OWNER_LOGIN_MAX_LENGTH = 39
const GITHUB_TOPIC_MAX_COUNT = 20
const GITHUB_TOPIC_MAX_LENGTH = 50

interface CachedPageValue {
  items: unknown[]
  upstreamItemCount: number
}

/**
 * Creates stable GitHub repository payloads so page-cache assertions remain deterministic.
 * @param id - Repository identifier and numeric suffix.
 * @param ownerLogin - Owner login, or null for a malformed upstream row.
 * @returns A raw GitHub payload containing picker fields and unused large-response fields.
 * @example
 * createRepository(2, 'laststance') // => { id: 2, full_name: 'laststance/repo-2', ... }
 */
function createRepository(id: number, ownerLogin: string | null = 'octocat') {
  return {
    id,
    node_id: `REPO_${id}`,
    name: `repo-${id}`,
    full_name: `${ownerLogin ?? 'unknown'}/repo-${id}`,
    owner: ownerLogin
      ? {
          login: ownerLogin,
          avatar_url: `https://avatars.githubusercontent.com/${ownerLogin}/${id}`,
          type: 'User',
        }
      : null,
    description: `Repository ${id}`,
    html_url: `https://github.com/${ownerLogin ?? 'unknown'}/repo-${id}`,
    homepage: null,
    stargazers_count: id,
    watchers_count: id + 1,
    language: 'TypeScript',
    topics: ['nextjs'],
    visibility: 'public',
    updated_at: '2026-07-17T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    private: false,
  }
}

/**
 * Creates consecutive raw repository pages at GitHub's 100-item boundary.
 * @param count - Number of repositories on the page.
 * @param startId - Identifier assigned to the first repository.
 * @returns Deterministic raw repository payloads.
 * @example
 * createRepositories(2, 101) // => [{ id: 101, ... }, { id: 102, ... }]
 */
function createRepositories(count: number, startId: number) {
  return Array.from({ length: count }, (_, index) =>
    createRepository(startId + index),
  )
}

/**
 * Returns Axios-like responses by exact URL so unexpected catalog requests fail loudly.
 * @param responsesByUrl - Raw GitHub response data keyed by requested relative URL.
 * @returns A mocked Axios get method.
 * @example
 * createApiGet(new Map([['/user', AUTHENTICATED_USER]]))
 */
function createApiGet(responsesByUrl: ReadonlyMap<string, unknown>) {
  return vi.fn(async (url: string) => {
    if (!responsesByUrl.has(url)) {
      throw new Error(`Unexpected GitHub request: ${url}`)
    }

    return { data: responsesByUrl.get(url) }
  })
}

/**
 * Narrows cached unknown values before size and per-page item assertions run.
 * @param value - Value resolved from the fake Next.js Data Cache.
 * @returns Whether the value has the catalog page contract.
 * @example
 * isCachedPageValue({ items: [], upstreamItemCount: 0 }) // => true
 */
function isCachedPageValue(value: unknown): value is CachedPageValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray(value.items) &&
    'upstreamItemCount' in value &&
    typeof value.upstreamItemCount === 'number'
  )
}

/**
 * Builds a credential-bearing Axios failure fixture for auth and org-fallback branches.
 * @param status - GitHub HTTP response status.
 * @param rawToken - Secret embedded in the Axios message, response, and Authorization header.
 * @returns An AxiosError shaped like a rejected authenticated GitHub request.
 * @example
 * createCredentialBearingAxiosError(401, 'gho_secret') // => AxiosError with response.status 401
 */
function createCredentialBearingAxiosError(status: number, rawToken: string) {
  const requestConfig = {
    headers: new axios.AxiosHeaders({
      Authorization: `Bearer ${rawToken}`,
    }),
  }
  return new axios.AxiosError(
    `GitHub rejected ${rawToken}`,
    'ERR_BAD_REQUEST',
    requestConfig,
    undefined,
    {
      status,
      data: { message: `GitHub ${status} for ${rawToken}` },
      statusText: `GitHub ${status}`,
      headers: new axios.AxiosHeaders(),
      config: requestConfig,
    },
  )
}

/**
 * Creates 100 raw repositories populated to GitHub's documented field limits.
 * @returns One maximum-sized upstream page with unique numeric IDs.
 * @example
 * createMaximumFieldRepositoryPage() // => [{ id: 1, name: 'rrrr…' }, ...]
 */
function createMaximumFieldRepositoryPage() {
  const ownerLogin = 'o'.repeat(GITHUB_OWNER_LOGIN_MAX_LENGTH)
  const repositoryName = 'r'.repeat(GITHUB_REPOSITORY_NAME_MAX_LENGTH)
  const description = 'd'.repeat(GITHUB_REPOSITORY_DESCRIPTION_MAX_LENGTH)
  const topics = Array.from({ length: GITHUB_TOPIC_MAX_COUNT }, () =>
    't'.repeat(GITHUB_TOPIC_MAX_LENGTH),
  )

  return Array.from({ length: 100 }, (_, index) => ({
    ...createRepository(index + 1, ownerLogin),
    name: repositoryName,
    full_name: `${ownerLogin}/${repositoryName}`,
    description,
    topics,
  }))
}

describe('GitHub repository catalog page cache', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    cacheHarness.cachedResults.clear()
    cacheHarness.unstableCache.mockClear()
    githubAxiosHarness.createGitHubAxios.mockReset()
    loggerHarness.warn.mockReset()
    dateNowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(BASE_CACHE_WINDOW_MS + 1_000)
  })

  afterEach(() => {
    dateNowSpy.mockRestore()
  })

  it('supplements 100-item user pages with organization repositories while retaining one duplicate and every org-only repository', async () => {
    // Arrange
    const rawToken = 'gho_catalog_test'
    const userRepositories = createRepositories(100, 1)
    const duplicateFromOrganization = {
      ...createRepository(1, 'laststance'),
      description: 'Organization duplicate must not replace user metadata',
    }
    const organizationOnlyRepository = createRepository(101, 'laststance')
    const apiGet = createApiGet(
      new Map<string, unknown>([
        ['/user', AUTHENTICATED_USER],
        [ORGANIZATION_PAGE_ONE_URL, [LASTSTANCE_ORGANIZATION]],
        [USER_REPOSITORY_PAGE_ONE_URL, userRepositories],
        [USER_REPOSITORY_PAGE_TWO_URL, []],
        [
          LASTSTANCE_REPOSITORY_PAGE_ONE_URL,
          [duplicateFromOrganization, organizationOnlyRepository],
        ],
      ]),
    )
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    const catalog = await getCachedGitHubRepositoryCatalog(rawToken)
    const cachedPages = await Promise.all(cacheHarness.cachedResults.values())
    const cacheKeys = cacheHarness.unstableCache.mock.calls.map(
      ([, keyParts]) => keyParts,
    )
    const requestedUrls = apiGet.mock.calls.map(([url]) => url)

    // Assert
    expect(apiGet).toHaveBeenCalledWith(USER_REPOSITORY_PAGE_TWO_URL)
    expect(apiGet).toHaveBeenCalledWith(LASTSTANCE_REPOSITORY_PAGE_ONE_URL)
    expect(
      requestedUrls.indexOf(LASTSTANCE_REPOSITORY_PAGE_ONE_URL),
    ).toBeGreaterThan(requestedUrls.indexOf(ORGANIZATION_PAGE_ONE_URL))
    expect(catalog.organizations).toEqual([
      {
        id: 10,
        login: 'laststance',
        avatar_url: 'https://avatars.githubusercontent.com/laststance',
        description: 'Laststance organization',
      },
    ])
    expect(catalog.repositories).toHaveLength(101)
    expect(catalog.repositories.filter(({ id }) => id === 1)).toHaveLength(1)
    expect(catalog.repositories[0]).toMatchObject({
      id: 1,
      owner: { login: 'octocat' },
      description: 'Repository 1',
    })
    expect(catalog.repositories[100]).toMatchObject({
      id: 101,
      full_name: 'laststance/repo-101',
      owner: { login: 'laststance' },
    })
    expect(cacheKeys).toEqual(
      expect.arrayContaining([
        [
          'github-repository-catalog-v2',
          'cff7f5a35e4cc4db5b0316e6e17ec3c59c1d96ca296edba59399094601cd7fd6',
          '20000',
          'organizations',
          '1',
        ],
        [
          'github-repository-catalog-v2',
          'cff7f5a35e4cc4db5b0316e6e17ec3c59c1d96ca296edba59399094601cd7fd6',
          '20000',
          'repositories',
          'authenticated-user',
          '1',
        ],
        [
          'github-repository-catalog-v2',
          'cff7f5a35e4cc4db5b0316e6e17ec3c59c1d96ca296edba59399094601cd7fd6',
          '20000',
          'repositories',
          'authenticated-user',
          '2',
        ],
        [
          'github-repository-catalog-v2',
          'cff7f5a35e4cc4db5b0316e6e17ec3c59c1d96ca296edba59399094601cd7fd6',
          '20000',
          'repositories',
          'laststance',
          '1',
        ],
      ]),
    )
    expect(JSON.stringify(cacheKeys)).not.toContain(rawToken)
    for (const [, , cacheOptions] of cacheHarness.unstableCache.mock.calls) {
      expect(cacheOptions).toEqual({ revalidate: 86_400 })
    }
    expect(cachedPages).toHaveLength(4)

    for (const cachedPage of cachedPages) {
      if (!isCachedPageValue(cachedPage)) {
        throw new Error(
          'Expected every cache entry to contain one catalog page',
        )
      }

      // Each value remains one GitHub page and safely below Next.js's 2 MiB ceiling.
      expect(cachedPage.items.length).toBeLessThanOrEqual(100)
      expect(
        new TextEncoder().encode(JSON.stringify(cachedPage)).byteLength,
      ).toBeLessThan(NEXT_DATA_CACHE_ENTRY_LIMIT_BYTES)
    }
  })

  it('keeps a 100-repository page below 2 MiB when every cached field uses GitHub maximum-sized values', async () => {
    // Arrange
    const maximumFieldRepositories = createMaximumFieldRepositoryPage()
    const apiGet = createApiGet(
      new Map<string, unknown>([
        ['/user', AUTHENTICATED_USER],
        [ORGANIZATION_PAGE_ONE_URL, []],
        [USER_REPOSITORY_PAGE_ONE_URL, maximumFieldRepositories],
        [USER_REPOSITORY_PAGE_TWO_URL, []],
      ]),
    )
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    const catalog = await getCachedGitHubRepositoryCatalog(
      'gho_maximum_field_page',
    )
    const pageOneCacheEntry = [...cacheHarness.cachedResults.entries()].find(
      ([cacheKey]) =>
        cacheKey.includes('"repositories","authenticated-user","1"'),
    )
    const cachedPageOne = await pageOneCacheEntry?.[1]

    // Assert
    expect(catalog.repositories).toHaveLength(100)
    for (const repository of catalog.repositories) {
      expect(repository.name).toHaveLength(GITHUB_REPOSITORY_NAME_MAX_LENGTH)
      expect(repository.full_name).toHaveLength(
        GITHUB_OWNER_LOGIN_MAX_LENGTH + 1 + GITHUB_REPOSITORY_NAME_MAX_LENGTH,
      )
      expect(repository.owner.login).toHaveLength(GITHUB_OWNER_LOGIN_MAX_LENGTH)
      expect(repository.description).toHaveLength(
        GITHUB_REPOSITORY_DESCRIPTION_MAX_LENGTH,
      )
      expect(repository.topics).toHaveLength(GITHUB_TOPIC_MAX_COUNT)
      expect(
        repository.topics.every(
          (topic) => topic.length === GITHUB_TOPIC_MAX_LENGTH,
        ),
      ).toBe(true)
    }
    if (!isCachedPageValue(cachedPageOne)) {
      throw new Error('Expected the maximum-field repository page in cache')
    }
    expect(cachedPageOne.items).toHaveLength(100)
    expect(
      new TextEncoder().encode(JSON.stringify(cachedPageOne)).byteLength,
    ).toBeLessThan(NEXT_DATA_CACHE_ENTRY_LIMIT_BYTES)
  })

  it('skips null and missing owners without failing the catalog and still requests page two after 100 raw rows', async () => {
    // Arrange
    const rawPageOne = createRepositories(100, 1)
    rawPageOne[19] = createRepository(20, null)
    const repositoryWithoutOwner = rawPageOne[79]
    if (!repositoryWithoutOwner) {
      throw new Error('Expected deterministic repository fixture at index 79')
    }
    Reflect.deleteProperty(repositoryWithoutOwner, 'owner')
    const apiGet = createApiGet(
      new Map<string, unknown>([
        ['/user', AUTHENTICATED_USER],
        [ORGANIZATION_PAGE_ONE_URL, []],
        [USER_REPOSITORY_PAGE_ONE_URL, rawPageOne],
        [USER_REPOSITORY_PAGE_TWO_URL, [createRepository(101)]],
      ]),
    )
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    const catalog = await getCachedGitHubRepositoryCatalog(
      'gho_malformed_owner',
    )
    const pageOneCacheEntry = [...cacheHarness.cachedResults.entries()].find(
      ([cacheKey]) =>
        cacheKey.includes('"repositories","authenticated-user","1"'),
    )
    const cachedPageOne = await pageOneCacheEntry?.[1]

    // Assert
    expect(apiGet).toHaveBeenCalledWith(USER_REPOSITORY_PAGE_TWO_URL)
    expect(catalog.repositories).toHaveLength(99)
    expect(catalog.repositories.some(({ id }) => id === 20)).toBe(false)
    expect(catalog.repositories.some(({ id }) => id === 80)).toBe(false)
    expect(catalog.repositories.some(({ id }) => id === 101)).toBe(true)
    if (!isCachedPageValue(cachedPageOne)) {
      throw new Error('Expected the first user repository page in cache')
    }
    expect(cachedPageOne.upstreamItemCount).toBe(100)
    expect(cachedPageOne.items).toHaveLength(98)
  })

  it('rejects the whole catalog when organization supplementation reports a revoked 401 token', async () => {
    // Arrange
    const rawToken = 'gho_revoked_during_org_supplement'
    const apiGet = vi.fn(async (url: string) => {
      if (url === '/user') return { data: AUTHENTICATED_USER }
      if (url === ORGANIZATION_PAGE_ONE_URL) {
        return { data: [LASTSTANCE_ORGANIZATION] }
      }
      if (url === USER_REPOSITORY_PAGE_ONE_URL) {
        return { data: [createRepository(1)] }
      }
      if (url === LASTSTANCE_REPOSITORY_PAGE_ONE_URL) {
        throw createCredentialBearingAxiosError(401, rawToken)
      }
      throw new Error(`Unexpected GitHub request: ${url}`)
    })
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    let catalogError: unknown
    try {
      await getCachedGitHubRepositoryCatalog(rawToken)
    } catch (error) {
      catalogError = error
    }

    // Assert
    expect(getGitHubCatalogErrorStatus(catalogError)).toBe(401)
    expect(apiGet).toHaveBeenCalledWith(USER_REPOSITORY_PAGE_ONE_URL)
    expect(apiGet).toHaveBeenCalledWith(LASTSTANCE_REPOSITORY_PAGE_ONE_URL)
  })

  it.each([404, 500])(
    'returns authenticated-user repositories when optional organization supplementation responds %i',
    async (organizationStatus) => {
      // Arrange
      const rawToken = `gho_org_partial_${organizationStatus}`
      const apiGet = vi.fn(async (url: string) => {
        if (url === '/user') return { data: AUTHENTICATED_USER }
        if (url === ORGANIZATION_PAGE_ONE_URL) {
          return { data: [LASTSTANCE_ORGANIZATION] }
        }
        if (url === USER_REPOSITORY_PAGE_ONE_URL) {
          return { data: [createRepository(1)] }
        }
        if (url === LASTSTANCE_REPOSITORY_PAGE_ONE_URL) {
          throw createCredentialBearingAxiosError(organizationStatus, rawToken)
        }
        throw new Error(`Unexpected GitHub request: ${url}`)
      })
      githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

      // Act
      const catalog = await getCachedGitHubRepositoryCatalog(rawToken)

      // Assert
      expect(catalog.organizations).toHaveLength(1)
      expect(catalog.repositories.map(({ id }) => id)).toEqual([1])
      expect(apiGet).toHaveBeenCalledWith(LASTSTANCE_REPOSITORY_PAGE_ONE_URL)
      expect(loggerHarness.warn).toHaveBeenCalledWith(
        { status: organizationStatus },
        'Skipping GitHub organization repository supplementation',
      )
    },
  )

  it.each([429, 500])(
    'returns authenticated-user repositories when the organization list responds %i',
    async (organizationStatus) => {
      // Arrange
      const rawToken = `gho_org_list_partial_${organizationStatus}`
      const apiGet = vi.fn(async (url: string) => {
        if (url === '/user') return { data: AUTHENTICATED_USER }
        if (url === USER_REPOSITORY_PAGE_ONE_URL) {
          return { data: [createRepository(1)] }
        }
        if (url === ORGANIZATION_PAGE_ONE_URL) {
          throw createCredentialBearingAxiosError(organizationStatus, rawToken)
        }
        throw new Error(`Unexpected GitHub request: ${url}`)
      })
      githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

      // Act
      const catalog = await getCachedGitHubRepositoryCatalog(rawToken)

      // Assert
      expect(catalog.organizations).toEqual([])
      expect(catalog.repositories.map(({ id }) => id)).toEqual([1])
      expect(loggerHarness.warn).toHaveBeenCalledWith(
        { status: organizationStatus },
        'Skipping GitHub organization list supplementation',
      )
      expect(JSON.stringify(loggerHarness.warn.mock.calls)).not.toContain(
        rawToken,
      )
    },
  )

  it('rejects the whole catalog when the organization list reports a revoked token', async () => {
    // Arrange
    const rawToken = 'gho_revoked_during_org_list'
    const apiGet = vi.fn(async (url: string) => {
      if (url === '/user') return { data: AUTHENTICATED_USER }
      if (url === USER_REPOSITORY_PAGE_ONE_URL) {
        return { data: [createRepository(1)] }
      }
      if (url === ORGANIZATION_PAGE_ONE_URL) {
        throw createCredentialBearingAxiosError(401, rawToken)
      }
      throw new Error(`Unexpected GitHub request: ${url}`)
    })
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    let catalogError: unknown
    try {
      await getCachedGitHubRepositoryCatalog(rawToken)
    } catch (error) {
      catalogError = error
    }

    // Assert
    expect(getGitHubCatalogErrorStatus(catalogError)).toBe(401)
    expect(loggerHarness.warn).not.toHaveBeenCalled()
  })

  it('validates the user live on every open while reusing all collection pages in the same 24-hour window', async () => {
    // Arrange
    let userValidationCount = 0
    const apiGet = vi.fn(async (url: string) => {
      if (url === '/user') {
        userValidationCount += 1
        return {
          data: {
            ...AUTHENTICATED_USER,
            name: `Validated ${userValidationCount}`,
          },
        }
      }
      if (url === ORGANIZATION_PAGE_ONE_URL) return { data: [] }
      if (url === USER_REPOSITORY_PAGE_ONE_URL) {
        return { data: [createRepository(1)] }
      }
      throw new Error(`Unexpected GitHub request: ${url}`)
    })
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    const firstCatalog =
      await getCachedGitHubRepositoryCatalog('gho_same_window')
    const secondCatalog =
      await getCachedGitHubRepositoryCatalog('gho_same_window')
    const requestedUrls = apiGet.mock.calls.map(([url]) => url)

    // Assert
    expect(firstCatalog.currentUser.name).toBe('Validated 1')
    expect(secondCatalog.currentUser.name).toBe('Validated 2')
    expect(requestedUrls.filter((url) => url === '/user')).toHaveLength(2)
    expect(
      requestedUrls.filter((url) => url === ORGANIZATION_PAGE_ONE_URL),
    ).toHaveLength(1)
    expect(
      requestedUrls.filter((url) => url === USER_REPOSITORY_PAGE_ONE_URL),
    ).toHaveLength(1)
    expect(githubAxiosHarness.createGitHubAxios).toHaveBeenCalledTimes(2)
  })

  it('rejects a second open when live user validation returns 401 instead of exposing already-cached collections', async () => {
    // Arrange
    const rawToken = 'gho_revoked_after_collection_cache'
    let userValidationCount = 0
    const apiGet = vi.fn(async (url: string) => {
      if (url === '/user') {
        userValidationCount += 1
        if (userValidationCount === 2) {
          throw createCredentialBearingAxiosError(401, rawToken)
        }
        return { data: AUTHENTICATED_USER }
      }
      if (url === ORGANIZATION_PAGE_ONE_URL) return { data: [] }
      if (url === USER_REPOSITORY_PAGE_ONE_URL) {
        return { data: [createRepository(1)] }
      }
      throw new Error(`Unexpected GitHub request: ${url}`)
    })
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    const firstCatalog = await getCachedGitHubRepositoryCatalog(rawToken)
    let secondOpenError: unknown
    try {
      await getCachedGitHubRepositoryCatalog(rawToken)
    } catch (error) {
      secondOpenError = error
    }
    const requestedUrls = apiGet.mock.calls.map(([url]) => url)

    // Assert
    expect(firstCatalog.repositories.map(({ id }) => id)).toEqual([1])
    expect(axios.isAxiosError(secondOpenError)).toBe(true)
    if (!axios.isAxiosError(secondOpenError)) {
      throw new Error('Expected live user validation to reject with AxiosError')
    }
    expect(secondOpenError.response?.status).toBe(401)
    expect(requestedUrls.filter((url) => url === '/user')).toHaveLength(2)
    expect(
      requestedUrls.filter((url) => url === ORGANIZATION_PAGE_ONE_URL),
    ).toHaveLength(1)
    expect(
      requestedUrls.filter((url) => url === USER_REPOSITORY_PAGE_ONE_URL),
    ).toHaveLength(1)
  })

  it('performs a blocking collection miss with a new page key after crossing the 24-hour window', async () => {
    // Arrange
    let repositoryPageRequestCount = 0
    const apiGet = vi.fn(async (url: string) => {
      if (url === '/user') return { data: AUTHENTICATED_USER }
      if (url === ORGANIZATION_PAGE_ONE_URL) return { data: [] }
      if (url === USER_REPOSITORY_PAGE_ONE_URL) {
        repositoryPageRequestCount += 1
        return { data: [createRepository(repositoryPageRequestCount)] }
      }
      throw new Error(`Unexpected GitHub request: ${url}`)
    })
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    const firstCatalog = await getCachedGitHubRepositoryCatalog(
      'gho_window_rollover',
    )
    dateNowSpy.mockReturnValue(
      BASE_CACHE_WINDOW_MS + CACHE_WINDOW_DURATION_MS + 1_000,
    )
    const secondCatalog = await getCachedGitHubRepositoryCatalog(
      'gho_window_rollover',
    )
    const cacheKeys = cacheHarness.unstableCache.mock.calls.map(
      ([, keyParts]) => keyParts,
    )

    // Assert
    expect(firstCatalog.repositories.map(({ id }) => id)).toEqual([1])
    expect(secondCatalog.repositories.map(({ id }) => id)).toEqual([2])
    expect(repositoryPageRequestCount).toBe(2)
    expect(cacheKeys.some((keyParts) => keyParts.includes('20000'))).toBe(true)
    expect(cacheKeys.some((keyParts) => keyParts.includes('20001'))).toBe(true)
  })

  it('redacts an Axios 401 from every thrown surface and retries the failed page for the same token', async () => {
    // Arrange
    const rawToken = 'gho_do_not_leak_this_secret'
    const unauthorizedErrorFixture = createCredentialBearingAxiosError(
      401,
      rawToken,
    )
    let repositoryPageRequestCount = 0
    const apiGet = vi.fn(async (url: string) => {
      if (url === '/user') return { data: AUTHENTICATED_USER }
      if (url === ORGANIZATION_PAGE_ONE_URL) return { data: [] }
      if (url === USER_REPOSITORY_PAGE_ONE_URL) {
        repositoryPageRequestCount += 1
        if (repositoryPageRequestCount === 1) {
          throw unauthorizedErrorFixture
        }
        return { data: [createRepository(1)] }
      }
      throw new Error(`Unexpected GitHub request: ${url}`)
    })
    githubAxiosHarness.createGitHubAxios.mockReturnValue({ get: apiGet })

    // Act
    let firstError: unknown
    try {
      await getCachedGitHubRepositoryCatalog(rawToken)
    } catch (error) {
      firstError = error
    }
    const retriedCatalog = await getCachedGitHubRepositoryCatalog(rawToken)
    const requestedUrls = apiGet.mock.calls.map(([url]) => url)

    // Assert
    if (!(firstError instanceof Error)) {
      throw new Error('Expected the first catalog load to reject with Error')
    }
    expect(firstError.name).toBe('GitHubCatalogRequestError')
    expect(firstError.message).toBe(
      'GitHub catalog request failed with status 401',
    )
    expect(getGitHubCatalogErrorStatus(firstError)).toBe(401)
    expect(unauthorizedErrorFixture.message).toContain(rawToken)
    expect(unauthorizedErrorFixture.config?.headers.Authorization).toBe(
      `Bearer ${rawToken}`,
    )
    expect(firstError.stack).not.toContain(rawToken)
    expect(JSON.stringify(firstError)).not.toContain(rawToken)
    expect(String(firstError)).not.toContain(rawToken)
    expect(retriedCatalog.repositories.map(({ id }) => id)).toEqual([1])
    expect(repositoryPageRequestCount).toBe(2)
    expect(requestedUrls.filter((url) => url === '/user')).toHaveLength(2)
    expect(
      requestedUrls.filter((url) => url === ORGANIZATION_PAGE_ONE_URL),
    ).toHaveLength(1)
  })
})
