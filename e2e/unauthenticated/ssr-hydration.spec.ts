/**
 * SSR Hydration E2E Tests
 *
 * Verifies that Server-Side Rendering (SSR) and client hydration
 * work correctly without hydration mismatch errors.
 *
 * Tests for Phase 1 refactoring:
 * - useMounted hook with useSyncExternalStore
 * - FeaturesSection random subtitle
 *
 * @remarks
 * Hydration mismatches occur when the server-rendered HTML differs
 * from what the client expects to render. These tests verify that
 * our SSR-safe patterns work correctly.
 */

import { test, expect } from '../fixtures/coverage'

test.describe('SSR Hydration', () => {
  test('landing page should not have hydration mismatch errors', async ({
    page,
  }) => {
    // Collect console messages for hydration errors
    const hydrationErrors: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      // Check for React hydration-related errors
      if (
        text.includes('Hydration') ||
        text.includes('hydration') ||
        text.includes('mismatch') ||
        text.includes('did not match') ||
        text.includes('server-rendered HTML')
      ) {
        hydrationErrors.push(text)
      }
    })

    // Navigate to landing page
    await page.goto('/')

    // Wait for hydration to complete
    await page.waitForLoadState('networkidle')

    // No hydration errors should occur
    expect(hydrationErrors).toHaveLength(0)
  })

  test('landing page features section should render correctly', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Features section should be visible
    const featuresSection = page.locator('#features')
    await expect(featuresSection).toBeVisible()

    // "For AI Era Developers" heading should be visible
    const heading = page.getByRole('heading', {
      name: /for ai era developers/i,
    })
    await expect(heading).toBeVisible()

    // Subtitle should be one of the FEATURE_SUBTITLES
    const expectedSubtitles = [
      'Tame the repo chaos from AI-powered development',
      'Your repos multiply faster than ever. We help you stay organized.',
      'Ship fast with AI. Stay organized with GitBox.',
      'In the age of vibe coding, chaos needs a home.',
      'Build more than ever. Lose track of nothing.',
    ]

    // Get subtitle text
    const subtitle = featuresSection.locator('p.text-lg').first()
    await expect(subtitle).toBeVisible()
    const subtitleText = await subtitle.textContent()

    // Should match one of the expected subtitles
    expect(expectedSubtitles).toContain(subtitleText?.trim())
  })

  test('landing page should display all feature cards', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check for feature cards
    const featureCards = [
      'Kanban Board',
      'Drag & Drop',
      'Project Info',
      'Maintenance Mode',
    ]

    for (const feature of featureCards) {
      const card = page.getByRole('heading', { name: feature, level: 3 })
      await expect(card).toBeVisible()
    }
  })

  test('landing page should not flash or flicker during hydration', async ({
    page,
  }) => {
    // Navigate to landing page
    await page.goto('/')

    // The hero section should be visible immediately (SSR)
    const heroHeading = page.getByRole('heading', { level: 1 })
    await expect(heroHeading).toBeVisible({ timeout: 1000 })

    // Wait for full hydration
    await page.waitForLoadState('networkidle')

    // Hero should still be visible (no flashing)
    await expect(heroHeading).toBeVisible()
  })

  test('kanban preview should render without errors', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Kanban preview columns should be visible
    const ideaColumn = page.locator('[data-testid="kanban-column-idea"]')
    await expect(ideaColumn).toBeVisible()

    // Cards should be visible
    const aiAgentCard = page.locator('[data-testid="kanban-card-ai-agent"]')
    await expect(aiAgentCard).toBeVisible()
  })
})
