/**
 * Playwright Coverage Fixture
 *
 * Automatically collects V8 JS and CSS coverage for each test
 * and reports to monocart-reporter for aggregated coverage reports.
 *
 * @remarks
 * - Only works with Chromium-based browsers (V8 coverage API)
 * - Uses resetOnNavigation: false to capture coverage across page navigations
 * - Coverage is collected per-test and aggregated by monocart-reporter
 */

import { test as base } from '@playwright/test'
import { addCoverageReport } from 'monocart-reporter'

/**
 * Extended test fixture with automatic V8 coverage collection.
 *
 * @example
 * ```typescript
 * import { test, expect } from './fixtures/coverage'
 *
 * test('my test', async ({ page }) => {
 *   await page.goto('/')
 *   await expect(page).toHaveTitle(/GitBox/)
 * })
 * ```
 */
export const test = base.extend<{ autoCoverage: void }>({
  autoCoverage: [
    async ({ page }, use, testInfo) => {
      // Determine if this is a Chromium-based browser
      const isChromium =
        testInfo.project.name === 'setup' ||
        testInfo.project.name === 'logged-in' ||
        testInfo.project.name === 'unauthenticated'

      if (isChromium) {
        // Start JS and CSS coverage collection before test
        await Promise.all([
          page.coverage.startJSCoverage({
            resetOnNavigation: false,
          }),
          page.coverage.startCSSCoverage({
            resetOnNavigation: false,
          }),
        ])
      }

      // Run the actual test
      await use()

      // Collect and report coverage after test
      if (isChromium) {
        const [jsCoverage, cssCoverage] = await Promise.all([
          page.coverage.stopJSCoverage(),
          page.coverage.stopCSSCoverage(),
        ])

        const coverageData = [...jsCoverage, ...cssCoverage]

        // Add coverage data to monocart-reporter
        await addCoverageReport(coverageData, testInfo)
      }
    },
    { scope: 'test', auto: true },
  ],
})

export { expect } from '@playwright/test'
