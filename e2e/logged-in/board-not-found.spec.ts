import { test, expect } from '../fixtures/coverage'

// Locks the /board/[id] not-found contract end-to-end: getBoardBundle returns
// null for both a malformed id (boardIdSchema guard) and a well-formed but
// unseeded UUID (.maybeSingle() null), and the page calls notFound() in both
// cases, rendering the segment-local board/[id]/not-found.tsx boundary.
test.describe('Board Not Found', () => {
  // Lives under logged-in/, so it inherits the stored session by project
  // convention; but APP_ENV=test makes the proxy bypass auth, so what's under
  // test is the null-bundle -> notFound() -> segment boundary, not the gate.
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('shows "Board not found" heading for malformed board id', async ({
    page,
  }) => {
    // Arrange: 'not-a-uuid' fails boardIdSchema, so getBoardBundle returns null
    // before any Postgres round-trip and BoardPage calls notFound().
    // Act
    await page.goto('/board/not-a-uuid')
    // Settle to networkidle, per the project's e2e page-load wait strategy.
    await page.waitForLoadState('networkidle')
    // Assert
    // Next.js App Router may stream a 200 status before notFound() throws,
    // so verify the 404 page content instead of the HTTP status code.
    await expect(
      page.getByRole('heading', { name: 'Board not found' }),
    ).toBeVisible()
  })

  test('shows "Board not found" heading for unseeded board UUID', async ({
    page,
  }) => {
    // Arrange: a well-formed UUID with no matching row makes .maybeSingle()
    // resolve null, so getBoardBundle returns null and BoardPage calls notFound().
    // Act
    await page.goto('/board/00000000-0000-0000-0000-000000000999')
    // Settle to networkidle, per the project's e2e page-load wait strategy.
    await page.waitForLoadState('networkidle')
    // Assert
    // Next.js App Router may stream a 200 status before notFound() throws,
    // so verify the 404 page content instead of the HTTP status code.
    await expect(
      page.getByRole('heading', { name: 'Board not found' }),
    ).toBeVisible()
  })
})
