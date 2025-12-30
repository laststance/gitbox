import { test, expect, type Page } from '@playwright/test'

/**
 * Cross-Service localStorage Persistence E2E Tests
 *
 * Tests that Gmail state persists when navigating between
 * different Google services (simulated pages).
 *
 * This is the PRIMARY test suite for validating that
 * redux-storage-middleware works correctly across page navigation.
 */

/**
 * Clear localStorage before each test
 */
async function clearStorage(page: Page) {
  await page.evaluate(() => localStorage.clear())
}

/**
 * Get email count from localStorage
 */
async function getEmailCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const data = localStorage.getItem('gmail-clone-state')
    if (!data) return 0
    try {
      const persisted = JSON.parse(data)
      return persisted.state?.emails?.emails?.length ?? 0
    } catch {
      return 0
    }
  })
}

/**
 * Wait for hydration to complete
 */
async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => {
      const footer = document.querySelector('footer')
      return footer?.textContent?.includes('✅ Complete') ?? false
    },
    { timeout: 10000 },
  )
}

/**
 * Generate emails and wait for persistence
 */
async function generateAndWaitForPersistence(page: Page, buttonText: string) {
  await page.click(`button:has-text("${buttonText}")`)
  // Wait for debounced save (300ms debounce + buffer)
  await page.waitForTimeout(500)
}

test.describe('Cross-Service localStorage Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('should display app launcher when clicking grid icon', async ({
    page,
  }) => {
    // Wait for hydration
    await waitForHydration(page)

    // Click app launcher button
    await page.click('[data-testid="app-launcher-button"]')

    // Verify app launcher popup is visible
    await expect(
      page.locator('[data-testid="app-launcher-popup"]'),
    ).toBeVisible()

    // Verify service links are present
    await expect(
      page.locator('[data-testid="app-launcher-translate"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="app-launcher-youtube"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="app-launcher-calendar"]'),
    ).toBeVisible()
  })

  test('should persist emails when navigating to Translate and back', async ({
    page,
  }) => {
    await waitForHydration(page)

    // Generate 100 emails
    await generateAndWaitForPersistence(page, '+100 Emails')

    // Verify emails were created
    const emailCount = await getEmailCount(page)
    expect(emailCount).toBe(100)

    // Navigate to Translate service via app launcher
    await page.click('[data-testid="app-launcher-button"]')
    await page.click('[data-testid="app-launcher-translate"]')

    // Wait for Translate page to load
    await page.waitForURL('**/services/translate')
    await expect(page.locator('text=Google Translate')).toBeVisible()

    // Verify email count badge shows persisted emails
    await expect(
      page.locator('[data-testid="gmail-status-badge"]'),
    ).toContainText('100 emails persisted')

    // Navigate back to Gmail
    await page.click('text=Back to Gmail')
    await page.waitForURL('/')

    // Wait for hydration
    await waitForHydration(page)

    // Verify emails are still there
    const restoredCount = await getEmailCount(page)
    expect(restoredCount).toBe(100)

    // Verify UI shows correct email count
    await expect(page.locator('footer')).toContainText('100 emails')
  })

  test('should persist 1000 emails across multiple service navigations', async ({
    page,
  }) => {
    await waitForHydration(page)

    // Generate 1000 emails for stress test
    await generateAndWaitForPersistence(page, '+1000 Emails')
    const initialCount = await getEmailCount(page)
    expect(initialCount).toBe(1000)

    // Navigate through multiple services
    const services = ['youtube', 'calendar', 'maps', 'docs']

    for (const service of services) {
      // Open app launcher and navigate to service
      await page.click('[data-testid="app-launcher-button"]')
      await page.click(`[data-testid="app-launcher-${service}"]`)
      await page.waitForURL(`**/services/${service}`)

      // Verify persistence indicator on service page
      await expect(
        page.locator('[data-testid="gmail-status-badge"]'),
      ).toContainText('1,000 emails persisted')
    }

    // Return to Gmail
    await page.click('text=Back to Gmail')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Final verification
    const finalCount = await getEmailCount(page)
    expect(finalCount).toBe(1000)
  })

  test('should persist state across browser context recreation (simulated browser restart)', async ({
    browser,
  }) => {
    // Session 1: Generate emails
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()

    await page1.goto('/')
    await page1.evaluate(() => localStorage.clear())
    await page1.reload()
    await page1.waitForLoadState('networkidle')
    await waitForHydration(page1)

    // Generate emails
    await generateAndWaitForPersistence(page1, '+100 Emails')

    // Navigate to YouTube
    await page1.click('[data-testid="app-launcher-button"]')
    await page1.click('[data-testid="app-launcher-youtube"]')
    await page1.waitForURL('**/services/youtube')

    // Save localStorage state
    const storageState = await page1.evaluate(() =>
      localStorage.getItem('gmail-clone-state'),
    )
    expect(storageState).not.toBeNull()

    // Close session 1 (simulates browser close)
    await context1.close()

    // Session 2: Restore and verify (simulates browser reopen)
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()

    await page2.goto('/')

    // Inject saved localStorage
    await page2.evaluate((savedState) => {
      if (savedState) {
        localStorage.setItem('gmail-clone-state', savedState)
      }
    }, storageState)

    await page2.reload()
    await page2.waitForLoadState('networkidle')
    await waitForHydration(page2)

    // Verify emails persisted across "browser restart"
    const restoredCount = await getEmailCount(page2)
    expect(restoredCount).toBe(100)

    // Navigate to a different service and verify
    await page2.click('[data-testid="app-launcher-button"]')
    await page2.click('[data-testid="app-launcher-meet"]')
    await page2.waitForURL('**/services/meet')

    await expect(
      page2.locator('[data-testid="gmail-status-badge"]'),
    ).toContainText('100 emails persisted')

    await context2.close()
  })

  test('should show correct count on service pages after email operations', async ({
    page,
  }) => {
    await waitForHydration(page)

    // Generate emails
    await generateAndWaitForPersistence(page, '+100 Emails')

    // Navigate to Photos
    await page.click('[data-testid="app-launcher-button"]')
    await page.click('[data-testid="app-launcher-photos"]')
    await page.waitForURL('**/services/photos')

    // Verify count
    await expect(
      page.locator('[data-testid="gmail-status-badge"]'),
    ).toContainText('100 emails persisted')

    // Return to Gmail and add more emails
    await page.click('text=Back to Gmail')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Add more emails (loadEmails replaces, so this will be 1000, not 1100)
    await generateAndWaitForPersistence(page, '+1000 Emails')

    // Navigate to Chat
    await page.click('[data-testid="app-launcher-button"]')
    await page.click('[data-testid="app-launcher-chat"]')
    await page.waitForURL('**/services/chat')

    // Verify updated count
    await expect(
      page.locator('[data-testid="gmail-status-badge"]'),
    ).toContainText('1,000 emails persisted')
  })

  test('should handle clear all operation and reflect on service pages', async ({
    page,
  }) => {
    await waitForHydration(page)

    // Generate emails
    await generateAndWaitForPersistence(page, '+100 Emails')

    // Verify emails exist
    let count = await getEmailCount(page)
    expect(count).toBe(100)

    // Clear all emails
    await page.click('button:has-text("Clear All")')
    await page.waitForTimeout(500)

    // Navigate to Drive
    await page.click('[data-testid="app-launcher-button"]')
    await page.click('[data-testid="app-launcher-drive"]')
    await page.waitForURL('**/services/drive')

    // Verify badge shows no emails
    await expect(
      page.locator('[data-testid="gmail-status-badge"]'),
    ).toContainText('No emails yet')

    // Return to Gmail and verify
    await page.click('text=Back to Gmail')
    await page.waitForURL('/')
    await waitForHydration(page)

    count = await getEmailCount(page)
    expect(count).toBe(0)
  })
})

test.describe('Service Page UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await waitForHydration(page)

    // Generate some emails for testing
    await generateAndWaitForPersistence(page, '+100 Emails')
  })

  test('all service pages should be accessible and display correctly', async ({
    page,
  }) => {
    const services = [
      { id: 'translate', title: 'Google Translate' },
      { id: 'search', title: 'Google' },
      { id: 'youtube', title: 'YouTube' },
      { id: 'maps', title: 'Maps' },
      { id: 'docs', title: 'Docs' },
      { id: 'calendar', title: 'Calendar' },
      { id: 'photos', title: 'Photos' },
      { id: 'news', title: 'News' },
      { id: 'meet', title: 'Meet' },
      { id: 'chat', title: 'Chat' },
      { id: 'drive', title: 'Drive' },
      { id: 'sheets', title: 'Sheets' },
    ]

    for (const service of services) {
      await page.click('[data-testid="app-launcher-button"]')
      await page.click(`[data-testid="app-launcher-${service.id}"]`)
      await page.waitForURL(`**/services/${service.id}`)

      // Verify service page loaded with correct title
      await expect(page.locator(`text=${service.title}`).first()).toBeVisible()

      // Verify Gmail status badge is present
      await expect(
        page.locator('[data-testid="gmail-status-badge"]'),
      ).toBeVisible()

      // Verify app launcher button is present
      await expect(
        page.locator('[data-testid="app-launcher-button"]'),
      ).toBeVisible()

      // Return to Gmail for next iteration
      await page.click('text=Back to Gmail')
      await page.waitForURL('/')
      await waitForHydration(page)
    }
  })

  test('service pages should have working app launcher', async ({ page }) => {
    // Navigate to Calendar
    await page.click('[data-testid="app-launcher-button"]')
    await page.click('[data-testid="app-launcher-calendar"]')
    await page.waitForURL('**/services/calendar')

    // Open app launcher on service page
    await page.click('[data-testid="app-launcher-button"]')
    await expect(
      page.locator('[data-testid="app-launcher-popup"]'),
    ).toBeVisible()

    // Navigate to YouTube from Calendar (not via Gmail)
    await page.click('[data-testid="app-launcher-youtube"]')
    await page.waitForURL('**/services/youtube')

    // Verify YouTube loaded
    await expect(page.locator('text=YouTube').first()).toBeVisible()

    // Verify emails still persisted
    await expect(
      page.locator('[data-testid="gmail-status-badge"]'),
    ).toContainText('100 emails persisted')
  })
})

test.describe('Performance Tests - Cross Service Navigation', () => {
  test('should navigate between services quickly with 1000+ emails', async ({
    page,
  }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await waitForHydration(page)

    // Generate 1000 emails
    await generateAndWaitForPersistence(page, '+1000 Emails')

    const navigationTimes: number[] = []
    const services = ['translate', 'youtube', 'calendar', 'maps']

    for (const service of services) {
      const startTime = Date.now()

      await page.click('[data-testid="app-launcher-button"]')
      await page.click(`[data-testid="app-launcher-${service}"]`)
      await page.waitForURL(`**/services/${service}`)

      // Wait for page to be interactive
      await expect(
        page.locator('[data-testid="gmail-status-badge"]'),
      ).toBeVisible()

      const navigationTime = Date.now() - startTime
      navigationTimes.push(navigationTime)
    }

    // All navigations should complete in under 2 seconds each
    for (const time of navigationTimes) {
      expect(time).toBeLessThan(2000)
    }

    const avgTime =
      navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length
    console.log(`
[Performance] Cross-service navigation with 1000 emails:
  Average navigation time: ${avgTime.toFixed(2)}ms
  Individual times: ${navigationTimes.map((t) => `${t}ms`).join(', ')}
    `)

    // Average should be under 1 second
    expect(avgTime).toBeLessThan(1000)
  })
})
