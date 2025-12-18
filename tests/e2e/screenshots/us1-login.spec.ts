/**
 * E2E Screenshot Test: User Story 1 - GitHub Login Flow
 *
 * 目的: GitHub OAuth ログインフローのスクリーンショットを撮影
 *
 * スクリーンショット対象:
 * 1. Landing page with "Sign in with GitHub" button
 * 2. Boards screen after successful authentication
 */

import { test, expect } from '@playwright/test'

test.describe('User Story 1: Login Flow Screenshots', () => {
  test('Screenshot 1: Landing page', async ({ page }) => {
    await page.goto('http://localhost:3000/ja/login')
    const signInButton = page.getByRole('button', {
      name: /Sign in with GitHub|GitHub でサインイン/i,
    })
    await expect(signInButton).toBeVisible()
    await page.screenshot({
      path: 'tests/e2e/screenshots/us1-login/01-landing-page.png',
      fullPage: true,
    })
  })
})
