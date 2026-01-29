import { test as setup } from './fixtures/coverage'

/**
 * Path to store authenticated browser state for reuse across tests.
 * Contains cookies and localStorage after auth setup completes.
 */
export const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * Local Supabase project reference.
 * For local development, Supabase uses "gitbox" as project_id (from config.toml).
 * The cookie name format is: sb-{project-id}-auth-token
 */
const SUPABASE_PROJECT_REF = 'gitbox'

/**
 * Test user data matching seed.sql.
 * Uses UUID format for local Supabase compatibility.
 */
const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001', // UUID from seed.sql
  email: 'test@gitbox.dev',
  user_metadata: {
    avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    full_name: 'Test User',
    preferred_username: 'testuser',
    user_name: 'testuser',
  },
}

/**
 * Creates a mock Supabase session token.
 * This is a simplified session structure for testing purposes.
 *
 * @returns JSON string of mock session data (Supabase SSR expects JSON, not Base64)
 */
function createMockSupabaseSession(): string {
  const session = {
    access_token: 'mock-access-token-for-testing',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token-for-testing',
    user: MOCK_USER,
  }

  // Supabase SSR stores session as JSON string (NOT base64)
  return JSON.stringify(session)
}

/**
 * Auth setup test that injects authentication cookies directly.
 *
 * Instead of going through the OAuth flow (which requires real GitHub credentials),
 * this setup injects the necessary cookies to simulate an authenticated state:
 *
 * 1. Supabase auth token cookie (sb-{project-ref}-auth-token)
 * 2. GitHub provider token cookie (gh_token_{project-ref-prefix})
 *
 * The storage state is saved to AUTH_FILE for reuse by dependent test projects.
 *
 * NOTE: For local Supabase, the project ref is "gitbox" (from config.toml project_id).
 */
setup('inject auth cookies', async ({ page }) => {
  // Use configured baseURL, with fallback for direct execution
  const baseURL =
    process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3008'

  // Navigate to the app first to establish the domain context
  await page.goto(baseURL)

  // Inject Supabase auth cookie
  // Cookie name format: sb-{project-ref}-auth-token
  await page.context().addCookies([
    {
      name: `sb-${SUPABASE_PROJECT_REF}-auth-token`,
      value: createMockSupabaseSession(),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false, // localhost doesn't use HTTPS
      sameSite: 'Lax',
    },
  ])

  // Inject GitHub provider token cookie
  // Cookie name format: gh_token_{first 8 chars of project ref}
  const projectRefPrefix = SUPABASE_PROJECT_REF.substring(0, 8)
  await page.context().addCookies([
    {
      name: `gh_token_${projectRefPrefix}`,
      value: 'mock-github-provider-token-for-testing',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  // Save the authenticated state for reuse by other test projects
  await page.context().storageState({ path: AUTH_FILE })
})
