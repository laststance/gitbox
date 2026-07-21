/** GitHub REST base URL shared by all server-side API clients. */
export const GITHUB_API_BASE_URL = 'https://api.github.com'

/** GitHub REST media type recommended for JSON responses. */
export const GITHUB_API_ACCEPT_HEADER = 'application/vnd.github+json'

/** GitHub REST version pinned so upstream response semantics stay stable. */
export const GITHUB_API_VERSION = '2026-03-10'

/** User-Agent required for GitHub REST requests. */
export const GITHUB_API_USER_AGENT = 'GitBox-App'

/** Maximum time an upstream GitHub request may occupy a server invocation. */
export const GITHUB_API_TIMEOUT_MS = 10_000

/** E2E-only token recognized by the GitHub MSW handlers. */
export const GITHUB_E2E_MOCK_TOKEN = 'mock-github-provider-token-for-testing'

/** GitHub's maximum supported repository page size. */
export const GITHUB_REPOSITORY_PAGE_SIZE = 100

/** Safety cap preserving the existing 1,000-item upper bound per catalog collection. */
export const GITHUB_CATALOG_MAX_PAGES = 10

/** One day keeps repeat picker opens fast while allowing automatic refreshes. */
export const GITHUB_REPOSITORY_CATALOG_REVALIDATE_SECONDS = 24 * 60 * 60

/** Milliseconds in one cache window; rotating keys make the 24-hour refresh blocking instead of stale-while-revalidate. */
export const GITHUB_REPOSITORY_CATALOG_WINDOW_MS =
  GITHUB_REPOSITORY_CATALOG_REVALIDATE_SECONDS * 1_000

/** Explicit affiliations covered by GitHub's authenticated-user repository API. */
export const GITHUB_REPOSITORY_AFFILIATIONS =
  'owner,collaborator,organization_member'

/** Bump when the cached repository catalog shape or loading semantics change. */
export const GITHUB_REPOSITORY_CATALOG_CACHE_VERSION =
  'github-repository-catalog-v2'
