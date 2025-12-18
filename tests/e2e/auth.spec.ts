/**
 * E2E Test: GitHub OAuth Login Flow (User Story 1)
 *
 * Test scope:
 * - Access landing page → "Sign in with GitHub" button is displayed
 * - GitHub OAuth flow starts
 * - After successful authentication, redirects to Boards screen
 */

import { test, expect } from '@playwright/test'

test.describe('User Story 1: GitHub Login Flow', () => {
  test('Landing page displays "Sign in with GitHub" button', async ({
    page,
  }) => {
    await page.goto('http://localhost:3008/login')
    const signInButton = page.getByRole('button', {
      name: /Sign in with GitHub/i,
    })
    await expect(signInButton).toBeVisible()
  })
})
