/**
 * Landing Page E2E Tests
 *
 * Tests for the public landing page (unauthenticated)
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Landing Page', () => {
  test('should display the landing page with hero section', async ({
    page,
  }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/GitBox/)

    // Check for main heading
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()

    // Check for login/get started button (it's a button, not a link)
    const loginButton = page.getByRole('button', {
      name: /get started|sign in|github/i,
    })
    await expect(loginButton.first()).toBeVisible()
  })

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/')

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded')

    // Check for navigation links
    const navLinks = page.getByRole('link', {
      name: /features|how it works|github/i,
    })
    await expect(navLinks.first()).toBeVisible()

    // Navigation should have multiple links
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)
  })

  test('should navigate to login when clicking sign in', async ({ page }) => {
    await page.goto('/')

    // Find and click the sign in button in the header
    const loginButton = page
      .getByRole('button', {
        name: /sign in with github/i,
      })
      .first()
    await loginButton.click()

    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Page should still be functional
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
  })

  test('hero names the product without a fade-in class', async ({ page }) => {
    // protects=Hero h1 names the product; fails_when=Like Never Before or Manage GitHub Repos remains; no_claim=visual line count at a named viewport
    await page.goto('/')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText(/Your GitHub repositories,/)
    await expect(heading).toHaveText(/on a Kanban board/)
    await expect(heading).not.toHaveText(/Like Never Before/)
    await expect(heading).not.toHaveText(/Manage GitHub Repos/)
  })

  test('hero heading is visible without an entrance fade', async ({ page }) => {
    // protects=Hero h1 is not faded in; fails_when=opacity-0 or animate-fade-in is on the h1; no_claim=other entrance effects on Glow
    await page.goto('/')

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).not.toHaveClass(/opacity-0/)
    await expect(heading).not.toHaveClass(/animate-fade-in/)
    await expect(heading).toHaveCSS('opacity', '1')
  })

  test('features heading says what GitBox does', async ({ page }) => {
    // protects=Features heading and subtitle are the locked product sentence; fails_when=For AI Era Developers or a random old subtitle; no_claim=other marketing tone
    await page.goto('/')

    const heading = page.getByRole('heading', {
      level: 2,
      name: 'A Kanban board for your GitHub repositories',
    })
    await expect(heading).toBeVisible()
    await expect(
      page.getByText(
        'Add repositories, drag them between columns, and keep a note with each one.',
      ),
    ).toBeVisible()
  })

  test('Kanban Board card is wider than the other feature cards at 1280px', async ({
    page,
  }) => {
    // protects=Kanban Board is at least 1.5× each sibling at 1280px; fails_when=four equal-width cells; no_claim=padding, title size, or DOM order
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')

    const featured = page.getByTestId('feature-card-kanban-board')
    const siblings = [
      page.getByTestId('feature-card-drag-drop'),
      page.getByTestId('feature-card-project-info'),
      page.getByTestId('feature-card-set-work-aside'),
    ]

    const featuredBox = await featured.boundingBox()
    expect(featuredBox).not.toBeNull()

    for (const sibling of siblings) {
      const box = await sibling.boundingBox()
      expect(box).not.toBeNull()
      expect(featuredBox!.width).toBeGreaterThanOrEqual(box!.width * 1.5)
    }
  })

  test('landing section headings use Source Serif', async ({ page }) => {
    // protects=all four landing section headings list Source Serif in computed font-family; fails_when=any of those four is only the system stack; no_claim=woff2 bytes downloaded, signed-in routes
    await page.goto('/')

    const headings = [
      page.getByRole('heading', { level: 1 }),
      page.getByRole('heading', {
        level: 2,
        name: 'A Kanban board for your GitHub repositories',
      }),
      page.getByRole('heading', { level: 2, name: 'How It Works' }),
      page.getByRole('heading', {
        level: 2,
        name: 'Ready to Organize Your Repos?',
      }),
    ]

    for (const heading of headings) {
      const family = await heading.evaluate(
        (node) => getComputedStyle(node).fontFamily,
      )
      expect(family).toMatch(/Source Serif/)
    }
  })
})
