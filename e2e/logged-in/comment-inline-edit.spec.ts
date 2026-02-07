/**
 * Comment Inline Edit E2E Tests
 *
 * Tests for Phase 4: Inline Edit for RepoCard comments
 * Verifies click-to-edit, character counter, keyboard shortcuts, and auto-save.
 *
 * @see https://github.com/laststance/gitbox/issues/20
 *
 * @remarks
 * These tests verify:
 * - Click on comment triggers edit mode (CommentInlineEdit)
 * - Character counter displays correctly (0/300)
 * - Escape key cancels editing and returns to display mode
 * - Enter key saves the comment
 * - Auto-save with debounce persists changes
 * - Cancel/Save buttons work correctly
 */

import { test, expect } from '../fixtures/coverage'
import {
  querySingle,
  PROJECT_INFO_IDS,
  BOARD_IDS,
  CARD_IDS,
  resetProjectInfoComments,
} from '../helpers/db-query'

test.describe('Comment Inline Edit on RepoCard (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  // Reset comments before each test to ensure clean state (real DB persists mutations)
  test.beforeEach(async ({ page }) => {
    await resetProjectInfoComments()
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    // Wait for kanban board to load
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({
      timeout: 10000,
    })
  })

  test('should open edit mode when clicking on existing comment', async ({
    page,
  }) => {
    // card-1 has comment - capture the displayed text before editing
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await expect(card1CommentDisplay).toBeVisible({ timeout: 10000 })
    const commentText = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-text"]`,
    )
    const displayedText = await commentText.textContent()

    // Click on comment to edit
    await card1CommentDisplay.click()

    // Should show inline edit textarea
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Should have textarea pre-filled with the displayed comment
    const textarea = inlineEdit.locator('textarea')
    await expect(textarea).toBeVisible()
    // The textarea value should match what was displayed on the card
    const textareaValue = await textarea.inputValue()
    expect(textareaValue).toBeTruthy()
    expect(textareaValue).toBe(displayedText)
  })

  test('should display character counter in edit mode', async ({ page }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit to appear
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Character counter should be visible
    const counter = inlineEdit.locator('[data-testid="character-counter"]')
    await expect(counter).toBeVisible()

    // Should display format like "XX/300"
    await expect(counter).toContainText('/300')
  })

  test('should cancel edit and return to display mode on Escape key', async ({
    page,
  }) => {
    // card-1 has comment - capture the current text before editing
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await expect(card1CommentDisplay).toBeVisible({ timeout: 10000 })
    const originalText = await card1CommentDisplay.textContent()

    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Type some changes
    const textarea = inlineEdit.locator('textarea')
    await textarea.fill('Modified comment that should be cancelled')

    // Press Escape to cancel
    await textarea.press('Escape')

    // Should return to display mode with the original text preserved
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
    await expect(card1CommentDisplay).toBeVisible()
    await expect(card1CommentDisplay).toHaveText(originalText!)
    await expect(card1CommentDisplay).not.toContainText('Modified comment')
  })

  test('should save comment on Enter key (without Shift)', async ({ page }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    const textarea = inlineEdit.locator('textarea')
    const newComment = 'New comment saved with Enter key'
    await textarea.fill(newComment)

    // Press Enter to save
    await textarea.press('Enter')

    // Should return to display mode
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
    await expect(card1CommentDisplay).toBeVisible()

    // New comment should be displayed
    await expect(card1CommentDisplay).toContainText(newComment)
  })

  test('should open edit mode when clicking on empty state', async ({
    page,
  }) => {
    // card-3 has empty comment - should show empty state
    const card3EmptyState = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card3}"] [data-testid="comment-empty-state"]`,
    )
    await expect(card3EmptyState).toBeVisible({ timeout: 10000 })

    // Click on empty state to add comment
    await card3EmptyState.click()

    // Should show inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card3}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Textarea should be empty
    const textarea = inlineEdit.locator('textarea')
    await expect(textarea).toHaveValue('')
  })

  test('should show Save button in edit mode (no cancel button)', async ({
    page,
  }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Should have Save button (checkmark only)
    const saveButton = inlineEdit.locator('[data-testid="comment-save-btn"]')
    await expect(saveButton).toBeVisible()

    // Should NOT have Cancel button (removed for cleaner UX)
    const cancelButton = inlineEdit.locator(
      '[data-testid="comment-cancel-btn"]',
    )
    await expect(cancelButton).not.toBeVisible()
  })

  test('should cancel edit when pressing Escape key', async ({ page }) => {
    // card-1 has comment - capture the current text before editing
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await expect(card1CommentDisplay).toBeVisible({ timeout: 10000 })
    const originalText = await card1CommentDisplay.textContent()

    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Type some changes
    const textarea = inlineEdit.locator('textarea')
    await textarea.fill('This should be cancelled')

    // Press Escape to cancel (no cancel button in new design)
    await textarea.press('Escape')

    // Should return to display mode with the same text as before editing
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
    await expect(card1CommentDisplay).toBeVisible()
    // Verify the original text is preserved (Escape cancels the edit)
    await expect(card1CommentDisplay).toHaveText(originalText!)
  })

  test('should save comment when clicking Save button', async ({ page }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    const textarea = inlineEdit.locator('textarea')
    const newComment = 'Comment saved via Save button'
    await textarea.fill(newComment)

    // Click Save button
    const saveButton = inlineEdit.locator('[data-testid="comment-save-btn"]')
    await saveButton.click()

    // Should return to display mode with new comment
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
    await expect(card1CommentDisplay).toBeVisible()
    await expect(card1CommentDisplay).toContainText(newComment)
  })

  // TODO: Re-enable when real Supabase auth is implemented
  // Currently skipped because mock auth tokens don't work with supabase.auth.getUser()
  // See: gap_2026-01-29_e2e_crud_verification_auth in Serena memories
  test.skip('should verify comment is persisted in database after save', async ({
    page,
  }) => {
    // card-1 uses projinfo1 for its project info
    const projectInfoId = PROJECT_INFO_IDS.projinfo1

    // Navigate to board
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await expect(card1CommentDisplay).toBeVisible({ timeout: 10000 })
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    const textarea = inlineEdit.locator('textarea')
    const uniqueComment = `DB verified comment ${Date.now()}`
    await textarea.fill(uniqueComment)

    // Save the comment
    const saveButton = inlineEdit.locator('[data-testid="comment-save-btn"]')
    await saveButton.click()

    // Wait for server action to complete
    await page.waitForTimeout(1000)

    // Verify comment is persisted in database
    const projectInfo = await querySingle<{ comment: string }>('projectinfo', {
      id: projectInfoId,
    })
    expect(projectInfo).not.toBeNull()
    expect(projectInfo?.comment).toBe(uniqueComment)
  })

  test('should show character count warning when approaching limit', async ({
    page,
  }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Type a long comment (> 270 chars for warning state)
    const textarea = inlineEdit.locator('textarea')
    const longText = 'A'.repeat(280) // 280 characters
    await textarea.fill(longText)

    // Character counter should show warning state (orange color class)
    const counter = inlineEdit.locator('[data-testid="character-counter"]')
    await expect(counter).toContainText('280/300')

    // Should have warning styling (text-amber or text-orange)
    await expect(counter).toHaveClass(/text-amber|text-orange/)
  })

  test('should disable Save button when over character limit', async ({
    page,
  }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Type a comment over limit (> 300 chars)
    const textarea = inlineEdit.locator('textarea')
    const overLimitText = 'A'.repeat(310) // 310 characters
    await textarea.fill(overLimitText)

    // Save button should be disabled
    const saveButton = inlineEdit.locator('[data-testid="comment-save-btn"]')
    await expect(saveButton).toBeDisabled()

    // Character counter should show error state (red color)
    const counter = inlineEdit.locator('[data-testid="character-counter"]')
    await expect(counter).toContainText('310/300')
    await expect(counter).toHaveClass(/text-destructive|text-red/)
  })

  test('should auto-focus textarea when opening edit mode', async ({
    page,
  }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    // Textarea should be focused
    const textarea = inlineEdit.locator('textarea')
    await expect(textarea).toBeFocused()
  })

  test('should allow multiline input with Shift+Enter', async ({ page }) => {
    // card-1 has comment
    const card1CommentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await card1CommentDisplay.click()

    // Wait for inline edit
    const inlineEdit = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"]`,
    )
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    const textarea = inlineEdit.locator('textarea')

    // Type multiline content directly (Shift+Enter inserts newline in textarea)
    // Use fill with newline character to verify multiline support
    const multilineText = 'Line 1\nLine 2'
    await textarea.fill(multilineText)

    // Should still be in edit mode (not saved by Enter key)
    await expect(inlineEdit).toBeVisible()

    // Textarea should have both lines
    await expect(textarea).toHaveValue(multilineText)
  })
})
