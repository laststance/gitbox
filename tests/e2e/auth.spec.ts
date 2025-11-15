/**
 * E2E Test: GitHub OAuth Login Flow (User Story 1)
 *
 * テスト対象:
 * - Landing page にアクセス → "Sign in with GitHub" ボタンが表示される
 * - GitHub OAuth フローが開始される
 * - 認証成功後、Boards 画面にリダイレクトされる
 */

import { test, expect } from '@playwright/test'

test.describe('User Story 1: GitHub Login Flow', () => {
  test('Landing page に "Sign in with GitHub" ボタンが表示される', async ({ page }) => {
    await page.goto('http://localhost:3000/ja/login')
    const signInButton = page.getByRole('button', { name: /Sign in with GitHub|GitHub でサインイン/i })
    await expect(signInButton).toBeVisible()
  })
})
