/**
 * E2E Test: Project Info Modal
 *
 * Constitution Requirements:
 * - Principle II: E2E test coverage for critical flows
 * - Principle IV: WCAG AA compliance
 * - Principle VI: TDD - Test-first approach
 *
 * User Story 4 Acceptance Scenarios:
 * 1. Select "Edit Project Info" from overflow menu → Modal displays
 * 2. Enter memo in Quick note → Save
 * 3. Add Production URL → Display in list
 * 4. Add Tracking services URL → Open in new tab
 * 5. Add Supabase Dashboard URL → Save
 * 6. Click Save button → Modal closes
 */

import { test, expect } from '@playwright/test'

test.describe('Project Info Modal (US4)', () => {
  test.beforeEach(async ({ page }) => {
    // Access board screen in authenticated state
    // Board ID: 00000000-0000-0000-0000-000000000100 (see supabase/seed.sql)
    await page.goto('/board/00000000-0000-0000-0000-000000000100')
    await page.waitForLoadState('networkidle')

    // Clear existing Project Info URLs for test isolation
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await modal.waitFor({ state: 'visible' })

    // Delete all existing URLs
    const deleteButtons = modal.locator('button[data-testid^="remove-url"]')
    const deleteCount = await deleteButtons.count()
    for (let i = 0; i < deleteCount; i++) {
      // Always delete the first button (after deletion, the next element becomes first)
      await deleteButtons.first().click()
    }

    // Clear Quick note as well
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await quickNoteTextarea.fill('')

    // Save and close
    await modal.locator('[data-testid="save-button"]').click()
    await modal.waitFor({ state: 'hidden' })
  })

  test('Scenario 1: Open Project Info modal from overflow menu', async ({
    page,
  }) => {
    // Given: Repository card exists
    const card = page.locator('[data-testid="repo-card"]').first()
    await expect(card).toBeVisible()

    // When: Select "Edit Project Info" from the ⋯ menu in the upper right corner of the card
    await card.hover()
    const menuTrigger = card.locator('[data-testid^="overflow-menu-trigger"]')
    await menuTrigger.click()

    const editButton = page.locator('[data-testid^="edit-project"]')
    await expect(editButton).toBeVisible()
    await editButton.click()

    // Then: Project Info modal is displayed
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible({ timeout: 2000 })

    // Modal title is correct
    await expect(modal.locator('h2')).toContainText('Project Info')

    // Screenshot: Modal initial display (empty state)
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-modal-empty.png',
      fullPage: true,
    })
  })

  test('Scenario 2: Add and save Quick note', async ({ page }) => {
    // Given: Project Info modal is displayed
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // When: Enter a memo of 1-3 lines in the Quick note section
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await expect(quickNoteTextarea).toBeVisible()

    const noteText =
      'This is a test project\nMain production app\nDeployed on Vercel'
    await quickNoteTextarea.fill(noteText)

    // Verify character limit (300 characters)
    const charCount = modal.locator('[data-testid="char-count"]')
    await expect(charCount).toContainText('61 / 300')

    // Screenshot: After Quick note input
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-quick-note.png',
      fullPage: true,
    })

    // When: Click Save button
    await modal.locator('[data-testid="save-button"]').click()

    // Then: Memo is saved and modal closes
    await expect(modal).not.toBeVisible({ timeout: 2000 })

    // Open modal again to confirm it was saved
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()
    await expect(quickNoteTextarea).toHaveValue(noteText)
  })

  test('Scenario 3: Add multiple Production URLs', async ({ page }) => {
    // Given: In the Links section
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // When: Add multiple Production URLs
    const addUrlButton = modal.locator('[data-testid="add-url-button"]')
    await expect(addUrlButton).toBeVisible()

    // Add first URL
    await addUrlButton.click()
    const urlInput = modal.locator('[data-testid^="url-input"]').first()
    await expect(urlInput).toBeVisible()
    await urlInput.fill('https://example.com')

    // Add second URL
    await addUrlButton.click()
    const urlInput2 = modal.locator('[data-testid^="url-input"]').nth(1)
    await expect(urlInput2).toBeVisible()
    await urlInput2.fill('https://staging.example.com')

    // Then: All URLs are saved and displayed in a list
    const urlList = modal.locator('[data-testid="url-list"]')
    await expect(urlList.locator('li')).toHaveCount(2)

    // URL links are displayed correctly
    await expect(urlList).toContainText('example.com')
    await expect(urlList).toContainText('staging.example.com')

    // Screenshot: After registering multiple URLs
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-multiple-urls.png',
      fullPage: true,
    })
  })

  test('Scenario 4: Add Tracking services URL and open in new tab', async ({
    page,
    context,
  }) => {
    // Given: In the Links section
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // When: Add Tracking services URL
    await modal.locator('[data-testid="add-url-button"]').click()

    // Operate custom combobox: target the last added URL row
    const urlTypeSelect = modal
      .locator('[data-testid="url-type-select"]')
      .last()
    await expect(urlTypeSelect).toBeVisible()
    await urlTypeSelect.click()
    // Select Tracking option
    await page.getByRole('option', { name: 'Tracking' }).click()

    const urlInput = modal.locator('[data-testid^="url-input"]').last()
    await urlInput.fill('https://analytics.google.com/dashboard')

    // Save and close
    await modal.locator('[data-testid="save-button"]').click()
    await expect(modal).not.toBeVisible()

    // Open again
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()

    // Then: Can open in new tab on click
    const urlLink = modal
      .locator('[data-testid="url-list"]')
      .locator('a')
      .first()

    // Verify target="_blank" attribute
    await expect(urlLink).toHaveAttribute('target', '_blank')
    await expect(urlLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('Scenario 5: Add Supabase Dashboard links', async ({ page }) => {
    // Given: In the Links section
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // When: Add Supabase Dashboard link
    await modal.locator('[data-testid="add-url-button"]').click()

    // Operate custom combobox: target the last added URL row
    const urlTypeSelect = modal
      .locator('[data-testid="url-type-select"]')
      .last()
    await expect(urlTypeSelect).toBeVisible()
    await urlTypeSelect.click()
    // Select Supabase option
    await page.getByRole('option', { name: 'Supabase' }).click()

    const urlInput = modal.locator('[data-testid^="url-input"]').last()
    await urlInput.fill('https://app.supabase.com/project/abc123/editor')

    // Then: Project reference link is saved
    await modal.locator('[data-testid="save-button"]').click()
    await expect(modal).not.toBeVisible()

    // Verify saved
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()

    const urlList = modal.locator('[data-testid="url-list"]')
    await expect(urlList).toContainText('supabase.com')
  })

  test('Scenario 6: Save changes and close modal', async ({ page }) => {
    // Given: Edited Project Info
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Edit Quick note
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await quickNoteTextarea.fill('Updated project info')

    // When: Click "Save" button
    const saveButton = modal.locator('[data-testid="save-button"]')
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Then: Changes are saved and modal closes
    await expect(modal).not.toBeVisible({ timeout: 2000 })

    // Returned to board view
    const board = page.locator('[data-testid="repo-card"]')
    await expect(board.first()).toBeVisible()
  })

  test('Cancel button closes modal without saving', async ({ page }) => {
    // Given: Editing in modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Edit
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await quickNoteTextarea.fill('This should not be saved')

    // When: Click Cancel button
    const cancelButton = modal.locator('[data-testid="cancel-button"]')
    await cancelButton.click()

    // Then: Modal closes (not saved)
    await expect(modal).not.toBeVisible()

    // Open again and confirm it was not saved
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()
    await expect(quickNoteTextarea).not.toHaveValue('This should not be saved')
  })

  test('WCAG AA Accessibility compliance', async ({ page }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Focus management
    const firstFocusable = modal.locator('[data-testid="quick-note-textarea"]')
    await expect(firstFocusable).toBeFocused()

    // Keyboard navigation (Tab key)
    await page.keyboard.press('Tab')
    const addUrlButton = modal.locator('[data-testid="add-url-button"]')
    await expect(addUrlButton).toBeFocused()

    // Close modal with ESC key
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('URL validation', async ({ page }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Enter invalid URL
    await modal.locator('[data-testid="add-url-button"]').click()
    const urlInput = modal.locator('[data-testid^="url-input"]').first()
    await urlInput.fill('not-a-valid-url')

    // Display validation error
    const errorMessage = modal.locator('[data-testid="url-error"]')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText('Please enter a valid URL')

    // Save button is disabled
    const saveButton = modal.locator('[data-testid="save-button"]')
    await expect(saveButton).toBeDisabled()

    // Screenshot: URL validation error display
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-url-validation-error.png',
      fullPage: true,
    })

    // Correct to valid URL
    await urlInput.fill('https://example.com')
    await expect(errorMessage).not.toBeVisible()
    await expect(saveButton).toBeEnabled()
  })
})

test.describe('Project Info Modal - Credentials (US5)', () => {
  test.beforeEach(async ({ page }) => {
    // Access board screen in authenticated state
    await page.goto('/board/00000000-0000-0000-0000-000000000100')
    await page.waitForLoadState('networkidle')

    // Open Project Info modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await modal.waitFor({ state: 'visible' })

    // Clear existing Credentials
    const deleteButtons = modal.locator(
      'button[data-testid^="remove-credential"]',
    )
    const deleteCount = await deleteButtons.count()
    for (let i = 0; i < deleteCount; i++) {
      await deleteButtons.first().click()
    }

    // Save and close
    await modal.locator('[data-testid="save-button"]').click()
    await modal.waitFor({ state: 'hidden' })
  })

  test('Scenario 1: Add Pattern A (Reference) credential', async ({ page }) => {
    // Given: In the Credentials section
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // When: Add Pattern A (Reference) credential
    const addCredentialButton = modal.locator(
      '[data-testid="add-credential-button"]',
    )
    await addCredentialButton.click()

    // Select Credential type
    const credentialTypeSelect = modal
      .locator('[data-testid^="credential-type-select"]')
      .first()
    await credentialTypeSelect.click()
    await page.getByRole('option', { name: 'Reference' }).click()

    // Enter Credential name
    const nameInput = modal.locator('[data-testid^="credential-name"]').first()
    await nameInput.fill('Stripe Dashboard')

    // Enter Reference URL
    const referenceInput = modal
      .locator('[data-testid^="credential-reference"]')
      .first()
    await referenceInput.fill('https://dashboard.stripe.com')

    // Enter Note
    const noteInput = modal.locator('[data-testid^="credential-note"]').first()
    await noteInput.fill('Production API keys')

    // Screenshot: After Pattern A credential input
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-pattern-a.png',
      fullPage: true,
    })

    // Then: Save and close modal
    await modal.locator('[data-testid="save-button"]').click()
    await expect(modal).not.toBeVisible()

    // Open again and confirm it was saved
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()

    await expect(nameInput).toHaveValue('Stripe Dashboard')
    await expect(referenceInput).toHaveValue('https://dashboard.stripe.com')
    await expect(noteInput).toHaveValue('Production API keys')
  })

  test('Scenario 2: Add Pattern B (Encrypted) credential with masked display', async ({
    page,
  }) => {
    // Given: In the Credentials section
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // When: Add Pattern B (Encrypted) credential
    const addCredentialButton = modal.locator(
      '[data-testid="add-credential-button"]',
    )
    await addCredentialButton.click()

    // Select Credential type
    const credentialTypeSelect = modal
      .locator('[data-testid^="credential-type-select"]')
      .first()
    await credentialTypeSelect.click()
    await page.getByRole('option', { name: 'Encrypted' }).click()

    // Enter Credential name
    const nameInput = modal.locator('[data-testid^="credential-name"]').first()
    await nameInput.fill('Stripe API Key')

    // Enter Encrypted value
    const encryptedInput = modal
      .locator('[data-testid^="credential-encrypted"]')
      .first()
    await encryptedInput.fill('sk_live_51H4RdE2BqJhGwM5N8XyZ123')

    // Then: Masked display is automatically generated (value is not visible because input type="password")
    await expect(encryptedInput).toHaveAttribute('type', 'password')

    // Screenshot: After Pattern B credential input (masked display)
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-pattern-b-masked.png',
      fullPage: true,
    })

    // Save
    await modal.locator('[data-testid="save-button"]').click()
    await expect(modal).not.toBeVisible()
  })

  test('Scenario 3: Reveal encrypted credential value with 30-second auto-hide', async ({
    page,
  }) => {
    // Given: Pattern B credential is saved
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Add Encrypted credential
    const addCredentialButton = modal.locator(
      '[data-testid="add-credential-button"]',
    )
    await addCredentialButton.click()

    const credentialTypeSelect = modal
      .locator('[data-testid^="credential-type-select"]')
      .first()
    await credentialTypeSelect.click()
    await page.getByRole('option', { name: 'Encrypted' }).click()

    const nameInput = modal.locator('[data-testid^="credential-name"]').first()
    await nameInput.fill('Test API Key')

    const encryptedInput = modal
      .locator('[data-testid^="credential-encrypted"]')
      .first()
    const testValue = 'sk_test_1234567890abcdef'
    await encryptedInput.fill(testValue)

    // When: Click Reveal button
    const revealButton = modal.locator('[data-testid^="toggle-reveal"]').first()
    await expect(revealButton).toBeVisible()
    await revealButton.click()

    // Then: Value is displayed (changes to type="text")
    await expect(encryptedInput).toHaveAttribute('type', 'text')
    await expect(encryptedInput).toHaveValue(testValue)

    // Icon changes to EyeOff
    await expect(revealButton.locator('svg')).toBeVisible()

    // Screenshot: Revealed state
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-revealed.png',
      fullPage: true,
    })

    // Click again to hide
    await revealButton.click()
    await expect(encryptedInput).toHaveAttribute('type', 'password')

    // Note: 30-second auto-hide timer is too long for E2E tests,
    // covered by unit tests
  })

  test('Scenario 4: Add Pattern C (External) credential', async ({ page }) => {
    // Given: In the Credentials section
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // When: Add Pattern C (External) credential
    const addCredentialButton = modal.locator(
      '[data-testid="add-credential-button"]',
    )
    await addCredentialButton.click()

    // Select Credential type
    const credentialTypeSelect = modal
      .locator('[data-testid^="credential-type-select"]')
      .first()
    await credentialTypeSelect.click()
    await page.getByRole('option', { name: 'External' }).click()

    // Enter Credential name
    const nameInput = modal.locator('[data-testid^="credential-name"]').first()
    await nameInput.fill('Production Database')

    // Enter External location
    const locationInput = modal
      .locator('[data-testid^="credential-location"]')
      .first()
    await locationInput.fill('1Password > Team Vault > Production Credentials')

    // Enter Note
    const noteInput = modal.locator('[data-testid^="credential-note"]').first()
    await noteInput.fill('PostgreSQL admin password')

    // Screenshot: After Pattern C credential input
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-pattern-c.png',
      fullPage: true,
    })

    // Then: Save
    await modal.locator('[data-testid="save-button"]').click()
    await expect(modal).not.toBeVisible()

    // Open again and confirm
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()

    await expect(nameInput).toHaveValue('Production Database')
    await expect(locationInput).toHaveValue(
      '1Password > Team Vault > Production Credentials',
    )
    await expect(noteInput).toHaveValue('PostgreSQL admin password')
  })

  test('Scenario 5: Add multiple credentials of different patterns', async ({
    page,
  }) => {
    // Given: In the Credentials section
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    const addCredentialButton = modal.locator(
      '[data-testid="add-credential-button"]',
    )

    // Pattern A
    await addCredentialButton.click()
    let credentialTypeSelect = modal
      .locator('[data-testid^="credential-type-select"]')
      .nth(0)
    await credentialTypeSelect.click()
    await page.getByRole('option', { name: 'Reference' }).click()
    await modal
      .locator('[data-testid^="credential-name"]')
      .nth(0)
      .fill('AWS Console')
    await modal
      .locator('[data-testid^="credential-reference"]')
      .nth(0)
      .fill('https://console.aws.amazon.com')

    // Pattern B
    await addCredentialButton.click()
    credentialTypeSelect = modal
      .locator('[data-testid^="credential-type-select"]')
      .nth(1)
    await credentialTypeSelect.click()
    await page.getByRole('option', { name: 'Encrypted' }).click()
    await modal
      .locator('[data-testid^="credential-name"]')
      .nth(1)
      .fill('GitHub Token')
    await modal
      .locator('[data-testid^="credential-encrypted"]')
      .nth(1)
      .fill('ghp_1234567890abcdefABCDEF')

    // Pattern C
    await addCredentialButton.click()
    credentialTypeSelect = modal
      .locator('[data-testid^="credential-type-select"]')
      .nth(2)
    await credentialTypeSelect.click()
    await page.getByRole('option', { name: 'External' }).click()
    await modal
      .locator('[data-testid^="credential-name"]')
      .nth(2)
      .fill('SSH Key')
    await modal
      .locator('[data-testid^="credential-location"]')
      .nth(2)
      .fill('Bitwarden > Server Keys')

    // Screenshot: Multiple credentials
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-multiple.png',
      fullPage: true,
    })

    // Then: All are saved
    await modal.locator('[data-testid="save-button"]').click()
    await expect(modal).not.toBeVisible()

    // Open again and confirm all are saved
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()

    const credentialNames = modal.locator('[data-testid^="credential-name"]')
    await expect(credentialNames).toHaveCount(3)
    await expect(credentialNames.nth(0)).toHaveValue('AWS Console')
    await expect(credentialNames.nth(1)).toHaveValue('GitHub Token')
    await expect(credentialNames.nth(2)).toHaveValue('SSH Key')
  })

  test('Scenario 6: Delete credential', async ({ page }) => {
    // Given: Credential is added
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Add Credential
    const addCredentialButton = modal.locator(
      '[data-testid="add-credential-button"]',
    )
    await addCredentialButton.click()
    await addCredentialButton.click()

    let credentialNames = modal.locator('[data-testid^="credential-name"]')
    await expect(credentialNames).toHaveCount(2)

    // When: Click delete button
    const deleteButton = modal
      .locator('[data-testid^="remove-credential"]')
      .first()
    await deleteButton.click()

    // Then: Credential is deleted
    credentialNames = modal.locator('[data-testid^="credential-name"]')
    await expect(credentialNames).toHaveCount(1)
  })

  test('WCAG AA: Credentials section keyboard navigation', async ({ page }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Add Credential
    const addCredentialButton = modal.locator(
      '[data-testid="add-credential-button"]',
    )

    // Move to add credential button with Tab key (Quick note → Add URL → Add Credential)
    await page.keyboard.press('Tab') // Leave Quick note
    await page.keyboard.press('Tab') // Add URL
    await page.keyboard.press('Tab') // Add Credential
    await expect(addCredentialButton).toBeFocused()

    // Add with Enter key
    await page.keyboard.press('Enter')

    // Focus moves to Credential name
    const nameInput = modal.locator('[data-testid^="credential-name"]').first()
    await expect(nameInput).toBeVisible()
  })
})
