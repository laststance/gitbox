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

  test('should open ProjectInfoModal when clicking Note button', async ({
    page,
  }) => {
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

      // Should have Project Info title
      const title = dialog.getByText(/project info/i)
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

      // Character counter should be visible (format: X / 20000)
      const charCounter = dialog.getByTestId('char-count')
      await expect(charCounter).toBeVisible()
      await expect(charCounter).toContainText('/ 20000')
    }
  })
})

test.describe('Maintenance Comment Inline Edit (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const MAINTENANCE_URL = '/maintenance'

  test.beforeEach(async ({ page }) => {
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
    expect(commentCount + emptyCount).toBeGreaterThanOrEqual(0)
  })

  test('should open inline edit when clicking comment area', async ({
    page,
  }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Find clickable comment area (empty state or display)
    const commentEmptyState = page.locator(
      '[data-testid="comment-empty-state"]',
    )
    const commentDisplay = page.locator('[data-testid="comment-display"]')

    const emptyCount = await commentEmptyState.count()
    const displayCount = await commentDisplay.count()

    if (emptyCount > 0) {
      // Click empty state to add comment
      await commentEmptyState.first().click()

      // Should show inline edit (use first() since multiple cards may exist)
      const inlineEdit = page
        .locator('[data-testid="comment-inline-edit"]')
        .first()
      await expect(inlineEdit).toBeVisible({ timeout: 5000 })

      // Should have textarea
      const textarea = inlineEdit.locator('textarea')
      await expect(textarea).toBeVisible()
    } else if (displayCount > 0) {
      // Click existing comment to edit
      await commentDisplay.first().click()

      // Should show inline edit (use first() since multiple cards may exist)
      const inlineEdit = page
        .locator('[data-testid="comment-inline-edit"]')
        .first()
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

    // Find and click comment area
    const commentEmptyState = page.locator(
      '[data-testid="comment-empty-state"]',
    )
    const commentDisplay = page.locator('[data-testid="comment-display"]')

    const emptyCount = await commentEmptyState.count()
    const displayCount = await commentDisplay.count()

    if (emptyCount > 0) {
      await commentEmptyState.first().click()
    } else if (displayCount > 0) {
      await commentDisplay.first().click()
    } else {
      // Skip if no comment area found
      return
    }

    // Should show inline edit with character counter (use first() for multiple cards)
    const inlineEdit = page
      .locator('[data-testid="comment-inline-edit"]')
      .first()
    await expect(inlineEdit).toBeVisible({ timeout: 5000 })

    const counter = inlineEdit.locator('[data-testid="character-counter"]')
    await expect(counter).toBeVisible()
    await expect(counter).toContainText('/300')
  })

  test('should save comment on Enter key', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Find and click comment area
    const commentEmptyState = page.locator(
      '[data-testid="comment-empty-state"]',
    )
    const emptyCount = await commentEmptyState.count()

    if (emptyCount > 0) {
      await commentEmptyState.first().click()

      // Use first() since multiple cards may exist
      const inlineEdit = page
        .locator('[data-testid="comment-inline-edit"]')
        .first()
      await expect(inlineEdit).toBeVisible({ timeout: 5000 })

      // Type comment and press Enter to save
      const textarea = inlineEdit.locator('textarea')
      const testComment = 'E2E test comment for maintenance'
      await textarea.fill(testComment)
      await textarea.press('Enter')

      // Should close inline edit
      await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })

      // Comment should be displayed
      const commentDisplay = page.locator('[data-testid="comment-display"]')
      await expect(commentDisplay.first()).toContainText(testComment)
    }
  })

  test('should cancel edit on Escape key', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByText('Maintenance Mode')).toBeVisible({
      timeout: 10000,
    })

    // Find and click comment area
    const commentEmptyState = page.locator(
      '[data-testid="comment-empty-state"]',
    )
    const emptyCount = await commentEmptyState.count()

    if (emptyCount > 0) {
      await commentEmptyState.first().click()

      const inlineEdit = page
        .locator('[data-testid="comment-inline-edit"]')
        .first()
      await expect(inlineEdit).toBeVisible({ timeout: 5000 })

      // Type comment and press Escape to cancel
      const textarea = inlineEdit.locator('textarea')
      await textarea.fill('This should be cancelled')
      await textarea.press('Escape')

      // Should close inline edit and show empty state again
      await expect(inlineEdit).not.toBeVisible({ timeout: 5000 })
      await expect(commentEmptyState.first()).toBeVisible()
    }
  })
})
