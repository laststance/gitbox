/**
 * E2E Screenshot Test: User Story 2 - Repository Search and Add
 *
 * 目的: Repository検索・追加フローのスクリーンショットを撮影
 *
 * スクリーンショット対象:
 * 1. Empty search state (初期状態)
 * 2. Search results (検索結果表示)
 * 3. Multi-select state (複数選択状態)
 * 4. Filter UI (フィルターUI)
 * 5. Duplicate error (重複エラー表示)
 * 6. Loading state (ローディング状態)
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Supabase Admin クライアント
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

// テスト用ユーザーとボード
let testUser: {
  id: string
  email: string
  accessToken: string
  refreshToken: string
}
let testBoard: { id: string; name: string }

test.describe('User Story 2: Repository Search Screenshots', () => {
  test.beforeAll(async () => {
    // テスト用ユーザーを作成
    const { data: createUserResponse, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: 'us2-screenshot-user@example.com',
        password: 'us2-screenshot-password-123',
        email_confirm: true,
        user_metadata: {
          avatar_url: 'https://avatars.githubusercontent.com/u/888888',
          user_name: 'us2-screenshot-user',
        },
      })

    if (createUserError) throw createUserError

    const { data: sessionData, error: sessionError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: 'us2-screenshot-user@example.com',
        password: 'us2-screenshot-password-123',
      })

    if (sessionError) throw sessionError

    testUser = {
      id: createUserResponse.user.id,
      email: createUserResponse.user.email!,
      accessToken: sessionData.session!.access_token,
      refreshToken: sessionData.session!.refresh_token,
    }

    // テスト用ボードを作成
    const { data: boardData, error: boardError } = await supabaseAdmin
      .from('Board')
      .insert({
        user_id: testUser.id,
        name: 'US2 Screenshot Test Board',
        theme: 'ocean',
      })
      .select()
      .single()

    if (boardError) throw boardError
    testBoard = { id: boardData.id, name: boardData.name }
  })

  test.afterAll(async () => {
    // クリーンアップ
    if (testBoard) {
      await supabaseAdmin.from('Board').delete().eq('id', testBoard.id)
    }
    if (testUser) {
      await supabaseAdmin.auth.admin.deleteUser(testUser.id)
    }
  })

  test('Screenshot 1: Empty search state', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // "Add Repositories" ボタンをクリック
    const addButton = page.getByRole('button', {
      name: /Add Repositories|Repository.*追加/i,
    })
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Combobox が表示される
    const combobox = page.getByRole('combobox')
    await expect(combobox).toBeVisible()

    // スクリーンショット撮影
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/01-empty-search-state.png',
      fullPage: true,
    })
  })

  test('Screenshot 2: Search results', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Repository追加フローを開く
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // 検索キーワード入力
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')

    // 検索結果が表示されるまで待機
    await expect(page.getByRole('option').first()).toBeVisible()

    // スクリーンショット撮影
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/02-search-results.png',
      fullPage: true,
    })
  })

  test('Screenshot 3: Multi-select state', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Repository追加フローを開く
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // 検索して複数選択
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')
    await expect(page.getByRole('option').first()).toBeVisible()

    await page.getByRole('option', { name: /facebook\/react/i }).click()
    await page.getByRole('option', { name: /reactjs\/react.dev/i }).click()

    // 選択したリポジトリがバッジ表示される
    await expect(page.getByText('facebook/react')).toBeVisible()
    await expect(page.getByText('reactjs/react.dev')).toBeVisible()

    // スクリーンショット撮影
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/03-multi-select-state.png',
      fullPage: true,
    })
  })

  test('Screenshot 4: Filter UI', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Repository追加フローを開く
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // Owner filter を使用
    const ownerFilter = page.getByPlaceholder(/Filter by owner/i)
    if (await ownerFilter.isVisible()) {
      await ownerFilter.fill('facebook')
    }

    // 検索実行
    await page.getByPlaceholder(/Search repositories/i).fill('react')
    await expect(page.getByRole('option').first()).toBeVisible()

    // スクリーンショット撮影
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/04-filter-ui.png',
      fullPage: true,
    })
  })

  test('Screenshot 5: Duplicate error', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    // 既存リポジトリを追加
    const { error: insertError } = await supabaseAdmin.from('RepoCard').insert({
      board_id: testBoard.id,
      status_id: '00000000-0000-0000-0000-000000000000', // Dummy status ID
      repo_owner: 'laststance',
      repo_name: 'gitbox',
      note: 'Already added for screenshot test',
      order: 0,
    })

    if (insertError) console.error('Insert error:', insertError)

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Repository追加試行
    await page.getByRole('button', { name: /Add Repositories/i }).click()
    await page.getByPlaceholder(/Search repositories/i).fill('gitbox')
    await page.getByRole('option', { name: /laststance\/gitbox/i }).click()
    await page.getByRole('button', { name: /Add \(1\)/i }).click()

    // 重複エラーメッセージ表示を待機
    const errorMessage = page.getByRole('alert')
    await expect(errorMessage).toBeVisible()

    // スクリーンショット撮影
    await page.screenshot({
      path: 'tests/e2e/screenshots/us2-repo-search/05-duplicate-error.png',
      fullPage: true,
    })
  })

  test('Screenshot 6: Loading state', async ({ page, context }) => {
    // 認証設定
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    await page.goto(`http://localhost:3000/ja/board/${testBoard.id}`)

    // Repository追加フローを開く
    await page.getByRole('button', { name: /Add Repositories/i }).click()

    // 検索開始（ローディング状態をキャプチャするため、すぐにスクリーンショット）
    const searchInput = page.getByPlaceholder(/Search repositories/i)
    await searchInput.fill('react')

    // ローディングインジケーターが表示される可能性がある
    const loadingIndicator = page.getByRole('status')
    if (await loadingIndicator.isVisible({ timeout: 500 }).catch(() => false)) {
      // スクリーンショット撮影
      await page.screenshot({
        path: 'tests/e2e/screenshots/us2-repo-search/06-loading-state.png',
        fullPage: true,
      })
    } else {
      // ローディングが速すぎてキャプチャできない場合は、検索結果が表示される前の状態をキャプチャ
      await page.screenshot({
        path: 'tests/e2e/screenshots/us2-repo-search/06-loading-state.png',
        fullPage: true,
      })
    }
  })
})
