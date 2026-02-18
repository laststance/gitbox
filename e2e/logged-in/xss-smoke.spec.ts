/**
 * XSS Smoke Tests
 *
 * Verifies that user-input rendering paths properly escape XSS payloads.
 * Tests the three primary attack surfaces:
 * - Comment text (stored XSS)
 * - Board title (stored XSS)
 * - Project info link URL (javascript: scheme)
 *
 * @see https://github.com/laststance/gitbox/issues/127
 */

import { test, expect } from '../fixtures/coverage'
import {
  BOARD_IDS,
  CARD_IDS,
  resetProjectInfoComments,
} from '../helpers/db-query'

test.describe('XSS Prevention Smoke Tests (Authenticated)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  const BOARD_URL = `/board/${BOARD_IDS.testBoard}`
  const XSS_SCRIPT_PAYLOAD = '<script>alert("xss")</script>'
  const XSS_IMG_PAYLOAD = '<img src=x onerror=alert("xss")>'
  const XSS_JS_URL = 'javascript:alert(1)'

  test.beforeEach(async ({ page }) => {
    await resetProjectInfoComments()
    await page.goto(BOARD_URL)
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('[data-testid^="repo-card-"]').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('should escape script tags in comment text', async ({ page }) => {
    // Track any dialog/alert events — should never fire
    let alertFired = false
    page.on('dialog', async (dialog) => {
      alertFired = true
      await dialog.dismiss()
    })

    // Click on card-1 comment to enter edit mode
    const commentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await expect(commentDisplay).toBeVisible({ timeout: 10000 })
    await commentDisplay.click()

    // Type XSS payload into textarea
    const textarea = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"] textarea`,
    )
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill(XSS_SCRIPT_PAYLOAD)
    await textarea.press('Enter')

    // Verify the XSS payload is rendered as escaped text, not executed
    // (toContainText auto-waits for the save to complete)
    const commentText = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-text"]`,
    )
    await expect(commentText).toContainText('<script>')

    // Verify no alert fired after DOM settled
    expect(alertFired).toBe(false)
  })

  test('should escape img onerror payload in comment text', async ({
    page,
  }) => {
    let alertFired = false
    page.on('dialog', async (dialog) => {
      alertFired = true
      await dialog.dismiss()
    })

    const commentDisplay = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-display"]`,
    )
    await expect(commentDisplay).toBeVisible({ timeout: 10000 })
    await commentDisplay.click()

    const textarea = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-inline-edit"] textarea`,
    )
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill(XSS_IMG_PAYLOAD)
    await textarea.press('Enter')

    // Verify the XSS payload is rendered as escaped text, not executed
    // (toContainText auto-waits for the save to complete)
    const commentText = page.locator(
      `[data-testid="repo-card-${CARD_IDS.card1}"] [data-testid="comment-text"]`,
    )
    await expect(commentText).toContainText('<img')

    // Verify no alert fired after DOM settled
    expect(alertFired).toBe(false)
  })

  test('should reject javascript: URL in project info link', async ({
    page,
  }) => {
    let alertFired = false
    page.on('dialog', async (dialog) => {
      alertFired = true
      await dialog.dismiss()
    })

    // Open the first card's note/project info modal
    const card = page.locator(`[data-testid="repo-card-${CARD_IDS.card1}"]`)
    await card.click()

    // Wait for note modal to appear
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Find a link edit button and click it
    let enteredEditMode = false
    const editButton = modal.locator('[data-testid^="url-edit-"]').first()
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click()
      enteredEditMode = true
    } else {
      // If no existing link, look for "add link" button
      const addLink = modal.locator('button:has-text("Add")').first()
      if (await addLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addLink.click()
        enteredEditMode = true
      }
    }

    // Ensure we actually found an edit/add button — test is meaningless otherwise
    expect(enteredEditMode).toBe(true)

    // Try to enter javascript: URL
    const urlInput = modal.locator('[data-testid^="url-input-"]').first()
    await expect(urlInput).toBeVisible({ timeout: 3000 })
    await urlInput.fill(XSS_JS_URL)
    await urlInput.press('Tab')

    // Wait for validation
    await page.waitForTimeout(500)

    // Should show error — javascript: is not allowed
    const error = modal.locator('[role="alert"]').first()
    await expect(error).toBeVisible({ timeout: 3000 })
    await expect(error).toContainText('http')

    expect(alertFired).toBe(false)
  })
})
