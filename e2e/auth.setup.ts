import { test as setup } from './fixtures/coverage'

/**
 * Path to store authenticated browser state for reuse across tests.
 * Contains cookies and localStorage after auth setup completes.
 */
export const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * Compute the Supabase auth cookie name from the Supabase URL.
 *
 * @supabase/supabase-js derives the storage key (= cookie name) as:
 *   `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
 *
 * For local dev (http://127.0.0.1:54321), this becomes `sb-127-auth-token`.
 * For production (https://xxx.supabase.co), it becomes `sb-xxx-auth-token`.
 *
 * @see node_modules/@supabase/supabase-js/dist/index.cjs line ~202
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_AUTH_COOKIE_NAME = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

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
 * Pre-computed JWT for E2E test mode.
 *
 * Signed with the well-known local Supabase JWT secret.
 * Claims: iss=supabase-demo, role=authenticated,
 *   sub=00000000-0000-0000-0000-000000000001, aud=authenticated, exp=2032
 *
 * PostgREST validates this JWT and sets auth.uid() = sub claim for RLS.
 */
const E2E_TEST_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxOTgzODEyOTk2fQ.iUckNAR3RMWPmn8smgOZr0NeDUzRLR0LOx_5V1ddQVs'

/**
 * Creates a mock Supabase session token with a valid JWT.
 *
 * The access_token is a real JWT that PostgREST can validate, enabling
 * auth.uid() to return the mock user UUID for RLS policy evaluation.
 *
 * @returns JSON string of session data (Supabase SSR expects JSON, not Base64)
 */
function createMockSupabaseSession(): string {
  const session = {
    access_token: E2E_TEST_JWT,
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
 * LIMITATION: This mock auth works for UI rendering but NOT for server-side auth
 * validation. Tests that verify database mutations after UI actions will fail
 * because supabase.auth.getUser() returns null with the mock token.
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
  // Cookie name must match the storageKey that @supabase/supabase-js computes
  // from the Supabase URL: `sb-${hostname.split('.')[0]}-auth-token`
  await page.context().addCookies([
    {
      name: SUPABASE_AUTH_COOKIE_NAME,
      value: createMockSupabaseSession(),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false, // localhost doesn't use HTTPS
      sameSite: 'Lax',
    },
  ])

  // Inject GitHub provider token cookie
  await page.context().addCookies([
    {
      name: 'gh_token_gitbox',
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
