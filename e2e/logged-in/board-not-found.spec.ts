import { test, expect } from '../fixtures/coverage'

// Locks the /board/[id] not-found contract end-to-end: getBoardBundle returns
// null for a malformed id (boardIdSchema guard), for a well-formed but
// unseeded UUID (.maybeSingle() null) and for a board of another account, and
// the page calls notFound() in all three cases, rendering the segment-local
// board/[id]/not-found.tsx boundary.
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

  test('shows "Board not found" when opening another user\'s board by its id', async ({
    page,
  }) => {
    // Arrange: seed.sql gives other-user a board. A board opens only for the
    // account that owns it, so getBoardBundle must not return it to testuser.
    // Act
    await page.goto('/board/00000000-0000-0000-0000-000000000110')
    await page.waitForLoadState('networkidle')
    // Assert: the page says why, and does not show the board
    await expect(
      page.getByRole('heading', { name: 'Board not found' }),
    ).toBeVisible()
    await expect(
      page.getByText(
        "This board doesn't exist, was deleted, or belongs to another account.",
      ),
    ).toBeVisible()
    await expect(
      page.getByText('A board opens only for the account that owns it.'),
    ).toBeVisible()
    await expect(page.getByText('Other User Board')).toHaveCount(0)
  })
})
