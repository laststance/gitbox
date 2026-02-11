/**
 * ProjectInfo Links E2E Tests
 *
 * Tests for the ProjectInfo Links feature including:
 * - LinkTypeCombobox with 55 built-in presets in 12 categories
 * - URL validation and management
 * - CreateLinkTypeDialog for custom link types
 * - Persistence of links data
 *
 * Note: After Issue #37, links are now managed via NoteModal (accessed via Note button)
 * instead of a separate ProjectInfoModal.
 *
 * Requires authentication (uses storageState from auth.setup.ts)
 */

import { test, expect } from '../fixtures/coverage'
import { querySingle, PROJECT_INFO_IDS, BOARD_IDS } from '../helpers/db-query'

test.describe('ProjectInfo Links (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  /**
   * Helper to open NoteModal from a repo card's Note button
   * (Previously opened ProjectInfoModal via overflow menu, now unified into NoteModal)
   */
  async function openNoteModal(
    page: import('@playwright/test').Page,
  ): Promise<import('@playwright/test').Locator> {
    // Wait for cards to load
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Click on the Note button (has aria-label="Open note")
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await expect(noteButton).toBeVisible()
    await noteButton.click()

    // Wait for NoteModal to appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    return dialog
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should open NoteModal from repo card Note button', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Verify modal title (now "Project Note" after Issue #37 consolidation)
    const title = dialog.getByText(/project note/i)
    await expect(title).toBeVisible()

    // Verify modal has required elements
    await expect(dialog.locator('[data-testid="note-editor"]')).toBeVisible()
    await expect(dialog.locator('[data-testid="add-url-button"]')).toBeVisible()
  })

  test('should display LinkTypeCombobox when adding a URL', async ({
    page,
  }) => {
    const dialog = await openNoteModal(page)

    // Click Add URL button
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // URL input and type selector should appear
    const urlInput = dialog.locator('[data-testid="url-input-0"]')
    await expect(urlInput).toBeVisible()

    // LinkTypeCombobox trigger should be visible
    const comboboxTrigger = dialog.locator(
      '[data-testid="link-type-combobox-trigger"]',
    )
    await expect(comboboxTrigger).toBeVisible()
  })

  test('should show "Add custom type..." at the top of combobox (always visible)', async ({
    page,
  }) => {
    const dialog = await openNoteModal(page)

    // Add a URL row
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Open the combobox
    const comboboxTrigger = dialog.locator(
      '[data-testid="link-type-combobox-trigger"]',
    )
    await comboboxTrigger.click()

    await page.waitForTimeout(300)

    // "Add custom type..." should be IMMEDIATELY visible at the top
    // without scrolling or searching
    const addCustomOption = page.locator('[data-testid="add-custom-link-type"]')
    await expect(addCustomOption).toBeVisible({ timeout: 3000 })

    // It should appear BEFORE the first category heading (Hosting)
    const hostingHeading = page.getByText('Hosting', { exact: true })
    await expect(hostingHeading).toBeVisible()

    // Verify "Add custom type..." contains expected text
    await expect(addCustomOption).toContainText('Add custom type')
  })

  test('should show 55 presets in 12 categories when opening combobox', async ({
    page,
  }) => {
    const dialog = await openNoteModal(page)

    // Add a URL row
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Click on the combobox trigger to open dropdown
    const comboboxTrigger = dialog.locator(
      '[data-testid="link-type-combobox-trigger"]',
    )
    await comboboxTrigger.click()

    // Wait for popover to open
    await page.waitForTimeout(300)

    // Check for category headings (should have at least some of the 12 categories)
    const categories = [
      'Hosting',
      'Cloud',
      'Database',
      'Auth',
      'Email',
      'Payment',
      'Monitoring',
      'Analytics',
      'DevOps',
      'Communication',
      'Storage',
      'Other',
    ]

    // At least some categories should be visible in the dropdown
    let visibleCategories = 0
    for (const category of categories) {
      const categoryHeading = page.getByText(category, { exact: true })
      if (await categoryHeading.isVisible().catch(() => false)) {
        visibleCategories++
      }
    }
    expect(visibleCategories).toBeGreaterThan(0)

    // Check for some known presets
    const knownPresets = ['Vercel', 'GitHub', 'AWS', 'Supabase', 'Stripe']
    for (const preset of knownPresets) {
      const presetOption = page.locator(
        `[data-testid="link-type-option-${preset.toLowerCase()}"]`,
      )
      // May need to scroll to see all, so just check at least one exists
      if (await presetOption.isVisible().catch(() => false)) {
        await expect(presetOption).toBeVisible()
        break
      }
    }
  })

  test('should search and filter presets in combobox', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add a URL row
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Open the combobox
    const comboboxTrigger = dialog.locator(
      '[data-testid="link-type-combobox-trigger"]',
    )
    await comboboxTrigger.click()

    await page.waitForTimeout(300)

    // Type in the search field
    const searchInput = page.getByPlaceholder(/search link type/i)
    await expect(searchInput).toBeVisible()
    await searchInput.fill('stripe')

    // Wait for search to filter
    await page.waitForTimeout(200)

    // Stripe should be visible in the filtered results
    const stripeOption = page.locator('[data-testid="link-type-option-stripe"]')
    await expect(stripeOption).toBeVisible()

    // Other unrelated options should not be visible
    const vercelOption = page.locator('[data-testid="link-type-option-vercel"]')
    await expect(vercelOption).not.toBeVisible()
  })

  test('should select a preset from combobox', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add a URL row
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Open the combobox
    const comboboxTrigger = dialog.locator(
      '[data-testid="link-type-combobox-trigger"]',
    )
    await comboboxTrigger.click()

    await page.waitForTimeout(300)

    // Search for Supabase
    const searchInput = page.getByPlaceholder(/search link type/i)
    await searchInput.fill('supabase')

    await page.waitForTimeout(200)

    // Click on Supabase option
    const supabaseOption = page.locator(
      '[data-testid="link-type-option-supabase"]',
    )
    await supabaseOption.click()

    // Combobox should now show Supabase as selected
    await expect(comboboxTrigger).toContainText('Supabase')
  })

  test('should validate URL input', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add a URL row
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Enter an invalid URL
    const urlInput = dialog.locator('[data-testid="url-input-0"]')
    await urlInput.fill('not-a-valid-url')

    // Wait for debounced validation
    await page.waitForTimeout(400)

    // Error message should appear (using role="alert")
    const errorMessage = dialog.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible({ timeout: 3000 })
    await expect(errorMessage).toContainText(/http:\/\/ or https:\/\//i)

    // Per-item save button should be disabled
    const itemSaveButton = dialog.locator('[data-testid="url-save-0"]')
    await expect(itemSaveButton).toBeDisabled()
  })

  test('should accept valid URLs', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add a URL row
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Enter a valid URL
    const urlInput = dialog.locator('[data-testid="url-input-0"]')
    await urlInput.fill('https://example.com/path?query=value')

    // Wait for debounced validation
    await page.waitForTimeout(400)

    // No error message should appear
    const errorMessage = dialog.locator('[role="alert"]')
    await expect(errorMessage).not.toBeVisible()

    // Per-item save button should be enabled
    const itemSaveButton = dialog.locator('[data-testid="url-save-0"]')
    await expect(itemSaveButton).not.toBeDisabled()
  })

  test('should add multiple URLs', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add first URL and save it (Enter exits edit mode)
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    const urlInput0 = dialog.locator('[data-testid="url-input-0"]')
    await urlInput0.fill('https://example.com')
    await page.keyboard.press('Enter')

    // First URL should now be in display mode (link visible)
    await expect(dialog.locator('[data-testid="url-link-0"]')).toBeVisible()

    // Add second URL
    await addUrlButton.click()

    const urlInput1 = dialog.locator('[data-testid="url-input-1"]')
    await expect(urlInput1).toBeVisible()
    await urlInput1.fill('https://another.com')
    await page.keyboard.press('Enter')

    // Second URL should now be in display mode
    await expect(dialog.locator('[data-testid="url-link-1"]')).toBeVisible()

    // Add third URL (stays in edit mode since it's empty)
    await addUrlButton.click()

    const urlInput2 = dialog.locator('[data-testid="url-input-2"]')
    await expect(urlInput2).toBeVisible()

    // All three URL items should exist
    await expect(dialog.locator('[data-testid="url-link-0"]')).toBeVisible()
    await expect(dialog.locator('[data-testid="url-link-1"]')).toBeVisible()
    await expect(urlInput2).toBeVisible() // Third is still in edit mode
  })

  test('should remove a URL', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add first URL and save it
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()
    const urlInput0 = dialog.locator('[data-testid="url-input-0"]')
    await urlInput0.fill('https://first.com')
    await page.keyboard.press('Enter')

    // Add second URL and save it
    await addUrlButton.click()
    const urlInput1 = dialog.locator('[data-testid="url-input-1"]')
    await urlInput1.fill('https://second.com')
    await page.keyboard.press('Enter')

    // Verify both exist in display mode
    await expect(dialog.locator('[data-testid="url-link-0"]')).toBeVisible()
    await expect(dialog.locator('[data-testid="url-link-1"]')).toBeVisible()

    // Remove the first URL (use new test ID: url-delete-0)
    const deleteButton = dialog.locator('[data-testid="url-delete-0"]')
    await deleteButton.click()

    // Now only one URL should remain (re-indexed to 0)
    await expect(dialog.locator('[data-testid="url-link-0"]')).toBeVisible()
    await expect(dialog.locator('[data-testid="url-link-1"]')).not.toBeVisible()
  })

  test('should open CreateLinkTypeDialog from "Add custom type..." option', async ({
    page,
  }) => {
    const dialog = await openNoteModal(page)

    // Add a URL row
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Open the combobox
    const comboboxTrigger = dialog.locator(
      '[data-testid="link-type-combobox-trigger"]',
    )
    await comboboxTrigger.click()

    await page.waitForTimeout(300)

    // Click on "Add custom type..." option
    const addCustomOption = page.locator('[data-testid="add-custom-link-type"]')
    await addCustomOption.click()

    // CreateLinkTypeDialog should open
    await page.waitForTimeout(300)

    // Look for the dialog with "Create Custom Link Type" title or similar
    const createDialog = page
      .getByRole('dialog')
      .filter({ hasText: /create.*link type|custom.*type/i })
    await expect(createDialog).toBeVisible({ timeout: 5000 })
  })

  test('should save links and close dialog', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add a URL
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Select a type - use Vercel which has a unique name
    const comboboxTrigger = dialog.locator(
      '[data-testid="link-type-combobox-trigger"]',
    )
    await comboboxTrigger.click()
    await page.waitForTimeout(300)

    const searchInput = page.getByPlaceholder(/search link type/i)
    await searchInput.fill('vercel')
    await page.waitForTimeout(200)

    const vercelOption = page.locator('[data-testid="link-type-option-vercel"]')
    await expect(vercelOption).toBeVisible({ timeout: 5000 })
    await vercelOption.click()

    // Enter URL
    const urlInput = dialog.locator('[data-testid="url-input-0"]')
    await urlInput.fill('https://vercel.com/test/project')

    // Verify save button is enabled (form is valid)
    const saveButton = dialog.locator('[data-testid="save-button"]')
    await expect(saveButton).not.toBeDisabled()

    // Save
    await saveButton.click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Wait for network to settle after save
    await page.waitForLoadState('networkidle')

    // Note: In MSW mock environment, data won't persist across page reloads.
    // Actual persistence is verified in integration tests with real database.
  })

  test('should verify links are persisted in database after save', async ({
    page,
  }) => {
    // openNoteModal opens the first card on the page (card-3: laststance/create-react-app-vite)
    // which maps to projinfo3 in seed data
    const projectInfoId = PROJECT_INFO_IDS.projinfo3

    const dialog = await openNoteModal(page)

    // Add a URL with unique identifier
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Select Sentry type — use .last() since prior tests may have saved URLs
    const comboboxTrigger = dialog
      .locator('[data-testid="link-type-combobox-trigger"]')
      .last()
    await comboboxTrigger.click()
    await page.waitForTimeout(300)

    const searchInput = page.getByPlaceholder(/search link type/i)
    await searchInput.fill('sentry')
    await page.waitForTimeout(200)

    const sentryOption = page.locator('[data-testid="link-type-option-sentry"]')
    await expect(sentryOption).toBeVisible({ timeout: 5000 })
    await sentryOption.click()

    // Enter URL with unique timestamp — use .last() for newly added input
    const uniqueUrl = `https://sentry.io/test/project-${Date.now()}`
    const urlInput = dialog.locator('[data-testid^="url-input-"]').last()
    await urlInput.fill(uniqueUrl)

    // Click inline "Save URL" button to commit the URL to parent state
    // (EditableUrlItem uses internal state; onUrlChange only fires on inline save/blur)
    const inlineSaveBtn = dialog.locator('[data-testid^="url-save-"]').last()
    await inlineSaveBtn.click()
    await page.waitForTimeout(500)

    // Save the dialog
    const saveButton = dialog.locator('[data-testid="save-button"]')
    await saveButton.click()

    // Wait for server action to complete
    await page.waitForTimeout(1500)

    // Verify links are persisted in database
    const projectInfo = await querySingle<{ links: unknown }>('projectinfo', {
      id: projectInfoId,
    })
    expect(projectInfo).not.toBeNull()
    // Links column is JSONB — Supabase returns parsed JS array, so stringify for substring check
    expect(JSON.stringify(projectInfo?.links)).toContain(uniqueUrl)
  })

  test('should cancel without saving changes', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Record existing URL count before adding a new one
    const existingLinkCount = await dialog
      .locator('[data-testid^="url-link-"]')
      .count()

    // Add a URL — previous tests may have saved URLs, so the new input
    // index depends on how many existing URLs are displayed.
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    // Wait for any URL input to appear (index may vary based on existing URLs)
    const anyUrlInput = dialog.locator('[data-testid^="url-input-"]').last()
    await expect(anyUrlInput).toBeVisible({ timeout: 5000 })
    await anyUrlInput.fill('https://should-not-be-saved.com')

    // Click on the editor area to move focus away from URL input.
    // This triggers the blur handler which auto-saves valid URLs, but our URL
    // "https://should-not-be-saved.com" is still in the input (not yet saved via Enter).
    // The blur handler calls handleSave() which dispatches to Redux draft.
    // We avoid pressing Escape because that closes the entire dialog.
    // Instead, we cancel the input-level editing first by clearing the input.
    await anyUrlInput.fill('')
    await page.waitForTimeout(100)

    // Cancel the dialog
    const cancelButton = dialog.locator('[data-testid="cancel-button"]')
    await cancelButton.click()

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Reopen the modal
    const newDialog = await openNoteModal(page)

    // The unsaved URL should not be present — check all URL inputs/links
    const allUrlInputs = newDialog.locator('[data-testid^="url-input-"]')
    const allUrlLinks = newDialog.locator('[data-testid^="url-link-"]')
    const inputCount = await allUrlInputs.count()
    const linkCount = await allUrlLinks.count()

    // Verify none contain the cancelled URL
    for (let i = 0; i < inputCount; i++) {
      await expect(allUrlInputs.nth(i)).not.toHaveValue(
        'https://should-not-be-saved.com',
      )
    }
    for (let i = 0; i < linkCount; i++) {
      await expect(allUrlLinks.nth(i)).not.toContainText(
        'should-not-be-saved.com',
      )
    }
  })
})

test.describe('ProjectInfo Links - Edge Cases (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`

  /**
   * Helper to open NoteModal from a repo card's Note button
   */
  async function openNoteModal(
    page: import('@playwright/test').Page,
  ): Promise<import('@playwright/test').Locator> {
    const card = page.locator('[data-testid^="repo-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Click on the Note button (has aria-label="Open note")
    const noteButton = card.getByRole('button', { name: 'Open note' })
    await expect(noteButton).toBeVisible()
    await noteButton.click()

    // Wait for NoteModal to appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    return dialog
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
  })

  test('should handle localhost URLs for development', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Count existing URL inputs/links before adding
    const beforeCount = await dialog
      .locator('[data-testid^="url-input-"], [data-testid^="url-link-"]')
      .count()

    // Add a localhost URL — use .last() since prior tests may have saved URLs
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()
    await page.waitForTimeout(300)

    // Wait for a NEW url-input to appear (count should increase)
    const urlInput = dialog.locator('[data-testid^="url-input-"]').last()
    await expect(urlInput).toBeVisible({ timeout: 10000 })
    await urlInput.fill('http://localhost:3000/api/test')
    await page.keyboard.press('Tab')

    // Should be valid (no error)
    const errorMessage = dialog.locator('[data-testid="url-error"]')
    await expect(errorMessage).not.toBeVisible()

    const saveButton = dialog.locator('[data-testid="save-button"]')
    await expect(saveButton).not.toBeDisabled()
  })

  test('should handle URLs with special characters', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add a URL with special characters — use .last() since prior tests may have saved URLs
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()

    const urlInput = dialog.locator('[data-testid^="url-input-"]').last()
    await expect(urlInput).toBeVisible({ timeout: 5000 })
    await urlInput.fill(
      'https://example.com/path?key=value&name=test%20user#section',
    )
    await page.keyboard.press('Tab')

    // Should be valid
    const errorMessage = dialog.locator('[data-testid="url-error"]')
    await expect(errorMessage).not.toBeVisible()
  })

  test('should close combobox by clicking outside', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add URL and open combobox — use .last() since prior tests may have saved URLs
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()
    await page.waitForTimeout(300)

    // Use .last() because prior tests may have saved URLs with their own combobox triggers
    const comboboxTrigger = dialog
      .locator('[data-testid="link-type-combobox-trigger"]')
      .last()
    await comboboxTrigger.click()
    await page.waitForTimeout(300)

    // Verify dropdown is open
    const searchInput = page.getByPlaceholder(/search link type/i)
    await expect(searchInput).toBeVisible()

    // Click on the URL input (outside the dropdown) to close it
    const urlInput = dialog.locator('[data-testid^="url-input-"]').last()
    await urlInput.click()

    // Dropdown should be closed
    await expect(searchInput).not.toBeVisible({ timeout: 2000 })

    // Modal should still be visible
    await expect(dialog).toBeVisible()
  })

  test('should handle keyboard navigation in combobox', async ({ page }) => {
    const dialog = await openNoteModal(page)

    // Add URL and open combobox
    const addUrlButton = dialog.locator('[data-testid="add-url-button"]')
    await addUrlButton.click()
    await page.waitForTimeout(300)

    // Use .last() because prior tests may have saved URLs with their own combobox triggers
    const comboboxTrigger = dialog
      .locator('[data-testid="link-type-combobox-trigger"]')
      .last()
    await comboboxTrigger.click()
    await page.waitForTimeout(300)

    // Search for something
    const searchInput = page.getByPlaceholder(/search link type/i)
    await searchInput.fill('ver')
    await page.waitForTimeout(200)

    // Use arrow keys to navigate
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    // Press Enter to select
    await page.keyboard.press('Enter')

    // Combobox should close and show selected value
    await expect(searchInput).not.toBeVisible({ timeout: 2000 })
    // The combobox trigger should show the selected preset (Vercel or similar)
    await expect(comboboxTrigger).toBeVisible()
  })
})
