/**
 * Comment Display E2E Tests
 *
 * Tests for Phase 3: Comment Display on RepoCard
 * Verifies that inline comments are displayed correctly in Card-in-Card style.
 *
 * @see https://github.com/laststance/gitbox/issues/20
 *
 * @remarks
 * These tests verify:
 * - Comments are fetched and displayed on RepoCards
 * - Empty state is shown for cards without comments
 * - Comment styling is applied correctly (Card-in-Card UI)
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Comment Display on RepoCard (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should display comments on RepoCards that have projectinfo.comment', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // card-1 has comment "npmリリース完了、当分は機能追加予定なし"
    const card1CommentDisplay = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-display"]',
    )
    await expect(card1CommentDisplay).toBeVisible({ timeout: 10000 })
    await expect(card1CommentDisplay).toContainText('npmリリース完了')

    // card-2 has comment "プロトタイプ作ったけど微妙"
    const card2CommentDisplay = page.locator(
      '[data-testid="repo-card-card-2"] [data-testid="comment-display"]',
    )
    await expect(card2CommentDisplay).toBeVisible({ timeout: 10000 })
    await expect(card2CommentDisplay).toContainText('プロトタイプ作ったけど')
  })

  test('should show empty state for cards without comments', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // card-3 has empty comment - should show empty state
    const card3EmptyState = page.locator(
      '[data-testid="repo-card-card-3"] [data-testid="comment-empty-state"]',
    )
    await expect(card3EmptyState).toBeVisible({ timeout: 10000 })
    await expect(card3EmptyState).toContainText('Add comment')
  })

  test('should display comment with Card-in-Card styling', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // Check that comment display has Card-in-Card styling (left border)
    const commentDisplay = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-display"]',
    )
    await expect(commentDisplay).toBeVisible({ timeout: 10000 })

    // Verify styling: should have border-l-4 class (left border accent)
    await expect(commentDisplay).toHaveClass(/border-l-4/)
  })

  test('should show message icon in comment display', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // Check that comment display contains the message square icon
    const commentDisplay = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-display"]',
    )
    await expect(commentDisplay).toBeVisible({ timeout: 10000 })

    // MessageSquare icon should be present (lucide-react icon)
    const messageIcon = commentDisplay.locator('svg').first()
    await expect(messageIcon).toBeVisible()
  })

  test('should display full comment text without truncation', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // card-2 has a longer comment
    const commentText = page.locator(
      '[data-testid="repo-card-card-2"] [data-testid="comment-text"]',
    )
    await expect(commentText).toBeVisible({ timeout: 10000 })

    // Full text should be visible (not truncated)
    await expect(commentText).toContainText('プロトタイプ作ったけど微妙')
    await expect(commentText).toContainText('差分表示エディタで苦戦中')
  })

  test('should handle cards without projectinfo gracefully', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // card-5 has no projectinfo at all - should show empty state
    const card5 = page.locator('[data-testid="repo-card-card-5"]')
    if (await card5.isVisible()) {
      const emptyState = card5.locator('[data-testid="comment-empty-state"]')
      await expect(emptyState).toBeVisible({ timeout: 5000 })
    }
  })

  test('should allow typing Space key in comment edit without triggering drag', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // Click on the empty state / comment area to enter edit mode
    // card-3 has empty comment - use it for testing
    const card3EmptyState = page.locator(
      '[data-testid="repo-card-card-3"] [data-testid="comment-empty-state"]',
    )
    await expect(card3EmptyState).toBeVisible({ timeout: 10000 })
    await card3EmptyState.click()

    // Wait for inline edit to appear
    const inlineEdit = page.locator(
      '[data-testid="repo-card-card-3"] [data-testid="comment-inline-edit"]',
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Get the textarea
    const textarea = page.locator(
      '[data-testid="repo-card-card-3"] [data-testid="comment-textarea"]',
    )
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await expect(textarea).toBeFocused()

    // Type text with spaces - this should NOT trigger dnd-kit drag mode
    const testText = 'Test comment with multiple spaces'
    await textarea.fill(testText)

    // Verify the text was entered correctly (including spaces)
    await expect(textarea).toHaveValue(testText)

    // Verify no drag overlay is visible (drag mode was not triggered)
    const dragOverlay = page.locator('[data-dnd-kit-drag-overlay]')
    await expect(dragOverlay).not.toBeVisible()

    // Press Escape to cancel without saving
    await textarea.press('Escape')

    // Inline edit should close
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
  })

  test('should save comment with spaces via Enter key', async ({ page }) => {
    await page.goto(BOARD_URL)

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')

    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // Click on existing comment to enter edit mode
    // card-1 has a comment already
    const card1CommentDisplay = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-display"]',
    )
    await expect(card1CommentDisplay).toBeVisible({ timeout: 10000 })
    await card1CommentDisplay.click()

    // Wait for inline edit to appear
    const inlineEdit = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-inline-edit"]',
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Get the textarea
    const textarea = page.locator(
      '[data-testid="repo-card-card-1"] [data-testid="comment-textarea"]',
    )
    await expect(textarea).toBeVisible({ timeout: 5000 })

    // Clear and type new text with spaces
    await textarea.clear()
    const newComment = 'Updated comment with spaces'
    await textarea.fill(newComment)

    // Verify the text was entered correctly
    await expect(textarea).toHaveValue(newComment)

    // Press Enter to save (without Shift)
    await textarea.press('Enter')

    // Inline edit should close after save
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })

    // Comment display should show the new text
    await expect(card1CommentDisplay).toBeVisible({ timeout: 5000 })
    await expect(card1CommentDisplay).toContainText(newComment)
  })
})
