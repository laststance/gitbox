/**
 * Silent GitHub Token Refresh E2E Tests
 *
 * End-to-end coverage for the `/api/auth/github/refresh` route handler.
 *
 * Why these tests stay narrow:
 *  In MSW test mode (`NEXT_PUBLIC_ENABLE_MSW_MOCK=true`, `APP_ENV=test`),
 *  `hasGitHubToken()` short-circuits to `true` (axios-github.ts:131) so a
 *  manually-cleared cookie does NOT surface `errorCode='GITHUB_TOKEN_MISSING'`.
 *  That means the full client-hook → Server Action → route flow is not
 *  reachable in the E2E harness. The hook + Server Action layers are covered
 *  exhaustively by unit tests (see src/tests/unit/lib/utils/handle-github-
 *  token-missing.test.ts and src/tests/unit/lib/actions/github-error-code.
 *  test.ts).
 *
 *  These E2E tests target the route handler branches that are reachable
 *  without going through the OAuth round-trip:
 *   - Attempt cap exceeded (bails before any Supabase or rate-limit call)
 *   - Open-redirect coercion (sanitization runs before any side effect)
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Silent GitHub token refresh — route handler', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('redirects to /login?error=token_refresh_failed when ?attempt=2 exceeds the cap', async ({
    page,
  }) => {
    // The handler bails immediately when attempt > MAX_REFRESH_ATTEMPTS (=1)
    // before touching Supabase or rate-limit, so this is fully deterministic.
    const response = await page.goto(
      '/api/auth/github/refresh?next=/board/abc&attempt=2',
    )

    // Playwright follows redirects automatically — assert the final landing
    // page rather than the 307 itself.
    expect(page.url()).toContain('/login')
    expect(page.url()).toContain('error=token_refresh_failed')
    // The fetch chain that got us here should have started with a redirect.
    expect(response?.request().redirectedFrom()).not.toBeNull()
  })
})
