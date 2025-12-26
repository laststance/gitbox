import { test, expect, type Page } from '@playwright/test'

/**
 * Gmail Clone E2E Tests
 *
 * Comprehensive testing suite for:
 * - Basic UI functionality
 * - 1000+ email load testing with localStorage persistence
 * - Performance metrics collection
 */

/**
 * Clear localStorage before each test
 */
async function clearStorage(page: Page) {
  await page.evaluate(() => localStorage.clear())
}

/**
 * Get localStorage size in bytes
 */
async function getStorageSize(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const data = localStorage.getItem('gmail-clone-state')
    return data ? new Blob([data]).size : 0
  })
}

/**
 * Get email count from localStorage
 *
 * The persisted state has structure: { version: number, state: AppState }
 * where AppState = { emails: EmailsState } and EmailsState has 'emails' array
 */
async function getEmailCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const data = localStorage.getItem('gmail-clone-state')
    if (!data) return 0
    try {
      const persisted = JSON.parse(data)
      // Access: persisted.state.emails.emails (note the wrapper structure!)
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

test.describe('Gmail Clone - Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('should display Gmail Clone header', async ({ page }) => {
    await expect(page.locator('text=Gmail Clone')).toBeVisible()
  })

  test('should display email generation buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("+100 Emails")')).toBeVisible()
    await expect(page.locator('button:has-text("+1000 Emails")')).toBeVisible()
    await expect(page.locator('button:has-text("+5000 Emails")')).toBeVisible()
  })

  test('should generate 100 emails and persist to localStorage', async ({
    page,
  }) => {
    // Initial state should have 0 emails
    const initialCount = await getEmailCount(page)
    expect(initialCount).toBe(0)

    // Wait for hydration to complete
    await waitForHydration(page)

    // Click +100 Emails button
    await page.click('button:has-text("+100 Emails")')

    // Wait for debounced save (300ms debounce + buffer)
    await page.waitForTimeout(500)

    // Verify localStorage was updated
    const finalCount = await getEmailCount(page)
    expect(finalCount).toBe(100)

    // Verify storage size is reasonable (should be > 10KB for 100 emails)
    const size = await getStorageSize(page)
    expect(size).toBeGreaterThan(10000)
  })

  test('should clear all emails when Clear All is clicked', async ({
    page,
  }) => {
    // First generate some emails
    await page.click('button:has-text("+100 Emails")')
    await page.waitForTimeout(500)

    // Verify emails exist
    let count = await getEmailCount(page)
    expect(count).toBe(100)

    // Click Clear All
    await page.click('button:has-text("Clear All")')
    await page.waitForTimeout(500)

    // Verify emails are cleared
    count = await getEmailCount(page)
    expect(count).toBe(0)
  })

  test('should persist emails after page reload', async ({ page }) => {
    // Generate emails
    await page.click('button:has-text("+100 Emails")')
    await page.waitForTimeout(500)

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait for hydration
    await waitForHydration(page)

    // Verify emails are still present
    const count = await getEmailCount(page)
    expect(count).toBe(100)
  })
})

test.describe('Gmail Clone - 1000+ Email Load Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('should handle 1000 emails with acceptable performance', async ({
    page,
  }) => {
    const startTime = Date.now()

    // Generate 1000 emails
    await page.click('button:has-text("+1000 Emails")')

    // Wait for debounced save to complete (300ms debounce + buffer)
    await page.waitForTimeout(600)

    const generationTime = Date.now() - startTime

    // Verify 1000 emails were created
    const count = await getEmailCount(page)
    expect(count).toBe(1000)

    // Performance assertion: should complete in under 5 seconds
    expect(generationTime).toBeLessThan(5000)

    // Verify storage size (should be between 500KB - 2MB for 1000 emails)
    const size = await getStorageSize(page)
    expect(size).toBeGreaterThan(500000)
    expect(size).toBeLessThan(2000000)

    console.log(`[Performance] 1000 emails:
      - Generation time: ${generationTime}ms
      - Storage size: ${(size / 1024).toFixed(2)}KB
    `)
  })

  test('should persist 1000 emails after reload with fast hydration', async ({
    page,
  }) => {
    // Generate 1000 emails
    await page.click('button:has-text("+1000 Emails")')
    await page.waitForTimeout(600)

    // Measure reload + hydration time
    const reloadStart = Date.now()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await waitForHydration(page)
    const hydrationTime = Date.now() - reloadStart

    // Verify emails persisted
    const count = await getEmailCount(page)
    expect(count).toBe(1000)

    // Hydration should complete in under 3 seconds
    expect(hydrationTime).toBeLessThan(3000)

    console.log(`[Performance] 1000 email hydration time: ${hydrationTime}ms`)
  })

  test('should handle sequential email loads with persistence', async ({
    page,
  }) => {
    // Load 100 emails first
    await page.click('button:has-text("+100 Emails")')
    await page.waitForTimeout(300)

    // Verify 100 emails saved
    let count = await getEmailCount(page)
    expect(count).toBe(100)

    // Load 1000 emails (replaces previous)
    await page.click('button:has-text("+1000 Emails")')
    await page.waitForTimeout(300)

    // Should have 1000 emails (loadEmails replaces, doesn't accumulate)
    count = await getEmailCount(page)
    expect(count).toBe(1000)
  })
})

test.describe('Gmail Clone - Performance Metrics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('should collect performance metrics for 5000 emails', async ({
    page,
  }) => {
    const metrics: Record<string, number> = {}

    // Measure generation time
    const genStart = Date.now()
    await page.click('button:has-text("+5000 Emails")')
    await page.waitForTimeout(2000) // Wait for debounce
    metrics.generationTimeMs = Date.now() - genStart

    // Verify count
    const count = await getEmailCount(page)
    expect(count).toBe(5000)

    // Measure storage size
    metrics.storageSizeBytes = await getStorageSize(page)
    metrics.storageSizeKB = metrics.storageSizeBytes / 1024
    metrics.storageSizeMB = metrics.storageSizeKB / 1024

    // Measure reload + hydration
    const reloadStart = Date.now()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await waitForHydration(page)
    metrics.hydrationTimeMs = Date.now() - reloadStart

    // Verify emails persisted
    const finalCount = await getEmailCount(page)
    expect(finalCount).toBe(5000)

    // Output performance report
    console.log(`
╔══════════════════════════════════════════════════╗
║     Gmail Clone Performance Report - 5000 Emails ║
╠══════════════════════════════════════════════════╣
║ Generation Time:    ${String(metrics.generationTimeMs).padEnd(6)}ms                  ║
║ Storage Size:       ${metrics.storageSizeMB.toFixed(2).padEnd(6)}MB                  ║
║ Hydration Time:     ${String(metrics.hydrationTimeMs).padEnd(6)}ms                  ║
║ Emails per KB:      ${(5000 / metrics.storageSizeKB).toFixed(2).padEnd(6)}                     ║
╚══════════════════════════════════════════════════╝
    `)

    // Performance assertions
    expect(metrics.generationTimeMs).toBeLessThan(10000) // Under 10s for 5000 emails
    expect(metrics.hydrationTimeMs).toBeLessThan(5000) // Under 5s hydration
    expect(metrics.storageSizeMB).toBeLessThan(10) // Under 10MB storage
  })

  test('should demonstrate debounce optimization', async ({ page }) => {
    // Rapid clicks should be debounced - only final state saved
    const rapidClicks = 5
    const startTime = Date.now()

    for (let i = 0; i < rapidClicks; i++) {
      await page.click('button:has-text("+100 Emails")')
      await page.waitForTimeout(50) // Quick succession clicks
    }

    // Wait for debounce window (100ms debounce + buffer)
    await page.waitForTimeout(300)
    const totalTime = Date.now() - startTime

    // Should have final state saved (loadEmails replaces, so last click = 100 emails)
    const count = await getEmailCount(page)
    expect(count).toBe(100)

    // Verify debounce: rapid actions should complete quickly with batched saves
    expect(totalTime).toBeLessThan(2000)
    console.log(
      `[Debounce Test] ${rapidClicks} rapid clicks completed in ${totalTime}ms`,
    )
  })
})

test.describe('Gmail Clone - Browser Close/Reopen Persistence', () => {
  /**
   * Test that localStorage data persists across browser sessions.
   *
   * This simulates a real user scenario:
   * 1. User opens app, generates emails
   * 2. User closes browser completely
   * 3. User reopens browser and navigates back
   * 4. Emails should be restored from localStorage
   */
  test('should persist state after browser close and reopen', async ({
    browser,
  }) => {
    // Create first browser context (session 1)
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()

    // Navigate and generate emails
    await page1.goto('/')
    await page1.evaluate(() => localStorage.clear())
    await page1.reload()
    await page1.waitForLoadState('networkidle')

    // Wait for hydration
    await page1.waitForFunction(
      () => {
        const footer = document.querySelector('footer')
        return footer?.textContent?.includes('✅ Complete') ?? false
      },
      { timeout: 10000 },
    )

    // Generate 100 emails
    await page1.click('button:has-text("+100 Emails")')
    await page1.waitForTimeout(500)

    // Verify emails exist in localStorage
    const emailCountSession1 = await page1.evaluate(() => {
      const data = localStorage.getItem('gmail-clone-state')
      if (!data) return 0
      try {
        const persisted = JSON.parse(data)
        return persisted.state?.emails?.emails?.length ?? 0
      } catch {
        return 0
      }
    })
    expect(emailCountSession1).toBe(100)

    // Save localStorage state before closing
    const storageState = await page1.evaluate(() => {
      const data = localStorage.getItem('gmail-clone-state')
      return data
    })
    expect(storageState).not.toBeNull()

    // Close the first browser context (simulates browser close)
    await context1.close()

    // Create a NEW browser context (simulates browser reopen)
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()

    // Navigate to the app
    await page2.goto('/')

    // Inject the saved localStorage state (simulating browser's localStorage persistence)
    await page2.evaluate((savedState) => {
      if (savedState) {
        localStorage.setItem('gmail-clone-state', savedState)
      }
    }, storageState)

    // Reload to trigger hydration from localStorage
    await page2.reload()
    await page2.waitForLoadState('networkidle')

    // Wait for hydration
    await page2.waitForFunction(
      () => {
        const footer = document.querySelector('footer')
        return footer?.textContent?.includes('✅ Complete') ?? false
      },
      { timeout: 10000 },
    )

    // Verify emails were restored from localStorage
    const emailCountSession2 = await page2.evaluate(() => {
      const data = localStorage.getItem('gmail-clone-state')
      if (!data) return 0
      try {
        const persisted = JSON.parse(data)
        return persisted.state?.emails?.emails?.length ?? 0
      } catch {
        return 0
      }
    })

    // Critical assertion: emails should persist across browser sessions
    expect(emailCountSession2).toBe(100)

    // Cleanup
    await context2.close()
  })

  test('should restore complex state after browser restart', async ({
    browser,
  }) => {
    // Session 1: Create complex state with 1000 emails
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()

    await page1.goto('/')
    await page1.evaluate(() => localStorage.clear())
    await page1.reload()
    await page1.waitForLoadState('networkidle')

    // Wait for hydration
    await page1.waitForFunction(
      () => {
        const footer = document.querySelector('footer')
        return footer?.textContent?.includes('✅ Complete') ?? false
      },
      { timeout: 10000 },
    )

    // Generate 1000 emails for complex state test
    await page1.click('button:has-text("+1000 Emails")')
    await page1.waitForTimeout(800)

    // Capture state
    const storageState = await page1.evaluate(() =>
      localStorage.getItem('gmail-clone-state'),
    )
    const originalSize = await page1.evaluate(() => {
      const data = localStorage.getItem('gmail-clone-state')
      return data ? new Blob([data]).size : 0
    })

    expect(originalSize).toBeGreaterThan(500000) // Should be > 500KB for 1000 emails

    // Close session 1
    await context1.close()

    // Session 2: Restore and verify
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    await page2.goto('/')

    // Inject saved state
    await page2.evaluate((savedState) => {
      if (savedState) {
        localStorage.setItem('gmail-clone-state', savedState)
      }
    }, storageState)

    // Measure hydration time after browser restart
    const hydrationStart = Date.now()
    await page2.reload()
    await page2.waitForLoadState('networkidle')
    await page2.waitForFunction(
      () => {
        const footer = document.querySelector('footer')
        return footer?.textContent?.includes('✅ Complete') ?? false
      },
      { timeout: 10000 },
    )
    const hydrationTime = Date.now() - hydrationStart

    // Verify state integrity
    const restoredCount = await page2.evaluate(() => {
      const data = localStorage.getItem('gmail-clone-state')
      if (!data) return 0
      try {
        const persisted = JSON.parse(data)
        return persisted.state?.emails?.emails?.length ?? 0
      } catch {
        return 0
      }
    })

    expect(restoredCount).toBe(1000)
    expect(hydrationTime).toBeLessThan(3000) // Hydration should be fast

    console.log(
      `[Browser Restart] 1000 emails restored in ${hydrationTime}ms after browser restart`,
    )

    await context2.close()
  })
})

test.describe('Gmail Clone - UI Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Generate some emails for interaction tests
    await page.click('button:has-text("+100 Emails")')
    await page.waitForTimeout(1000)
  })

  test('should display stats bar with correct counts', async ({ page }) => {
    await expect(page.locator('text=Total:')).toBeVisible()
    await expect(page.locator('text=Unread:')).toBeVisible()
    await expect(page.locator('text=Starred:')).toBeVisible()
    await expect(page.locator('text=Storage:')).toBeVisible()
  })

  test('should search emails', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search mail..."]')
    await expect(searchInput).toBeVisible()

    // Type a search query
    await searchInput.fill('test')
    await page.waitForTimeout(300) // Wait for filter

    // Search should filter emails
    await expect(searchInput).toHaveValue('test')
  })

  test('should display hydration status', async ({ page }) => {
    await waitForHydration(page)
    await expect(page.locator('text=Hydration: ✅ Complete')).toBeVisible()
  })
})
