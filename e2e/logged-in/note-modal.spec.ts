/**
 * NoteModal E2E Tests
 *
 * Tests for the NoteModal component which uses the full Plate Editor.
 * Requires authentication (uses storageState from auth.setup.ts)
 *
 * Features tested:
 * - Modal opening from repo card Note button
 * - Plate Editor visibility and basic functionality
 * - Text formatting (bold, italic, etc.)
 * - Slash commands
 * - Character count validation
 */

import { test, expect } from '../fixtures/coverage'

test.describe('NoteModal (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    // Use networkidle to wait for all data fetches to complete
    // This prevents flakiness caused by cards not being rendered yet
    await page.waitForLoadState('networkidle')
  })

  test('should open NoteModal from repo card Note button', async ({ page }) => {
    // Wait for cards to load (testid pattern: repo-card-{id})
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Click on the Note button (has aria-label="Open note")
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await expect(noteButton).toBeVisible()
    await noteButton.click()

    // NoteModal should be visible
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Dialog should have "Project Note" title
    const title = dialog.getByText(/project note/i)
    await expect(title).toBeVisible()
  })

  test('should display Plate Editor in the modal', async ({ page }) => {
    // Open NoteModal via Note button
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Plate Editor should be visible via data-testid="note-editor"
    const editor = dialog.locator('[data-testid="note-editor"]')
    await expect(editor).toBeVisible()

    // Editor should have editable area (Slate editor)
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await expect(editorContent).toBeVisible()
  })

  test('should allow typing in the editor', async ({ page }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Focus on editor and type
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()
    await page.keyboard.type('Hello, this is a test note!')

    // Verify text was typed
    await expect(editorContent).toContainText('Hello, this is a test note!')
  })

  test('should show and update character count', async ({ page }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Character count should be visible
    const charCount = dialog.locator('#note-char-count')
    await expect(charCount).toBeVisible()

    // Type some text and verify count updates
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()

    // Clear any existing content first
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('Test')

    // Character count should show 4 characters
    await expect(charCount).toContainText('4')
  })

  test('should close modal on Cancel button', async ({ page }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Click Cancel button
    const cancelButton = dialog.getByRole('button', { name: /cancel/i })
    await cancelButton.click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('should close modal on Save button click', async ({ page }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Type some text
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()
    await page.keyboard.type('Test note content')

    // Click Save button
    const saveButton = dialog.getByRole('button', { name: /save/i })
    await saveButton.click()

    // Toast appears optimistically (immediately on save click) before dialog closes
    // Check for it first since it has 4000ms duration and may disappear during high load
    // After Issue #37, the toast message is "Project info saved"
    const toastMessage = page.getByText(/project info saved/i)
    await expect(toastMessage).toBeVisible({ timeout: 5000 })

    // Dialog should close (primary assertion - this is what the test name describes)
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Wait for network to settle after save action completes in background
    await page.waitForLoadState('networkidle')
  })

  test('should trigger slash command menu on "/" key', async ({ page }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Focus on editor and type "/"
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()

    // Clear existing content first
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('/')

    // Wait for slash menu to appear - look for menu items
    // The slash menu shows options like "Heading 1", "Paragraph", etc.
    const slashMenu = page
      .locator('.bg-popover')
      .filter({ hasText: /heading|paragraph/i })
    await expect(slashMenu).toBeVisible({ timeout: 3000 })
  })

  test('should apply bold formatting via keyboard shortcut', async ({
    page,
  }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Focus on editor
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()

    // Clear existing content
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')

    // Type some text
    await page.keyboard.type('Bold text')

    // Select all text
    await page.keyboard.press('Meta+a')

    // Apply bold with Cmd+B
    await page.keyboard.press('Meta+b')

    // Click somewhere to deselect and make formatting visible
    await page.keyboard.press('End')

    // Verify bold mark is applied (check for strong element)
    // Note: Slate wraps text in complex DOM structures
    const boldText = editorContent.locator('strong.slate-bold')
    await expect(boldText).toHaveCount(1, { timeout: 3000 })
  })

  test('should NOT show skeleton after saving note (regression test)', async ({
    page,
  }) => {
    // This test verifies the fix for the issue where saving a note
    // caused the entire board to show skeleton due to revalidatePath
    // triggering a re-render and setting loading=true.
    //
    // Fix: KanbanBoard only shows skeleton when loading=true AND statuses.length===0

    // Wait for board content to load
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Open NoteModal
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Type some text to trigger a change
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()
    await page.keyboard.type(' - E2E test timestamp: ' + Date.now())

    // Get reference to a column header (to verify board stays visible)
    const columnHeader = page.locator('[data-testid^="status-column-"]').first()
    await expect(columnHeader).toBeVisible()

    // Click Save button
    const saveButton = dialog.getByRole('button', { name: /save/i })
    await saveButton.click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // CRITICAL: Verify board content remains visible (no skeleton)
    // The column header should remain visible immediately after save
    await expect(columnHeader).toBeVisible()

    // Wait a moment for any potential revalidation to complete
    await page.waitForTimeout(500)

    // Board should still be visible (not replaced by skeleton)
    await expect(columnHeader).toBeVisible()

    // Repo cards should also remain visible
    await expect(card).toBeVisible()

    // Skeleton should NOT be visible
    // KanbanSkeleton uses these classes: animate-pulse, bg-muted
    const skeleton = page.locator('.animate-pulse').first()
    await expect(skeleton).not.toBeVisible({ timeout: 1000 })
  })
})

test.describe('NoteModal Editor Height & Scroll (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    // Use networkidle to wait for all data fetches to complete
    // This prevents flakiness caused by cards not being rendered yet
    await page.waitForLoadState('networkidle')
  })

  test('should maintain fixed editor height with overflow scroll', async ({
    page,
  }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Get the editor container (PlateContainer with overflow-y-auto)
    // The EditorContainer has the fixed height and overflow-y-auto style
    const editorContainer = dialog.locator(
      '[data-testid="note-editor"] .overflow-y-auto',
    )
    await expect(editorContainer).toBeVisible()

    // Get initial height of the editor container
    const initialHeight = await editorContainer.evaluate(
      (el) => el.getBoundingClientRect().height,
    )

    // Focus on editor and type many lines of text
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()

    // Clear existing content
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')

    // Type multiple lines to exceed editor height
    const lines = Array.from(
      { length: 20 },
      (_, i) =>
        `Line ${i + 1}: Testing scroll behavior with fixed height editor.`,
    ).join('\n')
    await page.keyboard.type(lines)

    // Wait for content to render
    await page.waitForTimeout(500)

    // Get height after adding content
    const finalHeight = await editorContainer.evaluate(
      (el) => el.getBoundingClientRect().height,
    )

    // Height should remain the same (fixed) - allow tolerance for rendering variations
    // Note: Browser rendering can cause significant variations due to sub-pixel rendering,
    // font metrics, scrollbar appearance, and line height calculations.
    // The key verification is that height stays roughly constant (not growing unboundedly).
    // Tolerance of 30px accommodates browser rendering variations while ensuring
    // the editor maintains its fixed-height behavior.
    expect(Math.abs(finalHeight - initialHeight)).toBeLessThan(30)

    // Verify the editor container has overflow-y-auto style applied
    const hasOverflowScroll = await editorContainer.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return style.overflowY === 'auto' || style.overflowY === 'scroll'
    })
    expect(hasOverflowScroll).toBe(true)
  })

  test('should be scrollable when content exceeds editor height', async ({
    page,
  }) => {
    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Focus on editor
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()

    // Clear existing content
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')

    // Type unique marker text at the top
    await page.keyboard.type('TOP_MARKER_TEXT')
    await page.keyboard.press('Enter')

    // Type many lines to push the marker out of view
    for (let i = 0; i < 25; i++) {
      await page.keyboard.type(`Line ${i + 1}: Filler content for scroll test`)
      await page.keyboard.press('Enter')
    }

    await page.keyboard.type('BOTTOM_MARKER_TEXT')

    // Wait for content to render
    await page.waitForTimeout(500)

    // The editor container should now have scrollable content
    const editorContainer = dialog.locator(
      '[data-testid="note-editor"] .overflow-y-auto',
    )

    // Check that scroll height is greater than client height (content is scrollable)
    const isScrollable = await editorContainer.evaluate((el) => {
      return el.scrollHeight > el.clientHeight
    })
    expect(isScrollable).toBe(true)

    // Scroll to top and verify TOP_MARKER_TEXT is visible
    await editorContainer.evaluate((el) => {
      el.scrollTop = 0
    })
    await page.waitForTimeout(200)

    // TOP_MARKER_TEXT should be visible after scrolling to top
    await expect(editorContent).toContainText('TOP_MARKER_TEXT')
  })
})

test.describe('NoteModal Formatting (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = '/board/board-1'

  test('should support markdown autoformat for heading', async ({ page }) => {
    await page.goto(BOARD_URL)
    // Use networkidle to wait for all data fetches to complete
    await page.waitForLoadState('networkidle')

    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Focus on editor
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()

    // Clear existing content
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')

    // Type markdown heading - the space after # triggers autoformat
    await page.keyboard.type('# ')
    await page.keyboard.type('Heading 1')

    // Verify heading element was created
    const heading = editorContent.locator('h1')
    await expect(heading).toBeVisible({ timeout: 3000 })
    await expect(heading).toContainText('Heading 1')
  })

  test('should apply italic formatting via keyboard shortcut', async ({
    page,
  }) => {
    await page.goto(BOARD_URL)
    // Use networkidle to wait for all data fetches to complete
    await page.waitForLoadState('networkidle')

    // Open NoteModal
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await noteButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Focus on editor
    const editorContent = dialog.locator('[data-slate-editor="true"]')
    await editorContent.click()

    // Clear existing content
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Backspace')

    // Type some text
    await page.keyboard.type('Italic text')

    // Select all text
    await page.keyboard.press('Meta+a')

    // Apply italic with Cmd+I
    await page.keyboard.press('Meta+i')

    // Click somewhere to deselect and make formatting visible
    await page.keyboard.press('End')

    // Verify italic mark is applied
    // Note: Slate wraps text in complex DOM structures
    const italicText = editorContent.locator('em.slate-italic')
    await expect(italicText).toHaveCount(1, { timeout: 3000 })
  })
})
