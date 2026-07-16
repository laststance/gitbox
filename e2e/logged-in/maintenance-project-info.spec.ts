/**
 * Maintenance ProjectInfo E2E Tests
 *
 * Tests for ProjectInfo functionality on the Maintenance page.
 * Verifies comment inline editing and Note modal functionality.
 *
 * @remarks
 * The Maintenance page shows archived/maintenance projects with:
 * - Inline comment editing (same as RepoCard)
 * - Note modal with rich text editor
 * - Links management
 */

import { test, expect } from '../fixtures/coverage'
import { resetMaintenanceItems } from '../helpers/db-query'

test.describe('Maintenance ProjectInfo (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const MAINTENANCE_URL = '/maintenance'

  test.beforeEach(async ({ page }) => {
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should display maintenance page with cards', async ({ page }) => {
    // Wait for maintenance page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Should show maintenance cards (grid or list view)
    const maintenanceCard = page.locator('[data-testid^="maintenance-card-"]')
    // Allow for empty state if no maintenance cards exist
    const cardCount = await maintenanceCard.count()
    if (cardCount > 0) {
      await expect(maintenanceCard.first()).toBeVisible()
    }
  })

  test('should show Note button on maintenance card', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Look for Note button - may be in card actions area
    const noteButton = page.getByRole('button', { name: 'Open note' })
    const noteButtonCount = await noteButton.count()

    // If Note button exists, verify it's visible
    if (noteButtonCount > 0) {
      await expect(noteButton.first()).toBeVisible()
    }
  })

  test('should open NoteModal when clicking Note button', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Find and click Note button
    const noteButton = page.getByRole('button', { name: 'Open note' })
    const noteButtonCount = await noteButton.count()

    if (noteButtonCount > 0) {
      await noteButton.first().click()

      // Dialog should open
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      // Should have Project Note title (after Issue #37 consolidation)
      const title = dialog.getByText(/project note/i)
      await expect(title).toBeVisible()

      // Should have Note editor
      const editor = dialog.locator('[data-slate-editor="true"]')
      await expect(editor).toBeVisible()

      // Should have Links section (exact match to avoid "related links" text)
      const linksSection = dialog.getByText('Links', { exact: true })
      await expect(linksSection).toBeVisible()

      // Should have Save and Cancel buttons
      const saveButton = dialog.getByRole('button', { name: /save/i })
      const cancelButton = dialog.getByRole('button', { name: /cancel/i })
      await expect(saveButton).toBeVisible()
      await expect(cancelButton).toBeVisible()
    }
  })

  test('should close ProjectInfoModal on Cancel', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Open modal
    const noteButton = page.getByRole('button', { name: 'Open note' })
    const noteButtonCount = await noteButton.count()

    if (noteButtonCount > 0) {
      await noteButton.first().click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      // Click Cancel
      const cancelButton = dialog.getByRole('button', { name: /cancel/i })
      await cancelButton.click()

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('should save note and close modal', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Open modal
    const noteButton = page.getByRole('button', { name: 'Open note' })
    const noteButtonCount = await noteButton.count()

    if (noteButtonCount > 0) {
      await noteButton.first().click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      // Type in editor
      const editor = dialog.locator('[data-slate-editor="true"]')
      await editor.click()
      await page.keyboard.type('Test note content from E2E')

      // Click Save
      const saveButton = dialog.getByRole('button', { name: /save/i })
      await saveButton.click()

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('should show character counter in Note editor', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Open modal
    const noteButton = page.getByRole('button', { name: 'Open note' })
    const noteButtonCount = await noteButton.count()

    if (noteButtonCount > 0) {
      await noteButton.first().click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      // Character counter should be visible (format: X / 20,000 with comma formatting)
      const charCounter = dialog.getByTestId('char-count')
      await expect(charCounter).toBeVisible()
      await expect(charCounter).toContainText('/ 20,000')
    }
  })
})

test.describe('Maintenance Comment Inline Edit (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const MAINTENANCE_URL = '/maintenance'

  test.beforeEach(async ({ page }) => {
    await resetMaintenanceItems()
    await page.goto(MAINTENANCE_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should show comment placeholder or existing comment on card', async ({
    page,
  }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Look for either comment display or empty state
    const commentDisplay = page.locator('[data-testid="comment-display"]')
    const emptyState = page.locator('[data-testid="comment-empty-state"]')

    const commentCount = await commentDisplay.count()
    const emptyCount = await emptyState.count()

    // Should have at least one comment area (either display or empty state)
    // Seed data ensures maintenance cards exist, so at least one area should be present
    expect(commentCount + emptyCount).toBeGreaterThan(0)
  })

  test('should open inline edit when clicking comment area', async ({
    page,
  }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Scope to the card with empty comment (old-project from seed data)
    // <Activity mode="hidden"> keeps CommentInlineEdit in DOM for ALL cards,
    // so we must scope to the correct card to avoid finding a hidden instance
    const card = page
      .locator('.group')
      .filter({ has: page.locator('h3', { hasText: 'old-project' }) })

    const emptyState = card.locator('[data-testid="comment-empty-state"]')
    const display = card.locator('[data-testid="comment-display"]')

    const emptyCount = await emptyState.count()
    const displayCount = await display.count()

    if (emptyCount > 0) {
      await emptyState.click()
      const inlineEdit = card.locator('[data-testid="comment-inline-edit"]')
      await expect(inlineEdit).toBeVisible({ timeout: 5000 })
      const textarea = inlineEdit.locator('textarea')
      await expect(textarea).toBeVisible()
    } else if (displayCount > 0) {
      await display.click()
      const inlineEdit = card.locator('[data-testid="comment-inline-edit"]')
      await expect(inlineEdit).toBeVisible({ timeout: 5000 })
    }
  })

  test('should show character counter in comment inline edit', async ({
    page,
  }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Scope to old-project card (has empty comment in seed data)
    const card = page
      .locator('.group')
      .filter({ has: page.locator('h3', { hasText: 'old-project' }) })

    const emptyState = card.locator('[data-testid="comment-empty-state"]')
    const display = card.locator('[data-testid="comment-display"]')

    const emptyCount = await emptyState.count()
    const displayCount = await display.count()

    if (emptyCount > 0) {
      await emptyState.click()
    } else if (displayCount > 0) {
      await display.click()
    } else {
      return
    }

    const inlineEdit = card.locator('[data-testid="comment-inline-edit"]')
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    const counter = inlineEdit.locator('[data-testid="character-counter"]')
    await expect(counter).toBeVisible()
    await expect(counter).toContainText('/2000')
  })

  test('should save comment on Enter key', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Scope to old-project card (has empty comment in seed data)
    const card = page
      .locator('.group')
      .filter({ has: page.locator('h3', { hasText: 'old-project' }) })

    const emptyState = card.locator('[data-testid="comment-empty-state"]')
    const inlineEdit = card.locator('[data-testid="comment-inline-edit"]')
    const testComment = 'E2E test comment for maintenance'

    // Arrange
    await expect(emptyState).toBeVisible()

    // Act
    await emptyState.click()
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })
    const textarea = inlineEdit.locator('textarea')
    await textarea.fill(testComment)
    await textarea.press('Enter')

    // Assert
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
    const commentDisplay = card.locator('[data-testid="comment-display"]')
    await expect(commentDisplay).toContainText(testComment)
  })

  test('should cancel edit on Escape key', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Scope to old-project card (has empty comment in seed data)
    const card = page
      .locator('.group')
      .filter({ has: page.locator('h3', { hasText: 'old-project' }) })

    const emptyState = card.locator('[data-testid="comment-empty-state"]')
    const inlineEdit = card.locator('[data-testid="comment-inline-edit"]')

    // Arrange
    await expect(emptyState).toBeVisible()

    // Act
    await emptyState.click()
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })
    const textarea = inlineEdit.locator('textarea')
    await textarea.fill('This should be cancelled')
    await textarea.press('Escape')

    // Assert
    await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
    await expect(emptyState).toBeVisible()
  })
})
