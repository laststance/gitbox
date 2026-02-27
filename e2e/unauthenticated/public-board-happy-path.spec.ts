/**
 * Public Board Happy Path E2E Tests
 *
 * Tests for visiting a public board with a valid slug that has actual data.
 * Validates the read-only Kanban view renders correctly without authentication.
 *
 * The existing public-board.spec.ts covers 404 cases (invalid/empty slugs).
 * This file covers the successful path with real seed data.
 */

import { test, expect } from '../fixtures/coverage'
import {
  PUBLIC_BOARD_SLUG,
  BOARD_IDS,
  resetBoardPublicState,
} from '../helpers/db-query'

const PUBLIC_BOARD_URL = `/public/${PUBLIC_BOARD_SLUG}`

test.describe('Public Board Happy Path', () => {
  test.afterEach(async () => {
    await resetBoardPublicState()
  })

  test('should display public board with board name and Public badge', async ({
    page,
  }) => {
    await page.goto(PUBLIC_BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Verify board name in header
    await expect(page.locator('h1')).toContainText('Test Board')

    // Verify "Public" badge is visible
    await expect(page.getByText('Public', { exact: true })).toBeVisible()
  })

  test('should display columns and cards in read-only view', async ({
    page,
  }) => {
    await page.goto(PUBLIC_BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Verify at least one column header is visible (h2 elements in PublicColumn)
    const columnHeaders = page.locator('h2')
    await expect(columnHeaders.first()).toBeVisible()

    // Verify at least one card with a GitHub link is visible
    const githubLinks = page.locator('a[href^="https://github.com/"]')
    await expect(githubLinks.first()).toBeVisible()
  })

  test('should not show edit/drag/delete controls', async ({ page }) => {
    await page.goto(PUBLIC_BOARD_URL)
    await page.waitForLoadState('networkidle')

    // No overflow menu buttons (used in authenticated board view)
    await expect(page.getByRole('button', { name: /more/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /overflow/i })).toHaveCount(0)

    // No drag handles
    await expect(page.locator('[data-dnd-handle]')).toHaveCount(0)
    await expect(page.locator('[aria-roledescription="sortable"]')).toHaveCount(
      0,
    )

    // No settings button
    await expect(page.getByRole('button', { name: /settings/i })).toHaveCount(0)
  })

  test('should display footer with GitBox link', async ({ page }) => {
    await page.goto(PUBLIC_BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Verify "Created with GitBox" text
    await expect(page.getByText('Created with')).toBeVisible()

    // Verify GitBox link in footer (scoped to avoid strict mode with multiple same-href links)
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: 'GitBox' })).toBeVisible()

    // Verify "Create your own board" link
    const createLink = footer.getByRole('link', {
      name: 'Create your own board',
    })
    await expect(createLink).toBeVisible()
    await expect(createLink).toHaveAttribute(
      'href',
      'https://gitbox-laststance.vercel.app',
    )
  })

  test('should show card metadata (language, stars)', async ({ page }) => {
    await page.goto(PUBLIC_BOARD_URL)
    await page.waitForLoadState('networkidle')

    // Verify language metadata is visible (seed data has TypeScript cards)
    await expect(page.getByText('TypeScript').first()).toBeVisible()

    // Verify star count is visible (seed data cards have stars > 0)
    // Stars are rendered with a <Star> icon and a number like "42", "128", "500"
    await expect(page.getByText('42').first()).toBeVisible()
  })
})
