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
 * Collect coverage only in CI. Local runs — especially `pnpm e2e:parallel`, whose
 * blob-only reporter never runs monocart — would otherwise keep dumping raw V8
 * data into `monocart-report/coverage/.cache` with nothing ever cleaning it up,
 * ballooning to tens of GB. GitHub Actions sets `CI=true`, so CI is unaffected.
 */
const shouldCollectCoverage = Boolean(process.env.CI)

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
      // Coverage uses the V8 API, available only on Chromium-based projects.
      const isChromium =
        testInfo.project.name === 'setup' ||
        testInfo.project.name === 'logged-in' ||
        testInfo.project.name === 'unauthenticated'

      // Gate on CI so local runs never write to monocart-report/.cache.
      const collectCoverage = isChromium && shouldCollectCoverage

      if (collectCoverage) {
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
      if (collectCoverage) {
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
