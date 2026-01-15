/**
 * Page Title E2E Tests - Unauthenticated Pages
 *
 * Verifies that page titles follow the correct format:
 * - Template: "{PageTitle} | GitBox"
 * - No duplicate "GitBox" in titles
 */

import { test, expect } from '../fixtures/coverage'

test.describe('Page Titles (Unauthenticated)', () => {
  test('login page title should be "Login | GitBox"', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle('Login | GitBox')
  })

  test('privacy policy page title should be "Privacy Policy | GitBox"', async ({
    page,
  }) => {
    await page.goto('/privacy')
    await expect(page).toHaveTitle('Privacy Policy | GitBox')
  })

  test('terms of use page title should be "Terms of Use | GitBox"', async ({
    page,
  }) => {
    await page.goto('/terms')
    await expect(page).toHaveTitle('Terms of Use | GitBox')
  })

  test('landing page title should be default', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('GitBox - GitHub Repository Manager')
  })

  test('no page should have duplicate GitBox in title', async ({ page }) => {
    const publicPages = ['/login', '/privacy', '/terms']

    for (const path of publicPages) {
      await page.goto(path)
      const title = await page.title()
      const gitboxCount = (title.match(/GitBox/gi) || []).length

      expect(gitboxCount, `${path} has duplicate GitBox: "${title}"`).toBe(1)
    }
  })
})
