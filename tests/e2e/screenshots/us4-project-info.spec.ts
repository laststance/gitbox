/**
 * Screenshot Test: Project Info Modal (US4)
 *
 * Constitution requirements:
 * - Principle I: Browser verification with Playwright MCP screenshots
 * - T144: Capture browser screenshots of Project Info modal
 *
 * Purpose: Visual documentation of all US4 scenarios
 */

import { test, expect } from '@playwright/test'

test.describe('US4 Project Info Modal - Screenshot Documentation', () => {
  test.beforeEach(async ({ page }) => {
    // Access board screen
    await page.goto('/board/00000000-0000-0000-0000-000000000100')
    await page.waitForLoadState('networkidle')

    // Test isolation: Clear existing data
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    const modal = page.locator('[data-testid="project-info-modal"]')
    await modal.waitFor({ state: 'visible' })

    // Delete existing URLs
    const deleteButtons = modal.locator('button[data-testid^="remove-url"]')
    const deleteCount = await deleteButtons.count()
    for (let i = 0; i < deleteCount; i++) {
      await deleteButtons.first().click()
    }

    // Clear Quick note
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await quickNoteTextarea.fill('')

    // Save and close
    await modal.locator('[data-testid="save-button"]').click()
    await modal.waitFor({ state: 'hidden' })
  })

  test('01-modal-empty-state: Empty Project Info modal', async ({ page }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Screenshot: Empty state
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-01-modal-empty-state.png',
      fullPage: true,
    })
  })

  test('02-quick-note-filled: Quick note with text', async ({ page }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Enter text in Quick note
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await quickNoteTextarea.fill(
      'Production app deployed on Vercel\nMain features: Kanban board, Project info\nNext: Add maintenance mode',
    )

    // Screenshot: After entering Quick note
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-02-quick-note-filled.png',
      fullPage: true,
    })
  })

  test('03-single-production-url: Single Production URL added', async ({
    page,
  }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Add Production URL
    await modal.locator('[data-testid="add-url-button"]').click()
    const urlInput = modal.locator('[data-testid^="url-input"]').first()
    await expect(urlInput).toBeVisible()
    await urlInput.fill('https://gitbox.vercel.app')

    // Screenshot: Single Production URL
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-03-single-production-url.png',
      fullPage: true,
    })
  })

  test('04-multiple-urls: Multiple URLs with different types', async ({
    page,
  }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Production URL
    await modal.locator('[data-testid="add-url-button"]').click()
    let urlInput = modal.locator('[data-testid^="url-input"]').last()
    await expect(urlInput).toBeVisible()
    await urlInput.fill('https://gitbox.vercel.app')

    // Tracking URL
    await modal.locator('[data-testid="add-url-button"]').click()
    const urlTypeSelect = modal
      .locator('[data-testid="url-type-select"]')
      .last()
    await expect(urlTypeSelect).toBeVisible()
    await urlTypeSelect.click()
    await page.getByRole('option', { name: 'Tracking' }).click()
    urlInput = modal.locator('[data-testid^="url-input"]').last()
    await urlInput.fill('https://analytics.google.com/dashboard')

    // Supabase URL
    await modal.locator('[data-testid="add-url-button"]').click()
    const urlTypeSelect2 = modal
      .locator('[data-testid="url-type-select"]')
      .last()
    await expect(urlTypeSelect2).toBeVisible()
    await urlTypeSelect2.click()
    await page.getByRole('option', { name: 'Supabase' }).click()
    urlInput = modal.locator('[data-testid^="url-input"]').last()
    await urlInput.fill('https://app.supabase.com/project/abc123/editor')

    // Screenshot: Multiple URLs (different types)
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-04-multiple-urls.png',
      fullPage: true,
    })
  })

  test('05-url-type-dropdown: URL type dropdown opened', async ({ page }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Add URL and open dropdown
    await modal.locator('[data-testid="add-url-button"]').click()
    const urlTypeSelect = modal
      .locator('[data-testid="url-type-select"]')
      .last()
    await expect(urlTypeSelect).toBeVisible()
    await urlTypeSelect.click()

    // Screenshot: URL type dropdown opened state
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-05-url-type-dropdown.png',
      fullPage: true,
    })
  })

  test('06-url-validation-error: URL validation error state', async ({
    page,
  }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Enter invalid URL
    await modal.locator('[data-testid="add-url-button"]').click()
    const urlInput = modal.locator('[data-testid^="url-input"]').first()
    await expect(urlInput).toBeVisible()
    await urlInput.fill('not-a-valid-url')

    // Wait for error message to display
    const errorMessage = modal.locator('[data-testid="url-error"]')
    await expect(errorMessage).toBeVisible()

    // Screenshot: URL validation error
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-06-url-validation-error.png',
      fullPage: true,
    })
  })

  test('07-complete-form: Complete form with all fields filled', async ({
    page,
  }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Enter Quick note
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await quickNoteTextarea.fill(
      'Full-stack PWA for GitHub repository management\nBuilt with Next.js 16, React 19, Supabase\nDeployed: Vercel (Production)',
    )

    // Production URL
    await modal.locator('[data-testid="add-url-button"]').click()
    let urlInput = modal.locator('[data-testid^="url-input"]').last()
    await expect(urlInput).toBeVisible()
    await urlInput.fill('https://gitbox.vercel.app')

    // Tracking URL
    await modal.locator('[data-testid="add-url-button"]').click()
    const urlTypeSelect = modal
      .locator('[data-testid="url-type-select"]')
      .last()
    await expect(urlTypeSelect).toBeVisible()
    await urlTypeSelect.click()
    await page.getByRole('option', { name: 'Tracking' }).click()
    urlInput = modal.locator('[data-testid^="url-input"]').last()
    await urlInput.fill('https://analytics.google.com/analytics/gitbox')

    // Screenshot: All fields filled
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-07-complete-form.png',
      fullPage: true,
    })
  })

  test('08-saved-and-reopened: Saved data displayed after reopen', async ({
    page,
  }) => {
    // Open modal
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()

    const modal = page.locator('[data-testid="project-info-modal"]')
    await expect(modal).toBeVisible()

    // Enter data
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]',
    )
    await quickNoteTextarea.fill('Saved project information test')

    await modal.locator('[data-testid="add-url-button"]').click()
    const urlInput = modal.locator('[data-testid^="url-input"]').first()
    await expect(urlInput).toBeVisible()
    await urlInput.fill('https://example.com')

    // Save
    await modal.locator('[data-testid="save-button"]').click()
    await expect(modal).not.toBeVisible()

    // Reopen
    await page.locator('[data-testid="repo-card"]').first().hover()
    await page.locator('[data-testid^="overflow-menu-trigger"]').first().click()
    await page.locator('[data-testid^="edit-project"]').click()
    await expect(modal).toBeVisible()

    // Screenshot: Saved data displayed
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-08-saved-and-reopened.png',
      fullPage: true,
    })
  })
})
